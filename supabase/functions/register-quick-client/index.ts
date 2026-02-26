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

    // Verify caller using anon client
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

    // Use service role client for privileged operations
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

    // Validate input
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

    // Generate a placeholder user_id and email
    const placeholderId = crypto.randomUUID();
    const placeholderEmail = `client_${placeholderId.slice(0, 8)}@placeholder.local`;

    // Insert profile directly (bypasses auth, uses service role)
    const { data: profile, error: insertError } = await adminClient
      .from("profiles")
      .insert({
        user_id: placeholderId,
        email: placeholderEmail,
        full_name: cleanName,
        sales_role: "client",
        parent_id: caller.id,
        sales_status: "pending",
        is_approved: false,
      })
      .select("id, user_id, full_name, email")
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, profile }),
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
