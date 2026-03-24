import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/telegram';
const MAX_RUNTIME_MS = 55_000;
const MIN_REMAINING_MS = 5_000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) return errorResponse('LOVABLE_API_KEY is not configured');

  const TELEGRAM_API_KEY = Deno.env.get('TELEGRAM_API_KEY');
  if (!TELEGRAM_API_KEY) return errorResponse('TELEGRAM_API_KEY is not configured');

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let totalProcessed = 0;

  try {
    // Read initial offset
    const { data: state, error: stateErr } = await supabase
      .from('telegram_bot_state')
      .select('update_offset')
      .eq('id', 1)
      .single();

    if (stateErr) return errorResponse(stateErr.message);

    let currentOffset = state.update_offset;

    // Poll continuously until time runs out
    while (true) {
      const elapsed = Date.now() - startTime;
      const remainingMs = MAX_RUNTIME_MS - elapsed;
      if (remainingMs < MIN_REMAINING_MS) break;

      const timeout = Math.min(50, Math.floor(remainingMs / 1000) - 5);
      if (timeout < 1) break;

      const response = await fetch(`${GATEWAY_URL}/getUpdates`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'X-Connection-Api-Key': TELEGRAM_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          offset: currentOffset,
          timeout,
          allowed_updates: ['message'],
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        console.error('getUpdates failed:', data);
        return errorResponse(`Telegram API failed [${response.status}]`);
      }

      const updates = data.result ?? [];
      if (updates.length === 0) continue;

      // Process each update
      for (const update of updates) {
        if (!update.message) continue;

        const msg = update.message;
        const hasDocument = !!(msg.document && msg.document.mime_type === 'application/pdf');

        // Store message
        const row = {
          update_id: update.update_id,
          chat_id: msg.chat.id,
          text: msg.text || msg.caption || null,
          has_document: hasDocument,
          document_file_id: hasDocument ? msg.document.file_id : null,
          document_file_name: hasDocument ? msg.document.file_name : null,
          is_processed: false,
          raw_update: update,
        };

        const { error: insertErr } = await supabase
          .from('telegram_messages')
          .upsert(row, { onConflict: 'update_id' });

        if (insertErr) {
          console.error('Insert error:', insertErr);
          continue;
        }

        // Process as research report
        try {
          await processAsResearch(supabase, row, LOVABLE_API_KEY, TELEGRAM_API_KEY);
          totalProcessed++;
        } catch (err) {
          console.error('Processing error for update', update.update_id, err);
        }
      }

      // Advance offset
      const newOffset = Math.max(...updates.map((u: any) => u.update_id)) + 1;
      await supabase
        .from('telegram_bot_state')
        .update({ update_offset: newOffset, updated_at: new Date().toISOString() })
        .eq('id', 1);

      currentOffset = newOffset;
    }

    return new Response(
      JSON.stringify({ ok: true, processed: totalProcessed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Polling error:', err);
    return errorResponse(err instanceof Error ? err.message : 'Unknown error');
  }
});

function errorResponse(message: string) {
  return new Response(
    JSON.stringify({ error: message }),
    { status: 500, headers: { 'Content-Type': 'application/json' } }
  );
}

async function processAsResearch(
  supabase: any,
  msg: any,
  lovableKey: string,
  telegramKey: string
) {
  const messageText = msg.text || '';

  // Skip if no meaningful content and no document
  if (!messageText.trim() && !msg.has_document) return;

  // Use AI to parse the message into research metadata
  const parsed = await parseWithAI(messageText, lovableKey);

  // Download and upload PDF if present
  let pdfPath: string | null = null;
  if (msg.has_document && msg.document_file_id) {
    pdfPath = await downloadAndUploadPdf(
      supabase,
      msg.document_file_id,
      msg.document_file_name || 'research.pdf',
      lovableKey,
      telegramKey
    );
  }

  // Create research report
  const payload = {
    title_en: parsed.title_en || messageText.slice(0, 100) || 'Telegram Research',
    title_ko: parsed.title_ko || parsed.title_en || messageText.slice(0, 100) || '텔레그램 리서치',
    category: parsed.category || 'market_update',
    summary_en: parsed.summary_en || null,
    summary_ko: parsed.summary_ko || null,
    admin_note: `Auto-posted from Telegram (chat: ${msg.chat_id})`,
    pdf_url: pdfPath,
    external_url: parsed.external_url || null,
    publication_date: new Date().toISOString().split('T')[0],
    is_active: true,
  };

  const { data: report, error: reportErr } = await supabase
    .from('research_reports')
    .insert(payload)
    .select('id')
    .single();

  if (reportErr) {
    console.error('Failed to create research report:', reportErr);
    throw reportErr;
  }

  // Mark message as processed
  await supabase
    .from('telegram_messages')
    .update({
      is_processed: true,
      processed_at: new Date().toISOString(),
      research_report_id: report.id,
    })
    .eq('update_id', msg.update_id);

  // Notify all admins via in-app notification
  const titleDisplay = payload.title_ko || payload.title_en;
  const truncatedTitle = titleDisplay.length > 60 ? titleDisplay.slice(0, 60) + '...' : titleDisplay;

  const { data: adminRoles } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('role', 'admin');

  if (adminRoles && adminRoles.length > 0) {
    const notifications = adminRoles.map((r: any) => ({
      user_id: r.user_id,
      type: 'research',
      title_en: `New Research from Telegram`,
      title_ko: `텔레그램 리서치 자동 게시`,
      body_en: `"${truncatedTitle}" has been auto-posted from Telegram.`,
      body_ko: `"${truncatedTitle}"이(가) 텔레그램에서 자동 게시되었습니다.`,
      link: '/admin',
    }));

    const { error: notifErr } = await supabase.from('notifications').insert(notifications);
    if (notifErr) console.error('Failed to send admin notifications:', notifErr);
  }

  console.log('Created research report:', report.id, 'from Telegram update:', msg.update_id);
}

async function parseWithAI(text: string, lovableKey: string) {
  if (!text.trim()) {
    return {
      title_en: 'Research Report',
      title_ko: '리서치 리포트',
      category: 'market_update',
      summary_en: null,
      summary_ko: null,
      external_url: null,
    };
  }

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a research report metadata extractor. Given a forwarded message, extract:
- title_en: English title (concise, max 100 chars)
- title_ko: Korean title (concise, max 100 chars). If the original is Korean, translate to English for title_en. If original is English, translate to Korean for title_ko.
- category: one of "market_update", "product_analysis", "economic_outlook". Default to "market_update".
- summary_en: Brief English summary (1-3 sentences, max 500 chars)
- summary_ko: Brief Korean summary (1-3 sentences, max 500 chars)
- external_url: Extract any URL found in the text, or null

Respond ONLY with valid JSON, no markdown.`,
          },
          { role: 'user', content: text },
        ],
        temperature: 0.3,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      console.error('AI parse failed:', response.status);
      return fallbackParse(text);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Try to parse JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return fallbackParse(text);
  } catch (err) {
    console.error('AI parsing error:', err);
    return fallbackParse(text);
  }
}

function fallbackParse(text: string) {
  // Extract URL if present
  const urlMatch = text.match(/https?:\/\/[^\s]+/);

  return {
    title_en: text.slice(0, 100),
    title_ko: text.slice(0, 100),
    category: 'market_update',
    summary_en: text.slice(0, 500) || null,
    summary_ko: null,
    external_url: urlMatch ? urlMatch[0] : null,
  };
}

async function downloadAndUploadPdf(
  supabase: any,
  fileId: string,
  originalName: string,
  lovableKey: string,
  telegramKey: string
): Promise<string | null> {
  try {
    // Step 1: Get file path from Telegram
    const fileResponse = await fetch(`${GATEWAY_URL}/getFile`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableKey}`,
        'X-Connection-Api-Key': telegramKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ file_id: fileId }),
    });

    const fileData = await fileResponse.json();
    if (!fileResponse.ok) {
      console.error('getFile failed:', fileData);
      return null;
    }

    const filePath = fileData.result.file_path;

    // Step 2: Download the file
    const downloadResponse = await fetch(`${GATEWAY_URL}/file/${filePath}`, {
      headers: {
        'Authorization': `Bearer ${lovableKey}`,
        'X-Connection-Api-Key': telegramKey,
      },
    });

    if (!downloadResponse.ok) {
      console.error('File download failed:', downloadResponse.status);
      return null;
    }

    const fileBytes = new Uint8Array(await downloadResponse.arrayBuffer());

    // Step 3: Upload to Supabase Storage
    const sanitizedName = `${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from('research-documents')
      .upload(sanitizedName, fileBytes, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload failed:', uploadError);
      return null;
    }

    console.log('Uploaded PDF:', sanitizedName, 'original:', originalName);
    return sanitizedName;
  } catch (err) {
    console.error('PDF download/upload error:', err);
    return null;
  }
}
