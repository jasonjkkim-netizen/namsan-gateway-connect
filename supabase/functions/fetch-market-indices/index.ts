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

// Map internal symbols to Yahoo Finance ticker symbols
const YAHOO_SYMBOL_MAP: Record<string, string> = {
  // Market overview items
  'TVC:NI225': '^N225',
  'AMEX:SPY': 'SPY',
  'TVC:DJI': '^DJI',
  'FX:USDKRW': 'USDKRW=X',
  'FX:JPYKRW': 'JPYKRW=X',
  'FX:HKDKRW': 'HKDKRW=X',
  'FX:EURUSD': 'EURUSD=X',
  'FX:USDJPY': 'USDJPY=X',
  'FX:USDCNY': 'USDCNY=X',
  'TVC:US10Y': '^TNX',
  // TVC:US02Y - no reliable Yahoo ticker; uses US Treasury API or FRED
  'TVC:GOLD': 'GC=F',
  'TVC:SILVER': 'SI=F',
  'TVC:USOIL': 'CL=F',
  'NYMEX:NG1!': 'NG=F',
  // Crypto
  'CRYPTO:BTC': 'BTC-USD',
  'CRYPTO:ETH': 'ETH-USD',
  'CRYPTO:XRP': 'XRP-USD',
  // Market indices card symbols
  'KOSPI': '^KS11',
  'KOSDAQ': '^KQ11',
  'SPX': '^GSPC',
  'NDX': '^NDX',
  'S&P500': '^GSPC',
  'NASDAQ': '^IXIC',
};

interface YahooQuote {
  value: number;
  change: number;
  percent: number;
}

async function fetchYahooFinancePrice(yahooSymbol: string): Promise<YahooQuote | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=1d`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      console.warn(`Yahoo Finance returned ${response.status} for ${yahooSymbol}`);
      await response.text(); // consume body
      return null;
    }

    const data = await response.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) return null;

    const price = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose ?? meta.previousClose;

    if (price == null || price <= 0) return null;

    const change = prevClose ? +(price - prevClose).toFixed(4) : 0;
    const percent = prevClose && prevClose > 0 ? +((change / prevClose) * 100).toFixed(2) : 0;

    return { value: +price.toFixed(4), change, percent };
  } catch (err) {
    console.warn(`Yahoo Finance fetch error for ${yahooSymbol}:`, err);
    return null;
  }
}

async function fetchAllYahooFinancePrices(symbols: string[]): Promise<Record<string, YahooQuote>> {
  const results: Record<string, YahooQuote> = {};

  // Fetch in parallel batches of 5 to avoid rate limiting
  const batchSize = 5;
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    const promises = batch.map(async (internalSymbol) => {
      const yahooSymbol = YAHOO_SYMBOL_MAP[internalSymbol];
      if (!yahooSymbol) {
        console.warn(`No Yahoo symbol mapping for ${internalSymbol}`);
        return;
      }
      const quote = await fetchYahooFinancePrice(yahooSymbol);
      if (quote) {
        results[internalSymbol] = quote;
        console.log(`Yahoo Finance: ${internalSymbol} (${yahooSymbol}) = ${quote.value} (${quote.change >= 0 ? '+' : ''}${quote.change}, ${quote.percent}%)`);
      } else {
        console.warn(`Yahoo Finance: No data for ${internalSymbol} (${yahooSymbol})`);
      }
    });
    await Promise.all(promises);
  }

  return results;
}

// Fetch US Treasury yield from Treasury.gov OData API (no API key needed)
async function fetchUSTreasuryYield(maturity: '2' | '5' | '10' | '30' = '2'): Promise<YahooQuote | null> {
  // Try multiple URL formats since Treasury APIs can change
  const urls = [
    `https://data.treasury.gov/feed.svc/DailyTreasuryYieldCurveRateData?$orderby=NEW_DATE%20desc&$top=2&$format=json`,
    `https://data.treasury.gov/feed.svc/DailyTreasuryYieldCurveRateData?$top=2&$orderby=NEW_DATE%20desc&$select=NEW_DATE,BC_2YEAR,BC_5YEAR,BC_10YEAR,BC_30YEAR&$format=json`,
  ];

  for (const url of urls) {
    try {
      console.log(`Trying Treasury API: ${url.substring(0, 80)}...`);
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
      });
      
      if (!response.ok) {
        console.warn(`US Treasury API returned ${response.status}`);
        continue;
      }
      
      const text = await response.text();
      if (text.startsWith('<') || text.startsWith('<!')) {
        console.warn('US Treasury API returned HTML/XML instead of JSON, trying next URL...');
        continue;
      }
      
      const data = JSON.parse(text);
      const entries = data?.d?.results || data?.d || data?.value || [];
      const entriesArr = Array.isArray(entries) ? entries : [entries];
      
      if (entriesArr.length === 0) continue;
      
      const result = extractYieldFromEntries(entriesArr, maturity);
      if (result) return result;
    } catch (err) {
      console.warn('US Treasury API fetch error:', err);
    }
  }

  // Final fallback: try FRED-like public data via Alpha Vantage demo
  try {
    const avUrl = `https://www.alphavantage.co/query?function=TREASURY_YIELD&interval=daily&maturity=${maturity}year&apikey=demo&datatype=json`;
    console.log('Trying Alpha Vantage Treasury Yield...');
    const avResponse = await fetch(avUrl);
    if (avResponse.ok) {
      const avData = await avResponse.json();
      const dataPoints = avData?.data;
      if (dataPoints && dataPoints.length >= 2) {
        const latest = parseFloat(dataPoints[0].value);
        const prev = parseFloat(dataPoints[1].value);
        if (!isNaN(latest) && latest > 0) {
          const change = prev && !isNaN(prev) ? +(latest - prev).toFixed(3) : 0;
          const percent = prev && prev > 0 ? +((change / prev) * 100).toFixed(2) : 0;
          console.log(`Alpha Vantage: ${maturity}Y yield = ${latest} (${change >= 0 ? '+' : ''}${change}, ${percent}%)`);
          return { value: latest, change, percent };
        }
      }
    }
  } catch (err) {
    console.warn('Alpha Vantage fetch error:', err);
  }

  return null;
}

