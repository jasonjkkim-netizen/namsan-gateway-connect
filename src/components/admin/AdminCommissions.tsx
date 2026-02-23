import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Search, DollarSign, History, RefreshCw, Settings, Plus, Pencil, Trash2, UserCog } from 'lucide-react';

interface Distribution {
  id: string;
  investment_id: string;
  from_user_id: string | null;
  to_user_id: string;
  layer: number;
  upfront_amount: number | null;
  performance_amount: number | null;
  rate_used: number | null;
  currency: string | null;
  status: string;
  created_at: string;
}

interface AuditEntry {
  id: string;
  action: string;
  target_table: string | null;
  target_id: string | null;
  changed_by: string;
  old_values: any;
  new_values: any;
  created_at: string;
}

interface Profile {
  user_id: string;
  full_name: string;
  email: string;
  sales_role: string | null;
}

interface CommissionRate {
  id: string;
  product_id: string;
  sales_role: string;
  sales_level: number;
  upfront_rate: number;
  performance_rate: number;
  min_rate: number | null;
  max_rate: number | null;
  is_override: boolean | null;
  override_user_id: string | null;
  set_by: string | null;
}

interface Product {
  id: string;
  name_en: string;
  name_ko: string;
}

const ROLE_LABELS: Record<string, Record<string, string>> = {
  ko: { district_manager: '지역 매니저', principal_agent: '수석 에이전트', agent: '에이전트', client: '고객' },
  en: { district_manager: 'District Manager', principal_agent: 'Principal Agent', agent: 'Agent', client: 'Client' },
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'secondary',
  available: 'default',
  paid: 'outline',
  cancelled: 'destructive',
};

const SALES_ROLES = ['district_manager', 'principal_agent', 'agent'] as const;
const ROLE_LEVELS: Record<string, number> = { district_manager: 1, principal_agent: 2, agent: 3 };

