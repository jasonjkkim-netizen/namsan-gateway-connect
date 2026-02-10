import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'npm:resend@2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface IndexResult {
  symbol: string;
  name: string;
  currentValue: number | null;
  changeValue: number | null;
  changePercent: number | null;
  error?: string;
}

const ADMIN_EMAIL = "jason.jk.kim@gmail.com";

async function sendFailureNotification(failedIndices: IndexResult[], totalIndices: number) {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) {
    console.warn('RESEND_API_KEY not configured, skipping failure notification');
    return;
  }

  const resend = new Resend(resendApiKey);
  const now = new Date();
  const koreaTime = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(now);

  const failedList = failedIndices.map(i =>
    `<tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${i.name}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${i.symbol}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; color: #dc2626;">${i.error || 'Unknown error'}</td>
    </tr>`
  ).join('');

  try {
    await resend.emails.send({
      from: "Namsan Korea <onboarding@resend.dev>",
      to: [ADMIN_EMAIL],
      subject: `[Namsan Korea] 시장 지수 업데이트 실패 알림 - ${failedIndices.length}/${totalIndices} 지수`,
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: sans-serif;">
          <div style="background: linear-gradient(135deg, #dc2626, #ef4444); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0;">⚠️ 시장 지수 업데이트 실패</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border: 1px solid #eee;">
            <p>성공: ${totalIndices - failedIndices.length} / 실패: ${failedIndices.length}</p>
            <table style="width: 100%; border-collapse: collapse;">
              <thead><tr><th style="text-align:left;padding:8px;">지수명</th><th style="text-align:left;padding:8px;">심볼</th><th style="text-align:left;padding:8px;">오류</th></tr></thead>
              <tbody>${failedList}</tbody>
            </table>
            <p style="color: #666; font-size: 14px;">업데이트 시간: ${koreaTime} (KST)</p>
          </div>
        </div>
      `,
    });
    console.log('Failure notification email sent');
  } catch (emailError) {
    console.error('Failed to send notification email:', emailError);
  }
}

function parsePerplexityLine(line: string, symbol: string): { value: number; change: number; percent: number } | null {
  // Remove citation markers like [1], [3]
  const cleaned = line.replace(/\[\d+\]/g, '').trim();
  
  // Skip N/A lines
  if (cleaned.includes('N/A') || cleaned.includes('not available')) return null;

  // Find the value after the symbol
  const escapedSymbol = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const lineMatch = cleaned.match(new RegExp(`${escapedSymbol}[:\\s]+([\\d,]+\\.?\\d*)`, 'i'));
  if (!lineMatch) return null;

  const value = parseFloat(lineMatch[1].replace(/,/g, ''));
  if (isNaN(value) || value <= 0) return null;

  // Try to extract change and percent
  let change = 0;
  let percent = 0;

  // Handle "flat" or "0%" cases
  if (cleaned.includes('flat') || cleaned.match(/\(0[,\s]*0%\)/)) {
    return { value, change: 0, percent: 0 };
  }

  // Pattern: (+/-VALUE, +/-PERCENT%) or just numbers after the value
  const changeMatch = cleaned.match(/([+-]?\d[\d,]*\.?\d*)[,\s]+([+-]?\d[\d,]*\.?\d*)%/);
  if (changeMatch) {
    change = parseFloat(changeMatch[1].replace(/,/g, ''));
    percent = parseFloat(changeMatch[2].replace(/,/g, ''));
  }

  return { value, change: isNaN(change) ? 0 : change, percent: isNaN(percent) ? 0 : percent };
}

function parsePerplexityResponse(content: string, symbols: string[]): Record<string, { value: number; change: number; percent: number }> {
  const results: Record<string, { value: number; change: number; percent: number }> = {};
  const lines = content.split('\n');

  for (const symbol of symbols) {
    // Find the line containing this symbol
    const escapedSymbol = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matchingLine = lines.find(line => new RegExp(escapedSymbol, 'i').test(line));
    if (matchingLine) {
      const parsed = parsePerplexityLine(matchingLine, symbol);
      if (parsed) {
        results[symbol] = parsed;
      }
    }
  }

  return results;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const isAutoUpdate = body.autoUpdate === true;
    const updateOverview = body.updateOverview === true;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
    if (!PERPLEXITY_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'PERPLEXITY_API_KEY is not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch active indices from database
    const { data: activeIndices, error: idxError } = await supabase
      .from('market_indices')
      .select('id, symbol, name_ko, name_en, current_value')
      .eq('is_active', true);

    if (idxError || !activeIndices?.length) {
      return new Response(
        JSON.stringify({ success: false, error: 'No active indices found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build the prompt with all index symbols
    const symbolList = activeIndices.map(i => `${i.symbol} (${i.name_en})`).join(', ');
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    console.log(`Fetching market data via Perplexity for: ${symbolList}`);

    const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          {
            role: 'system',
            content: 'You are a financial data assistant. Return ONLY the requested data in the exact format specified. Every line must have a numeric value - never write N/A. No explanations.',
          },
          {
            role: 'user',
            content: `What are the most recent closing prices for these stock market indices? Search for each one individually.

${activeIndices.map(i => `- ${i.symbol} (${i.name_en})`).join('\n')}

IMPORTANT: You MUST provide a numeric value for EVERY index. Search finance sites like Yahoo Finance, Google Finance, Investing.com.

Format EXACTLY like this (one per line):
${activeIndices.map(i => `${i.symbol}: [price] ([change], [change_pct]%)`).join('\n')}

Example: KOSPI: 2,650.31 (+15.23, +0.58%)
If change is zero: KOSPI: 2,650.31 (0.00, 0.00%)`,
          },
        ],
        search_recency_filter: 'week',
      }),
    });

    if (!perplexityResponse.ok) {
      const errText = await perplexityResponse.text();
      console.error('Perplexity API error:', perplexityResponse.status, errText);
      return new Response(
        JSON.stringify({ success: false, error: `Perplexity API error [${perplexityResponse.status}]` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const perplexityData = await perplexityResponse.json();
    const content = perplexityData.choices?.[0]?.message?.content || '';
    console.log('Perplexity response:', content);

    const symbols = activeIndices.map(i => i.symbol);
    const parsed = parsePerplexityResponse(content, symbols);

    const results: IndexResult[] = [];

    for (const index of activeIndices) {
      const data = parsed[index.symbol];
      if (data) {
        results.push({
          symbol: index.symbol,
          name: index.name_ko,
          currentValue: data.value,
          changeValue: data.change,
          changePercent: data.percent,
        });

        // Update DB
        const { error: updateError } = await supabase
          .from('market_indices')
          .update({
            current_value: data.value,
            change_value: data.change,
            change_percent: data.percent,
            updated_at: new Date().toISOString(),
          })
          .eq('id', index.id);

        if (updateError) {
          console.error(`Failed to update ${index.symbol}:`, updateError);
        } else {
          console.log(`Updated ${index.name_ko}: ${data.value}`);
        }
      } else {
        results.push({
          symbol: index.symbol,
          name: index.name_ko,
          currentValue: null,
          changeValue: null,
          changePercent: null,
          error: 'Could not parse data from Perplexity response',
        });
      }
    }

    // Also update market overview items if requested
    let overviewResults: any[] = [];
    if (updateOverview) {
      const { data: overviewItems } = await supabase
        .from('market_overview_items')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (overviewItems?.length) {
        const overviewSymbols = overviewItems.map(i => `${i.title_en} (${i.symbol})`).join(', ');

        const overviewResponse = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'sonar-pro',
            messages: [
              {
                role: 'system',
                content: 'You are a financial data assistant. Return ONLY the requested data in the exact format specified. Every line must have a numeric value - never write N/A. No explanations.',
              },
              {
                role: 'user',
                content: `What are the most recent prices for these financial instruments? Search for each one individually on Yahoo Finance, Google Finance, or Investing.com.

${overviewItems.map(i => `- ${i.symbol} (${i.title_en})`).join('\n')}

IMPORTANT: You MUST provide a numeric value for EVERY item.

Format EXACTLY like this (one per line, use the full symbol including prefix):
${overviewItems.map(i => `${i.symbol}: [price] ([change], [change_pct]%)`).join('\n')}

Example: TVC:GOLD: 2,875.30 (+12.50, +0.44%)
If change is zero: TVC:GOLD: 2,875.30 (0.00, 0.00%)`,
              },
            ],
            search_recency_filter: 'week',
          }),
        });

        if (overviewResponse.ok) {
          const overviewData = await overviewResponse.json();
          const overviewContent = overviewData.choices?.[0]?.message?.content || '';
          console.log('Overview Perplexity response:', overviewContent);

          for (const item of overviewItems) {
            const parsed = parsePerplexityLine(
              overviewContent.split('\n').find(line => line.includes(item.symbol)) || '',
              item.symbol
            );
            if (parsed) {
              await supabase
                .from('market_overview_items')
                .update({
                  current_value: parsed.value,
                  change_value: parsed.change,
                  change_percent: parsed.percent,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', item.id);

              overviewResults.push({ symbol: item.symbol, title: item.title_en, ...parsed });
            } else {
              overviewResults.push({ symbol: item.symbol, title: item.title_en, error: 'Could not parse' });
            }
          }
        }
      }
    }

    // Send failure notification if auto-update
    if (isAutoUpdate) {
      const failedIndices = results.filter(r => !r.currentValue || r.error);
      if (failedIndices.length > 0) {
        await sendFailureNotification(failedIndices, results.length);
      }
    }

    return new Response(
      JSON.stringify({ success: true, data: results, overview: overviewResults }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching market indices:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
