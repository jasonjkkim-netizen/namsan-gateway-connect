import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SETTINGS_KEY = 'hk_insurance_benchmark';

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

    const supabaseAuthClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAuthClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Enforce admin role
    const userId = (claimsData.claims as any).sub as string;
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const { data: roleData } = await serviceClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Forbidden: admin only' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
    if (!PERPLEXITY_API_KEY) {
      throw new Error('PERPLEXITY_API_KEY is not configured');
    }

    // Query Perplexity for HK dividend savings insurance average return
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: 'You are a financial data assistant. Return ONLY a valid JSON object. No markdown, no explanation.',
          },
          {
            role: 'user',
            content: `What is the current average expected total return (IRR) of popular Hong Kong dividend-paying savings insurance plans (저축성 배당 보험) with a 20-year maturity? Consider major insurers like AIA, Manulife, Prudential, Sun Life, FWD, and China Life. Use the most recent publicly available projected total return rates including non-guaranteed dividends.

Return ONLY this JSON format:
{
  "average_return_percent": <number>,
  "range_low_percent": <number>,
  "range_high_percent": <number>,
  "maturity_years": 20,
  "sample_products": ["product1", "product2"],
  "data_date": "YYYY-MM",
  "notes": "brief note"
}`,
          },
        ],
        temperature: 0,
        search_recency_filter: 'month',
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Perplexity API error:', response.status, errText);
      throw new Error(`Perplexity API error [${response.status}]`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const citations = data.citations || [];

    console.log('Perplexity response:', content);

    // Parse JSON from response
    let benchmarkData: any = null;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        benchmarkData = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('Failed to parse Perplexity response:', e, content);
      throw new Error('Failed to parse benchmark data');
    }

    if (!benchmarkData || typeof benchmarkData.average_return_percent !== 'number') {
      throw new Error('Invalid benchmark data from Perplexity');
    }

    // Validate the return is reasonable (3-12% range)
    if (benchmarkData.average_return_percent < 3 || benchmarkData.average_return_percent > 12) {
      console.warn('Benchmark return outside expected range:', benchmarkData.average_return_percent);
      throw new Error(`Benchmark return ${benchmarkData.average_return_percent}% outside expected 3-12% range`);
    }

    // Save to app_settings
    const settingsValue = {
      ...benchmarkData,
      citations,
      updated_at: new Date().toISOString(),
    };

    const { data: existing } = await serviceClient
      .from('app_settings')
      .select('id')
      .eq('key', SETTINGS_KEY)
      .maybeSingle();

    if (existing) {
      await serviceClient
        .from('app_settings')
        .update({
          value: settingsValue,
          updated_at: new Date().toISOString(),
          updated_by: userId,
        })
        .eq('key', SETTINGS_KEY);
    } else {
      await serviceClient
        .from('app_settings')
        .insert({
          key: SETTINGS_KEY,
          value: settingsValue,
          updated_by: userId,
        });
    }

    return new Response(
      JSON.stringify({ success: true, data: settingsValue }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('fetch-hk-insurance-benchmark error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
