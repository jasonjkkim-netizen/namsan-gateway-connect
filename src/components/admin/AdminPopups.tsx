import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2, Save, X } from 'lucide-react';
import { toast } from 'sonner';

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
  is_active: boolean;
  display_order: number;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

const emptyForm = {
  title_en: '',
  title_ko: '',
  description_en: '',
  description_ko: '',
  image_url: '',
  button_text_en: 'Learn More',
  button_text_ko: '자세히 보기',
  button_link: '/products',
  is_active: true,
  display_order: 0,
  start_date: '',
  end_date: '',
};

export function AdminPopups() {
  const { language } = useLanguage();
  const [popups, setPopups] = useState<PopupAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showAdd, setShowAdd] = useState(false);

  const fetchPopups = async () => {
    const { data } = await supabase
      .from('popup_ads')
      .select('*')
      .order('display_order', { ascending: true });
    setPopups((data as PopupAd[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchPopups(); }, []);

  const handleSave = async () => {
    if (!form.title_ko && !form.title_en) {
      toast.error(language === 'ko' ? '제목을 입력해주세요' : 'Please enter a title');
      return;
    }

    if (editing) {
      const { error } = await supabase
        .from('popup_ads')
        .update({
          title_en: form.title_en,
          title_ko: form.title_ko,
          description_en: form.description_en || null,
          description_ko: form.description_ko || null,
          image_url: form.image_url || null,
          button_text_en: form.button_text_en || 'Learn More',
          button_text_ko: form.button_text_ko || '자세히 보기',
          button_link: form.button_link || '/products',
          is_active: form.is_active,
          display_order: form.display_order,
          start_date: form.start_date || null,
          end_date: form.end_date || null,
        } as any)
        .eq('id', editing);

      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success(language === 'ko' ? '수정되었습니다' : 'Updated');
    } else {
      const { error } = await supabase.from('popup_ads').insert({
        title_en: form.title_en,
        title_ko: form.title_ko,
        description_en: form.description_en || null,
        description_ko: form.description_ko || null,
        image_url: form.image_url || null,
        button_text_en: form.button_text_en || 'Learn More',
        button_text_ko: form.button_text_ko || '자세히 보기',
        button_link: form.button_link || '/products',
        is_active: form.is_active,
        display_order: form.display_order,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      } as any);

      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success(language === 'ko' ? '추가되었습니다' : 'Added');
    }

    setEditing(null);
    setShowAdd(false);
    setForm(emptyForm);
    fetchPopups();
  };

  const handleEdit = (popup: PopupAd) => {
    setEditing(popup.id);
    setShowAdd(true);
    setForm({
      title_en: popup.title_en,
      title_ko: popup.title_ko,
      description_en: popup.description_en || '',
      description_ko: popup.description_ko || '',
      image_url: popup.image_url || '',
      button_text_en: popup.button_text_en || 'Learn More',
      button_text_ko: popup.button_text_ko || '자세히 보기',
      button_link: popup.button_link || '/products',
      is_active: popup.is_active,
      display_order: popup.display_order,
      start_date: popup.start_date || '',
      end_date: popup.end_date || '',
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm(language === 'ko' ? '삭제하시겠습니까?' : 'Delete this popup?')) return;
    await supabase.from('popup_ads').delete().eq('id', id);
    toast.success(language === 'ko' ? '삭제되었습니다' : 'Deleted');
    fetchPopups();
  };

  const handleCancel = () => {
    setEditing(null);
    setShowAdd(false);
    setForm(emptyForm);
  };

  if (loading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          {language === 'ko' ? '팝업 광고 관리' : 'Popup Ad Management'}
        </h2>
        {!showAdd && (
          <Button onClick={() => { setShowAdd(true); setEditing(null); setForm(emptyForm); }}>
            <Plus className="h-4 w-4 mr-2" />
            {language === 'ko' ? '추가' : 'Add'}
          </Button>
        )}
      </div>

      {showAdd && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {editing ? (language === 'ko' ? '팝업 수정' : 'Edit Popup') : (language === 'ko' ? '새 팝업' : 'New Popup')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Title (EN)</label>
                <Input value={form.title_en} onChange={(e) => setForm({ ...form, title_en: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">제목 (KO)</label>
                <Input value={form.title_ko} onChange={(e) => setForm({ ...form, title_ko: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Description (EN)</label>
                <Textarea value={form.description_en} onChange={(e) => setForm({ ...form, description_en: e.target.value })} rows={3} />
              </div>
              <div>
                <label className="text-sm font-medium">설명 (KO)</label>
                <Textarea value={form.description_ko} onChange={(e) => setForm({ ...form, description_ko: e.target.value })} rows={3} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">{language === 'ko' ? '이미지 URL' : 'Image URL'}</label>
              <Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium">Button Text (EN)</label>
                <Input value={form.button_text_en} onChange={(e) => setForm({ ...form, button_text_en: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">버튼 텍스트 (KO)</label>
                <Input value={form.button_text_ko} onChange={(e) => setForm({ ...form, button_text_ko: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">{language === 'ko' ? '버튼 링크' : 'Button Link'}</label>
                <Input value={form.button_link} onChange={(e) => setForm({ ...form, button_link: e.target.value })} placeholder="/products" />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium">{language === 'ko' ? '표시 순서' : 'Display Order'}</label>
                <Input type="number" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="text-sm font-medium">{language === 'ko' ? '시작일' : 'Start Date'}</label>
                <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">{language === 'ko' ? '종료일' : 'End Date'}</label>
                <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                <span className="text-sm">{language === 'ko' ? '활성' : 'Active'}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave}>
                <Save className="h-4 w-4 mr-2" />
                {language === 'ko' ? '저장' : 'Save'}
              </Button>
              <Button variant="outline" onClick={handleCancel}>
                <X className="h-4 w-4 mr-2" />
                {language === 'ko' ? '취소' : 'Cancel'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{language === 'ko' ? '순서' : 'Order'}</TableHead>
            <TableHead>{language === 'ko' ? '제목' : 'Title'}</TableHead>
            <TableHead>{language === 'ko' ? '링크' : 'Link'}</TableHead>
            <TableHead>{language === 'ko' ? '기간' : 'Period'}</TableHead>
            <TableHead>{language === 'ko' ? '활성' : 'Active'}</TableHead>
            <TableHead>{language === 'ko' ? '작업' : 'Actions'}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {popups.map((popup) => (
            <TableRow key={popup.id}>
              <TableCell>{popup.display_order}</TableCell>
              <TableCell>{language === 'ko' ? popup.title_ko : popup.title_en}</TableCell>
              <TableCell className="text-muted-foreground text-sm">{popup.button_link}</TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {(popup as any).start_date || '–'} ~ {(popup as any).end_date || '–'}
              </TableCell>
              <TableCell>
                <Switch
                  checked={popup.is_active}
                  onCheckedChange={async (checked) => {
                    const { error } = await supabase
                      .from('popup_ads')
                      .update({ is_active: checked } as any)
                      .eq('id', popup.id);
                    if (error) {
                      toast.error(error.message);
                      return;
                    }
                    toast.success(language === 'ko' ? (checked ? '활성화됨' : '비활성화됨') : (checked ? 'Activated' : 'Deactivated'));
                    fetchPopups();
                  }}
                />
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(popup)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(popup.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {popups.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                {language === 'ko' ? '등록된 팝업이 없습니다' : 'No popups yet'}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