export function AdminCommissions() {
  const { language, formatCurrency, formatDate } = useLanguage();
  const { user } = useAuth();
  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Rates state
  const [rates, setRates] = useState<CommissionRate[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [rateDialogOpen, setRateDialogOpen] = useState(false);
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<CommissionRate | null>(null);
  const [rateForm, setRateForm] = useState({ sales_role: 'district_manager', upfront_rate: '0', performance_rate: '0' });
  const [overrideForm, setOverrideForm] = useState({ override_user_id: '', upfront_rate: '0', performance_rate: '0' });

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [distRes, auditRes, profilesRes, productsRes, ratesRes] = await Promise.all([
      supabase.from('commission_distributions').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('commission_audit_log').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('profiles').select('user_id, full_name, email, sales_role'),
      supabase.from('investment_products').select('id, name_en, name_ko').eq('is_active', true),
      supabase.from('commission_rates').select('*').order('sales_level', { ascending: true }),
    ]);

    if (distRes.data) setDistributions(distRes.data as Distribution[]);
    if (auditRes.data) setAuditLog(auditRes.data as AuditEntry[]);
    if (profilesRes.data) setProfiles(profilesRes.data as Profile[]);
    if (productsRes.data) {
      setProducts(productsRes.data as Product[]);
      if (!selectedProductId && productsRes.data.length > 0) setSelectedProductId(productsRes.data[0].id);
    }
    if (ratesRes.data) setRates(ratesRes.data as CommissionRate[]);
    setLoading(false);
  }

  const getName = (userId: string) => {
    const p = profiles.find((pr) => pr.user_id === userId);
    return p ? p.full_name : userId.slice(0, 8) + '…';
  };

  const getRole = (userId: string) => {
    const p = profiles.find((pr) => pr.user_id === userId);
    if (!p?.sales_role) return null;
    return ROLE_LABELS[language]?.[p.sales_role] || p.sales_role;
  };

  const getProductName = (productId: string) => {
    const p = products.find((pr) => pr.id === productId);
    if (!p) return productId.slice(0, 8);
    return language === 'ko' ? p.name_ko : p.name_en;
  };

  const handleStatusChange = async (id: string, toUserId: string, newStatus: string) => {
    const { error } = await supabase.from('commission_distributions').update({ status: newStatus }).eq('id', id);
    if (error) {
      toast.error(language === 'ko' ? '상태 변경 실패' : 'Status update failed');
    } else {
      toast.success(language === 'ko' ? '상태 변경 완료' : 'Status updated');
      supabase.functions.invoke('notify-sales', {
        body: { type: 'commission_status_changed', commission_id: id, new_status: newStatus, recipient_ids: [toUserId] },
      }).catch(console.error);
      fetchAll();
    }
  };

  // === Rate CRUD ===
  const openAddRate = () => {
    setEditingRate(null);
    setRateForm({ sales_role: 'district_manager', upfront_rate: '0', performance_rate: '0' });
    setRateDialogOpen(true);
  };

  const openEditRate = (rate: CommissionRate) => {
    setEditingRate(rate);
    setRateForm({
      sales_role: rate.sales_role,
      upfront_rate: String(rate.upfront_rate),
      performance_rate: String(rate.performance_rate),
    });
    setRateDialogOpen(true);
  };

  const handleSaveRate = async () => {
    if (!selectedProductId || !user) return;
    const payload = {
      product_id: selectedProductId,
      sales_role: rateForm.sales_role,
      sales_level: ROLE_LEVELS[rateForm.sales_role] || 1,
      upfront_rate: parseFloat(rateForm.upfront_rate) || 0,
      performance_rate: parseFloat(rateForm.performance_rate) || 0,
      is_override: false,
      set_by: user.id,
    };

    if (editingRate) {
      const { error } = await supabase.from('commission_rates').update(payload).eq('id', editingRate.id);
      if (error) { toast.error(error.message); return; }
      toast.success(language === 'ko' ? '요율 수정 완료' : 'Rate updated');
    } else {
      // Check if rate already exists for this product/role
      const existing = rates.find(r => r.product_id === selectedProductId && r.sales_role === rateForm.sales_role && !r.is_override);
      if (existing) {
        toast.error(language === 'ko' ? '이 역할의 요율이 이미 존재합니다' : 'Rate already exists for this role');
        return;
      }
      const { error } = await supabase.from('commission_rates').insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success(language === 'ko' ? '요율 추가 완료' : 'Rate added');
    }
    setRateDialogOpen(false);
    fetchAll();
  };

  const handleDeleteRate = async (id: string) => {
    const { error } = await supabase.from('commission_rates').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success(language === 'ko' ? '요율 삭제 완료' : 'Rate deleted');
    fetchAll();
  };

  // === Override CRUD ===
  const openAddOverride = () => {
    setOverrideForm({ override_user_id: '', upfront_rate: '0', performance_rate: '0' });
    setOverrideDialogOpen(true);
  };

  const handleSaveOverride = async () => {
    if (!selectedProductId || !user || !overrideForm.override_user_id) return;
    const targetProfile = profiles.find(p => p.user_id === overrideForm.override_user_id);
    const payload = {
      product_id: selectedProductId,
      sales_role: targetProfile?.sales_role || 'agent',
      sales_level: ROLE_LEVELS[targetProfile?.sales_role || 'agent'] || 3,
      upfront_rate: parseFloat(overrideForm.upfront_rate) || 0,
      performance_rate: parseFloat(overrideForm.performance_rate) || 0,
      is_override: true,
      override_user_id: overrideForm.override_user_id,
      set_by: user.id,
    };

    // Check if override already exists
    const existing = rates.find(r => r.product_id === selectedProductId && r.is_override && r.override_user_id === overrideForm.override_user_id);
    if (existing) {
      const { error } = await supabase.from('commission_rates').update(payload).eq('id', existing.id);
      if (error) { toast.error(error.message); return; }
      toast.success(language === 'ko' ? '개인 요율 수정 완료' : 'Override updated');
    } else {
      const { error } = await supabase.from('commission_rates').insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success(language === 'ko' ? '개인 요율 추가 완료' : 'Override added');
    }
    setOverrideDialogOpen(false);
    fetchAll();
  };

  const filteredDistributions = distributions.filter((d) => {
    const term = searchTerm.toLowerCase();
    return getName(d.to_user_id).toLowerCase().includes(term) ||
      (d.from_user_id && getName(d.from_user_id).toLowerCase().includes(term)) ||
      d.investment_id.toLowerCase().includes(term);
  });

  const totalUpfront = distributions.reduce((s, d) => s + (Number(d.upfront_amount) || 0), 0);
  const totalPerformance = distributions.reduce((s, d) => s + (Number(d.performance_amount) || 0), 0);
  const pendingCount = distributions.filter(d => d.status === 'pending').length;

  // Rates filtered by selected product
  const defaultRates = rates.filter(r => r.product_id === selectedProductId && !r.is_override);
  const overrideRates = rates.filter(r => r.product_id === selectedProductId && r.is_override);

  const salesUsers = profiles.filter(p => p.sales_role && p.sales_role !== 'client');

  return (
    <div className="card-elevated">
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-xl font-serif font-semibold">
            {language === 'ko' ? '커미션 관리' : 'Commission Management'}
          </h2>
          <Button variant="outline" size="sm" onClick={fetchAll}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {language === 'ko' ? '새로고침' : 'Refresh'}
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="rounded-lg border border-border p-4">
            <p className="text-sm text-muted-foreground">{language === 'ko' ? '총 선취 커미션' : 'Total Upfront'}</p>
            <p className="text-2xl font-semibold">{formatCurrency(totalUpfront)}</p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="text-sm text-muted-foreground">{language === 'ko' ? '총 성과 커미션' : 'Total Performance'}</p>
            <p className="text-2xl font-semibold">{formatCurrency(totalPerformance)}</p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="text-sm text-muted-foreground">{language === 'ko' ? '대기중' : 'Pending'}</p>
            <p className="text-2xl font-semibold">{pendingCount}</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="distributions" className="p-6">
        <TabsList>
          <TabsTrigger value="distributions" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            {language === 'ko' ? '분배 내역' : 'Distributions'}
          </TabsTrigger>
          <TabsTrigger value="rates" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            {language === 'ko' ? '요율 설정' : 'Rate Settings'}
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            {language === 'ko' ? '감사 로그' : 'Audit Log'}
          </TabsTrigger>
        </TabsList>

        <div className="mt-4">
          <div className="relative w-64 mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={language === 'ko' ? '검색...' : 'Search...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Distributions Tab */}
        <TabsContent value="distributions">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === 'ko' ? '수취인' : 'Recipient'}</TableHead>
                  <TableHead>{language === 'ko' ? '역할' : 'Role'}</TableHead>
                  <TableHead>{language === 'ko' ? '레이어' : 'Layer'}</TableHead>
                  <TableHead>{language === 'ko' ? '투자자' : 'Investor'}</TableHead>
                  <TableHead>{language === 'ko' ? '선취 커미션' : 'Upfront'}</TableHead>
                  <TableHead>{language === 'ko' ? '성과 커미션' : 'Performance'}</TableHead>
                  <TableHead>{language === 'ko' ? '적용률' : 'Rate'}</TableHead>
                  <TableHead>{language === 'ko' ? '상태' : 'Status'}</TableHead>
                  <TableHead>{language === 'ko' ? '일자' : 'Date'}</TableHead>
                  <TableHead>{language === 'ko' ? '작업' : 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 10 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-5 w-20" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filteredDistributions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      {language === 'ko' ? '분배 내역이 없습니다' : 'No distributions found'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDistributions.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{getName(d.to_user_id)}</TableCell>
                      <TableCell>
                        {getRole(d.to_user_id) ? (
                          <Badge variant="outline" className="text-xs">{getRole(d.to_user_id)}</Badge>
                        ) : '—'}
                      </TableCell>
                      <TableCell>{d.layer}</TableCell>
                      <TableCell>{d.from_user_id ? getName(d.from_user_id) : '—'}</TableCell>
                      <TableCell>
                        {d.upfront_amount ? (
                          <span className="text-success font-medium">{formatCurrency(Number(d.upfront_amount))}</span>
                        ) : '—'}
                      </TableCell>
                      <TableCell>
                        {d.performance_amount ? (
                          <span className="text-success font-medium">{formatCurrency(Number(d.performance_amount))}</span>
                        ) : '—'}
                      </TableCell>
                      <TableCell>{d.rate_used ? `${d.rate_used}%` : '—'}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_COLORS[d.status] as any || 'secondary'}>{d.status}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(d.created_at)}</TableCell>
                      <TableCell>
                        {d.status === 'pending' && (
                          <Button variant="outline" size="sm" className="text-xs" onClick={() => handleStatusChange(d.id, d.to_user_id, 'available')}>
                            {language === 'ko' ? '승인' : 'Approve'}
                          </Button>
                        )}
                        {d.status === 'available' && (
                          <Button variant="outline" size="sm" className="text-xs" onClick={() => handleStatusChange(d.id, d.to_user_id, 'paid')}>
                            {language === 'ko' ? '지급완료' : 'Mark Paid'}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Rate Settings Tab */}
        <TabsContent value="rates">
          <div className="space-y-6">
            {/* Product Selector */}
            <div className="flex items-center gap-4">
              <Label className="whitespace-nowrap font-medium">
                {language === 'ko' ? '상품 선택' : 'Select Product'}
              </Label>
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger className="w-[280px]">
                  <SelectValue placeholder={language === 'ko' ? '상품 선택' : 'Select product'} />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {language === 'ko' ? p.name_ko : p.name_en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Default Rates Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  {language === 'ko' ? '기본 요율 (역할별)' : 'Default Rates (by Role)'}
                </h3>
                <Button size="sm" onClick={openAddRate}>
                  <Plus className="h-4 w-4 mr-1" />
                  {language === 'ko' ? '요율 추가' : 'Add Rate'}
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === 'ko' ? '역할' : 'Role'}</TableHead>
                    <TableHead>{language === 'ko' ? '선취 요율 (%)' : 'Upfront Rate (%)'}</TableHead>
                    <TableHead>{language === 'ko' ? '성과 요율 (%)' : 'Performance Rate (%)'}</TableHead>
                    <TableHead>{language === 'ko' ? '작업' : 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {defaultRates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                        {language === 'ko' ? '설정된 기본 요율이 없습니다' : 'No default rates configured'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    defaultRates.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <Badge variant="outline">
                            {ROLE_LABELS[language]?.[r.sales_role] || r.sales_role}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{r.upfront_rate}%</TableCell>
                        <TableCell className="font-medium">{r.performance_rate}%</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEditRate(r)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDeleteRate(r.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Per-User Overrides Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold flex items-center gap-2">
                  <UserCog className="h-4 w-4" />
                  {language === 'ko' ? '개인별 요율 (오버라이드)' : 'Per-User Overrides'}
                </h3>
                <Button size="sm" variant="outline" onClick={openAddOverride}>
                  <Plus className="h-4 w-4 mr-1" />
                  {language === 'ko' ? '오버라이드 추가' : 'Add Override'}
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === 'ko' ? '사용자' : 'User'}</TableHead>
                    <TableHead>{language === 'ko' ? '역할' : 'Role'}</TableHead>
                    <TableHead>{language === 'ko' ? '선취 요율 (%)' : 'Upfront Rate (%)'}</TableHead>
                    <TableHead>{language === 'ko' ? '성과 요율 (%)' : 'Performance Rate (%)'}</TableHead>
                    <TableHead>{language === 'ko' ? '작업' : 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overrideRates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                        {language === 'ko' ? '개인별 오버라이드가 없습니다' : 'No per-user overrides'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    overrideRates.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">
                          {r.override_user_id ? getName(r.override_user_id) : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {ROLE_LABELS[language]?.[r.sales_role] || r.sales_role}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{r.upfront_rate}%</TableCell>
                        <TableCell className="font-medium">{r.performance_rate}%</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDeleteRate(r.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* Audit Log Tab */}
        <TabsContent value="audit">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === 'ko' ? '작업' : 'Action'}</TableHead>
                  <TableHead>{language === 'ko' ? '대상' : 'Target'}</TableHead>
                  <TableHead>{language === 'ko' ? '수행자' : 'Changed By'}</TableHead>
                  <TableHead>{language === 'ko' ? '세부사항' : 'Details'}</TableHead>
                  <TableHead>{language === 'ko' ? '일시' : 'Date'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 5 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-5 w-20" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : auditLog.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      {language === 'ko' ? '감사 로그가 없습니다' : 'No audit entries'}
                    </TableCell>
                  </TableRow>
                ) : (
                  auditLog.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell><Badge variant="outline">{entry.action}</Badge></TableCell>
                      <TableCell className="text-sm">
                        {entry.target_table && <span className="text-muted-foreground">{entry.target_table}</span>}
                      </TableCell>
                      <TableCell>{getName(entry.changed_by)}</TableCell>
                      <TableCell className="max-w-[300px]">
                        {entry.new_values && (
                          <span className="text-xs text-muted-foreground">
                            {entry.new_values.count !== undefined
                              ? `${entry.new_values.count} ${language === 'ko' ? '건 분배' : 'distributions'}`
                              : JSON.stringify(entry.new_values).slice(0, 100)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(entry.created_at)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Default Rate Dialog */}
      <Dialog open={rateDialogOpen} onOpenChange={setRateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingRate
                ? (language === 'ko' ? '요율 수정' : 'Edit Rate')
                : (language === 'ko' ? '기본 요율 추가' : 'Add Default Rate')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>{language === 'ko' ? '상품' : 'Product'}</Label>
              <p className="text-sm text-muted-foreground mt-1">{getProductName(selectedProductId)}</p>
            </div>
            <div>
              <Label>{language === 'ko' ? '역할' : 'Role'}</Label>
              <Select
                value={rateForm.sales_role}
                onValueChange={(v) => setRateForm({ ...rateForm, sales_role: v })}
                disabled={!!editingRate}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SALES_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_LABELS[language]?.[role] || role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{language === 'ko' ? '선취 요율 (%)' : 'Upfront Rate (%)'}</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={rateForm.upfront_rate}
                  onChange={(e) => setRateForm({ ...rateForm, upfront_rate: e.target.value })}
                />
              </div>
              <div>
                <Label>{language === 'ko' ? '성과 요율 (%)' : 'Performance Rate (%)'}</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={rateForm.performance_rate}
                  onChange={(e) => setRateForm({ ...rateForm, performance_rate: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRateDialogOpen(false)}>
              {language === 'ko' ? '취소' : 'Cancel'}
            </Button>
            <Button onClick={handleSaveRate}>
              {language === 'ko' ? '저장' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Override Dialog */}
      <Dialog open={overrideDialogOpen} onOpenChange={setOverrideDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {language === 'ko' ? '개인별 요율 설정' : 'Set Per-User Override'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>{language === 'ko' ? '상품' : 'Product'}</Label>
              <p className="text-sm text-muted-foreground mt-1">{getProductName(selectedProductId)}</p>
            </div>
            <div>
              <Label>{language === 'ko' ? '영업 사용자' : 'Sales User'}</Label>
              <Select
                value={overrideForm.override_user_id}
                onValueChange={(v) => setOverrideForm({ ...overrideForm, override_user_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={language === 'ko' ? '사용자 선택' : 'Select user'} />
                </SelectTrigger>
                <SelectContent>
                  {salesUsers.map((u) => (
                    <SelectItem key={u.user_id} value={u.user_id}>
                      {u.full_name} ({ROLE_LABELS[language]?.[u.sales_role || ''] || u.sales_role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{language === 'ko' ? '선취 요율 (%)' : 'Upfront Rate (%)'}</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={overrideForm.upfront_rate}
                  onChange={(e) => setOverrideForm({ ...overrideForm, upfront_rate: e.target.value })}
                />
              </div>
              <div>
                <Label>{language === 'ko' ? '성과 요율 (%)' : 'Performance Rate (%)'}</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={overrideForm.performance_rate}
                  onChange={(e) => setOverrideForm({ ...overrideForm, performance_rate: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideDialogOpen(false)}>
              {language === 'ko' ? '취소' : 'Cancel'}
            </Button>
            <Button onClick={handleSaveOverride} disabled={!overrideForm.override_user_id}>
              {language === 'ko' ? '저장' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
