import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface NotificationPayload {
  type: "investment_created" | "commission_status_changed" | "role_approved" | "role_changed" | "bulk_role_notification" | "commission_rate_changed";
  investment_id?: string;
  investor_name?: string;
  product_name_en?: string;
  product_name_ko?: string;
  amount?: number;
  currency?: string;
  commission_id?: string;
  new_status?: string;
  recipient_ids?: string[];
  // Role notification fields
  user_id?: string;
  user_name?: string;
  user_email?: string;
  role?: string;
  old_role?: string;
  // Rate change fields
  changed_by_name?: string;
  product_names?: { en: string; ko: string }[];
  affected_roles?: string[];
}

const ROLE_LABELS: Record<string, { en: string; ko: string }> = {
  webmaster: { en: 'Webmaster', ko: '웹마스터' },
  district_manager: { en: 'General Manager', ko: '총괄관리' },
  deputy_district_manager: { en: 'Deputy General Manager', ko: '부총괄관리' },
  principal_agent: { en: 'Principal Agent', ko: '수석 에이전트' },
  agent: { en: 'Agent', ko: '에이전트' },
  client: { en: 'Client', ko: '고객' },
};

function getRoleLabel(role: string, lang: string): string {
  return ROLE_LABELS[role]?.[lang === 'ko' ? 'ko' : 'en'] || role;
}

async function isAlertEnabled(supabase: any, category: string): Promise<boolean> {
  const { data } = await supabase
    .from("alert_settings")
    .select("is_enabled")
    .eq("category", category)
    .maybeSingle();
  return data?.is_enabled !== false;
}

async function logAlerts(supabase: any, category: string, subject: string, recipients: { user_id: string; name: string; email: string }[], sentBy?: string) {
  if (recipients.length === 0) return;
  const rows = recipients.map(r => ({
    category,
    recipient_user_id: r.user_id,
    recipient_name: r.name,
    recipient_email: r.email,
    subject,
    is_manual: false,
    sent_by: sentBy || null,
  }));
  await supabase.from("alert_log").insert(rows);
}

async function getSupervisorChain(supabase: any, userId: string): Promise<string[]> {
  const { data: ancestors } = await supabase.rpc("get_sales_ancestors", { _user_id: userId });
  if (!ancestors) return [];
  const ancestorIds = ancestors.map((a: any) => a.user_id);
  const { data: adminRoles } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin")
    .in("user_id", ancestorIds);
  const adminIds = new Set((adminRoles || []).map((r: any) => r.user_id));
  return ancestorIds.filter((id: string) => !adminIds.has(id));
}

async function sendEmail(resendKey: string, to: string, subject: string, html: string) {
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Namsan Partners <noreply@namsan-partners.com>",
        to: [to],
        subject,
        html,
      }),
    });
  } catch (emailErr) {
    console.error("Email send error:", emailErr);
  }
}

