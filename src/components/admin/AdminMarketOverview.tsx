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
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { toast } from 'sonner';

interface MarketItem {
  id: string;
  symbol: string;
  title_ko: string;
  title_en: string;
  display_order: number;
  is_active: boolean;
}

export function AdminMarketOverview() {
  const { language } = useLanguage();
  const [items, setItems] = useState<MarketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MarketItem | null>(null);
  const [formData, setFormData] = useState({
    symbol: '',
    title_ko: '',
    title_en: '',
    is_active: true
  });

  useEffect(() => {
    fetchItems();
  }, []);

  async function fetchItems() {
    const { data, error } = await supabase
      .from('market_overview_items')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      toast.error(language === 'ko' ? '데이터를 불러오는데 실패했습니다' : 'Failed to load data');
    } else {
      setItems(data || []);
    }
    setLoading(false);
  }

  function openAddDialog() {
    setEditingItem(null);
    setFormData({ symbol: '', title_ko: '', title_en: '', is_active: true });
    setDialogOpen(true);
  }

  function openEditDialog(item: MarketItem) {
    setEditingItem(item);
    setFormData({
      symbol: item.symbol,
      title_ko: item.title_ko,
      title_en: item.title_en,
      is_active: item.is_active
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.symbol || !formData.title_ko || !formData.title_en) {
      toast.error(language === 'ko' ? '모든 필드를 입력해주세요' : 'Please fill all fields');
      return;
    }

    if (editingItem) {
      const { error } = await supabase
        .from('market_overview_items')
        .update({
          symbol: formData.symbol,
          title_ko: formData.title_ko,
          title_en: formData.title_en,
          is_active: formData.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingItem.id);

      if (error) {
        toast.error(language === 'ko' ? '수정에 실패했습니다' : 'Failed to update');
      } else {
        toast.success(language === 'ko' ? '수정되었습니다' : 'Updated successfully');
        setDialogOpen(false);
        fetchItems();
      }
    } else {
      const maxOrder = items.length > 0 ? Math.max(...items.map(i => i.display_order)) : 0;
      const { error } = await supabase
        .from('market_overview_items')
        .insert({
          symbol: formData.symbol,
          title_ko: formData.title_ko,
          title_en: formData.title_en,
          is_active: formData.is_active,
          display_order: maxOrder + 1
        });

      if (error) {
        toast.error(language === 'ko' ? '추가에 실패했습니다' : 'Failed to add');
      } else {
        toast.success(language === 'ko' ? '추가되었습니다' : 'Added successfully');
        setDialogOpen(false);
        fetchItems();
      }
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(language === 'ko' ? '정말 삭제하시겠습니까?' : 'Are you sure you want to delete?')) {
      return;
    }

    const { error } = await supabase
      .from('market_overview_items')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error(language === 'ko' ? '삭제에 실패했습니다' : 'Failed to delete');
    } else {
      toast.success(language === 'ko' ? '삭제되었습니다' : 'Deleted successfully');
      fetchItems();
    }
  }

  async function moveItem(id: string, direction: 'up' | 'down') {
    const index = items.findIndex(i => i.id === id);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === items.length - 1) return;

    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    const currentItem = items[index];
    const swapItem = items[swapIndex];

    await Promise.all([
      supabase.from('market_overview_items').update({ display_order: swapItem.display_order }).eq('id', currentItem.id),
      supabase.from('market_overview_items').update({ display_order: currentItem.display_order }).eq('id', swapItem.id)
    ]);

    fetchItems();
  }

  async function toggleActive(id: string, currentStatus: boolean) {
    const { error } = await supabase
      .from('market_overview_items')
      .update({ is_active: !currentStatus, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      toast.error(language === 'ko' ? '상태 변경에 실패했습니다' : 'Failed to update status');
    } else {
      fetchItems();
    }
  }

  if (loading) {
    return <div className="text-center py-8">{language === 'ko' ? '로딩 중...' : 'Loading...'}</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{language === 'ko' ? '한눈에 보는 시장 관리' : 'Market Overview Management'}</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAddDialog} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              {language === 'ko' ? '추가' : 'Add'}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingItem 
                  ? (language === 'ko' ? '항목 수정' : 'Edit Item')
                  : (language === 'ko' ? '항목 추가' : 'Add Item')
                }
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>{language === 'ko' ? '심볼 (TradingView)' : 'Symbol (TradingView)'}</Label>
                <Input
                  value={formData.symbol}
                  onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                  placeholder="예: TVC:NI225, AMEX:SPY"
                />
              </div>
              <div className="space-y-2">
                <Label>{language === 'ko' ? '한국어 제목' : 'Korean Title'}</Label>
                <Input
                  value={formData.title_ko}
                  onChange={(e) => setFormData({ ...formData, title_ko: e.target.value })}
                  placeholder="니케이 225"
                />
              </div>
              <div className="space-y-2">
                <Label>{language === 'ko' ? '영어 제목' : 'English Title'}</Label>
                <Input
                  value={formData.title_en}
                  onChange={(e) => setFormData({ ...formData, title_en: e.target.value })}
                  placeholder="Nikkei 225"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label>{language === 'ko' ? '활성화' : 'Active'}</Label>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  {language === 'ko' ? '취소' : 'Cancel'}
                </Button>
                <Button type="submit">
                  {editingItem 
                    ? (language === 'ko' ? '수정' : 'Update')
                    : (language === 'ko' ? '추가' : 'Add')
                  }
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{language === 'ko' ? '순서' : 'Order'}</TableHead>
              <TableHead>{language === 'ko' ? '심볼' : 'Symbol'}</TableHead>
              <TableHead>{language === 'ko' ? '제목 (한/영)' : 'Title (KO/EN)'}</TableHead>
              <TableHead>{language === 'ko' ? '활성' : 'Active'}</TableHead>
              <TableHead>{language === 'ko' ? '작업' : 'Actions'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => moveItem(item.id, 'up')}
                      disabled={index === 0}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => moveItem(item.id, 'down')}
                      disabled={index === items.length - 1}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-sm">{item.symbol}</TableCell>
                <TableCell>
                  <div>{item.title_ko}</div>
                  <div className="text-sm text-muted-foreground">{item.title_en}</div>
                </TableCell>
                <TableCell>
                  <Switch
                    checked={item.is_active}
                    onCheckedChange={() => toggleActive(item.id, item.is_active)}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
