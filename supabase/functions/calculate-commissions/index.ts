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

    // Verify the caller using their JWT
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      console.error("Auth claims error:", claimsError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    // Use service role for data operations
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Check if user is admin OR has a sales role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    const { data: profileData } = await supabase
      .from("profiles")
      .select("sales_role")
      .eq("user_id", userId)
      .single();

    const isAdmin = !!roleData;
    const isSalesUser = !!profileData?.sales_role;

    if (!isAdmin && !isSalesUser) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { investment_id } = await req.json();
    if (!investment_id || typeof investment_id !== "string") {
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

    // If sales user (not admin), verify they created this investment or the investor is in their subtree
    if (!isAdmin) {
      const { data: inSubtree } = await supabase.rpc("is_in_subtree", {
        _ancestor_id: userId,
        _descendant_id: investment.user_id,
      });
      if (!inSubtree) {
        return new Response(JSON.stringify({ error: "Not authorized for this investment" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 2. Get the investor's profile (may not exist for quick-registered clients)
    const { data: investorProfile } = await supabase
      .from("profiles")
      .select("user_id, parent_id, sales_role, full_name")
      .eq("user_id", investment.user_id)
      .maybeSingle();

    const investorName = investorProfile?.full_name || "Unknown Investor";

    // 3. Get ancestors (upline)
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

    // 5. Fetch commission rates
    const { data: rates } = await supabase
      .from("commission_rates")
      .select("*")
      .eq("product_id", productId)
      .eq("is_override", false);

    const ratesByRole: Record<string, { upfront_rate: number; performance_rate: number }> = {};
    if (rates && rates.length > 0) {
      // Use manually configured rates; roles not explicitly set get 0
      for (const r of rates) {
        ratesByRole[r.sales_role] = {
          upfront_rate: Number(r.upfront_rate),
          performance_rate: Number(r.performance_rate),
        };
      }
      // Roles without manual rates get 0 (not default splits)
    } else {
      // No manual rates found — auto-generate defaults from product's upfront_commission_percent
      const { data: productData } = await supabase
        .from("investment_products")
        .select("upfront_commission_percent, performance_fee_percent")
        .eq("id", productId)
        .single();

      if (productData?.upfront_commission_percent) {
        const totalUpfront = Number(productData.upfront_commission_percent);
        const totalPerformance = Number(productData.performance_fee_percent) || 0;
        // Default split: upper hierarchy favored
        const defaultSplits: Record<string, number> = {
          webmaster: 0.40,
          district_manager: 0.40,
          deputy_district_manager: 0.25,
          principal_agent: 0.20,
          agent: 0.15,
        };
        for (const [role, ratio] of Object.entries(defaultSplits)) {
          ratesByRole[role] = {
            upfront_rate: Math.round(totalUpfront * ratio * 100) / 100,
            performance_rate: Math.round(totalPerformance * ratio * 100) / 100,
          };
        }
        console.log("Using default auto-distribution rates:", ratesByRole);
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

    // 7. Delete existing distributions (recalculate)
    const { data: existingDists } = await supabase
      .from("commission_distributions")
      .select("*")
      .eq("investment_id", investment_id);

    await supabase
      .from("commission_distributions")
      .delete()
      .eq("investment_id", investment_id);

    // 8. Calculate distributions (waterfall)
    const investmentAmount = Number(investment.investment_amount);
    const realizedReturn = Number(investment.realized_return_amount) || 0;
    const distributions: any[] = [];

    const sortedAncestors = (ancestors || []).sort((a: any, b: any) => a.depth - b.depth);

    for (const ancestor of sortedAncestors) {
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
        set_by_user_id: userId,
        currency: investment.invested_currency || "USD",
        status: "available",
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
      changed_by: userId,
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

    // 11. Send notifications to ancestors about new investment
    if (insertedCount > 0) {
      try {
        const internalSecret = Deno.env.get("INTERNAL_SERVICE_SECRET");
        await fetch(`${supabaseUrl}/functions/v1/notify-sales`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(internalSecret ? { "x-internal-secret": internalSecret } : {}),
          },
          body: JSON.stringify({
            type: "investment_created",
            investment_id,
            investor_name: investorName,
            product_name_en: investment.product_name_en,
            product_name_ko: investment.product_name_ko,
            amount: investmentAmount,
            currency: investment.invested_currency || "USD",
            recipient_ids: [investment.user_id],
          }),
        });
      } catch (notifyErr) {
        console.error("Notification error (non-blocking):", notifyErr);
      }
    }

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
