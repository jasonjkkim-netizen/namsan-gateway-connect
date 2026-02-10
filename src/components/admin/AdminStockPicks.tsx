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
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface StockPick {
  id: string;
  stock_name: string;
  stock_code: string | null;
  recommendation_date: string;
  closing_price_at_recommendation: number;
  current_closing_price: number | null;
  display_order: number;
  is_active: boolean;
}

export function AdminStockPicks() {
  const { language } = useLanguage();
  const [items, setItems] = useState<StockPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingPrices, setUpdatingPrices] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<StockPick | null>(null);
  const [formData, setFormData] = useState({
    stock_name: '',
    stock_code: '',
    recommendation_date: '',
    closing_price_at_recommendation: '',
    current_closing_price: '',
    is_active: true
  });

  useEffect(() => {
    fetchItems();
  }, []);

  async function fetchItems() {
    const { data, error } = await supabase
      .from('weekly_stock_picks')
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
    setFormData({
      stock_name: '',
      stock_code: '',
      recommendation_date: new Date().toISOString().split('T')[0],
      closing_price_at_recommendation: '',
      current_closing_price: '',
      is_active: true
    });
    setDialogOpen(true);
  }

  function openEditDialog(item: StockPick) {
    setEditingItem(item);
    setFormData({
      stock_name: item.stock_name,
      stock_code: item.stock_code || '',
      recommendation_date: item.recommendation_date,
      closing_price_at_recommendation: item.closing_price_at_recommendation.toString(),
      current_closing_price: item.current_closing_price?.toString() || '',
      is_active: item.is_active
    });
    setDialogOpen(true);
  }

  async function fetchSingleStockPrice(stockCode: string, stockName: string): Promise<number | null> {
    if (!stockCode) return null;
    
    try {
      const { data, error } = await supabase.functions.invoke('fetch-stock-prices', {
        body: {
          stockCodes: [{ code: stockCode, name: stockName }]
        }
      });

      if (error || !data.success) {
        console.warn('Failed to fetch price:', error || data.error);
        return null;
      }

      const result = data.data?.[0];
      return result?.currentPrice || null;
    } catch (err) {
      console.warn('Error fetching single stock price:', err);
      return null;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.stock_name || !formData.recommendation_date || !formData.closing_price_at_recommendation) {
      toast.error(language === 'ko' ? '필수 필드를 입력해주세요' : 'Please fill required fields');
      return;
    }

    // Auto-fetch current price if stock code is provided and current price is empty
    let currentPrice = formData.current_closing_price ? parseFloat(formData.current_closing_price) : null;
    
    if (formData.stock_code && !currentPrice) {
      toast.info(language === 'ko' ? '현재가 자동 조회 중...' : 'Fetching current price...');
      const fetchedPrice = await fetchSingleStockPrice(formData.stock_code, formData.stock_name);
      if (fetchedPrice) {
        currentPrice = fetchedPrice;
        toast.success(language === 'ko' ? `현재가: ${fetchedPrice.toLocaleString()}원` : `Current price: ₩${fetchedPrice.toLocaleString()}`);
      }
    }

    const payload = {
      stock_name: formData.stock_name,
      stock_code: formData.stock_code || null,
      recommendation_date: formData.recommendation_date,
      closing_price_at_recommendation: parseFloat(formData.closing_price_at_recommendation),
      current_closing_price: currentPrice,
      is_active: formData.is_active,
      updated_at: new Date().toISOString()
    };

    if (editingItem) {
      const { error } = await supabase
        .from('weekly_stock_picks')
        .update(payload)
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
        .from('weekly_stock_picks')
        .insert({ ...payload, display_order: maxOrder + 1 });

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
      .from('weekly_stock_picks')
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
      supabase.from('weekly_stock_picks').update({ display_order: swapItem.display_order }).eq('id', currentItem.id),
      supabase.from('weekly_stock_picks').update({ display_order: currentItem.display_order }).eq('id', swapItem.id)
    ]);

    fetchItems();
  }

  function calculateReturn(recommendedPrice: number, currentPrice: number | null): string {
    if (!currentPrice) return '-';
    const returnPct = ((currentPrice - recommendedPrice) / recommendedPrice) * 100;
    return `${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(2)}%`;
  }

  async function handleFetchPrices() {
    const stocksWithCodes = items.filter(item => item.stock_code && item.is_active);
    
    if (stocksWithCodes.length === 0) {
      toast.error(language === 'ko' ? '종목 코드가 있는 활성 종목이 없습니다' : 'No active stocks with codes');
      return;
    }

    setUpdatingPrices(true);
    toast.info(language === 'ko' ? '주가 업데이트 중...' : 'Fetching stock prices...');

    try {
      const { data, error } = await supabase.functions.invoke('fetch-stock-prices', {
        body: {
          stockCodes: stocksWithCodes.map(item => ({
            code: item.stock_code,
            name: item.stock_name
          }))
        }
      });

      if (error) {
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch prices');
      }

      // Update each stock with fetched price
      let updatedCount = 0;
      let failedCount = 0;

      for (const result of data.data) {
        if (result.currentPrice) {
          const stockItem = stocksWithCodes.find(s => s.stock_code === result.stockCode);
          if (stockItem) {
            const { error: updateError } = await supabase
              .from('weekly_stock_picks')
              .update({ 
                current_closing_price: result.currentPrice,
                updated_at: new Date().toISOString()
              })
              .eq('id', stockItem.id);
            
            if (!updateError) {
              updatedCount++;
            } else {
              failedCount++;
            }
          }
        } else {
          failedCount++;
          console.warn(`Failed to get price for ${result.stockName}: ${result.error}`);
        }
      }

      if (updatedCount > 0) {
        toast.success(
          language === 'ko' 
            ? `${updatedCount}개 종목 가격 업데이트 완료` 
            : `Updated prices for ${updatedCount} stocks`
        );
      }
      
      if (failedCount > 0) {
        toast.warning(
          language === 'ko' 
            ? `${failedCount}개 종목 가격 업데이트 실패` 
            : `Failed to update ${failedCount} stocks`
        );
      }

      fetchItems();

    } catch (error) {
      console.error('Error fetching stock prices:', error);
      toast.error(
        language === 'ko' 
          ? '주가 업데이트에 실패했습니다. Firecrawl 커넥터가 연결되었는지 확인해주세요.' 
          : 'Failed to fetch stock prices. Make sure Firecrawl connector is enabled.'
      );
    } finally {
      setUpdatingPrices(false);
    }
  }

  if (loading) {
    return <div className="text-center py-8">{language === 'ko' ? '로딩 중...' : 'Loading...'}</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{language === 'ko' ? '금주 관심 종목 관리' : 'Weekly Stock Picks'}</CardTitle>
        <div className="flex items-center gap-2">
          <Button 
            onClick={handleFetchPrices} 
            size="sm" 
            variant="outline"
            disabled={updatingPrices}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${updatingPrices ? 'animate-spin' : ''}`} />
            {language === 'ko' ? '주가 업데이트' : 'Update Prices'}
          </Button>
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
                  ? (language === 'ko' ? '종목 수정' : 'Edit Stock')
                  : (language === 'ko' ? '종목 추가' : 'Add Stock')
                }
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>{language === 'ko' ? '종목명 *' : 'Stock Name *'}</Label>
                <Input
                  value={formData.stock_name}
                  onChange={(e) => setFormData({ ...formData, stock_name: e.target.value })}
                  placeholder="삼성전자"
                />
              </div>
              <div className="space-y-2">
                <Label>{language === 'ko' ? '종목 코드' : 'Stock Code'}</Label>
                <Input
                  value={formData.stock_code}
                  onChange={(e) => setFormData({ ...formData, stock_code: e.target.value })}
                  placeholder="005930"
                />
              </div>
              <div className="space-y-2">
                <Label>{language === 'ko' ? '추천일 *' : 'Recommendation Date *'}</Label>
                <Input
                  type="date"
                  value={formData.recommendation_date}
                  onChange={(e) => setFormData({ ...formData, recommendation_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{language === 'ko' ? '추천일 종가 *' : 'Closing Price (Rec. Date) *'}</Label>
                <Input
                  type="number"
                  value={formData.closing_price_at_recommendation}
                  onChange={(e) => setFormData({ ...formData, closing_price_at_recommendation: e.target.value })}
                  placeholder="50000"
                />
              </div>
              <div className="space-y-2">
                <Label>{language === 'ko' ? '현재 가격' : 'Current Price'}</Label>
                <Input
                  type="number"
                  value={formData.current_closing_price}
                  onChange={(e) => setFormData({ ...formData, current_closing_price: e.target.value })}
                  placeholder="52000"
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
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{language === 'ko' ? '순서' : 'Order'}</TableHead>
              <TableHead>{language === 'ko' ? '종목명' : 'Stock'}</TableHead>
              <TableHead>{language === 'ko' ? '추천일' : 'Date'}</TableHead>
              <TableHead>{language === 'ko' ? '추천일 종가' : 'Rec. Price'}</TableHead>
              <TableHead>{language === 'ko' ? '현재 가격' : 'Current'}</TableHead>
              <TableHead>{language === 'ko' ? '수익률' : 'Return'}</TableHead>
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
                <TableCell className="font-medium">{item.stock_name}</TableCell>
                <TableCell>{item.recommendation_date}</TableCell>
                <TableCell>{item.closing_price_at_recommendation.toLocaleString()}원</TableCell>
                <TableCell>{item.current_closing_price?.toLocaleString() || '-'}원</TableCell>
                <TableCell className={
                  item.current_closing_price && item.current_closing_price > item.closing_price_at_recommendation
                    ? 'text-green-600 font-medium'
                    : item.current_closing_price && item.current_closing_price < item.closing_price_at_recommendation
                      ? 'text-red-600 font-medium'
                      : ''
                }>
                  {calculateReturn(item.closing_price_at_recommendation, item.current_closing_price)}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={item.is_active}
                    onCheckedChange={async () => {
                      await supabase
                        .from('weekly_stock_picks')
                        .update({ is_active: !item.is_active })
                        .eq('id', item.id);
                      fetchItems();
                    }}
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
