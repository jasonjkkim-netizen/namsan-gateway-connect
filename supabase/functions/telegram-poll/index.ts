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

  // Skip bot commands (e.g. /start, /help)
  if (messageText.trim().startsWith('/')) return;

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

  // Send email/kakao alerts if 'research' category is enabled
  await sendResearchAlert(supabase, payload);

  console.log('Created research report:', report.id, 'from Telegram update:', msg.update_id);
}

// Try structured format first: [제목]/[Title], [요약]/[Summary], [카테고리]/[Category]
function tryStructuredParse(text: string): ReturnType<typeof fallbackParse> | null {
  const lines = text.split('\n');
  const fields: Record<string, string> = {};
  let currentKey = '';
  let currentLines: string[] = [];

  const keyMap: Record<string, string> = {
    '제목': 'title', 'title': 'title',
    '요약': 'summary', 'summary': 'summary',
    '카테고리': 'category', 'category': 'category',
    'url': 'url', '링크': 'url',
  };

  for (const line of lines) {
    const match = line.match(/^\[([^\]]+)\]\s*(.*)/i);
    if (match) {
      if (currentKey) fields[currentKey] = currentLines.join('\n').trim();
      const rawKey = match[1].trim().toLowerCase();
      currentKey = keyMap[rawKey] || rawKey;
      currentLines = match[2] ? [match[2]] : [];
    } else if (currentKey) {
      currentLines.push(line);
    }
  }
  if (currentKey) fields[currentKey] = currentLines.join('\n').trim();

  // Must have at least a title to count as structured
  if (!fields.title) return null;

  const urlMatch = text.match(/https?:\/\/[^\s]+/);

  return {
    title_en: fields.title,
    title_ko: fields.title,
    category: fields.category || 'market_update',
    summary_en: fields.summary || null,
    summary_ko: fields.summary || null,
    external_url: fields.url || (urlMatch ? urlMatch[0] : null),
    _structured: true,
  };
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

  // 1) Try structured format first
  const structured = tryStructuredParse(text);
  if (structured) {
    console.log('Parsed with structured format:', structured.title_en);
    // If structured has Korean title, use AI only for translation
    return await translateStructured(structured, text, lovableKey);
  }

  // 2) Fall back to AI parsing
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
- summary_en: Brief English summary (1-3 sentences, max 500 chars). This should be a concise overview separate from the title.
- summary_ko: Brief Korean summary (1-3 sentences, max 500 chars). This should be a concise overview separate from the title.
- external_url: Extract any URL found in the text, or null

IMPORTANT: title and summary MUST be different. Title is a short headline. Summary is a brief description of the content.

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

// Translate structured fields if needed (e.g., Korean title → English title)
async function translateStructured(parsed: any, originalText: string, lovableKey: string) {
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
            content: `You translate research report fields between Korean and English. Given structured data, provide translations.
Return JSON with: title_en, title_ko, summary_en, summary_ko, category (one of: market_update, product_analysis, economic_outlook).
Keep original values, add translations for the other language.
Respond ONLY with valid JSON, no markdown.`,
          },
          {
            role: 'user',
            content: JSON.stringify({
              title: parsed.title_en,
              summary: parsed.summary_en,
              category: parsed.category,
            }),
          },
        ],
        temperature: 0.2,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      await response.text();
      return parsed;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const translated = JSON.parse(jsonMatch[0]);
      return {
        title_en: translated.title_en || parsed.title_en,
        title_ko: translated.title_ko || parsed.title_ko,
        category: translated.category || parsed.category,
        summary_en: translated.summary_en || parsed.summary_en,
        summary_ko: translated.summary_ko || parsed.summary_ko,
        external_url: parsed.external_url,
      };
    }
    return parsed;
  } catch {
    return parsed;
  }
}

