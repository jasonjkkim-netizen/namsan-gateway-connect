import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'npm:resend@2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const KIS_BASE_URL = 'https://openapi.koreainvestment.com:9443';
const ADMIN_EMAIL = Deno.env.get('ADMIN_EMAIL') || 'admin@namsan-korea.com';

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

// ── KIS Access Token ──────────────────────────────────────
async function getKisAccessToken(): Promise<string> {
  const appKey = Deno.env.get('KIS_APP_KEY');
  const appSecret = Deno.env.get('KIS_APP_SECRET');
  if (!appKey || !appSecret) throw new Error('KIS_APP_KEY or KIS_APP_SECRET not configured');

  const res = await fetch(`${KIS_BASE_URL}/oauth2/tokenP`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      appkey: appKey,
      appsecret: appSecret,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`KIS token error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  if (!data.access_token) throw new Error('No access_token in KIS response');
  console.log('KIS access token obtained successfully');
  return data.access_token;
}

// ── 국내주식 현재가 조회 ──────────────────────────────────
async function fetchKrStockPrice(token: string, stock: StockInput): Promise<StockPriceResult> {
  try {
    const appKey = Deno.env.get('KIS_APP_KEY')!;
    const appSecret = Deno.env.get('KIS_APP_SECRET')!;

    const url = `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price?fid_cond_mrkt_div_code=J&fid_input_iscd=${stock.code}`;
    const headers = {
      'content-type': 'application/json; charset=utf-8',
      'authorization': `Bearer ${token}`,
      'appkey': appKey,
      'appsecret': appSecret,
      'tr_id': 'FHKST01010100',
      'custtype': 'P',
    };

    const res = await fetchWithRetry(url, { method: 'GET', headers }, 3, 500);

    if (!res.ok) {
      const errText = await res.text();
      console.error(`KIS KR error for ${stock.name} (${stock.code}):`, res.status, errText);
      return { stockCode: stock.code, stockName: stock.name, currentPrice: null, error: `KIS API error ${res.status}` };
    }

    const data = await res.json();

    if (data.rt_cd !== '0') {
      console.error(`KIS KR response error for ${stock.name}:`, data.msg1);
      return { stockCode: stock.code, stockName: stock.name, currentPrice: null, error: data.msg1 || 'KIS response error' };
    }

    const priceStr = data.output?.stck_prpr;
    const price = priceStr ? parseInt(priceStr, 10) : null;

    if (price && price > 0) {
      console.log(`KR Price for ${stock.name} (${stock.code}): ${price}`);
      return { stockCode: stock.code, stockName: stock.name, currentPrice: price };
    }

    console.warn(`No valid KR price for ${stock.name}:`, priceStr);
    return { stockCode: stock.code, stockName: stock.name, currentPrice: null, error: 'No valid price returned' };
  } catch (err) {
    console.error(`Error fetching KR ${stock.name}:`, err);
    return { stockCode: stock.code, stockName: stock.name, currentPrice: null, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// ── 해외주식 현재가 조회 ──────────────────────────────────
async function fetchWithRetry(url: string, options: RequestInit, retries = 3, delay = 500): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);
      return res;
    } catch (err) {
      console.warn(`Fetch attempt ${attempt}/${retries} failed: ${err instanceof Error ? err.message : 'Unknown'}`);
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, delay * attempt));
    }
  }
  throw new Error('All retries exhausted');
}

async function fetchUsStockPrice(token: string, stock: StockInput): Promise<StockPriceResult> {
  try {
    const appKey = Deno.env.get('KIS_APP_KEY')!;
    const appSecret = Deno.env.get('KIS_APP_SECRET')!;

    const exchanges = ['NAS', 'NYS', 'AMS'];

    for (const excd of exchanges) {
      const url = `${KIS_BASE_URL}/uapi/overseas-price/v1/quotations/price?AUTH=&EXCD=${excd}&SYMB=${stock.code}`;
      const headers = {
        'content-type': 'application/json; charset=utf-8',
        'authorization': `Bearer ${token}`,
        'appkey': appKey,
        'appsecret': appSecret,
        'tr_id': 'HHDFS00000300',
        'custtype': 'P',
      };

      let res: Response;
      try {
        res = await fetchWithRetry(url, { method: 'GET', headers }, 3, 500);
      } catch (err) {
        console.warn(`KIS US (${excd}) connection failed for ${stock.name} after retries:`, err instanceof Error ? err.message : err);
        continue;
      }

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`KIS US (${excd}) error for ${stock.name}:`, res.status, errText);
        continue;
      }

      const data = await res.json();

      if (data.rt_cd !== '0') {
        console.warn(`KIS US (${excd}) response for ${stock.name}:`, data.msg1);
        continue;
      }

      const lastStr = data.output?.last;
      const price = lastStr ? parseFloat(lastStr) : null;

      if (price && price > 0) {
        console.log(`US Price for ${stock.name} (${stock.code}) on ${excd}: $${price}`);
        return { stockCode: stock.code, stockName: stock.name, currentPrice: price };
      }

      await new Promise(r => setTimeout(r, 100));
    }

    console.warn(`No valid US price for ${stock.name} on any exchange`);
    return { stockCode: stock.code, stockName: stock.name, currentPrice: null, error: 'No valid price on NAS/NYS/AMS' };
  } catch (err) {
    console.error(`Error fetching US ${stock.name}:`, err);
    return { stockCode: stock.code, stockName: stock.name, currentPrice: null, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// ── Perplexity Fallback ───────────────────────────────────
async function fetchPriceViaPerplexity(stock: StockInput, market: string): Promise<StockPriceResult> {
  const apiKey = Deno.env.get('PERPLEXITY_API_KEY');
  if (!apiKey) {
    console.warn('PERPLEXITY_API_KEY not set, skipping fallback');
    return { stockCode: stock.code, stockName: stock.name, currentPrice: null, error: 'Perplexity fallback unavailable' };
  }

  try {
    const currency = market === 'KR' ? 'KRW' : 'USD';
    const prompt = `What is the current stock price of ${stock.name} (ticker: ${stock.code})? Return ONLY the numeric price in ${currency} with no text, no currency symbol, no commas. Just the number.`;

    const res = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          { role: 'system', content: 'You are a stock price lookup tool. Return ONLY the numeric price value. No text, no currency symbols, no commas, no explanations.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`Perplexity error for ${stock.name}:`, res.status, errText);
      return { stockCode: stock.code, stockName: stock.name, currentPrice: null, error: `Perplexity API error ${res.status}` };
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim() || '';

    // Extract numeric price, filtering out year-like integers (2020-2030)
    const numbers = content.match(/[\d]+\.?\d*/g);
    if (numbers) {
      for (const numStr of numbers) {
        const num = parseFloat(numStr);
        if (num > 0 && !(Number.isInteger(num) && num >= 2020 && num <= 2030)) {
          console.log(`Perplexity fallback price for ${stock.name}: ${num} (${market})`);
          return { stockCode: stock.code, stockName: stock.name, currentPrice: num };
        }
      }
    }

    console.warn(`Perplexity returned no valid price for ${stock.name}:`, content);
    return { stockCode: stock.code, stockName: stock.name, currentPrice: null, error: 'Perplexity returned no valid price' };
  } catch (err) {
    console.error(`Perplexity fallback error for ${stock.name}:`, err);
    return { stockCode: stock.code, stockName: stock.name, currentPrice: null, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// ── Failure notification ──────────────────────────────────
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
      html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><h2 style="color:#dc2626">⚠️ 주가 업데이트 실패 (KIS API)</h2><p>${koreaTime} (KST) - ${failedStocks.length}/${totalStocks} 종목 실패</p><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;padding:8px;background:#f0f0f0">종목명</th><th style="text-align:left;padding:8px;background:#f0f0f0">코드</th><th style="text-align:left;padding:8px;background:#f0f0f0">오류</th></tr></thead><tbody>${failedList}</tbody></table><p><a href="https://namsan-gateway-connect.lovable.app/admin">관리자 패널 →</a></p></div>`,
    });
  } catch (e) {
    console.error('Failed to send notification:', e);
  }
}

