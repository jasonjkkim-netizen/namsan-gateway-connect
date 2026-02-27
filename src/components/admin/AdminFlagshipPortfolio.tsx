import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, RefreshCw } from 'lucide-react';
import type { PortfolioItemRow } from '@/components/flagship/portfolioTypes';

const GROUP_OPTIONS = [
  { value: 'shares', label: '주식' },
  { value: 'bonds', label: '채권' },
  { value: 'others', label: '기타' },
  { value: 'cash', label: '현금' },
];

const ASSET_TYPE_OPTIONS = [
  { value: 'stock', label: 'Stock' },
  { value: 'bond', label: 'Bond' },
  { value: 'etf', label: 'ETF' },
  { value: 'cash', label: 'Cash' },
];

interface FormData {
  name: string;
  group_id: string;
  asset_type: string;
  ticker: string;
  currency: string;
  recommended_weight: string;
  target_annual_return: string;
  current_price: string;
  base_price: string;
  display_order: string;
  notes: string;
}

const emptyForm: FormData = {
  name: '', group_id: 'shares', asset_type: 'stock', ticker: '', currency: 'KRW',
  recommended_weight: '0', target_annual_return: '', current_price: '', base_price: '',
  display_order: '0', notes: '',
};

export function AdminFlagshipPortfolio() {
  const { language } = useLanguage();
  const ko = language === 'ko';
  const [items, setItems] = useState<PortfolioItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);

  const fetchItems = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('flagship_portfolio_items')
      .select('*')
      .order('group_id')
      .order('display_order');
    if (data) setItems(data as unknown as PortfolioItemRow[]);
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (item: PortfolioItemRow) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      group_id: item.group_id,
      asset_type: item.asset_type,
      ticker: item.ticker || '',
      currency: item.currency,
      recommended_weight: String(item.recommended_weight),
      target_annual_return: item.target_annual_return != null ? String(item.target_annual_return) : '',
      current_price: item.current_price != null ? String(item.current_price) : '',
      base_price: item.base_price != null ? String(item.base_price) : '',
      display_order: String(item.display_order),
      notes: item.notes || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const payload: Record<string, any> = {
      name: form.name,
      group_id: form.group_id,
      asset_type: form.asset_type,
      ticker: form.ticker || null,
      currency: form.currency,
      recommended_weight: parseFloat(form.recommended_weight) || 0,
      target_annual_return: form.target_annual_return ? parseFloat(form.target_annual_return) : null,
      current_price: form.current_price ? parseFloat(form.current_price) : null,
      base_price: form.base_price ? parseFloat(form.base_price) : null,
      display_order: parseInt(form.display_order) || 0,
      notes: form.notes || null,
    };

    let error;
    if (editingId) {
      ({ error } = await supabase.from('flagship_portfolio_items').update(payload).eq('id', editingId));
    } else {
      ({ error } = await supabase.from('flagship_portfolio_items').insert([payload] as any));
    }

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(editingId ? (ko ? '수정됨' : 'Updated') : (ko ? '추가됨' : 'Created'));
      setDialogOpen(false);
      fetchItems();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(ko ? '삭제하시겠습니까?' : 'Delete this item?')) return;
    const { error } = await supabase.from('flagship_portfolio_items').delete().eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success(ko ? '삭제됨' : 'Deleted'); fetchItems(); }
  };

  const handleToggleActive = async (item: PortfolioItemRow) => {
    const { error } = await supabase
      .from('flagship_portfolio_items')
      .update({ is_active: !item.is_active })
      .eq('id', item.id);
    if (!error) fetchItems();
  };

  const updateField = (key: keyof FormData, value: string) => setForm(p => ({ ...p, [key]: value }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          {ko ? 'Flagship 포트폴리오 관리' : 'Flagship Portfolio Management'}
        </h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchItems} disabled={loading}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> {ko ? '추가' : 'Add'}
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              <TableHead>{ko ? '그룹' : 'Group'}</TableHead>
              <TableHead>{ko ? '종목명' : 'Name'}</TableHead>
              <TableHead>{ko ? '코드' : 'Ticker'}</TableHead>
              <TableHead className="text-right">{ko ? '비중(%)' : 'Weight(%)'}</TableHead>
              <TableHead className="text-right">{ko ? '목표수익률' : 'Target Return'}</TableHead>
              <TableHead className="text-right">{ko ? '기준가' : 'Base Price'}</TableHead>
              <TableHead className="text-right">{ko ? '현재가' : 'Current'}</TableHead>
              <TableHead>{ko ? '상태' : 'Active'}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(item => (
              <TableRow key={item.id} className={!item.is_active ? 'opacity-50' : ''}>
                <TableCell>{GROUP_OPTIONS.find(o => o.value === item.group_id)?.label || item.group_id}</TableCell>
                <TableCell className="font-medium max-w-[150px] truncate">{item.name}</TableCell>
                <TableCell>{item.ticker || '-'}</TableCell>
                <TableCell className="text-right font-mono">{item.recommended_weight}</TableCell>
                <TableCell className="text-right font-mono">
                  {item.target_annual_return != null ? `${(Number(item.target_annual_return) * 100).toFixed(1)}%` : '-'}
                </TableCell>
                <TableCell className="text-right font-mono">{item.base_price ?? '-'}</TableCell>
                <TableCell className="text-right font-mono">{item.current_price ?? '-'}</TableCell>
                <TableCell>
                  <button onClick={() => handleToggleActive(item)} className={`text-xs px-2 py-0.5 rounded ${item.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {item.is_active ? 'ON' : 'OFF'}
                  </button>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(item.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? (ko ? '항목 수정' : 'Edit Item') : (ko ? '항목 추가' : 'Add Item')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{ko ? '그룹' : 'Group'}</Label>
                <Select value={form.group_id} onValueChange={v => updateField('group_id', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GROUP_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">{ko ? '자산유형' : 'Asset Type'}</Label>
                <Select value={form.asset_type} onValueChange={v => updateField('asset_type', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ASSET_TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">{ko ? '종목명' : 'Name'}</Label>
              <Input value={form.name} onChange={e => updateField('name', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{ko ? '코드/티커' : 'Ticker'}</Label>
                <Input value={form.ticker} onChange={e => updateField('ticker', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">{ko ? '통화' : 'Currency'}</Label>
                <Select value={form.currency} onValueChange={v => updateField('currency', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="KRW">KRW</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{ko ? '추천 비중 (%)' : 'Weight (%)'}</Label>
                <Input type="number" value={form.recommended_weight} onChange={e => updateField('recommended_weight', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">{ko ? '목표 연수익률 (소수)' : 'Target Return (decimal)'}</Label>
                <Input type="number" step="0.01" value={form.target_annual_return} onChange={e => updateField('target_annual_return', e.target.value)} placeholder="e.g. 0.07" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{ko ? '기준가 (2/2)' : 'Base Price'}</Label>
                <Input type="number" value={form.base_price} onChange={e => updateField('base_price', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">{ko ? '현재가' : 'Current Price'}</Label>
                <Input type="number" value={form.current_price} onChange={e => updateField('current_price', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{ko ? '표시 순서' : 'Display Order'}</Label>
                <Input type="number" value={form.display_order} onChange={e => updateField('display_order', e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-xs">{ko ? '메모' : 'Notes'}</Label>
              <Input value={form.notes} onChange={e => updateField('notes', e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{ko ? '취소' : 'Cancel'}</Button>
            <Button onClick={handleSave}>{ko ? '저장' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