function fallbackParse(text: string) {
  const urlMatch = text.match(/https?:\/\/[^\s]+/);
  
  // Try to split first line as title, rest as summary
  const lines = text.trim().split('\n');
  const title = lines[0]?.slice(0, 100) || text.slice(0, 100);
  const summaryText = lines.length > 1 ? lines.slice(1).join('\n').trim().slice(0, 500) : null;

  return {
    title_en: title,
    title_ko: title,
    category: 'market_update',
    summary_en: summaryText,
    summary_ko: summaryText,
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

async function sendResearchAlert(supabase: any, payload: any) {
  try {
    // Check if 'research' alert category is enabled (email channel)
    const { data: emailSetting } = await supabase
      .from('alert_settings')
      .select('is_enabled')
      .eq('category', 'research')
      .eq('channel', 'email')
      .maybeSingle();

    const emailEnabled = emailSetting?.is_enabled !== false; // default true

    if (emailEnabled) {
      const subject = `[남산파트너스] 텔레그램 리서치 - 새로운 콘텐츠가 추가되었습니다`;
      const htmlContent = `
        <div style="margin-bottom: 16px;">
          <span style="display: inline-block; background: #e2e8f0; color: #1a365d; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600;">
            텔레그램 리서치 / Telegram Research
          </span>
        </div>
        <h2 style="color: #1a365d; margin: 0 0 8px; font-size: 18px;">${payload.title_ko}</h2>
        ${payload.title_en && payload.title_en !== payload.title_ko ? `<p style="color: #718096; margin: 0 0 16px; font-size: 14px;">${payload.title_en}</p>` : ''}
        <p style="color: #2d3748; margin: 0 0 8px; font-size: 14px;">새로운 콘텐츠가 추가되었습니다 / New content has been added</p>
        ${payload.summary_ko ? `<p style="color: #4a5568; margin: 16px 0 0; font-size: 13px; line-height: 1.6; border-left: 3px solid #1a365d; padding-left: 12px;">${payload.summary_ko.slice(0, 300)}</p>` : ''}
        <div style="margin-top: 24px;">
          <a href="https://namsan-gateway-connect.lovable.app/research" style="display: inline-block; background: #1a365d; color: white; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-size: 14px;">
            자세히 보기 / Read More
          </a>
        </div>
      `;

      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

      await fetch(`${supabaseUrl}/functions/v1/send-newsletter`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ subject, htmlContent }),
      });

      console.log('Research email alert sent');
    }

    // Check if kakao channel is enabled
    const { data: kakaoSetting } = await supabase
      .from('alert_settings')
      .select('is_enabled')
      .eq('category', 'research')
      .eq('channel', 'kakao')
      .maybeSingle();

    if (kakaoSetting?.is_enabled === true) {
      const kakaoMessage = `[남산파트너스] 텔레그램 리서치\n새로운 콘텐츠가 추가되었습니다\n\n${payload.title_ko}${payload.summary_ko ? '\n' + payload.summary_ko.slice(0, 200) : ''}`;
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

      await fetch(`${supabaseUrl}/functions/v1/send-kakao`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          message: kakaoMessage,
          templateObject: {
            object_type: 'text',
            text: kakaoMessage,
            link: {
              web_url: 'https://namsan-gateway-connect.lovable.app/research',
              mobile_web_url: 'https://namsan-gateway-connect.lovable.app/research',
            },
            button_title: '포털 방문',
          },
        }),
      });

      console.log('Research kakao alert sent');
    }

    // Check if SMS channel is enabled
    const { data: smsSetting } = await supabase
      .from('alert_settings')
      .select('is_enabled')
      .eq('category', 'research')
      .eq('channel', 'sms')
      .maybeSingle();

    if (smsSetting?.is_enabled === true) {
      const smsMessage = `[남산파트너스] 새 리서치: ${payload.title_ko.slice(0, 40)}`;
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

      await fetch(`${supabaseUrl}/functions/v1/send-sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ message: smsMessage }),
      });

      console.log('Research SMS alert sent');
    }
  } catch (err) {
    console.error('Failed to send research alerts:', err);
  }
}
