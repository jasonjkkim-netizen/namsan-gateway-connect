import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, ExternalLink } from 'lucide-react';

interface InterestNews {
  id: string;
  title_ko: string;
  title_en: string;
  url: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
}

const defaultForm = {
  title_ko: '',
  title_en: '',
  url: '',
  is_active: true,
  display_order: 0,
};

export function AdminInterestNews() {
  const { language } = useLanguage();
  const [items, setItems] = useState<InterestNews[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(defaultForm);

  async function fetchItems() {
    const { data } = await supabase
      .from('interest_news')
      .select('*')
      .order('display_order', { ascending: true });
    if (data) setItems(data as InterestNews[]);
    setLoading(false);
  }

  useEffect(() => { fetchItems(); }, []);

  function openNew() {
    setEditingId(null);
    setFormData(defaultForm);
    setDialogOpen(true);
  }

  function openEdit(item: InterestNews) {
    setEditingId(item.id);
    setFormData({
      title_ko: item.title_ko,
      title_en: item.title_en,
      url: item.url,
      is_active: item.is_active,
      display_order: item.display_order,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!formData.title_ko && !formData.title_en) {
      toast.error(language === 'ko' ? '제목을 입력해주세요' : 'Title is required');
      return;
    }
    if (!formData.url) {
      toast.error(language === 'ko' ? 'URL을 입력해주세요' : 'URL is required');
      return;
    }

    const payload = {
      title_ko: formData.title_ko,
      title_en: formData.title_en,
      url: formData.url,
      is_active: formData.is_active,
      display_order: formData.display_order,
    };

    let error;
    if (editingId) {
      ({ error } = await supabase.from('interest_news').update(payload).eq('id', editingId));
    } else {
      ({ error } = await supabase.from('interest_news').insert(payload));
    }

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(language === 'ko' ? '저장 완료' : 'Saved');
    setDialogOpen(false);
    fetchItems();
  }

  async function handleDelete(id: string) {
    if (!confirm(language === 'ko' ? '삭제하시겠습니까?' : 'Delete?')) return;
    const { error } = await supabase.from('interest_news').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success(language === 'ko' ? '삭제 완료' : 'Deleted');
    fetchItems();
  }

  if (loading) return <Skeleton className="h-40 w-full" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          {language === 'ko' ? '최근 업데이트 (뉴스 링크)' : 'Recent Updates (News Links)'}
        </h3>
        <Button onClick={openNew} size="sm" className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          {language === 'ko' ? '추가' : 'Add'}
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{language === 'ko' ? '순서' : 'Order'}</TableHead>
            <TableHead>{language === 'ko' ? '제목' : 'Title'}</TableHead>
            <TableHead>{language === 'ko' ? '링크' : 'Link'}</TableHead>
            <TableHead>{language === 'ko' ? '활성' : 'Active'}</TableHead>
            <TableHead>{language === 'ko' ? '작업' : 'Actions'}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map(item => (
            <TableRow key={item.id}>
              <TableCell className="text-sm">{item.display_order}</TableCell>
              <TableCell className="font-medium max-w-[250px] truncate">
                {language === 'ko' ? item.title_ko : item.title_en}
              </TableCell>
              <TableCell>
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1 text-sm">
                  <ExternalLink className="h-3 w-3" />
                  {language === 'ko' ? '링크' : 'Link'}
                </a>
              </TableCell>
              <TableCell>
                <Switch
                  checked={item.is_active}
                  onCheckedChange={async (checked) => {
                    await supabase.from('interest_news').update({ is_active: checked }).eq('id', item.id);
                    fetchItems();
                  }}
                />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {items.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                {language === 'ko' ? '관심 뉴스가 없습니다.' : 'No interest news.'}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId
                ? (language === 'ko' ? '관심 뉴스 수정' : 'Edit Interest News')
                : (language === 'ko' ? '관심 뉴스 추가' : 'Add Interest News')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{language === 'ko' ? '제목 (한국어)' : 'Title (Korean)'}</Label>
              <Input value={formData.title_ko} onChange={e => setFormData(p => ({ ...p, title_ko: e.target.value }))} />
            </div>
            <div>
              <Label>{language === 'ko' ? '제목 (영어)' : 'Title (English)'}</Label>
              <Input value={formData.title_en} onChange={e => setFormData(p => ({ ...p, title_en: e.target.value }))} />
            </div>
            <div>
              <Label>URL</Label>
              <Input value={formData.url} onChange={e => setFormData(p => ({ ...p, url: e.target.value }))} placeholder="https://..." />
            </div>
            <div>
              <Label>{language === 'ko' ? '표시 순서' : 'Display Order'}</Label>
              <Input type="number" value={formData.display_order} onChange={e => setFormData(p => ({ ...p, display_order: parseInt(e.target.value) || 0 }))} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={formData.is_active} onCheckedChange={checked => setFormData(p => ({ ...p, is_active: checked }))} />
              <Label>{language === 'ko' ? '활성' : 'Active'}</Label>
            </div>
            <Button onClick={handleSave} className="w-full">
              {language === 'ko' ? '저장' : 'Save'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
