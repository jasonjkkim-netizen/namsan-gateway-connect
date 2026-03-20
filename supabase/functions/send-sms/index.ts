import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SmsRequest {
  to: string | string[];
  content: string;
  subject?: string; // for LMS (long messages)
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

async function makeSignature(method: string, url: string, timestamp: string, accessKey: string, secretKey: string): Promise<string> {
  const message = method + " " + url + "\n" + timestamp + "\n" + accessKey;
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw", encoder.encode(secretKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
  return toBase64(signature);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const NAVER_ACCESS_KEY = Deno.env.get("NAVER_ACCESS_KEY");
    const NAVER_SECRET_KEY = Deno.env.get("NAVER_SECRET_KEY");
    const NAVER_SENS_SERVICE_ID = Deno.env.get("NAVER_SENS_SERVICE_ID");
    const NAVER_SENS_CALLING_NUMBER = Deno.env.get("NAVER_SENS_CALLING_NUMBER");

    if (!NAVER_ACCESS_KEY || !NAVER_SECRET_KEY || !NAVER_SENS_SERVICE_ID || !NAVER_SENS_CALLING_NUMBER) {
      throw new Error("Naver SENS SMS credentials are not configured");
    }

    // --- Authentication ---
    const internalSecret = Deno.env.get("INTERNAL_SERVICE_SECRET");
    const internalHeader = req.headers.get("x-internal-secret");
    const isInternalCall = internalSecret && internalHeader && internalHeader === internalSecret;

    if (!isInternalCall) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
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
      const { data: claimsData, error: authError } = await supabaseClient.auth.getClaims(token);
      if (authError || !claimsData?.claims?.sub) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const userId = claimsData.claims.sub as string;

      // Check admin or sales role
      const serviceClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      const { data: adminRole } = await serviceClient
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();

      const { data: profile } = await serviceClient
        .from("profiles")
        .select("sales_role")
        .eq("user_id", userId)
        .single();

      if (!adminRole && !profile?.sales_role) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { to, content, subject }: SmsRequest = await req.json();

    if (!to || !content) {
      return new Response(JSON.stringify({ error: "Missing 'to' and 'content' fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Normalize recipients
    const recipients = (Array.isArray(to) ? to : [to]).map((phone) => {
      // Strip non-digit except leading +
      const cleaned = phone.replace(/[^\d+]/g, "");
      // Convert Korean format: 010-xxxx-xxxx → +8210xxxxxxxx
      if (cleaned.startsWith("0")) {
        return { to: "+82" + cleaned.slice(1) };
      }
      if (!cleaned.startsWith("+")) {
        return { to: "+82" + cleaned };
      }
      return { to: cleaned };
    });

    // Determine SMS type: SMS (< 90 bytes), LMS (longer)
    const contentBytes = new TextEncoder().encode(content).length;
    const type = contentBytes > 80 ? "LMS" : "SMS";

    const timestamp = Date.now().toString();
    const uri = `/sms/v2/services/${NAVER_SENS_SERVICE_ID}/messages`;
    const signature = await makeSignature("POST", uri, timestamp, NAVER_ACCESS_KEY, NAVER_SECRET_KEY);

    const body: Record<string, unknown> = {
      type,
      from: NAVER_SENS_CALLING_NUMBER.replace(/[^\d]/g, ""),
      content,
      messages: recipients,
    };

    if (type === "LMS" && subject) {
      body.subject = subject;
    }

    const response = await fetch(`https://sens.apigw.ntruss.com${uri}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "x-ncp-apigw-timestamp": timestamp,
        "x-ncp-iam-access-key": NAVER_ACCESS_KEY,
        "x-ncp-apigw-signature-v2": signature,
      },
      body: JSON.stringify(body),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Naver SENS API error:", response.status, result);
      return new Response(
        JSON.stringify({ success: false, error: `SENS API error [${response.status}]`, details: result }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("SMS sent successfully:", result);

    return new Response(JSON.stringify({ success: true, data: result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-sms function:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
