import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface NotificationPayload {
  type: "investment_created" | "commission_status_changed";
  investment_id?: string;
  investor_name?: string;
  product_name_en?: string;
  product_name_ko?: string;
  amount?: number;
  currency?: string;
  commission_id?: string;
  new_status?: string;
  recipient_ids?: string[];
}

async function isAlertEnabled(supabase: any, category: string): Promise<boolean> {
  const { data } = await supabase
    .from("alert_settings")
    .select("is_enabled")
    .eq("category", category)
    .maybeSingle();
  return data?.is_enabled !== false;
}

async function logAlerts(supabase: any, category: string, subject: string, recipients: { user_id: string; name: string; email: string }[]) {
  if (recipients.length === 0) return;
  const rows = recipients.map(r => ({
    category,
    recipient_user_id: r.user_id,
    recipient_name: r.name,
    recipient_email: r.email,
    subject,
    is_manual: false,
  }));
  await supabase.from("alert_log").insert(rows);
}

// Get supervisor chain (ancestors) for a user, excluding admins
async function getSupervisorChain(supabase: any, userId: string): Promise<string[]> {
  const { data: ancestors } = await supabase.rpc("get_sales_ancestors", { _user_id: userId });
  if (!ancestors) return [];

  // Filter out admin users
  const ancestorIds = ancestors.map((a: any) => a.user_id);
  const { data: adminRoles } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin")
    .in("user_id", ancestorIds);

  const adminIds = new Set((adminRoles || []).map((r: any) => r.user_id));
  return ancestorIds.filter((id: string) => !adminIds.has(id));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const payload: NotificationPayload = await req.json();

    if (payload.type === "investment_created") {
      // Check toggle
      if (!(await isAlertEnabled(supabase, "investment"))) {
        return new Response(JSON.stringify({ success: true, notified: 0, disabled: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: ancestors } = await supabase.rpc("get_sales_ancestors", {
        _user_id: payload.recipient_ids?.[0],
      });

      if (!ancestors || ancestors.length === 0) {
        return new Response(JSON.stringify({ success: true, notified: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const amountStr = payload.amount
        ? `${payload.currency || "USD"} ${payload.amount.toLocaleString()}`
        : "";

      // Filter out admins from notification recipients
      const ancestorIds = ancestors.map((a: any) => a.user_id);
      const { data: adminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin")
        .in("user_id", ancestorIds);
      const adminIds = new Set((adminRoles || []).map((r: any) => r.user_id));

      const nonAdminAncestors = ancestors.filter((a: any) => !adminIds.has(a.user_id));

      // Build notification list: direct recipients + their supervisor chains
      const allRecipientIds = new Set<string>();
      for (const a of nonAdminAncestors) {
        allRecipientIds.add(a.user_id);
        // Cascade: also notify the supervisors of each ancestor (excluding admins)
        const supervisors = await getSupervisorChain(supabase, a.user_id);
        supervisors.forEach((id) => allRecipientIds.add(id));
      }

      const notifications = Array.from(allRecipientIds).map((uid) => ({
        user_id: uid,
        type: "investment",
        title_en: "New Investment Created",
        title_ko: "신규 투자 등록",
        body_en: `${payload.investor_name} invested ${amountStr} in ${payload.product_name_en}.`,
        body_ko: `${payload.investor_name}님이 ${payload.product_name_ko}에 ${amountStr}을 투자했습니다.`,
        link: "/sales-dashboard",
      }));

      const { error: insertErr } = await supabase.from("notifications").insert(notifications);
      if (insertErr) console.error("Error inserting notifications:", insertErr);

      // Log alerts
      const logSubject = `[Investment] ${payload.investor_name} - ${payload.product_name_en}`;
      const { data: recipientProfiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", Array.from(allRecipientIds));
      if (recipientProfiles) {
        await logAlerts(supabase, "investment", logSubject,
          recipientProfiles.map((p: any) => ({ user_id: p.user_id, name: p.full_name, email: p.email }))
        );
      }

      // Send email notifications via Resend
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (resendKey) {
        for (const uid of allRecipientIds) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("email, preferred_language")
            .eq("user_id", uid)
            .single();

          if (profile?.email) {
            const isKo = profile.preferred_language === "ko";
            try {
              await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                  from: "Namsan Partners <alert@namsan-partners.com>",
                  to: [profile.email],
                  subject: isKo
                    ? `[남산파트너스] ${payload.investor_name}님의 신규 투자`
                    : `[Namsan Partners] New Investment by ${payload.investor_name}`,
                  html: isKo
                    ? `<p>${payload.investor_name}님이 <strong>${payload.product_name_ko}</strong>에 <strong>${amountStr}</strong>을 투자했습니다.</p><p><a href="https://namsan-gateway-connect.lovable.app/sales-dashboard">영업 대시보드 바로가기</a></p>`
                    : `<p>${payload.investor_name} invested <strong>${amountStr}</strong> in <strong>${payload.product_name_en}</strong>.</p><p><a href="https://namsan-gateway-connect.lovable.app/sales-dashboard">Go to Sales Dashboard</a></p>`,
                }),
              });
            } catch (emailErr) {
              console.error("Email send error:", emailErr);
            }
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true, notified: allRecipientIds.size }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (payload.type === "commission_status_changed") {
      // Check toggle
      if (!(await isAlertEnabled(supabase, "commission"))) {
        return new Response(JSON.stringify({ success: true, notified: 0, disabled: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!payload.recipient_ids || payload.recipient_ids.length === 0) {
        return new Response(JSON.stringify({ success: true, notified: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const statusLabels: Record<string, { en: string; ko: string }> = {
        available: { en: "Available", ko: "수령가능" },
        paid: { en: "Paid", ko: "지급완료" },
        voided: { en: "Voided", ko: "취소됨" },
        pending: { en: "Pending", ko: "대기중" },
      };

      const label = statusLabels[payload.new_status || ""] || {
        en: payload.new_status,
        ko: payload.new_status,
      };

      // Expand recipients to include supervisor chain (excluding admins)
      const allRecipientIds = new Set<string>();
      for (const uid of payload.recipient_ids) {
        allRecipientIds.add(uid);
        const supervisors = await getSupervisorChain(supabase, uid);
        supervisors.forEach((id) => allRecipientIds.add(id));
      }

      const notifications = Array.from(allRecipientIds).map((uid) => ({
        user_id: uid,
        type: "commission",
        title_en: "Commission Status Updated",
        title_ko: "수수료 상태 변경",
        body_en: `Your commission status has been updated to "${label.en}".`,
        body_ko: `수수료 상태가 "${label.ko}"(으)로 변경되었습니다.`,
        link: "/sales-dashboard",
      }));

      const { error: insertErr } = await supabase.from("notifications").insert(notifications);
      if (insertErr) console.error("Error inserting notifications:", insertErr);

      // Log alerts
      const logSubject = `[Commission] Status → ${label.en}`;
      const { data: recipientProfiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", Array.from(allRecipientIds));
      if (recipientProfiles) {
        await logAlerts(supabase, "commission", logSubject,
          recipientProfiles.map((p: any) => ({ user_id: p.user_id, name: p.full_name, email: p.email }))
        );
      }

      // Send email
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (resendKey) {
        for (const uid of allRecipientIds) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("email, preferred_language")
            .eq("user_id", uid)
            .single();

          if (profile?.email) {
            const isKo = profile.preferred_language === "ko";
            try {
              await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                  from: "Namsan Partners <alert@namsan-partners.com>",
                  to: [profile.email],
                  subject: isKo
                    ? `[남산파트너스] 수수료 상태 변경: ${label.ko}`
                    : `[Namsan Partners] Commission Status: ${label.en}`,
                  html: isKo
                    ? `<p>수수료 상태가 <strong>${label.ko}</strong>(으)로 변경되었습니다.</p><p><a href="https://namsan-gateway-connect.lovable.app/sales-dashboard">영업 대시보드 바로가기</a></p>`
                    : `<p>Your commission status has been updated to <strong>${label.en}</strong>.</p><p><a href="https://namsan-gateway-connect.lovable.app/sales-dashboard">Go to Sales Dashboard</a></p>`,
                }),
              });
            } catch (emailErr) {
              console.error("Email send error:", emailErr);
            }
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true, notified: allRecipientIds.size }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown notification type" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Notify-sales error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
