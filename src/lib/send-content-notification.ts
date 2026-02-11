import { supabase } from '@/integrations/supabase/client';

type ContentType = 'viewpoint' | 'blog' | 'stock_pick' | 'video';
type ActionType = 'added' | 'updated' | 'deleted';

const contentLabels: Record<ContentType, { ko: string; en: string }> = {
  viewpoint: { ko: '남산 뷰포인트', en: 'Namsan Viewpoint' },
  blog: { ko: '블로그', en: 'Blog' },
  stock_pick: { ko: '관심 종목', en: 'Stock Pick' },
  video: { ko: '비디오', en: 'Video' },
};

const actionLabels: Record<ActionType, { ko: string; en: string }> = {
  added: { ko: '새로운 콘텐츠가 추가되었습니다', en: 'New content has been added' },
  updated: { ko: '콘텐츠가 업데이트되었습니다', en: 'Content has been updated' },
  deleted: { ko: '콘텐츠가 삭제되었습니다', en: 'Content has been removed' },
};

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

    const { data, error } = await supabase.functions.invoke('send-newsletter', {
      body: { subject, htmlContent },
    });

    if (error) {
      console.error('Notification email error:', error);
      return { success: false, error };
    }

    console.log(`Notification sent: ${contentType} ${action}, ${data?.sentCount} recipients`);
    return { success: true, sentCount: data?.sentCount };
  } catch (err) {
    console.error('Failed to send content notification:', err);
    return { success: false, error: err };
  }
}
