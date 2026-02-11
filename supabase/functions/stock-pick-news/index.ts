import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
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

    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
    if (!PERPLEXITY_API_KEY) throw new Error("PERPLEXITY_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch active stock picks
    const { data: stocks, error: stockErr } = await supabase
      .from("weekly_stock_picks")
      .select("stock_name, stock_code")
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (stockErr) throw stockErr;
    if (!stocks || stocks.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No active stocks" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stockNames = stocks.map((s) => s.stock_name).join(", ");

    const today = new Date();
    const koDate = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;

    // Single Perplexity call for all stocks
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "system",
            content: `당신은 한국 주식시장 전문 애널리스트입니다. 각 종목별로 오늘의 주요 뉴스를 2-3개 불릿포인트로 간결하게 정리해주세요.
반드시 아래 JSON 형식으로만 응답하세요. 마크다운이나 다른 텍스트 없이 JSON만 출력하세요:
[
  {"stock_name": "종목명", "bullets": ["뉴스1", "뉴스2"]},
  ...
]`,
          },
          {
            role: "user",
            content: `${koDate} 기준, 다음 종목들의 최신 주요 뉴스를 각각 정리해주세요: ${stockNames}`,
          },
        ],
        search_recency_filter: "day",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Perplexity API error:", response.status, errorText);
      throw new Error(`Perplexity API error [${response.status}]`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const citations = data.citations || [];

    // Parse JSON from response
    let newsItems: Array<{ stock_name: string; bullets: string[] }> = [];
    try {
      // Try to extract JSON from the response (may have markdown wrapping)
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        newsItems = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error("Failed to parse Perplexity response:", e, content);
      throw new Error("Failed to parse news response");
    }

    // Clear old news and insert new
    await supabase.from("stock_pick_news").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    const now = new Date().toISOString();
    const insertData = newsItems.map((item) => {
      const stock = stocks.find((s) => s.stock_name === item.stock_name);
      return {
        stock_name: item.stock_name,
        stock_code: stock?.stock_code || null,
        news_bullets: item.bullets,
        citations: citations,
        fetched_at: now,
      };
    });

    if (insertData.length > 0) {
      const { error: insertErr } = await supabase.from("stock_pick_news").insert(insertData);
      if (insertErr) throw insertErr;
    }

    return new Response(
      JSON.stringify({ success: true, count: insertData.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("stock-pick-news error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
