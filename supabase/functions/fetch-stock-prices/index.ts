import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'npm:resend@2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface StockPriceResult {
  stockCode: string;
  stockName: string;
  currentPrice: number | null;
  error?: string;
}

interface StockInput {
  code: string;
  name: string;
}

const ADMIN_EMAIL = "jason.jk.kim@gmail.com";

async function sendFailureNotification(failedStocks: StockPriceResult[], totalStocks: number) {
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

  const failedList = failedStocks.map(s => 
    `<tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${s.stockName}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${s.stockCode}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; color: #dc2626;">${s.error || 'Unknown error'}</td>
    </tr>`
  ).join('');

  try {
    await resend.emails.send({
      from: "Namsan Korea <onboarding@resend.dev>",
      to: [ADMIN_EMAIL],
      subject: `[Namsan Korea] 주가 업데이트 실패 알림 - ${failedStocks.length}/${totalStocks} 종목`,
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
              <h1 style="margin: 0;">⚠️ 주가 업데이트 실패</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">Stock Price Update Failed</p>
            </div>
            <div class="content">
              <p>안녕하세요,</p>
              <p>자동 주가 업데이트 중 일부 종목의 가격을 가져오지 못했습니다.</p>
              
              <div class="stats">
                <div class="stat-box">
                  <div class="stat-number success">${totalStocks - failedStocks.length}</div>
                  <div class="stat-label">성공</div>
                </div>
                <div class="stat-box">
                  <div class="stat-number failure">${failedStocks.length}</div>
                  <div class="stat-label">실패</div>
                </div>
              </div>
              
              <h3>실패한 종목 목록</h3>
              <table>
                <thead>
                  <tr>
                    <th>종목명</th>
                    <th>종목코드</th>
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
              
              <p>Admin 대시보드에서 수동으로 주가를 업데이트하거나 종목 코드를 확인해주세요.</p>
              
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
    const body = await req.json();
    let stockCodes: StockInput[] = body.stockCodes;
    const isAutoUpdate = body.autoUpdate === true;

    // If this is an auto-update request, fetch active stocks from database
    if (isAutoUpdate) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: activeStocks, error } = await supabase
        .from('weekly_stock_picks')
        .select('stock_code, stock_name')
        .eq('is_active', true)
        .not('stock_code', 'is', null);

      if (error) {
        console.error('Failed to fetch active stocks:', error);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to fetch active stocks' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      stockCodes = (activeStocks || []).map(s => ({
        code: s.stock_code!,
        name: s.stock_name
      }));

      console.log(`Auto-update: Found ${stockCodes.length} active stocks`);
    }

    if (!stockCodes || !Array.isArray(stockCodes) || stockCodes.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No stocks to update' }),
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

    const results: StockPriceResult[] = [];

    // Process each stock code
    for (const stock of stockCodes) {
      const { code, name } = stock;
      
      if (!code) {
        results.push({
          stockCode: code || '',
          stockName: name || '',
          currentPrice: null,
          error: 'No stock code provided'
        });
        continue;
      }

      try {
        // Naver Finance stock page URL
        const naverUrl = `https://finance.naver.com/item/main.naver?code=${code}`;
        
        console.log(`Scraping stock price for ${name} (${code}) from ${naverUrl}`);

        const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: naverUrl,
            formats: ['html'],
            onlyMainContent: false,
            waitFor: 2000, // Wait for dynamic content
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          console.error(`Firecrawl API error for ${code}:`, data);
          results.push({
            stockCode: code,
            stockName: name,
            currentPrice: null,
            error: data.error || `Request failed with status ${response.status}`
          });
          continue;
        }

        // Extract current price from the HTML
        const html = data.data?.html || data.html || '';
        
        // Naver Finance uses "현재가" class or specific elements for current price
        // Try multiple patterns to extract the price
        let currentPrice: number | null = null;

        // Pattern 1: Look for the main price display (no_today class)
        const pricePatterns = [
          /<p class="no_today"[^>]*>[\s\S]*?<span class="blind">현재가<\/span>[\s\S]*?<span[^>]*>([0-9,]+)<\/span>/i,
          /<dd class="stock_price"[^>]*>([0-9,]+)<\/dd>/i,
          /<strong class="[^"]*"[^>]*>([0-9,]+)<\/strong>/i,
          /현재가[\s\S]*?([0-9]{1,3}(?:,[0-9]{3})+)원?/i,
          /class="no_today"[^>]*>[\s\S]*?([0-9]{1,3}(?:,[0-9]{3})+)/i,
        ];

        for (const pattern of pricePatterns) {
          const match = html.match(pattern);
          if (match && match[1]) {
            const priceStr = match[1].replace(/,/g, '');
            const parsedPrice = parseInt(priceStr, 10);
            if (!isNaN(parsedPrice) && parsedPrice > 0) {
              currentPrice = parsedPrice;
              console.log(`Found price for ${code}: ${currentPrice} using pattern`);
              break;
            }
          }
        }

        // Alternative: Look for meta tags or structured data
        if (!currentPrice) {
          const metaMatch = html.match(/<meta[^>]*property="og:description"[^>]*content="[^"]*현재가\s*([0-9,]+)/i);
          if (metaMatch && metaMatch[1]) {
            const priceStr = metaMatch[1].replace(/,/g, '');
            const parsedPrice = parseInt(priceStr, 10);
            if (!isNaN(parsedPrice) && parsedPrice > 0) {
              currentPrice = parsedPrice;
              console.log(`Found price for ${code} from meta: ${currentPrice}`);
            }
          }
        }

        results.push({
          stockCode: code,
          stockName: name,
          currentPrice,
          error: currentPrice ? undefined : 'Could not extract price from page'
        });

        // Add a small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (stockError) {
        console.error(`Error processing stock ${code}:`, stockError);
        results.push({
          stockCode: code,
          stockName: name,
          currentPrice: null,
          error: stockError instanceof Error ? stockError.message : 'Unknown error'
        });
      }
    }

    console.log('Stock price fetch completed:', results);

    // If auto-update, also update the database directly
    if (isAutoUpdate) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      for (const result of results) {
        if (result.currentPrice && result.stockCode) {
          const { error } = await supabase
            .from('weekly_stock_picks')
            .update({ 
              current_closing_price: result.currentPrice,
              updated_at: new Date().toISOString()
            })
            .eq('stock_code', result.stockCode);

          if (error) {
            console.error(`Failed to update ${result.stockCode}:`, error);
          } else {
            console.log(`Updated ${result.stockName}: ${result.currentPrice}`);
          }
        }
      }

      // Send failure notification if any stocks failed during auto-update
      const failedStocks = results.filter(r => !r.currentPrice || r.error);
      if (failedStocks.length > 0) {
        await sendFailureNotification(failedStocks, results.length);
      }
    }

    return new Response(
      JSON.stringify({ success: true, data: results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching stock prices:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch stock prices';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
