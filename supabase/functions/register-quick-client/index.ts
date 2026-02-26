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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: authError } = await anonClient.auth.getUser();
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is webmaster
    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("sales_role, full_name")
      .eq("user_id", caller.id)
      .single();

    if (!callerProfile || callerProfile.sales_role !== "webmaster") {
      return new Response(
        JSON.stringify({ error: "Only webmasters can use quick registration" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { full_name } = await req.json();

    if (!full_name || typeof full_name !== "string" || full_name.trim().length < 1) {
      return new Response(
        JSON.stringify({ error: "Client name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanName = full_name.trim().slice(0, 100).replace(/[\x00-\x1F\x7F]/g, "");
    if (cleanName.length === 0) {
      return new Response(
        JSON.stringify({ error: "Invalid name" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate placeholder email and random password
    const placeholderId = crypto.randomUUID().slice(0, 8);
    const placeholderEmail = `client_${placeholderId}@placeholder.local`;
    const randomPassword = crypto.randomUUID(); // random unguessable password

    // Create auth user via admin API (bypasses email confirmation)
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: placeholderEmail,
      password: randomPassword,
      email_confirm: true,
      user_metadata: { full_name: cleanName },
    });

    if (createError || !newUser.user) {
      console.error("Create user error:", createError);
      return new Response(
        JSON.stringify({ error: createError?.message || "Failed to create user" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Wait for profile trigger, then update with sales info
    let profileUpdated = false;
    for (let attempt = 0; attempt < 8; attempt++) {
      const { error: updateError } = await adminClient
        .from("profiles")
        .update({
          sales_role: "client",
          parent_id: caller.id,
          sales_status: "pending",
          is_approved: false,
        })
        .eq("user_id", newUser.user.id);

      if (!updateError) {
        profileUpdated = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    if (!profileUpdated) {
      return new Response(
        JSON.stringify({ error: "Failed to update profile" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, user_id: newUser.user.id, full_name: cleanName }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Quick register error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
