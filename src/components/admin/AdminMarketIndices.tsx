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
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, TrendingUp, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';

interface MarketIndex {
  id: string;
  symbol: string;
  name_ko: string;
  name_en: string;
  current_value: number;
  change_value: number | null;
  change_percent: number | null;
  external_link: string | null;
  color_class: string | null;
  display_order: number | null;
  is_active: boolean | null;
}

export function AdminMarketIndices() {
  const { language } = useLanguage();
  const [indices, setIndices] = useState<MarketIndex[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MarketIndex | null>(null);
  const [formData, setFormData] = useState({
    symbol: '',
    name_ko: '',
    name_en: '',
    current_value: '',
    change_value: '',
    change_percent: '',
    external_link: '',
    color_class: 'from-blue-500 to-blue-600',
    is_active: true
  });

  const colorOptions = [
    { value: 'from-blue-500 to-blue-600', label: 'Blue' },
    { value: 'from-green-500 to-green-600', label: 'Green' },
    { value: 'from-purple-500 to-purple-600', label: 'Purple' },
    { value: 'from-orange-500 to-orange-600', label: 'Orange' },
    { value: 'from-red-500 to-red-600', label: 'Red' },
    { value: 'from-cyan-500 to-cyan-600', label: 'Cyan' },
    { value: 'from-pink-500 to-pink-600', label: 'Pink' },
    { value: 'from-yellow-500 to-yellow-600', label: 'Yellow' },
  ];

  useEffect(() => {
    fetchIndices();
  }, []);

  async function fetchIndices() {
    const { data, error } = await supabase
      .from('market_indices')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      toast.error(language === 'ko' ? '데이터를 불러오는데 실패했습니다' : 'Failed to load data');
    } else {
      setIndices(data || []);
    }
    setLoading(false);
  }

  function openAddDialog() {
    setEditingItem(null);
    setFormData({
      symbol: '',
      name_ko: '',
      name_en: '',
      current_value: '',
      change_value: '',
      change_percent: '',
      external_link: '',
      color_class: 'from-blue-500 to-blue-600',
      is_active: true
    });
    setDialogOpen(true);
  }

  function openEditDialog(item: MarketIndex) {
    setEditingItem(item);
    setFormData({
      symbol: item.symbol,
      name_ko: item.name_ko,
      name_en: item.name_en,
      current_value: item.current_value.toString(),
      change_value: item.change_value?.toString() || '',
      change_percent: item.change_percent?.toString() || '',
      external_link: item.external_link || '',
      color_class: item.color_class || 'from-blue-500 to-blue-600',
      is_active: item.is_active ?? true
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.symbol || !formData.name_ko || !formData.name_en || !formData.current_value) {
      toast.error(language === 'ko' ? '필수 필드를 입력해주세요' : 'Please fill required fields');
      return;
    }

    const payload = {
      symbol: formData.symbol,
      name_ko: formData.name_ko,
      name_en: formData.name_en,
      current_value: parseFloat(formData.current_value),
      change_value: formData.change_value ? parseFloat(formData.change_value) : 0,
      change_percent: formData.change_percent ? parseFloat(formData.change_percent) : 0,
      external_link: formData.external_link || null,
      color_class: formData.color_class,
      is_active: formData.is_active,
      updated_at: new Date().toISOString()
    };

    if (editingItem) {
      const { error } = await supabase
        .from('market_indices')
        .update(payload)
        .eq('id', editingItem.id);

      if (error) {
        toast.error(language === 'ko' ? '수정에 실패했습니다' : 'Failed to update');
      } else {
        toast.success(language === 'ko' ? '수정되었습니다' : 'Updated successfully');
        setDialogOpen(false);
        fetchIndices();
      }
    } else {
      const maxOrder = indices.length > 0 ? Math.max(...indices.map(i => i.display_order || 0)) : 0;
      const { error } = await supabase
        .from('market_indices')
        .insert({
          ...payload,
          display_order: maxOrder + 1
        });

      if (error) {
        toast.error(language === 'ko' ? '추가에 실패했습니다' : 'Failed to add');
      } else {
        toast.success(language === 'ko' ? '추가되었습니다' : 'Added successfully');
        setDialogOpen(false);
        fetchIndices();
      }
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(language === 'ko' ? '정말 삭제하시겠습니까?' : 'Are you sure you want to delete?')) {
      return;
    }

    const { error } = await supabase
      .from('market_indices')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error(language === 'ko' ? '삭제에 실패했습니다' : 'Failed to delete');
    } else {
      toast.success(language === 'ko' ? '삭제되었습니다' : 'Deleted successfully');
      fetchIndices();
    }
  }

  async function moveItem(id: string, direction: 'up' | 'down') {
    const index = indices.findIndex(i => i.id === id);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === indices.length - 1) return;

    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    const currentItem = indices[index];
    const swapItem = indices[swapIndex];

    await Promise.all([
      supabase.from('market_indices').update({ display_order: swapItem.display_order }).eq('id', currentItem.id),
      supabase.from('market_indices').update({ display_order: currentItem.display_order }).eq('id', swapItem.id)
    ]);

    fetchIndices();
  }

  async function toggleActive(id: string, currentStatus: boolean | null) {
    const { error } = await supabase
      .from('market_indices')
      .update({ is_active: !(currentStatus ?? true), updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      toast.error(language === 'ko' ? '상태 변경에 실패했습니다' : 'Failed to update status');
    } else {
      fetchIndices();
    }
  }

  function formatNumber(value: number) {
    return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 }).format(value);
  }

  if (loading) {
    return <div className="text-center py-8">{language === 'ko' ? '로딩 중...' : 'Loading...'}</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{language === 'ko' ? '시장 지수 관리' : 'Market Indices Management'}</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAddDialog} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              {language === 'ko' ? '추가' : 'Add'}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingItem 
                  ? (language === 'ko' ? '지수 수정' : 'Edit Index')
                  : (language === 'ko' ? '지수 추가' : 'Add Index')
                }
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{language === 'ko' ? '심볼' : 'Symbol'} *</Label>
                  <Input
                    value={formData.symbol}
                    onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                    placeholder="KOSPI"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === 'ko' ? '현재가' : 'Current Value'} *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.current_value}
                    onChange={(e) => setFormData({ ...formData, current_value: e.target.value })}
                    placeholder="2650.50"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{language === 'ko' ? '한국어 이름' : 'Korean Name'} *</Label>
                  <Input
                    value={formData.name_ko}
                    onChange={(e) => setFormData({ ...formData, name_ko: e.target.value })}
                    placeholder="코스피"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === 'ko' ? '영어 이름' : 'English Name'} *</Label>
                  <Input
                    value={formData.name_en}
                    onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                    placeholder="KOSPI"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{language === 'ko' ? '변동값' : 'Change Value'}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.change_value}
                    onChange={(e) => setFormData({ ...formData, change_value: e.target.value })}
                    placeholder="+15.30"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === 'ko' ? '변동률 (%)' : 'Change Percent (%)'}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.change_percent}
                    onChange={(e) => setFormData({ ...formData, change_percent: e.target.value })}
                    placeholder="+0.58"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{language === 'ko' ? '외부 링크' : 'External Link'}</Label>
                <Input
                  value={formData.external_link}
                  onChange={(e) => setFormData({ ...formData, external_link: e.target.value })}
                  placeholder="https://investing.com/..."
                />
              </div>
              <div className="space-y-2">
                <Label>{language === 'ko' ? '색상' : 'Color'}</Label>
                <div className="flex flex-wrap gap-2">
                  {colorOptions.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, color_class: color.value })}
                      className={`w-8 h-8 rounded-full bg-gradient-to-r ${color.value} ${
                        formData.color_class === color.value ? 'ring-2 ring-offset-2 ring-primary' : ''
                      }`}
                      title={color.label}
                    />
                  ))}
                </div>
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
              <TableHead className="w-24">{language === 'ko' ? '순서' : 'Order'}</TableHead>
              <TableHead>{language === 'ko' ? '심볼' : 'Symbol'}</TableHead>
              <TableHead>{language === 'ko' ? '이름' : 'Name'}</TableHead>
              <TableHead className="text-right">{language === 'ko' ? '현재가' : 'Value'}</TableHead>
              <TableHead className="text-right">{language === 'ko' ? '변동' : 'Change'}</TableHead>
              <TableHead>{language === 'ko' ? '활성' : 'Active'}</TableHead>
              <TableHead>{language === 'ko' ? '작업' : 'Actions'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {indices.map((item, index) => {
              const isPositive = (item.change_value ?? 0) >= 0;
              return (
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
                        disabled={index === indices.length - 1}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${item.color_class}`} />
                      <span className="font-mono text-sm">{item.symbol}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>{item.name_ko}</div>
                    <div className="text-sm text-muted-foreground">{item.name_en}</div>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatNumber(item.current_value)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className={`flex items-center justify-end gap-1 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                      {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                      <span className="font-mono text-sm">
                        {isPositive ? '+' : ''}{formatNumber(item.change_value ?? 0)} ({isPositive ? '+' : ''}{formatNumber(item.change_percent ?? 0)}%)
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={item.is_active ?? true}
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
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
