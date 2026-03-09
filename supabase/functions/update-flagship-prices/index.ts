import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'npm:resend@2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const KIS_BASE_URL = 'https://openapi.koreainvestment.com:9443';
const ADMIN_EMAIL = Deno.env.get('ADMIN_EMAIL') || 'admin@namsan-korea.com';

const MAX_CHANGE_RATIO = 0.50; // 50% cap – skip if price moves more than this

interface PriceResult {
  id: string;
  name: string;
  ticker: string;
  oldPrice: number | null;
  newPrice: number | null;
  skipped?: boolean;
  skipReason?: string;
  error?: string;
}

// ── KIS Access Token ──
async function getKisAccessToken(): Promise<string> {
  const appKey = Deno.env.get('KIS_APP_KEY');
  const appSecret = Deno.env.get('KIS_APP_SECRET');
  if (!appKey || !appSecret) throw new Error('KIS credentials not configured');

  const res = await fetch(`${KIS_BASE_URL}/oauth2/tokenP`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credentials', appkey: appKey, appsecret: appSecret }),
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`KIS token error ${res.status}: ${t}`); }
  const data = await res.json();
  if (!data.access_token) throw new Error('No access_token in KIS response');
  return data.access_token;
}

// ── Fetch with retry ──
async function fetchWithRetry(url: string, options: RequestInit, retries = 3, delay = 500): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try { return await fetch(url, options); }
    catch (err) {
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, delay * attempt));
    }
  }
  throw new Error('All retries exhausted');
}

// ── KR stock price ──
async function fetchKrPrice(token: string, ticker: string): Promise<number | null> {
  const appKey = Deno.env.get('KIS_APP_KEY')!;
  const appSecret = Deno.env.get('KIS_APP_SECRET')!;
  const url = `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price?fid_cond_mrkt_div_code=J&fid_input_iscd=${ticker}`;
  const res = await fetchWithRetry(url, {
    method: 'GET',
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'authorization': `Bearer ${token}`,
      'appkey': appKey, 'appsecret': appSecret,
      'tr_id': 'FHKST01010100', 'custtype': 'P',
    },
  });
  if (!res.ok) { await res.text(); return null; }
  const data = await res.json();
  if (data.rt_cd !== '0') return null;
  const price = parseInt(data.output?.stck_prpr, 10);
  return price > 0 ? price : null;
}

// ── US stock/ETF price ──
async function fetchUsPrice(token: string, ticker: string): Promise<number | null> {
  const appKey = Deno.env.get('KIS_APP_KEY')!;
  const appSecret = Deno.env.get('KIS_APP_SECRET')!;
  const exchanges = ['NAS', 'NYS', 'AMS'];
  for (const excd of exchanges) {
    const url = `${KIS_BASE_URL}/uapi/overseas-price/v1/quotations/price?AUTH=&EXCD=${excd}&SYMB=${ticker}`;
    try {
      const res = await fetchWithRetry(url, {
        method: 'GET',
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'authorization': `Bearer ${token}`,
          'appkey': appKey, 'appsecret': appSecret,
          'tr_id': 'HHDFS00000300', 'custtype': 'P',
        },
      });
      if (!res.ok) { await res.text(); continue; }
      const data = await res.json();
      if (data.rt_cd !== '0') continue;
      const price = parseFloat(data.output?.last);
      if (price > 0) return price;
    } catch { /* try next exchange */ }
    await new Promise(r => setTimeout(r, 100));
  }
  return null;
}

// ── Yahoo Finance fallback ──
async function fetchYahooPrice(ticker: string): Promise<number | null> {
  try {
    // Map common KR tickers to Yahoo format
    const yahooTicker = /^\d{6}$/.test(ticker) ? `${ticker}.KS` : ticker;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?interval=1d&range=1d`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) { await res.text(); return null; }
    const data = await res.json();
    const meta = data.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice;
    return price && price > 0 ? price : null;
  } catch { return null; }
}

// ── Perplexity fallback ──
async function fetchPerplexityPrice(name: string, ticker: string, currency: string): Promise<number | null> {
  const apiKey = Deno.env.get('PERPLEXITY_API_KEY');
  if (!apiKey) return null;
  try {
    const prompt = `What is the current price of ${name} (ticker: ${ticker})? Return ONLY the numeric price in ${currency} with no text, no currency symbol, no commas. Just the number.`;
    const res = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          { role: 'system', content: 'Return ONLY the numeric price value. No text, no symbols.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0,
      }),
    });
    if (!res.ok) { await res.text(); return null; }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim() || '';
    const numbers = content.match(/[\d]+\.?\d*/g);
    if (numbers) {
      for (const numStr of numbers) {
        const num = parseFloat(numStr);
        if (num > 0 && !(Number.isInteger(num) && num >= 2020 && num <= 2030) && String(num) !== ticker) return num;
      }
    }
    return null;
  } catch { return null; }
}

// ── Failure notification ──
async function sendFailureNotification(failed: PriceResult[], total: number) {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) return;
  const resend = new Resend(resendApiKey);
  const koreaTime = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date());
  const rows = failed.map(s =>
    `<tr><td style="padding:8px;border-bottom:1px solid #eee">${s.name}</td><td style="padding:8px;border-bottom:1px solid #eee">${s.ticker}</td><td style="padding:8px;border-bottom:1px solid #eee;color:#dc2626">${s.error || 'Unknown'}</td></tr>`
  ).join('');
  try {
    await resend.emails.send({
      from: "Namsan Korea <onboarding@resend.dev>",
      to: [ADMIN_EMAIL],
      subject: `[Namsan] 플래그십 시세 업데이트 실패 - ${failed.length}/${total}`,
      html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><h2 style="color:#dc2626">⚠️ 플래그십 포트폴리오 시세 업데이트 실패</h2><p>${koreaTime} (KST) - ${failed.length}/${total} 종목 실패</p><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;padding:8px;background:#f0f0f0">종목명</th><th style="text-align:left;padding:8px;background:#f0f0f0">코드</th><th style="text-align:left;padding:8px;background:#f0f0f0">오류</th></tr></thead><tbody>${rows}</tbody></table></div>`,
    });
  } catch (e) { console.error('Notification failed:', e); }
}

