import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

async function hmacSha256Base64(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw", encoder.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
  return toBase64(signature);
}

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

function escapeHtml(str: string): string {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;')
            .replace(/>/g,'&gt;').replace(/"/g,'&quot;')
            .replace(/'/g,'&#039;');
}

async function sendSms(to: string, content: string) {
  const NAVER_ACCESS_KEY = Deno.env.get("NAVER_ACCESS_KEY");
  const NAVER_SECRET_KEY = Deno.env.get("NAVER_SECRET_KEY");
  const NAVER_SENS_SERVICE_ID = Deno.env.get("NAVER_SENS_SERVICE_ID");
  const NAVER_SENS_CALLING_NUMBER = Deno.env.get("NAVER_SENS_CALLING_NUMBER");

  if (!NAVER_ACCESS_KEY || !NAVER_SECRET_KEY || !NAVER_SENS_SERVICE_ID || !NAVER_SENS_CALLING_NUMBER) {
    console.warn("Naver SENS SMS credentials not configured, skipping SMS");
    return;
  }

  const cleaned = to.replace(/[^\d+]/g, "");
  const recipient = cleaned.startsWith("0") ? "+82" + cleaned.slice(1) : cleaned.startsWith("+") ? cleaned : "+82" + cleaned;

  const timestamp = Date.now().toString();
  const uri = `/sms/v2/services/${NAVER_SENS_SERVICE_ID}/messages`;
  const message = "POST " + uri + "\n" + timestamp + "\n" + NAVER_ACCESS_KEY;
  const encoder = new TextEncoder();
  const signature = hmac("sha256", encoder.encode(NAVER_SECRET_KEY), encoder.encode(message), "utf8", "base64") as string;

  const contentBytes = new TextEncoder().encode(content).length;
  const type = contentBytes > 80 ? "LMS" : "SMS";

  try {
    const response = await fetch(`https://sens.apigw.ntruss.com${uri}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "x-ncp-apigw-timestamp": timestamp,
        "x-ncp-iam-access-key": NAVER_ACCESS_KEY,
        "x-ncp-apigw-signature-v2": signature,
      },
      body: JSON.stringify({
        type,
        from: NAVER_SENS_CALLING_NUMBER.replace(/[^\d]/g, ""),
        content,
        messages: [{ to: recipient }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("SMS send failed:", response.status, err);
    } else {
      console.log("SMS sent to:", recipient);
    }
  } catch (err) {
    console.error("SMS send error:", err);
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SignupNotificationRequest {
  userName: string;
  userEmail: string;
  userPhone: string;
  userAddress: string;
  userBirthday: string;
  signupDate: string;
}

const ADMIN_EMAIL = Deno.env.get('ADMIN_EMAIL') || 'admin@namsan-korea.com';

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing authorization header" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);

    if (claimsError || !claimsData?.claims) {
      console.error("Authentication failed:", claimsError);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid authentication" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const authenticatedEmail = claimsData.claims.email;

    const { 
      userName, userEmail, userPhone, userAddress, userBirthday, signupDate 
    }: SignupNotificationRequest = await req.json();

    if (!userName || !userEmail) {
      throw new Error("Missing required fields: userName and userEmail");
    }

    if (authenticatedEmail && userEmail.toLowerCase() !== authenticatedEmail.toLowerCase()) {
      console.warn(`Email mismatch: authenticated=${authenticatedEmail}, requested=${userEmail}`);
      return new Response(
        JSON.stringify({ success: false, error: "Email mismatch - unauthorized" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Use service role client to query district managers
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch webmasters only (email + phone for SMS)
    const { data: webmasterProfiles } = await serviceClient
      .from('profiles')
      .select('email, phone')
      .eq('sales_role', 'webmaster')
      .eq('is_approved', true)
      .or('is_deleted.is.null,is_deleted.eq.false')
      .or('is_rejected.is.null,is_rejected.eq.false');

    // Collect webmaster emails, fallback to ADMIN_EMAIL if none found
    const recipientEmails = webmasterProfiles && webmasterProfiles.length > 0
      ? [...new Set(webmasterProfiles.map(p => p.email).filter(Boolean))]
      : [ADMIN_EMAIL];

    // Collect webmaster phones for SMS
    const recipientPhones = webmasterProfiles
      ? webmasterProfiles.map(p => p.phone).filter(Boolean) as string[]
      : [];

    console.log(`Sending signup notification to ${recipientEmails.length} webmaster(s):`, recipientEmails);

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #B8860B, #DAA520); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border: 1px solid #eee; }
          .info-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .info-table th { text-align: left; padding: 12px; background: #f0f0f0; border-bottom: 1px solid #ddd; width: 120px; }
          .info-table td { padding: 12px; border-bottom: 1px solid #ddd; }
          .cta-button { display: inline-block; background: #B8860B; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">🔔 신규 가입 승인 요청</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">New Registration Pending Approval</p>
          </div>
          <div class="content">
            <p>안녕하세요,</p>
            <p>새로운 사용자가 Namsan Korea 클라이언트 포털에 가입을 요청했습니다. 아래 정보를 확인하시고 승인해 주세요.</p>
            
            <table class="info-table">
              <tr><th>이름 / Name</th><td><strong>${escapeHtml(userName)}</strong></td></tr>
              <tr><th>이메일 / Email</th><td>${escapeHtml(userEmail)}</td></tr>
              <tr><th>연락처 / Phone</th><td>${escapeHtml(userPhone || '-')}</td></tr>
              <tr><th>주소 / Address</th><td>${escapeHtml(userAddress || '-')}</td></tr>
              <tr><th>생년월일 / DOB</th><td>${escapeHtml(userBirthday || '-')}</td></tr>
              <tr><th>가입일 / Date</th><td>${escapeHtml(signupDate)}</td></tr>
            </table>
            
            <p>Admin 대시보드에서 이 가입 요청을 승인하거나 거절할 수 있습니다.</p>
            
            <center>
              <a href="https://namsan-gateway-connect.lovable.app/admin" class="cta-button">
                승인 페이지로 이동 →
              </a>
            </center>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Namsan Korea. All rights reserved.</p>
            <p>This is an automated notification from Namsan Korea Client Portal.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const emailResponse = await resend.emails.send({
      from: "Namsan Partners <noreply@namsan-partners.com>",
      to: recipientEmails,
      subject: `[Namsan Korea] 신규 가입 승인 요청 - ${userName}`,
      html: emailHtml,
    });

    console.log("Signup notification email sent:", emailResponse);

    // Send SMS to webmasters
    if (recipientPhones.length > 0) {
      const smsContent = `[남산파트너스] 신규 가입 승인 요청\n이름: ${userName}\n이메일: ${userEmail}\n연락처: ${userPhone || '-'}\n관리자 페이지에서 승인해 주세요.`;
      for (const phone of recipientPhones) {
        await sendSms(phone, smsContent);
      }
      console.log(`SMS sent to ${recipientPhones.length} webmaster(s)`);
    }

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in notify-admin-signup function:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
