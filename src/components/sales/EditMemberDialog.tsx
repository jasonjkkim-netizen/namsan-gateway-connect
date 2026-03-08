import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';

interface EditMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  onSuccess?: () => void;
}

export function EditMemberDialog({ open, onOpenChange, userId, onSuccess }: EditMemberDialogProps) {
  const { language } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    full_name_ko: '',
    phone: '',
    address: '',
    birthday: '',
  });

  useEffect(() => {
    if (!open || !userId) return;
    setLoading(true);

    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, full_name_ko, phone, address, birthday')
        .eq('user_id', userId)
        .maybeSingle();

      if (data) {
        setFormData({
          full_name: data.full_name || '',
          full_name_ko: data.full_name_ko || '',
          phone: data.phone || '',
          address: data.address || '',
          birthday: data.birthday || '',
        });
      }
      if (error) {
        console.error(error);
        toast.error(language === 'ko' ? '프로필 조회 실패' : 'Failed to fetch profile');
      }
      setLoading(false);
    };

    fetchProfile();
  }, [open, userId]);

  const handleSave = async () => {
    if (!userId) return;
    if (!formData.full_name.trim()) {
      toast.error(language === 'ko' ? '이름은 필수입니다' : 'Name is required');
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: formData.full_name.trim(),
        full_name_ko: formData.full_name_ko.trim() || null,
        phone: formData.phone.trim() || null,
        address: formData.address.trim() || null,
        birthday: formData.birthday || null,
      })
      .eq('user_id', userId);

    if (error) {
      console.error(error);
      toast.error(language === 'ko' ? '저장 실패' : 'Save failed');
    } else {
      toast.success(language === 'ko' ? '수정 완료' : 'Updated successfully');
      onOpenChange(false);
      onSuccess?.();
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif">
            {language === 'ko' ? '멤버 정보 수정' : 'Edit Member Info'}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{language === 'ko' ? '이름 (영문)' : 'Name (EN)'} *</Label>
                <Input
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{language === 'ko' ? '이름 (한글)' : 'Name (KO)'}</Label>
                <Input
                  value={formData.full_name_ko}
                  onChange={(e) => setFormData({ ...formData, full_name_ko: e.target.value })}
                  className="h-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{language === 'ko' ? '전화번호' : 'Phone'}</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+82-10-1234-5678"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{language === 'ko' ? '주소' : 'Address'}</Label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{language === 'ko' ? '생년월일' : 'Birthday'}</Label>
              <Input
                type="date"
                value={formData.birthday}
                onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
                className="h-9"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {language === 'ko' ? '취소' : 'Cancel'}
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {language === 'ko' ? '저장' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