function roleEmailHtml(userName: string, role: string, type: 'approved' | 'changed', oldRole?: string): string {
  const roleKo = getRoleLabel(role, 'ko');
  const roleEn = getRoleLabel(role, 'en');
  const oldRoleKo = oldRole ? getRoleLabel(oldRole, 'ko') : '';
  const oldRoleEn = oldRole ? getRoleLabel(oldRole, 'en') : '';

  const titleKo = type === 'approved' 
    ? '🎉 가입이 승인되었습니다' 
    : '🔄 역할이 변경되었습니다';
  const titleEn = type === 'approved' 
    ? '🎉 Your Account Has Been Approved' 
    : '🔄 Your Role Has Been Updated';

  const bodyKo = type === 'approved'
    ? `<p>${userName}님, 환영합니다!</p><p>귀하의 가입 신청이 승인되었으며, <strong>${roleKo}</strong> 역할이 부여되었습니다.</p>`
    : `<p>${userName}님,</p><p>귀하의 역할이 <strong>${oldRoleKo}</strong>에서 <strong>${roleKo}</strong>(으)로 변경되었습니다.</p>`;

  const bodyEn = type === 'approved'
    ? `<p>Welcome, ${userName}!</p><p>Your account has been approved and you have been assigned the role of <strong>${roleEn}</strong>.</p>`
    : `<p>Dear ${userName},</p><p>Your role has been changed from <strong>${oldRoleEn}</strong> to <strong>${roleEn}</strong>.</p>`;

  return `
    <!DOCTYPE html><html><head><meta charset="utf-8">
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background: linear-gradient(135deg, #B8860B, #DAA520); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
      .content { background: #f9f9f9; padding: 30px; border: 1px solid #eee; }
      .role-badge { display: inline-block; background: #B8860B; color: white; padding: 8px 20px; border-radius: 20px; font-weight: bold; font-size: 16px; margin: 10px 0; }
      .cta-button { display: inline-block; background: #B8860B; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
      .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    </style></head><body>
    <div class="container">
      <div class="header">
        <h1 style="margin: 0;">${titleKo}</h1>
        <p style="margin: 10px 0 0 0; opacity: 0.9;">${titleEn}</p>
      </div>
      <div class="content">
        ${bodyKo}
        <center><span class="role-badge">${roleKo} / ${roleEn}</span></center>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        ${bodyEn}
        <center>
          <a href="https://namsan-gateway-connect.lovable.app/market-data" class="cta-button">
            포털 바로가기 / Go to Portal →
          </a>
        </center>
      </div>
      <div class="footer">
        <p>© ${new Date().getFullYear()} Namsan Partners. All rights reserved.</p>
      </div>
    </div></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const resendKey = Deno.env.get("RESEND_API_KEY");

    const payload: NotificationPayload = await req.json();

    // ── Role Approved ──
    if (payload.type === "role_approved") {
      if (!payload.user_id || !payload.user_name || !payload.role) {
        return new Response(JSON.stringify({ error: "Missing fields" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const roleKo = getRoleLabel(payload.role, 'ko');
      const roleEn = getRoleLabel(payload.role, 'en');

      // In-app notification
      await supabase.from("notifications").insert({
        user_id: payload.user_id,
        type: "role",
        title_en: "Account Approved",
        title_ko: "가입 승인",
        body_en: `Your account has been approved. Your role: ${roleEn}.`,
        body_ko: `가입이 승인되었습니다. 부여된 역할: ${roleKo}.`,
        link: "/market-data",
      });

      // Email
      if (resendKey && payload.user_email) {
        const html = roleEmailHtml(payload.user_name, payload.role, 'approved');
        await sendEmail(
          resendKey, payload.user_email,
          `[남산파트너스] 가입 승인 - ${roleKo} / Account Approved - ${roleEn}`,
          html
        );
      }

      // Log
      if (payload.user_email) {
        await logAlerts(supabase, "role", `[Approval] ${payload.user_name} → ${roleEn}`, [
          { user_id: payload.user_id, name: payload.user_name, email: payload.user_email },
        ]);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Role Changed ──
    if (payload.type === "role_changed") {
      if (!payload.user_id || !payload.user_name || !payload.role) {
        return new Response(JSON.stringify({ error: "Missing fields" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const roleKo = getRoleLabel(payload.role, 'ko');
      const roleEn = getRoleLabel(payload.role, 'en');
      const oldRoleKo = payload.old_role ? getRoleLabel(payload.old_role, 'ko') : '';

      // In-app notification
      await supabase.from("notifications").insert({
        user_id: payload.user_id,
        type: "role",
        title_en: "Role Updated",
        title_ko: "역할 변경",
        body_en: `Your role has been changed to ${roleEn}.`,
        body_ko: `역할이 ${roleKo}(으)로 변경되었습니다.`,
        link: "/market-data",
      });

      // Email
      if (resendKey) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("email")
          .eq("user_id", payload.user_id)
          .single();

        if (profile?.email) {
          const html = roleEmailHtml(payload.user_name, payload.role, 'changed', payload.old_role);
          await sendEmail(
            resendKey, profile.email,
            `[남산파트너스] 역할 변경: ${oldRoleKo} → ${roleKo}`,
            html
          );
        }
      }

      // Log
      const { data: prof } = await supabase.from("profiles").select("email").eq("user_id", payload.user_id).single();
      await logAlerts(supabase, "role", `[Role Change] ${payload.user_name}: ${payload.old_role || 'none'} → ${payload.role}`, [
        { user_id: payload.user_id, name: payload.user_name, email: prof?.email || '' },
      ]);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Bulk Role Notification ──
    if (payload.type === "bulk_role_notification") {
      // Send current role info to all approved users with a sales_role
      const { data: allProfiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, sales_role, preferred_language")
        .eq("is_approved", true)
        .not("sales_role", "is", null)
        .or("is_deleted.is.null,is_deleted.eq.false");

      if (!allProfiles || allProfiles.length === 0) {
        return new Response(JSON.stringify({ success: true, sent: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let sentCount = 0;

      for (const p of allProfiles) {
        if (!p.email || !p.sales_role) continue;

        const roleKo = getRoleLabel(p.sales_role, 'ko');
        const roleEn = getRoleLabel(p.sales_role, 'en');

        // In-app notification
        await supabase.from("notifications").insert({
          user_id: p.user_id,
          type: "role",
          title_en: "Your Current Role",
          title_ko: "현재 역할 안내",
          body_en: `Your current role is: ${roleEn}.`,
          body_ko: `현재 부여된 역할: ${roleKo}.`,
          link: "/market-data",
        });

        // Email
        if (resendKey) {
          const html = `
            <!DOCTYPE html><html><head><meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #B8860B, #DAA520); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border: 1px solid #eee; }
              .role-badge { display: inline-block; background: #B8860B; color: white; padding: 8px 20px; border-radius: 20px; font-weight: bold; font-size: 16px; margin: 10px 0; }
              .cta-button { display: inline-block; background: #B8860B; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
              .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            </style></head><body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">📋 현재 역할 안내</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Your Current Role Information</p>
              </div>
              <div class="content">
                <p>${p.full_name}님,</p>
                <p>남산파트너스에서 귀하에게 부여된 현재 역할을 안내드립니다.</p>
                <center><span class="role-badge">${roleKo} / ${roleEn}</span></center>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p>Dear ${p.full_name},</p>
                <p>Here is your current role at Namsan Partners.</p>
                <center>
                  <a href="https://namsan-gateway-connect.lovable.app/market-data" class="cta-button">
                    포털 바로가기 / Go to Portal →
                  </a>
                </center>
              </div>
              <div class="footer">
                <p>© ${new Date().getFullYear()} Namsan Partners. All rights reserved.</p>
              </div>
            </div></body></html>`;

          await sendEmail(
            resendKey, p.email,
            `[남산파트너스] 현재 역할 안내: ${roleKo} / Your Role: ${roleEn}`,
            html
          );
        }

        sentCount++;
      }

      // Log
      await logAlerts(supabase, "role", `[Bulk Role Notification] ${sentCount} users`,
        allProfiles.filter(p => p.email).map(p => ({ user_id: p.user_id, name: p.full_name, email: p.email }))
      );

      return new Response(JSON.stringify({ success: true, sent: sentCount }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Investment Created ──
    if (payload.type === "investment_created") {
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

      const ancestorIds = ancestors.map((a: any) => a.user_id);
      const { data: adminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin")
        .in("user_id", ancestorIds);
      const adminIds = new Set((adminRoles || []).map((r: any) => r.user_id));
      const nonAdminAncestors = ancestors.filter((a: any) => !adminIds.has(a.user_id));

      const allRecipientIds = new Set<string>();
      for (const a of nonAdminAncestors) {
        allRecipientIds.add(a.user_id);
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

      await supabase.from("notifications").insert(notifications);

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

      if (resendKey) {
        for (const uid of allRecipientIds) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("email, preferred_language")
            .eq("user_id", uid)
            .single();

          if (profile?.email) {
            const isKo = profile.preferred_language === "ko";
            await sendEmail(
              resendKey, profile.email,
              isKo
                ? `[남산파트너스] ${payload.investor_name}님의 신규 투자`
                : `[Namsan Partners] New Investment by ${payload.investor_name}`,
              isKo
                ? `<p>${payload.investor_name}님이 <strong>${payload.product_name_ko}</strong>에 <strong>${amountStr}</strong>을 투자했습니다.</p><p><a href="https://namsan-gateway-connect.lovable.app/sales-dashboard">영업 대시보드 바로가기</a></p>`
                : `<p>${payload.investor_name} invested <strong>${amountStr}</strong> in <strong>${payload.product_name_en}</strong>.</p><p><a href="https://namsan-gateway-connect.lovable.app/sales-dashboard">Go to Sales Dashboard</a></p>`
            );
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true, notified: allRecipientIds.size }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Commission Status Changed ──
    if (payload.type === "commission_status_changed") {
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

      await supabase.from("notifications").insert(notifications);

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

      if (resendKey) {
        for (const uid of allRecipientIds) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("email, preferred_language")
            .eq("user_id", uid)
            .single();

          if (profile?.email) {
            const isKo = profile.preferred_language === "ko";
            await sendEmail(
              resendKey, profile.email,
              isKo
                ? `[남산파트너스] 수수료 상태 변경: ${label.ko}`
                : `[Namsan Partners] Commission Status: ${label.en}`,
              isKo
                ? `<p>수수료 상태가 <strong>${label.ko}</strong>(으)로 변경되었습니다.</p><p><a href="https://namsan-gateway-connect.lovable.app/sales-dashboard">영업 대시보드 바로가기</a></p>`
                : `<p>Your commission status has been updated to <strong>${label.en}</strong>.</p><p><a href="https://namsan-gateway-connect.lovable.app/sales-dashboard">Go to Sales Dashboard</a></p>`
            );
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true, notified: allRecipientIds.size }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Commission Rate Changed ──
    if (payload.type === "commission_rate_changed") {
      if (!payload.user_id || !payload.changed_by_name) {
        return new Response(JSON.stringify({ error: "Missing fields" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get ancestors of the user who changed rates
      const allRecipientIds = new Set<string>();
      const supervisors = await getSupervisorChain(supabase, payload.user_id);
      supervisors.forEach((id) => allRecipientIds.add(id));

      if (allRecipientIds.size === 0) {
        return new Response(JSON.stringify({ success: true, notified: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const productNamesKo = (payload.product_names || []).map(p => p.ko).join(', ') || '—';
      const productNamesEn = (payload.product_names || []).map(p => p.en).join(', ') || '—';
      const rolesKo = (payload.affected_roles || []).map(r => getRoleLabel(r, 'ko')).join(', ');
      const rolesEn = (payload.affected_roles || []).map(r => getRoleLabel(r, 'en')).join(', ');

      const notifications = Array.from(allRecipientIds).map((uid) => ({
        user_id: uid,
        type: "commission",
        title_en: "Commission Rates Updated",
        title_ko: "수수료 요율 변경",
        body_en: `${payload.changed_by_name} updated commission rates for ${productNamesEn}${rolesEn ? ` (${rolesEn})` : ''}.`,
        body_ko: `${payload.changed_by_name}님이 ${productNamesKo}의 수수료 요율을 변경했습니다${rolesKo ? ` (${rolesKo})` : ''}.`,
        link: "/sales-dashboard",
      }));

      await supabase.from("notifications").insert(notifications);

      // Log
      const logSubject = `[Rate Change] by ${payload.changed_by_name} - ${productNamesEn}`;
      const { data: recipientProfiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", Array.from(allRecipientIds));
      if (recipientProfiles) {
        await logAlerts(supabase, "commission", logSubject,
          recipientProfiles.map((p: any) => ({ user_id: p.user_id, name: p.full_name, email: p.email }))
        );
      }

      // Email
      if (resendKey) {
        for (const uid of allRecipientIds) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("email, preferred_language, full_name")
            .eq("user_id", uid)
            .single();

          if (prof?.email) {
            const isKo = prof.preferred_language === "ko";
            await sendEmail(
              resendKey, prof.email,
              isKo
                ? `[남산파트너스] 수수료 요율 변경 알림`
                : `[Namsan Partners] Commission Rate Update`,
              isKo
                ? `<p>${prof.full_name}님,</p><p><strong>${payload.changed_by_name}</strong>님이 다음 상품의 수수료 요율을 변경했습니다:</p><p><strong>${productNamesKo}</strong></p>${rolesKo ? `<p>변경 역할: ${rolesKo}</p>` : ''}<p><a href="https://namsan-gateway-connect.lovable.app/sales-dashboard">영업 대시보드에서 확인하기</a></p>`
                : `<p>Dear ${prof.full_name},</p><p><strong>${payload.changed_by_name}</strong> has updated commission rates for:</p><p><strong>${productNamesEn}</strong></p>${rolesEn ? `<p>Affected roles: ${rolesEn}</p>` : ''}<p><a href="https://namsan-gateway-connect.lovable.app/sales-dashboard">View in Sales Dashboard</a></p>`
            );
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