// ── Main handler ──────────────────────────────────────────
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
    if (claimsError || !claimsData?.claims?.sub) {
      console.error("Auth claims error:", claimsError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let body: { stockCodes?: StockInput[]; autoUpdate?: boolean; market?: string } = {};
    try {
      const text = await req.text();
      if (text && text.trim()) body = JSON.parse(text);
    } catch {
      body = { autoUpdate: true };
    }
    const defaultMarket = body.market || 'KR';

    let stockCodes: StockInput[] = body.stockCodes || [];
    const isAutoUpdate = body.autoUpdate === true || stockCodes.length === 0;
    let stockMarketMap: Record<string, string> = {};

    if (isAutoUpdate) {
      const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      const { data: activeStocks, error } = await supabase
        .from('weekly_stock_picks')
        .select('stock_code, stock_name, market')
        .eq('is_active', true)
        .not('stock_code', 'is', null);

      if (error) {
        return new Response(JSON.stringify({ success: false, error: 'Failed to fetch active stocks' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      stockCodes = (activeStocks || []).map(s => ({ code: s.stock_code!, name: s.stock_name }));
      for (const s of activeStocks || []) {
        if (s.stock_code) stockMarketMap[s.stock_code] = s.market || 'KR';
      }
    }

    if (!stockCodes || stockCodes.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'No stocks to update' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Get KIS access token
    let kisToken: string | null = null;
    try {
      kisToken = await getKisAccessToken();
    } catch (tokenErr) {
      console.error('Failed to get KIS token, will use Perplexity fallback:', tokenErr);
    }

    // Fetch each stock price via KIS API (with Perplexity fallback)
    const results: StockPriceResult[] = [];
    for (const stock of stockCodes) {
      const market = stockMarketMap[stock.code] || defaultMarket;

      let result: StockPriceResult;

      // Try KIS API first (if token available)
      if (kisToken) {
        if (market === 'US') {
          result = await fetchUsStockPrice(kisToken, stock);
        } else {
          result = await fetchKrStockPrice(kisToken, stock);
        }
      } else {
        result = { stockCode: stock.code, stockName: stock.name, currentPrice: null, error: 'KIS token unavailable' };
      }

      // Perplexity fallback if KIS failed
      if (!result.currentPrice) {
        console.log(`KIS failed for ${stock.name}, trying Perplexity fallback...`);
        const fallbackResult = await fetchPriceViaPerplexity(stock, market);
        if (fallbackResult.currentPrice) {
          result = fallbackResult;
          result.error = undefined;
        }
      }

      results.push(result);

      // KIS API rate limit delay
      if (stockCodes.indexOf(stock) < stockCodes.length - 1) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    console.log('Stock price fetch completed:', JSON.stringify(results));

    // Auto-update: save to DB
    if (isAutoUpdate) {
      const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      for (const result of results) {
        if (result.currentPrice && result.stockCode) {
          const { error } = await supabase
            .from('weekly_stock_picks')
            .update({
              current_closing_price: result.currentPrice,
              price_reference_date: new Date().toISOString().split('T')[0],
              updated_at: new Date().toISOString(),
            })
            .eq('stock_code', result.stockCode)
            .eq('is_active', true);
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
