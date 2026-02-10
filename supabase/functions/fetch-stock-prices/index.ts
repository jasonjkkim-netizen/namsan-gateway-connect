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
            </div>
            <div class="content">
              <p>${koreaTime} (KST) 자동 주가 업데이트 중 ${failedStocks.length}/${totalStocks} 종목 실패</p>
              <table>
                <thead><tr><th>종목명</th><th>종목코드</th><th>오류</th></tr></thead>
                <tbody>${failedList}</tbody>
              </table>
              <center><a href="https://namsan-gateway-connect.lovable.app/admin" class="cta-button">관리자 패널 →</a></center>
            </div>
            <div class="footer">© ${new Date().getFullYear()} Namsan Korea</div>
          </div>
        </body>
        </html>
      `,
    });
    console.log('Failure notification email sent');
  } catch (emailError) {
    console.error('Failed to send notification email:', emailError);
  }
}

async function fetchPricesViaPerplexity(stockCodes: StockInput[]): Promise<StockPriceResult[]> {
  const apiKey = Deno.env.get('PERPLEXITY_API_KEY');
  if (!apiKey) {
    throw new Error('PERPLEXITY_API_KEY is not configured');
  }

  const stockList = stockCodes.map(s => `${s.name} (종목코드: ${s.code})`).join(', ');

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [
        {
          role: 'system',
          content: '당신은 한국 주식시장 데이터 전문가입니다. 요청된 종목의 가장 최근 주가(현재가 또는 최근 종가)를 정확하게 JSON 형식으로 반환하세요. 반드시 아래 형식을 따르세요:\n[{"code":"종목코드","price":숫자}]\n숫자는 원 단위 정수입니다. 다른 텍스트 없이 JSON만 반환하세요.'
        },
        {
          role: 'user',
          content: `다음 한국 주식 종목들의 가장 최근 주가(현재가)를 알려주세요: ${stockList}`
        }
      ],
      search_recency_filter: 'day',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Perplexity API error:', response.status, errorText);
    throw new Error(`Perplexity API error [${response.status}]`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  console.log('Perplexity raw response:', content);

  // Extract JSON from the response
  const jsonMatch = content.match(/\[[\s\S]*?\]/);
  if (!jsonMatch) {
    console.error('Could not parse JSON from Perplexity response:', content);
    return stockCodes.map(s => ({
      stockCode: s.code,
      stockName: s.name,
      currentPrice: null,
      error: 'Could not parse price from AI response'
    }));
  }

  try {
    const prices: Array<{ code: string; price: number }> = JSON.parse(jsonMatch[0]);
    
    return stockCodes.map(stock => {
      const found = prices.find(p => p.code === stock.code);
      return {
        stockCode: stock.code,
        stockName: stock.name,
        currentPrice: found?.price || null,
        error: found?.price ? undefined : 'Price not found in response'
      };
    });
  } catch (parseError) {
    console.error('JSON parse error:', parseError);
    return stockCodes.map(s => ({
      stockCode: s.code,
      stockName: s.name,
      currentPrice: null,
      error: 'Failed to parse price data'
    }));
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let body: { stockCodes?: StockInput[]; autoUpdate?: boolean } = {};
    try {
      const text = await req.text();
      if (text && text.trim()) {
        body = JSON.parse(text);
      }
    } catch {
      body = { autoUpdate: true };
    }

    let stockCodes: StockInput[] = body.stockCodes || [];
    const isAutoUpdate = body.autoUpdate === true || stockCodes.length === 0;

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

    if (!stockCodes || stockCodes.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No stocks to update' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use Perplexity to fetch prices
    const results = await fetchPricesViaPerplexity(stockCodes);

    console.log('Stock price fetch completed:', results);

    // If auto-update, update the database directly
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