// ── Main ──
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // ── Authentication Guard ──
    // Allow access via: 1) cron secret header, or 2) valid admin JWT
    const cronSecret = req.headers.get('x-cron-secret');
    const expectedCronSecret = Deno.env.get('CRON_SECRET');
    const isCronAuth = expectedCronSecret && cronSecret === expectedCronSecret;

    if (!isCronAuth) {
      // Fall back to JWT auth – must be admin
      const authHeader = req.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const anonClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const token = authHeader.replace('Bearer ', '');
      const { data: claimsData, error: claimsErr } = await anonClient.auth.getClaims(token);
      if (claimsErr || !claimsData?.claims) {
        return new Response(JSON.stringify({ error: 'Invalid token' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const userId = claimsData.claims.sub as string;
      // Check admin role
      const serviceClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      const { data: roleData } = await serviceClient
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();
      if (!roleData) {
        return new Response(JSON.stringify({ error: 'Forbidden: admin only' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Fetch all active flagship items that have a ticker (stocks/ETFs only)
    const { data: portfolioItems, error: fetchErr } = await supabase
      .from('flagship_portfolio_items')
      .select('id, name, ticker, currency, asset_type, current_price, group_id')
      .eq('is_active', true)
      .not('ticker', 'is', null);

    if (fetchErr) throw new Error(`DB fetch error: ${fetchErr.message}`);

    const itemsToUpdate = (portfolioItems || []).filter(i => i.ticker && i.asset_type !== 'bond');
    if (itemsToUpdate.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No items to update', results: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Get KIS token
    let kisToken: string | null = null;
    try { kisToken = await getKisAccessToken(); }
    catch (e) { console.error('KIS token failed, will use fallbacks:', e); }

    const results: PriceResult[] = [];

    for (const item of itemsToUpdate) {
      const ticker = item.ticker!;
      const isKR = item.currency === 'KRW' || /^\d{6}$/.test(ticker);
      const currencyLabel = isKR ? 'KRW' : 'USD';
      let newPrice: number | null = null;
      let error: string | undefined;

      // 1) KIS API
      if (kisToken) {
        newPrice = isKR ? await fetchKrPrice(kisToken, ticker) : await fetchUsPrice(kisToken, ticker);
        if (newPrice) console.log(`KIS: ${item.name} (${ticker}) = ${newPrice}`);
      }

      // 2) Yahoo Finance fallback
      if (!newPrice) {
        newPrice = await fetchYahooPrice(ticker);
        if (newPrice) console.log(`Yahoo: ${item.name} (${ticker}) = ${newPrice}`);
      }

      // 3) Perplexity fallback
      if (!newPrice) {
        newPrice = await fetchPerplexityPrice(item.name, ticker, currencyLabel);
        if (newPrice) console.log(`Perplexity: ${item.name} (${ticker}) = ${newPrice}`);
      }

      if (!newPrice) error = 'All sources failed';

      // Safety check: skip if price change exceeds MAX_CHANGE_RATIO
      const oldPrice = item.current_price ? Number(item.current_price) : null;
      let skipped = false;
      let skipReason: string | undefined;

      if (newPrice && oldPrice && oldPrice > 0) {
        const changeRatio = Math.abs(newPrice - oldPrice) / oldPrice;
        if (changeRatio > MAX_CHANGE_RATIO) {
          skipped = true;
          skipReason = `Price change ${(changeRatio * 100).toFixed(1)}% exceeds ${MAX_CHANGE_RATIO * 100}% cap (${oldPrice} → ${newPrice})`;
          console.warn(`SKIPPED ${item.name}: ${skipReason}`);
          newPrice = null; // prevent DB update
        }
      }

      results.push({
        id: item.id, name: item.name, ticker,
        oldPrice, newPrice, skipped, skipReason, error,
      });

      // Rate limit between requests
      await new Promise(r => setTimeout(r, 200));
    }

    // Update DB
    let updated = 0;
    for (const r of results) {
      if (r.newPrice) {
        const { error } = await supabase
          .from('flagship_portfolio_items')
          .update({ current_price: r.newPrice, updated_at: new Date().toISOString() })
          .eq('id', r.id);
        if (error) console.error(`DB update failed for ${r.name}:`, error);
        else updated++;
      }
    }

    // Notify on failures and skips
    const failed = results.filter(r => !r.newPrice && !r.skipped);
    const skipped = results.filter(r => r.skipped);
    const notifyList = [...failed, ...skipped.map(s => ({ ...s, error: s.skipReason }))];
    if (notifyList.length > 0) await sendFailureNotification(notifyList, results.length);

    console.log(`Flagship prices: updated=${updated}, skipped=${skipped.length}, failed=${failed.length}, total=${results.length}`);

    return new Response(JSON.stringify({
      success: true,
      updated,
      total: results.length,
      results,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
