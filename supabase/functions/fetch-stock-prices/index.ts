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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { stockCodes } = await req.json();

    if (!stockCodes || !Array.isArray(stockCodes) || stockCodes.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Stock codes array is required' }),
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
