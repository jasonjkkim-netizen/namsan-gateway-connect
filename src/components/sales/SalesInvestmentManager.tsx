import { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Loader2, Briefcase, Save } from 'lucide-react';

interface DownlineMember {
  user_id: string;
  full_name: string;
  sales_role: string;
  sales_level: number;
  depth: number;
}

interface Investment {
  id: string;
  user_id: string;
  product_id: string | null;
  product_name_en: string;
  product_name_ko: string;
  investment_amount: number;
  current_value: number;
  status: string | null;
  start_date: string;
  invested_currency: string | null;
  created_by: string | null;
}

interface CommissionDist {
  id: string;
  investment_id: string;
  to_user_id: string;
  upfront_amount: number | null;
  performance_amount: number | null;
  rate_used: number | null;
  currency: string | null;
  status: string;
}

interface Product {
  id: string;
  name_en: string;
  name_ko: string;
  default_currency: string | null;
  min_investment_amount: number | null;
}

interface Props {
  downline: DownlineMember[];
  onDataChange?: () => void;
}

export function SalesInvestmentManager({ downline, onDataChange }: Props) {
  const { language, formatCurrency, formatDate } = useLanguage();
  const { user, profile } = useAuth();

  const [investments, setInvestments] = useState<Investment[]>([]);
  const [commissions, setCommissions] = useState<CommissionDist[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
  const [formClientId, setFormClientId] = useState('');
  const [formProductId, setFormProductId] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formCurrency, setFormCurrency] = useState('USD');
  const [formStartDate, setFormStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formStatus, setFormStatus] = useState('active');
  const [submitting, setSubmitting] = useState(false);

  // Inline commission edit
  const [editingCommission, setEditingCommission] = useState<string | null>(null);
  const [commUpfront, setCommUpfront] = useState('');
  const [commPerformance, setCommPerformance] = useState('');
  const [savingCommission, setSavingCommission] = useState(false);

  const userSalesRole = (profile as any)?.sales_role;
  const isWebmaster = userSalesRole === 'webmaster';
  const isDM = userSalesRole === 'district_manager' || isWebmaster;

  // All user IDs that we can manage (self + downline)
  const managedIds = useMemo(() => {
    const ids = downline.map((d) => d.user_id);
    if (user) ids.push(user.id);
    return ids;
  }, [downline, user]);

  // Clients available for investment (self + downline)
  const clientOptions = useMemo(() => {
    const opts: { user_id: string; full_name: string; sales_role: string }[] = [];
    if (user && profile) {
      opts.push({ user_id: user.id, full_name: profile.full_name, sales_role: userSalesRole || '' });
    }
    downline.forEach((d) => opts.push(d));
    return opts;
  }, [user, profile, downline, userSalesRole]);

  useEffect(() => {
    fetchData();
  }, [user, downline]);

  async function fetchData() {
    if (!user) return;
    setLoading(true);

    // Check admin role
    const { data: adminData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();
    setIsAdmin(!!adminData);

    const canSeeAll = isWebmaster || !!adminData;

    // Fetch investments
    let invQuery;
    if (canSeeAll || isDM) {
      invQuery = supabase.from('client_investments').select('*').order('start_date', { ascending: false }).limit(200);
    } else {
      invQuery = supabase.from('client_investments').select('*').in('user_id', managedIds).order('start_date', { ascending: false }).limit(200);
    }
    const { data: invData } = await invQuery;
    const invs = (invData || []) as Investment[];
    setInvestments(invs);

    // Fetch commissions for these investments
    const invIds = invs.map((i) => i.id);
    if (invIds.length > 0) {
      const { data: commData } = await supabase
        .from('commission_distributions')
        .select('id, investment_id, to_user_id, upfront_amount, performance_amount, rate_used, currency, status')
        .in('investment_id', invIds);
      setCommissions((commData || []) as CommissionDist[]);
    } else {
      setCommissions([]);
    }

    // Fetch products
    const { data: prodData } = await supabase
      .from('investment_products')
      .select('id, name_en, name_ko, default_currency, min_investment_amount')
      .eq('is_active', true)
      .order('name_en');
    setProducts((prodData || []) as Product[]);

    // Fetch profile names
    const allUserIds = [...new Set(invs.map((i) => i.user_id))];
    if (allUserIds.length > 0) {
      const { data: pData } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', allUserIds);
      const map: Record<string, string> = {};
      (pData || []).forEach((p: any) => { map[p.user_id] = p.full_name; });
      setProfiles(map);
    }

    setLoading(false);
  }

  const getName = (userId: string) => profiles[userId] || userId.slice(0, 8) + '…';

  const getMyCommission = (investmentId: string) => {
    if (!user) return null;
    return commissions.find((c) => c.investment_id === investmentId && c.to_user_id === user.id) || null;
  };

  const canEdit = isAdmin || isWebmaster || isDM || !!userSalesRole;

  // Open create dialog
  const openCreate = () => {
    setEditingInvestment(null);
    setFormClientId('');
    setFormProductId('');
    setFormAmount('');
    setFormCurrency('USD');
    setFormStartDate(new Date().toISOString().split('T')[0]);
    setFormStatus('active');
    setDialogOpen(true);
  };

  // Open edit dialog
  const openEdit = (inv: Investment) => {
    setEditingInvestment(inv);
    setFormClientId(inv.user_id);
    setFormProductId(inv.product_id || '');
    setFormAmount(String(inv.investment_amount));
    setFormCurrency(inv.invested_currency || 'USD');
    setFormStartDate(inv.start_date);
    setFormStatus(inv.status || 'active');
    setDialogOpen(true);
  };

  // Handle product change to auto-set currency
  useEffect(() => {
    if (formProductId && !editingInvestment) {
      const p = products.find((pr) => pr.id === formProductId);
      if (p?.default_currency) setFormCurrency(p.default_currency);
    }
  }, [formProductId]);

  async function handleSubmit() {
    if (!user) return;
    if (!formClientId || !formProductId || !formAmount || Number(formAmount) <= 0) {
      toast.error(language === 'ko' ? '모든 필드를 입력해주세요' : 'Please fill all fields');
      return;
    }

    const product = products.find((p) => p.id === formProductId);
    if (!product) return;

    if (product.min_investment_amount && Number(formAmount) < product.min_investment_amount) {
      toast.error(language === 'ko' ? `최소 투자금액: ${product.min_investment_amount}` : `Minimum: ${product.min_investment_amount}`);
      return;
    }

    setSubmitting(true);
    try {
      if (editingInvestment) {
        // Update existing
        const { error } = await supabase
          .from('client_investments')
          .update({
            user_id: formClientId,
            product_id: formProductId,
            product_name_en: product.name_en,
            product_name_ko: product.name_ko,
            investment_amount: Number(formAmount),
            current_value: Number(formAmount),
            start_date: formStartDate,
            invested_currency: formCurrency,
            status: formStatus,
          })
          .eq('id', editingInvestment.id);

        if (error) throw error;

        // Recalculate commissions
        await supabase.functions.invoke('calculate-commissions', {
          body: { investment_id: editingInvestment.id },
        });

        toast.success(language === 'ko' ? '투자가 수정되었습니다' : 'Investment updated');
      } else {
        // Insert new
        const { data: inv, error } = await supabase
          .from('client_investments')
          .insert({
            user_id: formClientId,
            product_id: formProductId,
            product_name_en: product.name_en,
            product_name_ko: product.name_ko,
            investment_amount: Number(formAmount),
            current_value: Number(formAmount),
            start_date: formStartDate,
            invested_currency: formCurrency,
            created_by: user.id,
            status: 'active',
          })
          .select('id')
          .single();

        if (error) throw error;

        // Auto-trigger commission calculation
        if (inv?.id) {
          await supabase.functions.invoke('calculate-commissions', {
            body: { investment_id: inv.id },
          });
        }

        toast.success(language === 'ko' ? '투자가 등록되었습니다' : 'Investment created');
      }

      setDialogOpen(false);
      await fetchData();
      onDataChange?.();
    } catch (err: any) {
      console.error('Investment save error:', err);
      toast.error(err.message || 'Failed');
    } finally {
      setSubmitting(false);
    }
  }

  // Inline commission save
  async function saveCommission(investmentId: string) {
    if (!user) return;
    setSavingCommission(true);

    try {
      const existing = getMyCommission(investmentId);
      const upfront = parseFloat(commUpfront);
      const performance = parseFloat(commPerformance);

      if (existing) {
        const { error } = await supabase
          .from('commission_distributions')
          .update({
            upfront_amount: isNaN(upfront) ? existing.upfront_amount : upfront,
            performance_amount: isNaN(performance) ? existing.performance_amount : performance,
          })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        // Find investment to get details
        const inv = investments.find((i) => i.id === investmentId);
        if (!inv) throw new Error('Investment not found');

        const { error } = await supabase
          .from('commission_distributions')
          .insert({
            investment_id: investmentId,
            to_user_id: user.id,
            from_user_id: inv.user_id,
            layer: 0,
            upfront_amount: isNaN(upfront) ? 0 : upfront,
            performance_amount: isNaN(performance) ? 0 : performance,
            currency: inv.invested_currency || 'USD',
            status: 'available',
          });
        if (error) throw error;
      }

      toast.success(language === 'ko' ? '커미션이 업데이트되었습니다' : 'Commission updated');
      setEditingCommission(null);
      await fetchData();
      onDataChange?.();
    } catch (err: any) {
      console.error('Commission save error:', err);
      toast.error(err.message || 'Failed');
    } finally {
      setSavingCommission(false);
    }
  }

  const startCommissionEdit = (investmentId: string) => {
    const existing = getMyCommission(investmentId);
    setCommUpfront(existing?.upfront_amount != null ? String(existing.upfront_amount) : '');
    setCommPerformance(existing?.performance_amount != null ? String(existing.performance_amount) : '');
    setEditingCommission(investmentId);
  };

  const selectedProduct = products.find((p) => p.id === formProductId);

  return (
    <div className="mt-8">
      <div className="card-elevated">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-serif font-semibold">
              {language === 'ko' ? '투자 & 커미션 관리' : 'Investment & Commission Management'}
            </h2>
          </div>
          {canEdit && (
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" />
              {language === 'ko' ? '투자 등록' : 'New Investment'}
            </Button>
          )}
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === 'ko' ? '투자자' : 'Investor'}</TableHead>
                <TableHead>{language === 'ko' ? '상품' : 'Product'}</TableHead>
                <TableHead className="text-right">{language === 'ko' ? '투자금액' : 'Amount'}</TableHead>
                <TableHead className="text-right">{language === 'ko' ? '현재가치' : 'Current'}</TableHead>
                <TableHead>{language === 'ko' ? '통화' : 'Curr'}</TableHead>
                <TableHead>{language === 'ko' ? '시작일' : 'Start'}</TableHead>
                <TableHead>{language === 'ko' ? '상태' : 'Status'}</TableHead>
                <TableHead className="text-right">{language === 'ko' ? '내 선취' : 'My Upfront'}</TableHead>
                <TableHead className="text-right">{language === 'ko' ? '내 성과' : 'My Perf'}</TableHead>
                <TableHead>{language === 'ko' ? '작업' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 10 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-16" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : investments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    {language === 'ko' ? '투자 내역이 없습니다' : 'No investments yet'}
                  </TableCell>
                </TableRow>
              ) : (
                investments.map((inv) => {
                  const myComm = getMyCommission(inv.id);
                  const isEditingComm = editingCommission === inv.id;

                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{getName(inv.user_id)}</TableCell>
                      <TableCell className="text-sm">
                        {language === 'ko' ? inv.product_name_ko : inv.product_name_en}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {Number(inv.investment_amount).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {Number(inv.current_value).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs">{inv.invested_currency || 'USD'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(inv.start_date)}</TableCell>
                      <TableCell>
                        <Badge variant={inv.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                          {inv.status || 'active'}
                        </Badge>
                      </TableCell>

                      {/* Commission columns */}
                      {isEditingComm ? (
                        <>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              step="0.01"
                              value={commUpfront}
                              onChange={(e) => setCommUpfront(e.target.value)}
                              className="w-24 h-7 text-xs text-right ml-auto"
                              placeholder="0.00"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              step="0.01"
                              value={commPerformance}
                              onChange={(e) => setCommPerformance(e.target.value)}
                              className="w-24 h-7 text-xs text-right ml-auto"
                              placeholder="0.00"
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2"
                                onClick={() => saveCommission(inv.id)}
                                disabled={savingCommission}
                              >
                                {savingCommission ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2"
                                onClick={() => setEditingCommission(null)}
                              >
                                ✕
                              </Button>
                            </div>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="text-right font-mono text-sm">
                            {myComm?.upfront_amount != null ? (
                              <span className="text-success">+{Number(myComm.upfront_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            ) : '—'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {myComm?.performance_amount != null ? (
                              <span className="text-success">+{Number(myComm.performance_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            ) : '—'}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {canEdit && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2"
                                    title={language === 'ko' ? '투자 수정' : 'Edit investment'}
                                    onClick={() => openEdit(inv)}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2"
                                    title={language === 'ko' ? '커미션 입력' : 'Edit commission'}
                                    onClick={() => startCommissionEdit(inv.id)}
                                  >
                                    $
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Create/Edit Investment Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">
              {editingInvestment
                ? (language === 'ko' ? '투자 수정' : 'Edit Investment')
                : (language === 'ko' ? '신규 투자 등록' : 'Create Investment')}
            </DialogTitle>
            <DialogDescription>
              {language === 'ko'
                ? '본인 또는 하위 조직의 투자를 등록/수정합니다.'
                : 'Register or edit investments for yourself or downline.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{language === 'ko' ? '투자자' : 'Client'}</Label>
              <Select value={formClientId} onValueChange={setFormClientId}>
                <SelectTrigger>
                  <SelectValue placeholder={language === 'ko' ? '선택' : 'Select'} />
                </SelectTrigger>
                <SelectContent>
                  {clientOptions.map((d) => (
                    <SelectItem key={d.user_id} value={d.user_id}>
                      {d.full_name} {d.user_id === user?.id ? (language === 'ko' ? '(본인)' : '(Me)') : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{language === 'ko' ? '상품' : 'Product'}</Label>
              <Select value={formProductId} onValueChange={setFormProductId}>
                <SelectTrigger>
                  <SelectValue placeholder={language === 'ko' ? '선택' : 'Select'} />
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

            <div className="space-y-1.5">
              <Label>{language === 'ko' ? '투자금액' : 'Amount'}</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  placeholder="0.00"
                  className="flex-1"
                />
                <Select value={formCurrency} onValueChange={setFormCurrency}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="KRW">KRW</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {selectedProduct?.min_investment_amount && (
                <p className="text-xs text-muted-foreground">
                  {language === 'ko' ? '최소:' : 'Min:'} {selectedProduct.min_investment_amount.toLocaleString()} {formCurrency}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>{language === 'ko' ? '시작일' : 'Start Date'}</Label>
              <Input
                type="date"
                value={formStartDate}
                onChange={(e) => setFormStartDate(e.target.value)}
              />
            </div>

            {editingInvestment && (
              <div className="space-y-1.5">
                <Label>{language === 'ko' ? '상태' : 'Status'}</Label>
                <Select value={formStatus} onValueChange={setFormStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{language === 'ko' ? '활성' : 'Active'}</SelectItem>
                    <SelectItem value="matured">{language === 'ko' ? '만기' : 'Matured'}</SelectItem>
                    <SelectItem value="redeemed">{language === 'ko' ? '상환' : 'Redeemed'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
              {language === 'ko' ? '취소' : 'Cancel'}
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingInvestment
                ? (language === 'ko' ? '수정' : 'Update')
                : (language === 'ko' ? '등록' : 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
