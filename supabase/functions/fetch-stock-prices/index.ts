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
  if (!resendApiKey) return;

  const resend = new Resend(resendApiKey);
  const koreaTime = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date());

  const failedList = failedStocks.map(s =>
    `<tr><td style="padding:8px;border-bottom:1px solid #eee">${s.stockName}</td><td style="padding:8px;border-bottom:1px solid #eee">${s.stockCode}</td><td style="padding:8px;border-bottom:1px solid #eee;color:#dc2626">${s.error || 'Unknown'}</td></tr>`
  ).join('');

  try {
    await resend.emails.send({
      from: "Namsan Korea <onboarding@resend.dev>",
      to: [ADMIN_EMAIL],
      subject: `[Namsan Korea] 주가 업데이트 실패 - ${failedStocks.length}/${totalStocks}`,
      html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><h2 style="color:#dc2626">⚠️ 주가 업데이트 실패</h2><p>${koreaTime} (KST) - ${failedStocks.length}/${totalStocks} 종목 실패</p><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;padding:8px;background:#f0f0f0">종목명</th><th style="text-align:left;padding:8px;background:#f0f0f0">코드</th><th style="text-align:left;padding:8px;background:#f0f0f0">오류</th></tr></thead><tbody>${failedList}</tbody></table><p><a href="https://namsan-gateway-connect.lovable.app/admin">관리자 패널 →</a></p></div>`,
    });
  } catch (e) {
    console.error('Failed to send notification:', e);
  }
}

async function fetchSingleStockPrice(apiKey: string, stock: StockInput): Promise<StockPriceResult> {
  try {
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
            content: '한국 주식의 현재 주가(원)를 숫자만 반환하세요. 종목코드가 아닌 주가만 답하세요. 쉼표 없이 숫자만. 예시: 55000'
          },
          {
            role: 'user',
            content: `한국 주식 "${stock.name}"의 현재 주가(원)를 알려주세요. 숫자만 답해주세요.`
          }
        ],
        search_recency_filter: 'day',
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Perplexity error for ${stock.name}:`, response.status, errText);
      return { stockCode: stock.code, stockName: stock.name, currentPrice: null, error: `API error ${response.status}` };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    console.log(`Perplexity response for ${stock.name}: ${content}`);

    // Extract all numbers from the response
    const allNumbers: number[] = [];
    const regex = /([0-9]{1,3}(?:,?[0-9]{3})+|[0-9]{4,})/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const num = parseInt(match[1].replace(/,/g, ''), 10);
      // Filter out: stock code, numbers < 1000, and unreasonably large numbers
      const codeNum = parseInt(stock.code, 10);
      if (num > 1000 && num !== codeNum && num < 100000000) {
        allNumbers.push(num);
      }
    }

    if (allNumbers.length > 0) {
      // Use the first valid price found
      const price = allNumbers[0];
      console.log(`Price for ${stock.name} (${stock.code}): ${price}`);
      return { stockCode: stock.code, stockName: stock.name, currentPrice: price };
    }

    console.warn(`Could not parse price for ${stock.name} from: ${content}`);
    return { stockCode: stock.code, stockName: stock.name, currentPrice: null, error: 'Could not parse price' };
  } catch (err) {
    console.error(`Error fetching ${stock.name}:`, err);
    return { stockCode: stock.code, stockName: stock.name, currentPrice: null, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let body: { stockCodes?: StockInput[]; autoUpdate?: boolean } = {};
    try {
      const text = await req.text();
      if (text && text.trim()) body = JSON.parse(text);
    } catch {
      body = { autoUpdate: true };
    }

    let stockCodes: StockInput[] = body.stockCodes || [];
    const isAutoUpdate = body.autoUpdate === true || stockCodes.length === 0;

    if (isAutoUpdate) {
      const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      const { data: activeStocks, error } = await supabase
        .from('weekly_stock_picks')
        .select('stock_code, stock_name')
        .eq('is_active', true)
        .not('stock_code', 'is', null);

      if (error) {
        return new Response(JSON.stringify({ success: false, error: 'Failed to fetch active stocks' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      stockCodes = (activeStocks || []).map(s => ({ code: s.stock_code!, name: s.stock_name }));
    }

    if (!stockCodes || stockCodes.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'No stocks to update' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const apiKey = Deno.env.get('PERPLEXITY_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ success: false, error: 'PERPLEXITY_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch each stock individually for accuracy
    const results: StockPriceResult[] = [];
    for (const stock of stockCodes) {
      const result = await fetchSingleStockPrice(apiKey, stock);
      results.push(result);
      // Small delay between requests
      if (stockCodes.indexOf(stock) < stockCodes.length - 1) {
        await new Promise(r => setTimeout(r, 300));
      }
    }

    console.log('Stock price fetch completed:', results);

    // Auto-update: save to DB
    if (isAutoUpdate) {
      const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      for (const result of results) {
        if (result.currentPrice && result.stockCode) {
          const { error } = await supabase
            .from('weekly_stock_picks')
            .update({ current_closing_price: result.currentPrice, updated_at: new Date().toISOString() })
            .eq('stock_code', result.stockCode);
          if (error) console.error(`Failed to update ${result.stockCode}:`, error);
          else console.log(`Updated ${result.stockName}: ${result.currentPrice}`);
        }
      }

      const failedStocks = results.filter(r => !r.currentPrice);
      if (failedStocks.length > 0) await sendFailureNotification(failedStocks, results.length);
    }

    return new Response(JSON.stringify({ success: true, data: results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
