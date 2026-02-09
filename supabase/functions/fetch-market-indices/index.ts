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

interface IndexInput {
  id: string;
  symbol: string;
  name_ko: string;
  name_en: string;
  current_value: number;
}

const ADMIN_EMAIL = "jason.jk.kim@gmail.com";

// Mapping of symbols to scraping sources
const INDEX_SOURCES: Record<string, { url: string; type: 'naver' | 'investing' }> = {
  'KOSPI': { url: 'https://finance.naver.com/sise/sise_index.naver?code=KOSPI', type: 'naver' },
  'KOSDAQ': { url: 'https://finance.naver.com/sise/sise_index.naver?code=KOSDAQ', type: 'naver' },
  'NDX': { url: 'https://finance.naver.com/world/sise.naver?symbol=NAS@IXIC', type: 'naver' },
  'SPX': { url: 'https://finance.naver.com/world/sise.naver?symbol=SPI@SPX', type: 'naver' },
};

function parseKoreanNumber(str: string): number | null {
  if (!str) return null;
  const cleaned = str.replace(/,/g, '').replace(/[^\d.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function extractNaverIndexData(html: string, symbol: string): { value: number | null; change: number | null; percent: number | null } {
  let value: number | null = null;
  let change: number | null = null;
  let percent: number | null = null;

  // For Korean indices (KOSPI, KOSDAQ)
  if (symbol === 'KOSPI' || symbol === 'KOSDAQ') {
    // Pattern for main index value: <em id="now_value">2,650.00</em>
    const valueMatch = html.match(/<em id="now_value"[^>]*>([0-9,.]+)<\/em>/i);
    if (valueMatch) {
      value = parseKoreanNumber(valueMatch[1]);
    }

    // Pattern for change value
    const changeMatch = html.match(/class="(up|down)"[^>]*>[\s\S]*?<em[^>]*>([0-9,.]+)<\/em>/i);
    if (changeMatch) {
      const changeVal = parseKoreanNumber(changeMatch[2]);
      if (changeVal !== null) {
        change = changeMatch[1] === 'down' ? -changeVal : changeVal;
      }
    }

    // Pattern for change percent
    const percentMatch = html.match(/\(([+-]?[0-9,.]+)%\)/i);
    if (percentMatch) {
      percent = parseKoreanNumber(percentMatch[1]);
    }
  } else {
    // For international indices on Naver (NDX, SPX)
    // Pattern: class="no_today" followed by the value
    const valueMatch = html.match(/<span class="no_today"[^>]*>[\s\S]*?<span>([0-9,.]+)<\/span>/i) ||
                       html.match(/<em class="[^"]*k_value[^"]*"[^>]*>([0-9,.]+)<\/em>/i) ||
                       html.match(/class="value"[^>]*>([0-9,.]+)</i);
    if (valueMatch) {
      value = parseKoreanNumber(valueMatch[1]);
    }

    // Change and percent for international
    const changeAreaMatch = html.match(/class="(up|down|same)"[^>]*>[\s\S]*?<span[^>]*>([0-9,.]+)<\/span>[\s\S]*?\(([+-]?[0-9,.]+)%\)/i);
    if (changeAreaMatch) {
      const changeVal = parseKoreanNumber(changeAreaMatch[2]);
      if (changeVal !== null) {
        change = changeAreaMatch[1] === 'down' ? -changeVal : changeVal;
      }
      percent = parseKoreanNumber(changeAreaMatch[3]);
    }
  }

  return { value, change, percent };
}

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
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #dc2626, #ef4444); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border: 1px solid #eee; }
            .stats { display: flex; justify-content: space-around; margin: 20px 0; text-align: center; }
            .stat-box { background: white; padding: 15px 25px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .stat-number { font-size: 28px; font-weight: bold; }
            .stat-label { font-size: 12px; color: #666; }
            .success { color: #16a34a; }
            .failure { color: #dc2626; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; background: white; }
            th { text-align: left; padding: 12px 8px; background: #f0f0f0; border-bottom: 2px solid #ddd; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            .cta-button { display: inline-block; background: #B8860B; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">⚠️ 시장 지수 업데이트 실패</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">Market Index Update Failed</p>
            </div>
            <div class="content">
              <p>안녕하세요,</p>
              <p>자동 시장 지수 업데이트 중 일부 지수의 데이터를 가져오지 못했습니다.</p>
              
              <div class="stats">
                <div class="stat-box">
                  <div class="stat-number success">${totalIndices - failedIndices.length}</div>
                  <div class="stat-label">성공</div>
                </div>
                <div class="stat-box">
                  <div class="stat-number failure">${failedIndices.length}</div>
                  <div class="stat-label">실패</div>
                </div>
              </div>
              
              <h3>실패한 지수 목록</h3>
              <table>
                <thead>
                  <tr>
                    <th>지수명</th>
                    <th>심볼</th>
                    <th>오류 내용</th>
                  </tr>
                </thead>
                <tbody>
                  ${failedList}
                </tbody>
              </table>
              
              <p style="color: #666; font-size: 14px;">
                <strong>업데이트 시간:</strong> ${koreaTime} (KST)
              </p>
              
              <center>
                <a href="https://namsan-gateway-connect.lovable.app/admin" class="cta-button">
                  관리자 패널로 이동 →
                </a>
              </center>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Namsan Korea. All rights reserved.</p>
              <p>This is an automated notification from Namsan Korea Market Data System.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });
    console.log('Failure notification email sent to admin');
  } catch (emailError) {
    console.error('Failed to send notification email:', emailError);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const isAutoUpdate = body.autoUpdate === true;
    let indicesToUpdate: IndexInput[] = body.indices || [];

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // If auto-update or no indices provided, fetch active indices from database
    if (isAutoUpdate || indicesToUpdate.length === 0) {
      const { data: activeIndices, error } = await supabase
        .from('market_indices')
        .select('id, symbol, name_ko, name_en, current_value')
        .eq('is_active', true);

      if (error) {
        console.error('Failed to fetch active indices:', error);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to fetch active indices' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      indicesToUpdate = activeIndices || [];
      console.log(`Auto-update: Found ${indicesToUpdate.length} active indices`);
    }

    if (indicesToUpdate.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No indices to update' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl connector not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: IndexResult[] = [];

    for (const index of indicesToUpdate) {
      const source = INDEX_SOURCES[index.symbol];
      
      if (!source) {
        console.log(`No source configured for ${index.symbol}, skipping`);
        results.push({
          symbol: index.symbol,
          name: index.name_ko,
          currentValue: null,
          changeValue: null,
          changePercent: null,
          error: 'No scraping source configured for this symbol'
        });
        continue;
      }

      try {
        console.log(`Scraping index data for ${index.name_ko} (${index.symbol}) from ${source.url}`);

        const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: source.url,
            formats: ['html'],
            onlyMainContent: false,
            waitFor: 2000,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          console.error(`Firecrawl API error for ${index.symbol}:`, data);
          results.push({
            symbol: index.symbol,
            name: index.name_ko,
            currentValue: null,
            changeValue: null,
            changePercent: null,
            error: data.error || `Request failed with status ${response.status}`
          });
          continue;
        }

        const html = data.data?.html || data.html || '';
        const extracted = extractNaverIndexData(html, index.symbol);

        console.log(`Extracted for ${index.symbol}:`, extracted);

        results.push({
          symbol: index.symbol,
          name: index.name_ko,
          currentValue: extracted.value,
          changeValue: extracted.change,
          changePercent: extracted.percent,
          error: extracted.value ? undefined : 'Could not extract index data from page'
        });

        // Add delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (indexError) {
        console.error(`Error processing index ${index.symbol}:`, indexError);
        results.push({
          symbol: index.symbol,
          name: index.name_ko,
          currentValue: null,
          changeValue: null,
          changePercent: null,
          error: indexError instanceof Error ? indexError.message : 'Unknown error'
        });
      }
    }

    console.log('Market index fetch completed:', results);

    // Update database with fetched results
    if (isAutoUpdate) {
      for (const result of results) {
        if (result.currentValue) {
          const { error } = await supabase
            .from('market_indices')
            .update({
              current_value: result.currentValue,
              change_value: result.changeValue ?? 0,
              change_percent: result.changePercent ?? 0,
              updated_at: new Date().toISOString()
            })
            .eq('symbol', result.symbol);

          if (error) {
            console.error(`Failed to update ${result.symbol}:`, error);
          } else {
            console.log(`Updated ${result.name}: ${result.currentValue}`);
          }
        }
      }

      // Send failure notification if any indices failed
      const failedIndices = results.filter(r => !r.currentValue || r.error);
      if (failedIndices.length > 0) {
        await sendFailureNotification(failedIndices, results.length);
      }
    }

    return new Response(
      JSON.stringify({ success: true, data: results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching market indices:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch market indices';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
