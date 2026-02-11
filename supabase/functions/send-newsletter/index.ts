import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No auth header");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRole) throw new Error("Admin access required");

    const { subject, htmlContent, newsletterId } = await req.json();

    if (!subject || !htmlContent) {
      throw new Error("Missing subject or content");
    }

    // Get all approved user emails
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("email, full_name, preferred_language")
      .eq("is_approved", true);

    if (profilesError) throw profilesError;
    if (!profiles || profiles.length === 0) {
      throw new Error("No approved recipients found");
    }

    const emails = profiles.map((p: any) => p.email).filter(Boolean);

    // Send emails in batches of 50
    let sentCount = 0;
    const batchSize = 50;

    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);

      // Send individually to avoid exposing email addresses
      for (const email of batch) {
        try {
          await resend.emails.send({
            from: "Namsan Partners <newsletter@namsan-partners.com>",
            to: [email],
            subject: subject,
            html: `
              <div style="max-width: 600px; margin: 0 auto; font-family: 'Georgia', serif; color: #1a1a1a;">
                <div style="background: linear-gradient(135deg, #1a365d, #2d4a7c); padding: 24px 32px; text-align: center;">
                  <h1 style="color: white; margin: 0; font-size: 22px; font-weight: 600;">Namsan Partners</h1>
                  <p style="color: #cbd5e0; margin: 4px 0 0; font-size: 13px;">Newsletter</p>
                </div>
                <div style="padding: 32px; background: #ffffff; border: 1px solid #e2e8f0; border-top: none;">
                  ${htmlContent}
                </div>
                <div style="padding: 16px 32px; background: #f7fafc; text-align: center; border: 1px solid #e2e8f0; border-top: none;">
                  <p style="color: #a0aec0; font-size: 11px; margin: 0;">
                    © ${new Date().getFullYear()} Namsan Partners. All rights reserved.
                  </p>
                </div>
              </div>
            `,
          });
          sentCount++;
        } catch (emailError) {
          console.error(`Failed to send to ${email}:`, emailError);
        }
      }
    }

    // Update newsletter record
    if (newsletterId) {
      await supabase
        .from("newsletters")
        .update({
          sent_at: new Date().toISOString(),
          sent_by: user.id,
          recipient_count: sentCount,
          status: "sent",
        })
        .eq("id", newsletterId);
    }

    return new Response(
      JSON.stringify({ success: true, sentCount, totalRecipients: emails.length }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Newsletter error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