function extractYieldFromEntries(entries: any[], maturity: string): YahooQuote | null {
  const fieldMap: Record<string, string> = {
    '2': 'BC_2YEAR',
    '5': 'BC_5YEAR', 
    '10': 'BC_10YEAR',
    '30': 'BC_30YEAR',
  };
  const field = fieldMap[maturity];
  if (!field) return null;
  
  const latest = entries[0];
  const value = parseFloat(latest[field]);
  if (isNaN(value)) return null;
  
  let change = 0;
  let percent = 0;
  if (entries.length > 1) {
    const prev = parseFloat(entries[1][field]);
    if (!isNaN(prev) && prev > 0) {
      change = +(value - prev).toFixed(3);
      percent = +((change / prev) * 100).toFixed(2);
    }
  }
  
  console.log(`US Treasury API: ${maturity}Y yield = ${value} (${change >= 0 ? '+' : ''}${change}, ${percent}%)`);
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
  const cleaned = line.replace(/\[\d+\]/g, '').trim();
  if (cleaned.includes('N/A') || cleaned.includes('not available')) return null;

  const escapedSymbol = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const lineMatch = cleaned.match(new RegExp(`${escapedSymbol}[:\\s]+([\\d,]+\\.?\\d*)`, 'i'));
  if (!lineMatch) return null;

  const value = parseFloat(lineMatch[1].replace(/,/g, ''));
  if (isNaN(value) || value <= 0) return null;

  let change = 0;
  let percent = 0;

  if (cleaned.includes('flat') || cleaned.match(/\(0[,\s]*0%\)/)) {
    return { value, change: 0, percent: 0 };
  }

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
    // Verify authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json().catch(() => ({}));
    const isAutoUpdate = body.autoUpdate === true;
    const updateOverview = body.updateOverview === true;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');

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

    console.log(`Fetching market indices via Yahoo Finance for: ${activeIndices.map(i => i.symbol).join(', ')}`);

    // Step 1: Try Yahoo Finance first
    const indexSymbols = activeIndices.map(i => i.symbol);
    const yahooIndexResults = await fetchAllYahooFinancePrices(indexSymbols);
    const yahooSuccessCount = Object.keys(yahooIndexResults).length;
    console.log(`Yahoo Finance returned data for ${yahooSuccessCount}/${activeIndices.length} indices`);

    // Step 2: Fallback to Perplexity for missing indices
    const missingIndices = activeIndices.filter(i => !yahooIndexResults[i.symbol]);
    let perplexityIndexResults: Record<string, { value: number; change: number; percent: number }> = {};

    if (missingIndices.length > 0 && PERPLEXITY_API_KEY) {
      console.log(`Falling back to Perplexity for ${missingIndices.length} missing indices: ${missingIndices.map(i => i.symbol).join(', ')}`);

      const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'sonar-pro',
          messages: [
            { role: 'system', content: 'You are a financial data assistant. Return ONLY the requested data. No explanations.' },
            { role: 'user', content: `Latest closing prices:\n${missingIndices.map(i => `- ${i.symbol} (${i.name_en})`).join('\n')}\n\nFormat: SYMBOL: price (change, change_pct%)` },
          ],
          search_recency_filter: 'day',
        }),
      });

      if (perplexityResponse.ok) {
        const perplexityData = await perplexityResponse.json();
        const content = perplexityData.choices?.[0]?.message?.content || '';
        console.log('Perplexity fallback for indices:', content);
        perplexityIndexResults = parsePerplexityResponse(content, missingIndices.map(i => i.symbol));
      } else {
        const errText = await perplexityResponse.text();
        console.error('Perplexity fallback failed:', errText);
      }
    }

    // Step 3: Update DB with combined results
    const results: IndexResult[] = [];
    for (const index of activeIndices) {
      const data = yahooIndexResults[index.symbol] || perplexityIndexResults[index.symbol];
      const source = yahooIndexResults[index.symbol] ? 'Yahoo Finance' : perplexityIndexResults[index.symbol] ? 'Perplexity' : 'none';

      if (data) {
        results.push({
          symbol: index.symbol,
          name: index.name_ko,
          currentValue: data.value,
          changeValue: data.change,
          changePercent: data.percent,
        });

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
          console.log(`Updated ${index.name_ko}: ${data.value} (${source})`);
        }
      } else {
        results.push({
          symbol: index.symbol,
          name: index.name_ko,
          currentValue: null,
          changeValue: null,
          changePercent: null,
          error: 'No data from Yahoo or Perplexity',
        });
      }
    }
    
    console.log('Index update summary:', JSON.stringify(results.map(r => `${r.symbol}: ${r.currentValue ?? 'FAIL'}`)));

    // Also update market overview items if requested
    let overviewResults: any[] = [];
    if (updateOverview) {
      const { data: overviewItems } = await supabase
        .from('market_overview_items')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (overviewItems?.length) {
        console.log(`Fetching overview prices via Yahoo Finance for ${overviewItems.length} items...`);
        
        // Step 1: Try Yahoo Finance first
        const overviewSymbols = overviewItems.map(i => i.symbol);
        const yahooResults = await fetchAllYahooFinancePrices(overviewSymbols);

        const yahooSuccessCount = Object.keys(yahooResults).length;
        console.log(`Yahoo Finance returned data for ${yahooSuccessCount}/${overviewItems.length} items`);

        // Step 2: Find items that Yahoo didn't return data for
        let missingItems = overviewItems.filter(i => !yahooResults[i.symbol]);

        // Step 2.5: US Treasury API for treasury yields (before Perplexity)
        for (const item of missingItems) {
          if (item.symbol === 'TVC:US02Y') {
            const treasuryData = await fetchUSTreasuryYield('2');
            if (treasuryData) {
              yahooResults[item.symbol] = treasuryData;
              console.log(`US Treasury API: US02Y = ${treasuryData.value}`);
            }
          }
        }

        // Recalculate missing after Treasury API
        missingItems = overviewItems.filter(i => !yahooResults[i.symbol]);

        // Step 3: Fall back to Perplexity for remaining missing items
        let perplexityResults: Record<string, { value: number; change: number; percent: number }> = {};
        if (missingItems.length > 0 && PERPLEXITY_API_KEY) {
          console.log(`Falling back to Perplexity for ${missingItems.length} missing items: ${missingItems.map(i => i.symbol).join(', ')}`);
          
          const todayStr = new Date().toISOString().split('T')[0];
          const overviewResponse = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'sonar-pro',
              messages: [
                { role: 'system', content: `You are a financial data assistant. Today is ${todayStr}. Return ONLY the requested data. No explanations.` },
                { role: 'user', content: `Latest prices for:\n${missingItems.map(i => `- ${i.symbol} (${i.title_en})`).join('\n')}\n\nFormat: SYMBOL: price (change, change_pct%)` },
              ],
              search_recency_filter: 'day',
            }),
          });

          if (overviewResponse.ok) {
            const overviewData = await overviewResponse.json();
            const overviewContent = overviewData.choices?.[0]?.message?.content || '';
            console.log('Perplexity fallback response:', overviewContent);

            for (const item of missingItems) {
              const parsed = parsePerplexityLine(
                overviewContent.split('\n').find(line => line.includes(item.symbol)) || '',
                item.symbol
              );
              if (parsed) {
                perplexityResults[item.symbol] = parsed;
              }
            }
          } else {
            const errText = await overviewResponse.text();
            console.error('Perplexity fallback failed:', errText);
          }
        }

        // Step 4: Update DB with combined results
        for (const item of overviewItems) {
          const data = yahooResults[item.symbol] || perplexityResults[item.symbol];
          const source = yahooResults[item.symbol] ? (YAHOO_SYMBOL_MAP[item.symbol] ? 'Yahoo Finance' : 'US Treasury API') : perplexityResults[item.symbol] ? 'Perplexity' : 'none';
          
          if (data) {
            await supabase
              .from('market_overview_items')
              .update({
                current_value: data.value,
                change_value: data.change,
                change_percent: data.percent,
                updated_at: new Date().toISOString(),
              })
              .eq('id', item.id);

            overviewResults.push({ symbol: item.symbol, title: item.title_en, source, ...data });
          } else {
            overviewResults.push({ symbol: item.symbol, title: item.title_en, source: 'none', error: 'No data from Yahoo or Perplexity' });
          }
        }
        
        console.log('Overview update summary:', JSON.stringify(overviewResults.map(r => `${r.symbol}: ${r.value ?? 'FAIL'} (${r.source})`)));
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
