import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Simple in-memory rate limiter
const rateLimiter = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const userLimit = rateLimiter.get(userId);
  if (!userLimit || now > userLimit.resetAt) {
    rateLimiter.set(userId, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (userLimit.count >= maxRequests) return false;
  userLimit.count++;
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimiter.entries()) {
    if (now > value.resetAt) rateLimiter.delete(key);
  }
}, 60000);

const SYSTEM_PROMPT = `You are a senior investment analyst at Namsan Partners, a premier Korean investment firm. 
You are analyzing the firm's Flagship Portfolio for risk/return assessment.

Your analysis must include these sections with markdown headers:

## 포트폴리오 개요 (Portfolio Overview)
Brief summary of the current portfolio composition.

## 리스크 분석 (Risk Analysis)
- Concentration risk
- Currency exposure (KRW vs USD)
- Asset class diversification
- Market risk factors

## 수익률 분석 (Return Analysis)  
- Current performance vs expectations
- Individual asset contribution
- Yield analysis for fixed income

## 리스크-리턴 평가 (Risk-Return Assessment)
- Overall risk-adjusted return outlook
- Sharpe ratio estimate if applicable
- Portfolio efficiency

## 권고사항 (Recommendations)
- 2-3 actionable suggestions for portfolio optimization

Guidelines:
- Be specific with numbers from the data provided
- Use both Korean and English for key terms
- Keep the analysis professional and data-driven
- Format numbers clearly (percentages, prices)
- Total length: 400-600 words`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limiting: 5 requests per minute per user
    const userId = claimsData.claims.sub as string;
    if (!checkRateLimit(userId, 5, 60000)) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please wait before requesting another analysis." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { portfolioData, language } = await req.json();

    if (!portfolioData || !Array.isArray(portfolioData)) {
      return new Response(JSON.stringify({ error: "Invalid portfolio data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cap array length to prevent abuse
    if (portfolioData.length > 100) {
      return new Response(JSON.stringify({ error: "Portfolio data exceeds maximum of 100 items" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate each item has expected shape and reasonable field lengths
    for (const item of portfolioData) {
      if (typeof item !== 'object' || item === null) {
        return new Response(JSON.stringify({ error: "Invalid portfolio item" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (typeof item.name === 'string' && item.name.length > 200) {
        return new Response(JSON.stringify({ error: "Portfolio item name too long" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (typeof item.group === 'string' && item.group.length > 200) {
        return new Response(JSON.stringify({ error: "Portfolio item group too long" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const lang = language === 'ko' ? 'Korean' : 'English';
    const userPrompt = `Please analyze the following Namsan Flagship Portfolio data. Respond primarily in ${lang}.

Portfolio Items (as of today):
${JSON.stringify(portfolioData, null, 2)}

Base date for performance calculation: August 1, 2025.
Analysis date: ${new Date().toISOString().split('T')[0]}.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Service temporarily unavailable." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Failed to connect to AI service" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("analyze-portfolio error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
