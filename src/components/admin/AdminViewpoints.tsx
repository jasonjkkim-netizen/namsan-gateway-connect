import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Upload, Image, Archive, Eye, ArrowUp, ArrowDown } from 'lucide-react';
import { toast } from 'sonner';
import { sendContentNotification } from '@/lib/send-content-notification';
import { RichPasteEditor } from './RichPasteEditor';

interface Viewpoint {
  id: string;
  title_ko: string;
  title_en: string;
  content_ko: string;
  content_en: string;
  image_url: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
}

export function AdminViewpoints() {
  const { language } = useLanguage();
  const [items, setItems] = useState<Viewpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Viewpoint | null>(null);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    title_ko: '',
    title_en: '',
    content_ko: '',
    content_en: '',
    image_url: '' as string | null,
    is_active: true,
  });

  useEffect(() => { fetchItems(); }, []);

  async function fetchItems() {
    const { data, error } = await supabase
      .from('namsan_viewpoints')
      .select('*')
      .order('display_order', { ascending: true });
    if (!error && data) setItems(data as Viewpoint[]);
    setLoading(false);
  }

  async function handleMoveOrder(item: Viewpoint, direction: 'up' | 'down') {
    const activeItems = items.filter(i => i.is_active).sort((a, b) => a.display_order - b.display_order);
    const currentIndex = activeItems.findIndex(i => i.id === item.id);
    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (swapIndex < 0 || swapIndex >= activeItems.length) return;

    const swapItem = activeItems[swapIndex];
    const tempOrder = item.display_order;

    await supabase.from('namsan_viewpoints').update({ display_order: swapItem.display_order }).eq('id', item.id);
    await supabase.from('namsan_viewpoints').update({ display_order: tempOrder }).eq('id', swapItem.id);
    
    toast.success(language === 'ko' ? '순서가 변경되었습니다' : 'Order changed');
    fetchItems();
  }

  function openAdd() {
    setEditingItem(null);
    setFormData({ title_ko: '', title_en: '', content_ko: '', content_en: '', image_url: null, is_active: true });
    setDialogOpen(true);
  }

  function openEdit(item: Viewpoint) {
    setEditingItem(item);
    setFormData({
      title_ko: item.title_ko,
      title_en: item.title_en,
      content_ko: item.content_ko,
      content_en: item.content_en,
      image_url: item.image_url,
      is_active: item.is_active,
    });
    setDialogOpen(true);
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const ext = file.name.split('.').pop();
    const fileName = `${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from('viewpoint-images')
      .upload(fileName, file);

    if (error) {
      toast.error(language === 'ko' ? '이미지 업로드 실패' : 'Image upload failed');
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('viewpoint-images')
      .getPublicUrl(fileName);

    setFormData(prev => ({ ...prev, image_url: urlData.publicUrl }));
    setUploading(false);
    toast.success(language === 'ko' ? '이미지 업로드 완료' : 'Image uploaded');
  }

  async function publishToBlog(data: typeof formData) {
    try {
      // Check if a blog post with the same Korean title already exists
      const { data: existing } = await supabase
        .from('blog_posts')
        .select('id')
        .eq('title_ko', data.title_ko)
        .maybeSingle();

      if (existing) {
        await supabase.from('blog_posts').update({
          title_en: data.title_en || data.title_ko,
          content_ko: data.content_ko,
          content_en: data.content_en || data.content_ko,
          thumbnail_url: data.image_url,
          is_active: data.is_active,
          author: 'Namsan Partners',
          updated_at: new Date().toISOString(),
        }).eq('id', existing.id);
      } else {
        await supabase.from('blog_posts').insert({
          title_ko: data.title_ko,
          title_en: data.title_en || data.title_ko,
          content_ko: data.content_ko,
          content_en: data.content_en || data.content_ko,
          thumbnail_url: data.image_url,
          is_active: data.is_active,
          author: 'Namsan Partners',
        });
      }
    } catch (err) {
      console.error('Auto blog publish error:', err);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.title_ko) {
      toast.error(language === 'ko' ? '제목을 입력해주세요' : 'Please enter a title');
      return;
    }

    if (editingItem) {
      const { error } = await supabase
        .from('namsan_viewpoints')
        .update({ ...formData, updated_at: new Date().toISOString() })
        .eq('id', editingItem.id);
      if (error) toast.error('Failed to update');
      else {
        await publishToBlog(formData);
        toast.success(language === 'ko' ? '수정 및 블로그 동기화 완료' : 'Updated & synced to blog');
        sendContentNotification({
          contentType: 'viewpoint',
          action: 'updated',
          titleKo: formData.title_ko,
          titleEn: formData.title_en,
          summaryKo: formData.content_ko?.replace(/!\[.*?\]\(.*?\)/g, '').slice(0, 200),
        });
        setDialogOpen(false);
        fetchItems();
      }
    } else {
      const maxOrder = items.length > 0 ? Math.max(...items.map(i => i.display_order)) : 0;
      const { error } = await supabase
        .from('namsan_viewpoints')
        .insert({ ...formData, display_order: maxOrder + 1 });
      if (error) toast.error('Failed to add');
      else {
        await publishToBlog(formData);
        toast.success(language === 'ko' ? '추가 및 블로그 자동 발행 완료' : 'Added & auto-published to blog');
        sendContentNotification({
          contentType: 'viewpoint',
          action: 'added',
          titleKo: formData.title_ko,
          titleEn: formData.title_en,
          summaryKo: formData.content_ko?.replace(/!\[.*?\]\(.*?\)/g, '').slice(0, 200),
        });
        setDialogOpen(false);
        fetchItems();
      }
    }
  }

  async function handleDelete(id: string) {
    const item = items.find(i => i.id === id);
    if (!confirm(language === 'ko' ? '정말 삭제하시겠습니까?' : 'Delete this item?')) return;
    const { error } = await supabase.from('namsan_viewpoints').delete().eq('id', id);
    if (!error) {
      toast.success(language === 'ko' ? '삭제되었습니다' : 'Deleted');
      fetchItems();
    }
  }

  if (loading) return <div className="text-center py-8">Loading...</div>;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{language === 'ko' ? '남산 뷰 포인트 관리' : 'Namsan View Point Management'}</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAdd} size="sm"><Plus className="h-4 w-4 mr-2" />{language === 'ko' ? '추가' : 'Add'}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingItem ? (language === 'ko' ? '뷰 포인트 수정' : 'Edit View Point') : (language === 'ko' ? '뷰 포인트 추가' : 'Add View Point')}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>제목 (한국어)</Label>
                  <Input value={formData.title_ko} onChange={e => setFormData({ ...formData, title_ko: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Title (English)</Label>
                  <Input value={formData.title_en} onChange={e => setFormData({ ...formData, title_en: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>내용 (한국어) - 이미지/텍스트 붙여넣기 가능</Label>
                <RichPasteEditor rows={8} value={formData.content_ko} onChange={v => setFormData({ ...formData, content_ko: v })} placeholder="텍스트나 이미지를 붙여넣기 하세요..." />
              </div>
              <div className="space-y-2">
                <Label>Content (English) - Paste images/text</Label>
                <RichPasteEditor rows={8} value={formData.content_en} onChange={v => setFormData({ ...formData, content_en: v })} placeholder="Paste text or images here..." />
              </div>
              <div className="space-y-2">
                <Label>{language === 'ko' ? '이미지' : 'Image'}</Label>
                {formData.image_url && (
                  <div className="mb-2 relative">
                    <img src={formData.image_url} alt="Preview" className="max-h-40 rounded-lg object-cover" />
                    <Button type="button" variant="destructive" size="sm" className="absolute top-1 right-1" onClick={() => setFormData({ ...formData, image_url: null })}>✕</Button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    <div className="flex items-center gap-2 px-3 py-2 border rounded-md hover:bg-muted transition-colors text-sm">
                      <Upload className="h-4 w-4" />
                      {uploading ? 'Uploading...' : (language === 'ko' ? '이미지 업로드' : 'Upload Image')}
                    </div>
                  </label>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={formData.is_active} onCheckedChange={checked => setFormData({ ...formData, is_active: checked })} />
                <Label>{language === 'ko' ? '활성화' : 'Active'}</Label>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{language === 'ko' ? '취소' : 'Cancel'}</Button>
                <Button type="submit">{editingItem ? (language === 'ko' ? '수정' : 'Update') : (language === 'ko' ? '추가' : 'Add')}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">{language === 'ko' ? '등록된 뷰 포인트가 없습니다' : 'No viewpoints yet'}</p>
        ) : (
          <Tabs defaultValue="active" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="active" className="flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5" />
                {language === 'ko' ? '활성' : 'Active'}
                <Badge variant="secondary" className="ml-1 text-xs">{items.filter(i => i.is_active).length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="archived" className="flex items-center gap-1.5">
                <Archive className="h-3.5 w-3.5" />
                {language === 'ko' ? '보관함' : 'Archived'}
                <Badge variant="secondary" className="ml-1 text-xs">{items.filter(i => !i.is_active).length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="all" className="flex items-center gap-1.5">
                {language === 'ko' ? '전체' : 'All'}
                <Badge variant="secondary" className="ml-1 text-xs">{items.length}</Badge>
              </TabsTrigger>
            </TabsList>

            {['active', 'archived', 'all'].map(tab => {
              const filtered = tab === 'all' ? items : items.filter(i => tab === 'active' ? i.is_active : !i.is_active);
              
              // Group by month
              const grouped = filtered.reduce<Record<string, Viewpoint[]>>((acc, item) => {
                const date = new Date(item.created_at);
                const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                if (!acc[key]) acc[key] = [];
                acc[key].push(item);
                return acc;
              }, {});

              const sortedMonths = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

              return (
                <TabsContent key={tab} value={tab}>
                  {filtered.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      {language === 'ko' ? '항목이 없습니다' : 'No items'}
                    </p>
                  ) : (
                    <div className="space-y-6">
                      {sortedMonths.map(month => {
                        const [y, m] = month.split('-');
                        const monthLabel = new Date(+y, +m - 1).toLocaleDateString(
                          language === 'ko' ? 'ko-KR' : 'en-US',
                          { year: 'numeric', month: 'long' }
                        );

                        return (
                          <div key={month}>
                            <h4 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                              <span className="h-1 w-1 rounded-full bg-primary" />
                              {monthLabel}
                              <span className="text-xs font-normal">({grouped[month].length})</span>
                            </h4>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-[60px]">{language === 'ko' ? '순서' : 'Order'}</TableHead>
                                  <TableHead className="w-[40%]">{language === 'ko' ? '제목' : 'Title'}</TableHead>
                                  <TableHead>{language === 'ko' ? '이미지' : 'Image'}</TableHead>
                                  <TableHead>{language === 'ko' ? '상태' : 'Status'}</TableHead>
                                  <TableHead>{language === 'ko' ? '날짜/시간' : 'Date/Time'}</TableHead>
                                  <TableHead>{language === 'ko' ? '작업' : 'Actions'}</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {grouped[month].map(item => (
                                  <TableRow key={item.id} className={`${!item.is_active ? 'opacity-60' : ''} ${item.is_active && grouped[month].filter(i => i.is_active).indexOf(item) === 0 && month === sortedMonths[0] ? 'bg-primary/5' : ''}`}>
                                    <TableCell>
                                      {item.is_active && (
                                        <div className="flex flex-col items-center gap-0.5">
                                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleMoveOrder(item, 'up')} disabled={items.filter(i => i.is_active).sort((a, b) => a.display_order - b.display_order).indexOf(item) === 0}>
                                            <ArrowUp className="h-3 w-3" />
                                          </Button>
                                          <span className="text-xs text-muted-foreground">{item.display_order}</span>
                                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleMoveOrder(item, 'down')} disabled={items.filter(i => i.is_active).sort((a, b) => a.display_order - b.display_order).indexOf(item) === items.filter(i => i.is_active).length - 1}>
                                            <ArrowDown className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      <div className="font-medium">{item.title_ko}</div>
                                      {item.title_en && <div className="text-sm text-muted-foreground">{item.title_en}</div>}
                                      <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                        {item.content_ko?.replace(/!\[.*?\]\(.*?\)/g, '').slice(0, 60)}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      {item.image_url ? (
                                        <img src={item.image_url} alt="" className="h-8 w-12 object-cover rounded" />
                                      ) : (
                                        <span className="text-muted-foreground">—</span>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      <Switch checked={item.is_active} onCheckedChange={async () => {
                                        await supabase.from('namsan_viewpoints').update({ is_active: !item.is_active }).eq('id', item.id);
                                        fetchItems();
                                        toast.success(item.is_active 
                                          ? (language === 'ko' ? '보관함으로 이동' : 'Archived')
                                          : (language === 'ko' ? '활성화됨' : 'Activated'));
                                      }} />
                                    </TableCell>
                                    <TableCell className="text-xs whitespace-nowrap">
                                      <div>{new Date(item.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })}</div>
                                      <div className="text-muted-foreground">
                                        {new Date(item.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex gap-1">
                                        <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
