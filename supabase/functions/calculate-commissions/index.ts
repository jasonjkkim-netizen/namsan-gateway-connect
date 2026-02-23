import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the caller is admin using their JWT
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role for data operations
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Check admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { investment_id } = await req.json();
    if (!investment_id) {
      return new Response(JSON.stringify({ error: "investment_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Fetch the investment
    const { data: investment, error: invErr } = await supabase
      .from("client_investments")
      .select("*")
      .eq("id", investment_id)
      .single();

    if (invErr || !investment) {
      return new Response(JSON.stringify({ error: "Investment not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Get the investor's profile to find their upline
    const { data: investorProfile } = await supabase
      .from("profiles")
      .select("user_id, parent_id, sales_role, full_name")
      .eq("user_id", investment.user_id)
      .single();

    if (!investorProfile) {
      return new Response(JSON.stringify({ error: "Investor profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Get ancestors (upline) using the DB function
    const { data: ancestors, error: ancestorErr } = await supabase
      .rpc("get_sales_ancestors", { _user_id: investment.user_id });

    if (ancestorErr) {
      console.error("Error getting ancestors:", ancestorErr);
      return new Response(JSON.stringify({ error: "Failed to get sales hierarchy" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Determine the product_id for rate lookup
    const productId = investment.product_id;
    if (!productId) {
      return new Response(JSON.stringify({ error: "Investment has no linked product" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Fetch commission rates for this product
    const { data: rates } = await supabase
      .from("commission_rates")
      .select("*")
      .eq("product_id", productId)
      .eq("is_override", false);

    const ratesByRole: Record<string, { upfront_rate: number; performance_rate: number }> = {};
    if (rates) {
      for (const r of rates) {
        ratesByRole[r.sales_role] = {
          upfront_rate: Number(r.upfront_rate),
          performance_rate: Number(r.performance_rate),
        };
      }
    }

    // 6. Check for user-specific overrides
    const ancestorIds = (ancestors || []).map((a: any) => a.user_id);
    const { data: overrides } = await supabase
      .from("commission_rates")
      .select("*")
      .eq("product_id", productId)
      .eq("is_override", true)
      .in("override_user_id", ancestorIds);

    const overridesByUser: Record<string, { upfront_rate: number; performance_rate: number }> = {};
    if (overrides) {
      for (const o of overrides) {
        if (o.override_user_id) {
          overridesByUser[o.override_user_id] = {
            upfront_rate: Number(o.upfront_rate),
            performance_rate: Number(o.performance_rate),
          };
        }
      }
    }

    // 7. Delete existing distributions for this investment (recalculate)
    const { data: existingDists } = await supabase
      .from("commission_distributions")
      .select("*")
      .eq("investment_id", investment_id);

    await supabase
      .from("commission_distributions")
      .delete()
      .eq("investment_id", investment_id);

    // 8. Calculate distributions for each ancestor (waterfall)
    const investmentAmount = Number(investment.investment_amount);
    const realizedReturn = Number(investment.realized_return_amount) || 0;
    const distributions: any[] = [];

    // Also include the direct seller (the investor's parent) first, then up
    const sortedAncestors = (ancestors || []).sort((a: any, b: any) => a.depth - b.depth);

    for (const ancestor of sortedAncestors) {
      // Use override if available, otherwise use role-based rate
      const rate = overridesByUser[ancestor.user_id] || ratesByRole[ancestor.sales_role];
      if (!rate) continue;

      const upfrontAmount = investmentAmount * (rate.upfront_rate / 100);
      const performanceAmount = realizedReturn * (rate.performance_rate / 100);

      if (upfrontAmount === 0 && performanceAmount === 0) continue;

      distributions.push({
        investment_id,
        from_user_id: investment.user_id,
        to_user_id: ancestor.user_id,
        layer: ancestor.depth,
        upfront_amount: Math.round(upfrontAmount * 100) / 100,
        performance_amount: Math.round(performanceAmount * 100) / 100,
        rate_used: rate.upfront_rate,
        set_by_user_id: user.id,
        currency: investment.invested_currency || "USD",
        status: "pending",
      });
    }

    // 9. Insert new distributions
    let insertedCount = 0;
    if (distributions.length > 0) {
      const { error: insertErr } = await supabase
        .from("commission_distributions")
        .insert(distributions);

      if (insertErr) {
        console.error("Error inserting distributions:", insertErr);
        return new Response(JSON.stringify({ error: "Failed to create distributions" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      insertedCount = distributions.length;
    }

    // 10. Write audit log
    await supabase.from("commission_audit_log").insert({
      action: "calculate_commissions",
      target_table: "commission_distributions",
      target_id: investment_id,
      changed_by: user.id,
      old_values: existingDists && existingDists.length > 0
        ? { count: existingDists.length, distributions: existingDists }
        : null,
      new_values: {
        count: insertedCount,
        investment_amount: investmentAmount,
        realized_return: realizedReturn,
        distributions: distributions.map((d) => ({
          to_user_id: d.to_user_id,
          layer: d.layer,
          upfront: d.upfront_amount,
          performance: d.performance_amount,
          rate: d.rate_used,
        })),
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        distributions_created: insertedCount,
        total_upfront: distributions.reduce((s, d) => s + d.upfront_amount, 0),
        total_performance: distributions.reduce((s, d) => s + d.performance_amount, 0),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Commission calculation error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
