import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface PopupAd {
  id: string;
  title_en: string;
  title_ko: string;
  description_en: string | null;
  description_ko: string | null;
  image_url: string | null;
  button_text_en: string | null;
  button_text_ko: string | null;
  button_link: string | null;
  start_date: string | null;
  end_date: string | null;
}

export function ProductPopup() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [popup, setPopup] = useState<PopupAd | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;

    async function checkAndShowPopup() {
      // Fetch active popups (get several to filter by date)
      const { data: popups } = await supabase
        .from('popup_ads')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true })
        .limit(10);

      if (!popups || popups.length === 0) return;

      const today = new Date().toISOString().split('T')[0];
      // Filter by date range
      const activePopup = popups.find((p: any) => {
        if (p.start_date && today < p.start_date) return false;
        if (p.end_date && today > p.end_date) return false;
        return true;
      }) as PopupAd | undefined;

      if (!activePopup) return;

      // Check if user dismissed today
      const { data: dismissal } = await supabase
        .from('popup_dismissals')
        .select('dismissed_at')
        .eq('user_id', user.id)
        .eq('popup_id', activePopup.id)
        .maybeSingle();

      if (dismissal) {
        const dismissedDate = new Date(dismissal.dismissed_at).toDateString();
        const today = new Date().toDateString();
        if (dismissedDate === today) return; // Already dismissed today
      }

      setPopup(activePopup);
      setOpen(true);
    }

    checkAndShowPopup();
  }, [user]);

  const handleDismiss = async () => {
    setOpen(false);
    if (!user || !popup) return;

    // Upsert dismissal record
    await supabase
      .from('popup_dismissals')
      .upsert(
        { user_id: user.id, popup_id: popup.id, dismissed_at: new Date().toISOString() },
        { onConflict: 'user_id,popup_id' }
      );
  };

  const handleButtonClick = () => {
    setOpen(false);
    if (popup?.button_link) {
      if (popup.button_link.startsWith('http')) {
        window.open(popup.button_link, '_blank');
      } else {
        navigate(popup.button_link);
      }
    }
  };

  if (!popup) return null;

  const title = language === 'ko' ? popup.title_ko : popup.title_en;
  const description = language === 'ko' ? popup.description_ko : popup.description_en;
  const buttonText = language === 'ko' ? (popup.button_text_ko || '자세히 보기') : (popup.button_text_en || 'Learn More');

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismiss(); }}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <button
          onClick={handleDismiss}
          className="absolute right-3 top-3 z-10 rounded-full bg-background/80 p-1.5 hover:bg-background transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {popup.image_url && (
          <div className="w-full">
            <img
              src={popup.image_url}
              alt={title}
              className="w-full h-48 object-cover"
            />
          </div>
        )}

        <div className="p-6 pt-4">
          <DialogHeader>
            <DialogTitle className="text-xl font-serif">{title}</DialogTitle>
            {description && (
              <DialogDescription className="text-sm mt-2 whitespace-pre-line">
                {description}
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="mt-6 flex gap-3">
            <Button variant="gold" className="flex-1" onClick={handleButtonClick}>
              {buttonText}
            </Button>
            <Button variant="outline" onClick={handleDismiss}>
              {language === 'ko' ? '닫기' : 'Close'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
