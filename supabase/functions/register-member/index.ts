import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the caller's identity
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await callerClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const callerId = claimsData.claims.sub as string;

    // Get caller's profile to verify they have a sales role
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: callerProfile, error: callerProfileError } = await adminClient
      .from("profiles")
      .select("user_id, full_name, sales_role, sales_level")
      .eq("user_id", callerId)
      .maybeSingle();

    if (callerProfileError || !callerProfile || !callerProfile.sales_role) {
      return new Response(JSON.stringify({ error: "You don't have permission to add members" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const ROLE_LEVELS: Record<string, number> = {
      webmaster: 0,
      district_manager: 1,
      deputy_district_manager: 2,
      principal_agent: 3,
      agent: 4,
      client: 5,
    };

    const callerLevel = ROLE_LEVELS[callerProfile.sales_role] ?? 99;

    const { email, password, fullName, phone, address, birthday, role } = await req.json();

    // Validate inputs
    if (!email || !password || !fullName || !phone || !address || !birthday || !role) {
      return new Response(JSON.stringify({ error: "All fields are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (typeof password !== "string" || password.length < 6) {
      return new Response(JSON.stringify({ error: "Password must be at least 6 characters" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (typeof email !== "string" || email.length > 255) {
      return new Response(JSON.stringify({ error: "Invalid email" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (typeof fullName !== "string" || fullName.length < 1 || fullName.length > 100) {
      return new Response(JSON.stringify({ error: "Name must be 1-100 characters" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Verify role hierarchy: caller can only add roles below their level
    const newRoleLevel = ROLE_LEVELS[role];
    if (newRoleLevel === undefined || role === "webmaster") {
      return new Response(JSON.stringify({ error: "Invalid role" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (newRoleLevel <= callerLevel) {
      return new Response(JSON.stringify({ error: "You can only add roles below your level" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Create user via admin API (does NOT affect caller's session)
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (createError) {
      console.error("Create user error:", createError);
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!newUser?.user) {
      return new Response(JSON.stringify({ error: "Failed to create user" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Wait for profile trigger, then update
    let profileUpdated = false;
    for (let attempt = 0; attempt < 8; attempt++) {
      const { error: updateError } = await adminClient
        .from("profiles")
        .update({
          phone,
          address,
          birthday,
          sales_role: role,
          parent_id: callerId,
          sales_status: "pending",
        })
        .eq("user_id", newUser.user.id);

      if (!updateError) {
        profileUpdated = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    if (!profileUpdated) {
      return new Response(JSON.stringify({ error: "Failed to update profile" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_id: newUser.user.id,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Register member error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
