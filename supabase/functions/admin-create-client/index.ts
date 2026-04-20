import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VALID_ROLES = [
  "webmaster",
  "district_manager",
  "deputy_district_manager",
  "principal_agent",
  "agent",
  "client",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: authError } = await anonClient.auth.getClaims(token);
    if (authError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = claimsData.claims.sub as string;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller has admin role via user_roles
    const { data: roleCheck, error: roleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError || !roleCheck) {
      return new Response(JSON.stringify({ error: "Admin role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    let {
      email,
      password,
      full_name,
      full_name_ko,
      phone,
      address,
      birthday,
      preferred_language,
      parent_id,
      sales_role,
      grant_admin,
      admin_notes,
    } = body ?? {};

    // Admin-create: relax requirements. Auto-generate fallbacks where missing.
    // Generate placeholder email if missing/invalid
    const emailValid = typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 255;
    if (!emailValid) {
      const ts = Date.now();
      const rand = Math.random().toString(36).slice(2, 8);
      email = `client_${ts}_${rand}@placeholder.local`;
    }
    // Generate random password if missing or too short
    if (!password || typeof password !== "string" || password.length < 6) {
      password = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    }
    // Use Korean name or email-prefix as fallback for full_name
    if (!full_name || typeof full_name !== "string" || full_name.trim().length < 1) {
      if (full_name_ko && String(full_name_ko).trim().length > 0) {
        full_name = String(full_name_ko).trim();
      } else {
        full_name = String(email).split("@")[0];
      }
    }
    if (full_name.length > 100) full_name = full_name.slice(0, 100);

    const finalRole = sales_role && VALID_ROLES.includes(sales_role) ? sales_role : "client";

    const cleanName = full_name.trim().replace(/[\x00-\x1F\x7F]/g, "");
    const cleanNameKo = full_name_ko ? String(full_name_ko).trim().slice(0, 100).replace(/[\x00-\x1F\x7F]/g, "") : null;
    const cleanNotes = admin_notes ? String(admin_notes).slice(0, 5000).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") : null;

    // Create auth user
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: cleanName },
    });

    if (createError || !newUser?.user) {
      console.error("Create user error:", createError);
      return new Response(JSON.stringify({ error: createError?.message || "Failed to create user" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Wait for profile trigger then update with full info
    // Note: sales_level is auto-computed by validate_hierarchy_depth trigger from parent
    let profileUpdated = false;
    let lastError: any = null;
    for (let attempt = 0; attempt < 8; attempt++) {
      const updatePayload: Record<string, any> = {
        full_name: cleanName,
        full_name_ko: cleanNameKo,
        phone: phone || null,
        address: address || null,
        birthday: birthday || null,
        preferred_language: preferred_language || "en",
        sales_role: finalRole,
        parent_id: parent_id || null,
        sales_status: "approved",
        is_approved: true,
        approved_at: new Date().toISOString(),
        approved_by: callerId,
      };

      // If no parent given, set sales_level explicitly to 0 for webmaster, else 1
      if (!parent_id) {
        updatePayload.sales_level = finalRole === "webmaster" ? 0 : 1;
      }

      const { error: updateError } = await adminClient
        .from("profiles")
        .update(updatePayload)
        .eq("user_id", newUser.user.id);

      if (!updateError) {
        profileUpdated = true;
        break;
      }
      lastError = updateError;
      console.error(`Profile update attempt ${attempt + 1} failed:`, updateError);
      await new Promise((r) => setTimeout(r, 500));
    }

    if (!profileUpdated) {
      return new Response(JSON.stringify({ error: lastError?.message || "Failed to update profile after creation" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Optionally grant admin role
    if (grant_admin === true) {
      const { error: adminGrantError } = await adminClient
        .from("user_roles")
        .insert({ user_id: newUser.user.id, role: "admin" });
      if (adminGrantError) {
        console.error("Grant admin error:", adminGrantError);
        // non-fatal
      }
    }

    return new Response(
      JSON.stringify({ success: true, user_id: newUser.user.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("admin-create-client error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
