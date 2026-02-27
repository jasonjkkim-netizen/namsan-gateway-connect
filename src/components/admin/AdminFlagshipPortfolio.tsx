import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, RefreshCw, Save, PieChart, BarChart3, Settings2, MessageSquareQuote } from 'lucide-react';
import type { PortfolioItemRow } from '@/components/flagship/portfolioTypes';
import { GROUP_META, GroupId, PRESETS, DEFAULT_ASSUMPTIONS } from '@/components/flagship/portfolioTypes';
import { mapRowToItem, buildGroups, formatPct } from '@/components/flagship/portfolioUtils';
import { FlagshipCharts } from '@/components/flagship/FlagshipCharts';

const GROUP_OPTIONS = [
  { value: 'shares', label: '주식 (Shares)' },
  { value: 'bonds', label: '채권 (Bonds)' },
  { value: 'others', label: '기타 (Others)' },
  { value: 'cash', label: '현금 (Cash)' },
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

  // Settings state
  const [presetWeights, setPresetWeights] = useState({
    low: { shares: 30, bonds: 70, others: 0, cash: 0 },
    mid: { shares: 50, bonds: 50, others: 0, cash: 0 },
    high: { shares: 70, bonds: 30, others: 0, cash: 0 },
  });

  // Preview weights for chart
  const [previewWeights, setPreviewWeights] = useState<Record<GroupId, number>>({
    shares: 50, bonds: 40, others: 10, cash: 0,
  });

  // CIO Commentary state
  const [cioKo, setCioKo] = useState('');
  const [cioEn, setCioEn] = useState('');

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

  // Load settings from app_settings
  const fetchSettings = async () => {
    const { data } = await supabase.from('app_settings').select('*').eq('key', 'flagship_config').maybeSingle();
    if (data?.value) {
      const val = data.value as any;
      if (val.presetWeights) setPresetWeights(val.presetWeights);
    }
  };

  const fetchCIO = async () => {
    const { data } = await supabase.from('app_settings').select('value').eq('key', 'cio_commentary').maybeSingle();
    if (data?.value) {
      const val = data.value as any;
      setCioKo(val.content_ko || '');
      setCioEn(val.content_en || '');
    }
  };

  useEffect(() => { fetchItems(); fetchSettings(); fetchCIO(); }, []);

  const mappedItems = useMemo(() => items.filter(i => i.is_active).map(r => mapRowToItem(r as any)), [items]);
  const groups = useMemo(() => buildGroups(mappedItems), [mappedItems]);

  // Sync preview weights from actual data
  useEffect(() => {
    if (mappedItems.length > 0) {
      const w: Record<GroupId, number> = { shares: 0, bonds: 0, others: 0, cash: 0 };
      mappedItems.forEach(i => { w[i.groupId] = (w[i.groupId] || 0) + i.weight; });
      const total = Object.values(w).reduce((s, v) => s + v, 0);
      if (total > 0) {
        (Object.keys(w) as GroupId[]).forEach(k => { w[k] = Math.round(w[k] / total * 100 * 10) / 10; });
        setPreviewWeights(w);
      }
    }
  }, [mappedItems]);

  // Group-level weight summaries
  const weightSummary = useMemo(() => {
    const summary: Record<string, { count: number; totalWeight: number; performance: number }> = {};
    for (const g of GROUP_OPTIONS) {
      const gItems = items.filter(i => i.group_id === g.value && i.is_active);
      const totalWeight = gItems.reduce((s, i) => s + Number(i.recommended_weight), 0);
      const group = groups.find(gr => gr.id === g.value);
      summary[g.value] = { count: gItems.length, totalWeight, performance: group?.performance || 0 };
    }
    return summary;
  }, [items, groups]);

  const openCreate = () => { setEditingId(null); setForm(emptyForm); setDialogOpen(true); };

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
    if (!form.name.trim()) { toast.error(ko ? '종목명을 입력하세요' : 'Name is required'); return; }
    const payload: Record<string, any> = {
      name: form.name.trim(),
      group_id: form.group_id,
      asset_type: form.asset_type,
      ticker: form.ticker.trim() || null,
      currency: form.currency,
      recommended_weight: parseFloat(form.recommended_weight) || 0,
      target_annual_return: form.target_annual_return ? parseFloat(form.target_annual_return) : null,
      current_price: form.current_price ? parseFloat(form.current_price) : null,
      base_price: form.base_price ? parseFloat(form.base_price) : null,
      display_order: parseInt(form.display_order) || 0,
      notes: form.notes.trim() || null,
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

  const handleBulkUpdatePrices = async () => {
    // Prompt for updating all current prices at once
    const priceUpdates: { id: string; name: string; currentPrice: string }[] = [];
    for (const item of items.filter(i => i.is_active && i.asset_type !== 'bond' && i.asset_type !== 'cash')) {
      const newPrice = prompt(`${item.name} (${item.ticker || 'N/A'}) - ${ko ? '현재가 입력' : 'Enter current price'}:`, String(item.current_price || ''));
      if (newPrice === null) return; // cancelled
      if (newPrice) priceUpdates.push({ id: item.id, name: item.name, currentPrice: newPrice });
    }

    let updated = 0;
    for (const up of priceUpdates) {
      const { error } = await supabase
        .from('flagship_portfolio_items')
        .update({ current_price: parseFloat(up.currentPrice) })
        .eq('id', up.id);
      if (!error) updated++;
    }
    toast.success(ko ? `${updated}개 종목 가격 업데이트됨` : `${updated} prices updated`);
    fetchItems();
  };

  const saveSettings = async () => {
    const config = { presetWeights };
    const { data: existing } = await supabase.from('app_settings').select('id').eq('key', 'flagship_config').maybeSingle();
    
    let error;
    if (existing) {
      ({ error } = await supabase.from('app_settings').update({ value: config as any }).eq('key', 'flagship_config'));
    } else {
      ({ error } = await supabase.from('app_settings').insert([{ key: 'flagship_config', value: config as any }] as any));
    }
    
    if (error) toast.error(error.message);
    else toast.success(ko ? '설정 저장됨' : 'Settings saved');
  };

  const saveCIO = async () => {
    const value = { content_ko: cioKo, content_en: cioEn };
    const { data: existing } = await supabase.from('app_settings').select('id').eq('key', 'cio_commentary').maybeSingle();
    let error;
    if (existing) {
      ({ error } = await supabase.from('app_settings').update({ value: value as any }).eq('key', 'cio_commentary'));
    } else {
      ({ error } = await supabase.from('app_settings').insert([{ key: 'cio_commentary', value: value as any }] as any));
    }
    if (error) toast.error(error.message);
    else toast.success(ko ? 'CIO 코멘트 저장됨' : 'CIO commentary saved');
  };

  const updateField = (key: keyof FormData, value: string) => setForm(p => ({ ...p, [key]: value }));

  return (
    <div className="space-y-6">
      <Tabs defaultValue="items" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="items" className="flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            {ko ? '종목 관리' : 'Items'}
          </TabsTrigger>
          <TabsTrigger value="cio" className="flex items-center gap-1.5">
            <MessageSquareQuote className="h-3.5 w-3.5" />
            {ko ? 'CIO 코멘트' : 'CIO Comment'}
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-1.5">
            <Settings2 className="h-3.5 w-3.5" />
            {ko ? '배분/설정' : 'Allocation'}
          </TabsTrigger>
          <TabsTrigger value="preview" className="flex items-center gap-1.5">
            <PieChart className="h-3.5 w-3.5" />
            {ko ? '미리보기' : 'Preview'}
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Items Management ── */}
        <TabsContent value="items" className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {GROUP_OPTIONS.map(g => {
              const s = weightSummary[g.value];
              return (
                <Card key={g.value} className="p-3">
                  <div className="text-xs text-muted-foreground">{g.label}</div>
                  <div className="text-lg font-mono font-bold">{s?.totalWeight.toFixed(1)}%</div>
                  <div className="text-[10px] text-muted-foreground">
                    {s?.count || 0} {ko ? '종목' : 'items'} · {formatPct(s?.performance || 0)}
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-lg font-semibold">
              {ko ? 'Flagship 포트폴리오 종목' : 'Flagship Portfolio Items'}
            </h3>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={handleBulkUpdatePrices}>
                {ko ? '일괄 가격 업데이트' : 'Bulk Price Update'}
              </Button>
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
                  <TableHead>{ko ? '유형' : 'Type'}</TableHead>
                  <TableHead className="text-right">{ko ? '비중(%)' : 'Weight(%)'}</TableHead>
                  <TableHead className="text-right">{ko ? '목표수익률' : 'Target Return'}</TableHead>
                  <TableHead className="text-right">{ko ? '기준가' : 'Base Price'}</TableHead>
                  <TableHead className="text-right">{ko ? '현재가' : 'Current'}</TableHead>
                  <TableHead className="text-right">{ko ? '수익률' : 'Return'}</TableHead>
                  <TableHead>{ko ? '상태' : 'Active'}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(item => {
                  const mapped = mapRowToItem(item as any);
                  const ret = mapped.basePrice && mapped.currentPrice
                    ? (mapped.currentPrice / mapped.basePrice - 1)
                    : mapped.targetAnnualReturn || 0;
                  const retColor = ret > 0 ? 'text-green-600' : ret < 0 ? 'text-red-500' : 'text-muted-foreground';

                  return (
                    <TableRow key={item.id} className={!item.is_active ? 'opacity-40' : ''}>
                      <TableCell>
                        <span className="inline-flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full" style={{
                            backgroundColor: item.group_id === 'shares' ? 'hsl(var(--accent))'
                              : item.group_id === 'bonds' ? 'hsl(var(--primary))'
                              : item.group_id === 'others' ? 'hsl(142 71% 45%)'
                              : 'hsl(var(--muted-foreground))'
                          }} />
                          {GROUP_OPTIONS.find(o => o.value === item.group_id)?.label.split(' ')[0] || item.group_id}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium max-w-[140px] truncate">{item.name}</TableCell>
                      <TableCell className="text-muted-foreground">{item.ticker || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">{item.asset_type}</TableCell>
                      <TableCell className="text-right font-mono">{item.recommended_weight}</TableCell>
                      <TableCell className="text-right font-mono">
                        {item.target_annual_return != null ? `${(Number(item.target_annual_return) * 100).toFixed(1)}%` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono">{item.base_price != null ? Number(item.base_price).toLocaleString() : '-'}</TableCell>
                      <TableCell className="text-right font-mono">{item.current_price != null ? Number(item.current_price).toLocaleString() : '-'}</TableCell>
                      <TableCell className={`text-right font-mono ${retColor}`}>
                        {formatPct(ret)}
                      </TableCell>
                      <TableCell>
                        <button onClick={() => handleToggleActive(item)} className={`text-[10px] px-2 py-0.5 rounded ${item.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>
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
                  );
                })}
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                      {ko ? '항목이 없습니다' : 'No items yet'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── Tab: CIO Commentary ── */}
        <TabsContent value="cio" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquareQuote className="h-5 w-5 text-accent" />
                {ko ? 'CIO 코멘트 관리' : 'CIO Commentary Management'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs">{ko ? '한국어 코멘트' : 'Korean Commentary'}</Label>
                <Textarea
                  value={cioKo}
                  onChange={e => setCioKo(e.target.value)}
                  rows={6}
                  placeholder={ko ? 'CIO 코멘트를 입력하세요 (마크다운 지원)' : 'Enter CIO commentary in Korean (markdown supported)'}
                  className="mt-1 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">{ko ? '영어 코멘트' : 'English Commentary'}</Label>
                <Textarea
                  value={cioEn}
                  onChange={e => setCioEn(e.target.value)}
                  rows={6}
                  placeholder="Enter CIO commentary in English (markdown supported)"
                  className="mt-1 text-sm"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                {ko
                  ? '마크다운 형식을 지원합니다. **굵게**, *기울임*, - 목록 등을 사용할 수 있습니다.'
                  : 'Markdown is supported. Use **bold**, *italic*, - lists, etc.'}
              </p>
              <Button onClick={saveCIO} className="gap-1.5">
                <Save className="h-4 w-4" />
                {ko ? 'CIO 코멘트 저장' : 'Save CIO Commentary'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 2: Allocation & Settings ── */}
        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{ko ? '시나리오 프리셋 비중 관리' : 'Scenario Preset Weights'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {(['low', 'mid', 'high'] as const).map(presetId => {
                const preset = PRESETS.find(p => p.id === presetId)!;
                const weights = presetWeights[presetId];
                return (
                  <div key={presetId} className="space-y-3">
                    <h4 className="text-sm font-semibold">
                      {ko ? preset.nameKo : preset.nameEn} ({ko ? preset.descKo : preset.descEn})
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {(['shares', 'bonds', 'others', 'cash'] as GroupId[]).map(gId => (
                        <div key={gId}>
                          <Label className="text-[10px] text-muted-foreground">
                            {ko ? GROUP_META[gId].nameKo : GROUP_META[gId].nameEn}
                          </Label>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            className="h-8 text-sm font-mono"
                            value={weights[gId]}
                            onChange={e => {
                              setPresetWeights(prev => ({
                                ...prev,
                                [presetId]: { ...prev[presetId], [gId]: Number(e.target.value) || 0 },
                              }));
                            }}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {ko ? '합계' : 'Total'}: {Object.values(weights).reduce((s, v) => s + v, 0)}%
                    </div>
                    <Separator />
                  </div>
                );
              })}
              <Button onClick={saveSettings} className="gap-1.5">
                <Save className="h-4 w-4" />
                {ko ? '설정 저장' : 'Save Settings'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{ko ? '기본 수익률 가정' : 'Default Return Assumptions'}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs">{ko ? '주식 예상 연수익률' : 'Expected Stock Return (Annual)'}</Label>
                  <div className="text-lg font-mono font-bold">{formatPct(DEFAULT_ASSUMPTIONS.expectedReturnStocksAnnual)}</div>
                  <p className="text-[10px] text-muted-foreground">{ko ? '코드에서 변경 가능' : 'Change in code'}</p>
                </div>
                <div>
                  <Label className="text-xs">{ko ? '기타자산 예상 연수익률' : 'Expected Others Return'}</Label>
                  <div className="text-lg font-mono font-bold">{formatPct(DEFAULT_ASSUMPTIONS.expectedReturnOthersAnnual)}</div>
                </div>
                <div>
                  <Label className="text-xs">{ko ? '현금 수익률' : 'Cash Return'}</Label>
                  <div className="text-lg font-mono font-bold">{formatPct(DEFAULT_ASSUMPTIONS.cashReturnAnnual)}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{ko ? '그래프 기준일' : 'Chart Base Date'}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm">
                <span className="font-mono font-semibold">2025-08-01</span>
                <span className="text-muted-foreground ml-2">(2025년 8월 1일)</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {ko
                  ? '기준일 변경은 코드의 portfolioTypes.ts 파일에서 BASE_DATE를 수정해야 합니다.'
                  : 'To change the base date, update BASE_DATE in portfolioTypes.ts.'}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 3: Preview ── */}
        <TabsContent value="preview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{ko ? '차트 미리보기' : 'Chart Preview'}</CardTitle>
            </CardHeader>
            <CardContent>
              {mappedItems.length > 0 ? (
                <FlagshipCharts items={mappedItems} groups={groups} groupWeights={previewWeights} sideBySide />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {ko ? '활성화된 종목이 없습니다' : 'No active items'}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Group performance summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{ko ? '그룹별 성과 요약' : 'Group Performance Summary'}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table className="text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead>{ko ? '그룹' : 'Group'}</TableHead>
                    <TableHead className="text-right">{ko ? '종목 수' : 'Items'}</TableHead>
                    <TableHead className="text-right">{ko ? '합계 비중' : 'Total Weight'}</TableHead>
                    <TableHead className="text-right">{ko ? '그룹 수익률' : 'Group Return'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.map(g => (
                    <TableRow key={g.id}>
                      <TableCell className="font-medium">{ko ? g.nameKo : g.nameEn}</TableCell>
                      <TableCell className="text-right font-mono">{g.items.length}</TableCell>
                      <TableCell className="text-right font-mono">{g.totalWeight.toFixed(1)}%</TableCell>
                      <TableCell className={`text-right font-mono ${g.performance > 0 ? 'text-green-600' : g.performance < 0 ? 'text-red-500' : ''}`}>
                        {formatPct(g.performance)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Dialog */}
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
                <Input value={form.ticker} onChange={e => updateField('ticker', e.target.value)} placeholder="e.g. 005930" />
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
                <Label className="text-xs">{ko ? '기준가 (8/1)' : 'Base Price (8/1)'}</Label>
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
