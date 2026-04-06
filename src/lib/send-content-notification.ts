import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type ContentType = 'viewpoint' | 'blog' | 'stock_pick' | 'video' | 'research';
type ActionType = 'added' | 'updated' | 'deleted';

// Content types that broadcast to ALL approved users (downline)
const BROADCAST_TYPES: ContentType[] = ['viewpoint', 'blog', 'stock_pick', 'research'];

const contentLabels: Record<ContentType, { ko: string; en: string }> = {
  viewpoint: { ko: '남산 뷰포인트', en: 'Namsan Viewpoint' },
  blog: { ko: '블로그', en: 'Blog' },
  stock_pick: { ko: '관심 종목', en: 'Stock Pick' },
  video: { ko: '비디오', en: 'Video' },
  research: { ko: '리서치', en: 'Research' },
};

const actionLabels: Record<ActionType, { ko: string; en: string }> = {
  added: { ko: '새로운 콘텐츠가 추가되었습니다', en: 'New content has been added' },
  updated: { ko: '콘텐츠가 업데이트되었습니다', en: 'Content has been updated' },
  deleted: { ko: '콘텐츠가 삭제되었습니다', en: 'Content has been removed' },
};

async function isAlertEnabled(category: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('alert_settings')
      .select('is_enabled')
      .eq('category', category)
      .maybeSingle();
    return data?.is_enabled !== false; // default to true if not found
  } catch {
    return true;
  }
}

async function logAlerts(category: string, subject: string, recipients: { user_id: string; full_name: string; email: string }[]) {
  if (recipients.length === 0) return;
  try {
    const rows = recipients.map(r => ({
      category,
      recipient_user_id: r.user_id,
      recipient_name: r.full_name,
      recipient_email: r.email,
      subject,
      is_manual: false,
    }));
    await supabase.from('alert_log').insert(rows);
  } catch (err) {
    console.error('[Alert Log] Failed to log alerts:', err);
  }
}

export async function sendContentNotification({
  contentType,
  action,
  titleKo,
  titleEn,
  summaryKo,
  summaryEn,
}: {
  contentType: ContentType;
  action: ActionType;
  titleKo: string;
  titleEn?: string;
  summaryKo?: string;
  summaryEn?: string;
}) {
  try {
    // Check if this category is enabled
    const enabled = await isAlertEnabled(contentType);
    if (!enabled) {
      console.log(`[Notification] ${contentType} alerts are disabled, skipping.`);
      toast.info(`알림이 비활성화 상태입니다 / Alerts for ${contentType} are disabled`);
      return { success: true, skipped: true };
    }

    const label = contentLabels[contentType];
    const actionLabel = actionLabels[action];
    const subject = `[Namsan Partners] ${label.ko} - ${actionLabel.ko}`;

    const htmlContent = `
      <div style="margin-bottom: 16px;">
        <span style="display: inline-block; background: #e2e8f0; color: #1a365d; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; margin-bottom: 8px;">
          ${label.ko} / ${label.en}
        </span>
      </div>
      <h2 style="color: #1a365d; margin: 0 0 8px; font-size: 18px;">
        ${titleKo}
      </h2>
      ${titleEn && titleEn !== titleKo ? `<p style="color: #718096; margin: 0 0 16px; font-size: 14px;">${titleEn}</p>` : ''}
      <p style="color: #2d3748; margin: 0 0 8px; font-size: 14px;">
        ${actionLabel.ko} / ${actionLabel.en}
      </p>
      ${summaryKo ? `<p style="color: #4a5568; margin: 16px 0 0; font-size: 13px; line-height: 1.6; border-left: 3px solid #1a365d; padding-left: 12px;">${summaryKo.slice(0, 300)}${summaryKo.length > 300 ? '...' : ''}</p>` : ''}
      <div style="margin-top: 24px;">
        <a href="https://namsan-gateway-connect.lovable.app" style="display: inline-block; background: #1a365d; color: white; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-size: 14px;">
          ${contentType === 'viewpoint' || contentType === 'blog' ? '자세히 보기 / Read More' : '포털 방문 / Visit Portal'}
        </a>
      </div>
    `;

    const isBroadcast = BROADCAST_TYPES.includes(contentType);

    console.log(`[Notification] Sending ${contentType} ${action} notification (broadcast=${isBroadcast})...`);

    // Check if kakao channel is enabled for this category
    let kakaoEnabled = false;
    try {
      const { data: kakaoSetting } = await supabase
        .from('alert_settings')
        .select('is_enabled')
        .eq('category', contentType)
        .eq('channel', 'kakao')
        .maybeSingle();
      kakaoEnabled = kakaoSetting?.is_enabled === true;
    } catch { /* ignore */ }

    // Send KakaoTalk message if enabled
    if (kakaoEnabled) {
      try {
        const kakaoMessage = `[남산파트너스] ${label.ko}\n${actionLabel.ko}\n\n${titleKo}${summaryKo ? '\n' + summaryKo.slice(0, 200) : ''}`;
        const { error: kakaoError } = await supabase.functions.invoke('send-kakao', {
          body: {
            message: kakaoMessage,
            templateObject: {
              object_type: 'text',
              text: kakaoMessage,
              link: {
                web_url: 'https://namsan-gateway-connect.lovable.app',
                mobile_web_url: 'https://namsan-gateway-connect.lovable.app',
              },
              button_title: '포털 방문',
            },
          },
        });
        if (kakaoError) {
          console.error('[Notification] Kakao send error:', kakaoError);
        } else {
          console.log('[Notification] Kakao message sent successfully');
        }
      } catch (kakaoErr) {
        console.error('[Notification] Kakao send failed:', kakaoErr);
      }
    }

    if (isBroadcast) {
      // Send to ALL approved users via send-newsletter
      const { data, error } = await supabase.functions.invoke('send-newsletter', {
        body: { subject, htmlContent },
      });

      if (error) {
        console.error('[Notification] Edge function error:', error);
        toast.error(`알림 이메일 발송 실패 / Notification email failed: ${error.message || 'Unknown error'}`);
        return { success: false, error };
      }

      if (data?.error) {
        console.error('[Notification] Server error:', data.error);
        toast.error(`알림 이메일 발송 실패 / Notification email failed: ${data.error}`);
        return { success: false, error: data.error };
      }

      // Log alerts for all recipients
      try {
        const { data: approvedProfiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, email')
          .eq('is_approved', true);
        if (approvedProfiles) {
          await logAlerts(contentType, subject, approvedProfiles);
        }
      } catch (logErr) {
        console.error('[Notification] Failed to log:', logErr);
      }

      console.log(`[Notification] Broadcast sent: ${contentType} ${action}, ${data?.sentCount} recipients`);
      toast.success(`알림 이메일 발송 완료 (${data?.sentCount}명) / Notification sent to ${data?.sentCount} recipients`);
      return { success: true, sentCount: data?.sentCount };
    } else {
      // Non-broadcast: send only to district managers (upper management)
      const { data: dmProfiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .eq('sales_role', 'district_manager')
        .eq('is_approved', true);

      const recipients = dmProfiles || [];
      if (recipients.length === 0) {
        console.log('[Notification] No district managers found, skipping.');
        toast.info('총괄관리인이 없어 알림을 건너뜁니다 / No district managers found');
        return { success: true, skipped: true };
      }

      let sentCount = 0;
      for (const dm of recipients) {
        if (!dm.email) continue;
        try {
          const { error } = await supabase.functions.invoke('send-newsletter', {
            body: { subject, htmlContent, targetEmail: dm.email },
          });
          if (!error) sentCount++;
        } catch (err) {
          console.error(`[Notification] Failed to send to ${dm.email}:`, err);
        }
      }

      await logAlerts(contentType, subject, recipients);

      console.log(`[Notification] Upper-mgmt only: ${contentType} ${action}, ${sentCount} recipients`);
      toast.success(`총괄관리인에게 알림 발송 완료 (${sentCount}명) / Sent to ${sentCount} manager(s)`);
      return { success: true, sentCount };
    }
  } catch (err: any) {
    console.error('[Notification] Failed to send:', err);
    toast.error(`알림 이메일 발송 실패 / Notification email failed: ${err?.message || 'Unknown error'}`);
    return { success: false, error: err };
  }
}
