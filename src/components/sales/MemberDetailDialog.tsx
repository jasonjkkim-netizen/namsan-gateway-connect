import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Mail, Phone, MapPin, Calendar, Users, DollarSign, CheckCircle, Clock, Wallet, Briefcase, LinkIcon, Loader2, Plus, Pencil, X, Save } from 'lucide-react';
import { formatCommissionAmount } from '@/lib/commission-format';

const ROLE_LABELS: Record<string, Record<string, string>> = {
  ko: { webmaster: '웹마스터', district_manager: '총괄관리', deputy_district_manager: '부총괄관리', principal_agent: '수석 에이전트', agent: '에이전트', client: '고객' },
  en: { webmaster: 'Webmaster', district_manager: 'General Manager', deputy_district_manager: 'Deputy GM', principal_agent: 'Principal Agent', agent: 'Agent', client: 'Client' },
};

interface MemberProfile {
  full_name: string;
  full_name_ko: string | null;
  email: string;
  phone?: string | null;
  address?: string | null;
  birthday?: string | null;
  sales_role: string | null;
  sales_status: string | null;
  sales_level: number | null;
  created_at: string;
}

interface CommissionRecord {
  id: string;
  upfront_amount: number | null;
  performance_amount: number | null;
  currency: string | null;
  status: string;
  created_at: string;
}

interface InvestmentRecord {
  id: string;
  product_name_en: string;
  product_name_ko: string;
  investment_amount: number;
  current_value: number;
  status: string | null;
  start_date: string;
  maturity_date: string | null;
  invested_currency: string | null;
  product_id: string | null;
}

interface ProductOption {
  id: string;
  name_en: string;
  name_ko: string;
  default_currency: string | null;
}

interface MemberDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
}

const EMPTY_INV_FORM = {
  product_id: '',
  product_name_en: '',
  product_name_ko: '',
  investment_amount: '',
  current_value: '',
  start_date: new Date().toISOString().split('T')[0],
  maturity_date: '',
  invested_currency: 'USD',
  status: 'active',
};

export function MemberDetailDialog({ open, onOpenChange, userId }: MemberDetailDialogProps) {
  const { language, formatCurrency, formatDate } = useLanguage();
  const { profile: myProfile, user } = useAuth();
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [investmentStats, setInvestmentStats] = useState({ count: 0, totalAmount: 0 });
  const [downlineCount, setDownlineCount] = useState(0);
  const [commissions, setCommissions] = useState<CommissionRecord[]>([]);
  const [investments, setInvestments] = useState<InvestmentRecord[]>([]);

  // Email linking state
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkEmail, setLinkEmail] = useState('');
  const [linkPassword, setLinkPassword] = useState('');
  const [linking, setLinking] = useState(false);

  // Investment form state
  const [invFormMode, setInvFormMode] = useState<'hidden' | 'add' | 'edit'>('hidden');
  const [editingInvId, setEditingInvId] = useState<string | null>(null);
  const [invForm, setInvForm] = useState(EMPTY_INV_FORM);
  const [invSaving, setInvSaving] = useState(false);
  const [products, setProducts] = useState<ProductOption[]>([]);

  useEffect(() => {
    if (!open || !userId || !user) return;
    setLoading(true);
    setInvFormMode('hidden');

    const fetchData = async () => {
      const canSeePrivateFields = user?.id === userId || (myProfile as any)?.sales_role === 'webmaster';
      const [profileRes, investRes, downlineRes, commRes, prodRes] = await Promise.all([
        supabase.from('profiles_safe' as any).select('full_name, full_name_ko, email, sales_role, sales_status, sales_level, created_at').eq('user_id', userId).maybeSingle(),
        canSeePrivateFields
          ? supabase.from('client_investments').select('id, product_id, product_name_en, product_name_ko, investment_amount, current_value, status, start_date, maturity_date, invested_currency').eq('user_id', userId).order('start_date', { ascending: false })
          : supabase.rpc('get_manager_subtree_investment_summaries', { _manager_id: user.id }).then(({ data, error }) => ({ data: (data || []).filter((row: any) => row.user_id === userId), error })),
        supabase.rpc('get_sales_subtree', { _user_id: userId }),
        supabase.from('commission_distributions').select('id, upfront_amount, performance_amount, currency, status, created_at').eq('to_user_id', userId).order('created_at', { ascending: false }).limit(20),
        supabase.from('investment_products').select('id, name_en, name_ko, default_currency').eq('is_active', true).order('name_en'),
      ]);

      setProfile(profileRes.data as unknown as MemberProfile | null);

      const investData = (investRes.data || []) as InvestmentRecord[];
      setInvestments(investData);
      setInvestmentStats({
        count: investData.length,
        totalAmount: investData.reduce((s, i) => s + (Number(i.investment_amount) || 0), 0),
      });

      setDownlineCount((downlineRes.data || []).length);
      setCommissions((commRes.data || []) as CommissionRecord[]);
      setProducts((prodRes.data || []) as ProductOption[]);
      setLoading(false);
    };

    fetchData();
  }, [open, userId]);

  const getRoleLabel = (role: string | null) => {
    if (!role) return 'N/A';
    return ROLE_LABELS[language]?.[role] || role;
  };

  const statusColor = (status: string | null) => {
    if (status === 'active') return 'text-emerald-600';
    if (status === 'pending') return 'text-amber-600';
    return 'text-destructive';
  };

  const commStatusConfig = (status: string) => {
    if (status === 'paid') return { label: language === 'ko' ? '지급완료' : 'Paid', icon: CheckCircle, color: 'text-emerald-600 bg-emerald-50' };
    if (status === 'available') return { label: language === 'ko' ? '수령가능' : 'Available', icon: Wallet, color: 'text-primary bg-primary/10' };
    return { label: language === 'ko' ? '대기' : 'Pending', icon: Clock, color: 'text-amber-600 bg-amber-50' };
  };

  const isPlaceholderEmail = profile?.email?.endsWith('@placeholder.local') ?? false;
  const canLinkEmail = isPlaceholderEmail && ((myProfile as any)?.sales_role === 'webmaster');

  const handleLinkEmail = async () => {
    if (!userId || !linkEmail.trim()) return;
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    if (!emailRegex.test(linkEmail)) {
      toast.error(language === 'ko' ? '올바른 이메일을 입력해주세요' : 'Please enter a valid email');
      return;
    }
    if (linkPassword && linkPassword.length < 6) {
      toast.error(language === 'ko' ? '비밀번호는 6자 이상이어야 합니다' : 'Password must be at least 6 characters');
      return;
    }

    setLinking(true);
    try {
      const { data, error } = await supabase.functions.invoke('link-client-email', {
        body: {
          target_user_id: userId,
          new_email: linkEmail.trim(),
          new_password: linkPassword || undefined,
        },
      });

      if (error) {
        toast.error(error.message || (language === 'ko' ? '이메일 연결 실패' : 'Failed to link email'));
      } else {
        toast.success(
          language === 'ko'
            ? `${linkEmail}로 계정이 연결되었습니다.`
            : `Account linked to ${linkEmail}.`
        );
        setShowLinkForm(false);
        setLinkEmail('');
        setLinkPassword('');
        if (profile) {
          setProfile({ ...profile, email: linkEmail.trim() });
        }
      }
    } catch (err: any) {
      toast.error(err.message || (language === 'ko' ? '오류가 발생했습니다' : 'An error occurred'));
    } finally {
      setLinking(false);
    }
  };

  // Investment form handlers
  const openAddInvestment = () => {
    setInvForm(EMPTY_INV_FORM);
    setEditingInvId(null);
    setInvFormMode('add');
  };

  const openEditInvestment = (inv: InvestmentRecord) => {
    setInvForm({
      product_id: inv.product_id || '',
      product_name_en: inv.product_name_en,
      product_name_ko: inv.product_name_ko,
      investment_amount: String(inv.investment_amount),
      current_value: String(inv.current_value),
      start_date: inv.start_date,
      maturity_date: inv.maturity_date || '',
      invested_currency: inv.invested_currency || 'USD',
      status: inv.status || 'active',
    });
    setEditingInvId(inv.id);
    setInvFormMode('edit');
  };

  const handleProductChange = (productId: string) => {
    const p = products.find((pr) => pr.id === productId);
    if (p) {
      setInvForm((prev) => ({
        ...prev,
        product_id: productId,
        product_name_en: p.name_en,
        product_name_ko: p.name_ko,
        invested_currency: p.default_currency || prev.invested_currency,
      }));
    }
  };

  const handleSaveInvestment = async () => {
    if (!userId || !user) return;
    const amount = Number(invForm.investment_amount);
    const currentVal = Number(invForm.current_value);
    if (!invForm.product_name_en && !invForm.product_name_ko) {
      toast.error(language === 'ko' ? '상품을 선택해주세요' : 'Please select a product');
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      toast.error(language === 'ko' ? '투자금액을 입력해주세요' : 'Please enter a valid amount');
      return;
    }
    if (!invForm.start_date) {
      toast.error(language === 'ko' ? '시작일을 입력해주세요' : 'Please enter a start date');
      return;
    }

    setInvSaving(true);
    try {
      const payload = {
        user_id: userId,
        product_id: invForm.product_id || null,
        product_name_en: invForm.product_name_en,
        product_name_ko: invForm.product_name_ko,
        investment_amount: amount,
        current_value: isNaN(currentVal) || currentVal <= 0 ? amount : currentVal,
        start_date: invForm.start_date,
        maturity_date: invForm.maturity_date || null,
        invested_currency: invForm.invested_currency,
        status: invForm.status,
        created_by: user.id,
      };

      if (invFormMode === 'edit' && editingInvId) {
        const { error } = await supabase.from('client_investments').update(payload).eq('id', editingInvId);
        if (error) throw error;
        toast.success(language === 'ko' ? '투자 수정 완료' : 'Investment updated');
      } else {
        const { data: inv, error } = await supabase.from('client_investments').insert(payload).select('id').single();
        if (error) throw error;
        // Auto-trigger commission calculation
        if (inv?.id) {
          await supabase.functions.invoke('calculate-commissions', { body: { investment_id: inv.id } }).catch(() => {});
        }
        toast.success(language === 'ko' ? '투자 등록 완료' : 'Investment created');
      }

      // Refresh investments
      const { data: refreshed } = await supabase
        .from('client_investments')
        .select('id, product_id, product_name_en, product_name_ko, investment_amount, current_value, status, start_date, maturity_date, invested_currency')
        .eq('user_id', userId)
        .order('start_date', { ascending: false });
      
      const investData = (refreshed || []) as InvestmentRecord[];
      setInvestments(investData);
      setInvestmentStats({
        count: investData.length,
        totalAmount: investData.reduce((s, i) => s + (Number(i.investment_amount) || 0), 0),
      });
      setInvFormMode('hidden');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || (language === 'ko' ? '저장 실패' : 'Save failed'));
    } finally {
      setInvSaving(false);
    }
  };

  const displayName = profile
    ? (language === 'ko' && profile.full_name_ko ? profile.full_name_ko : profile.full_name)
    : '';

  // Commission summary
  const commSummary = commissions.reduce(
    (acc, c) => {
      const total = (Number(c.upfront_amount) || 0) + (Number(c.performance_amount) || 0);
      acc.total += total;
      if (c.status === 'paid') acc.paid += total;
      else if (c.status === 'available') acc.available += total;
      else acc.pending += total;
      return acc;
    },
    { total: 0, paid: 0, available: 0, pending: 0 }
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-serif">
            {language === 'ko' ? '멤버 상세 정보' : 'Member Details'}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-2">
          {loading ? (
            <div className="space-y-4 py-4">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : !profile ? (
            <p className="text-muted-foreground py-4">
              {language === 'ko' ? '정보를 찾을 수 없습니다' : 'Profile not found'}
            </p>
          ) : (
            <div className="space-y-5 py-2">
              {/* Name & Role */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{displayName}</h3>
                  {language === 'ko' && profile.full_name_ko && (
                    <p className="text-sm text-muted-foreground">{profile.full_name}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant="default" className="text-xs">
                    {getRoleLabel(profile.sales_role)}
                  </Badge>
                  <span className={`text-xs font-medium ${statusColor(profile.sales_status)}`}>
                    {profile.sales_status === 'active'
                      ? (language === 'ko' ? '활성' : 'Active')
                      : profile.sales_status === 'pending'
                      ? (language === 'ko' ? '대기중' : 'Pending')
                      : (profile.sales_status || 'N/A')}
                  </span>
                </div>
              </div>

              {/* Contact Info */}
              <div className="space-y-3 rounded-lg border border-border p-4">
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  {isPlaceholderEmail ? (
                    <span className="truncate text-muted-foreground italic">
                      {language === 'ko' ? '이메일 미등록 (간편 등록)' : 'No email (quick-registered)'}
                    </span>
                  ) : (
                    <span className="truncate">{profile.email}</span>
                  )}
                </div>

                {/* Email Linking Section */}
                {canLinkEmail && !showLinkForm && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => setShowLinkForm(true)}
                  >
                    <LinkIcon className="h-3 w-3 mr-1" />
                    {language === 'ko' ? '실제 이메일 연결하기' : 'Link Real Email'}
                  </Button>
                )}

                {showLinkForm && (
                  <div className="space-y-3 rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">
                      {language === 'ko'
                        ? '실제 이메일을 입력하면 고객이 이 이메일로 로그인할 수 있습니다.'
                        : 'Enter a real email so the client can log in.'}
                    </p>
                    <div className="space-y-1">
                      <Label className="text-xs">{language === 'ko' ? '이메일' : 'Email'} *</Label>
                      <Input
                        type="email"
                        value={linkEmail}
                        onChange={(e) => setLinkEmail(e.target.value)}
                        placeholder="client@example.com"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{language === 'ko' ? '비밀번호 (선택)' : 'Password (optional)'}</Label>
                      <Input
                        type="password"
                        value={linkPassword}
                        onChange={(e) => setLinkPassword(e.target.value)}
                        placeholder="••••••••"
                        className="h-8 text-sm"
                      />
                      <p className="text-[10px] text-muted-foreground">
                        {language === 'ko'
                          ? '비밀번호를 설정하지 않으면 고객이 "비밀번호 찾기"로 설정해야 합니다.'
                          : 'If not set, client must use "Forgot Password" to set one.'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-7 text-xs"
                        onClick={() => { setShowLinkForm(false); setLinkEmail(''); setLinkPassword(''); }}
                        disabled={linking}
                      >
                        {language === 'ko' ? '취소' : 'Cancel'}
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 h-7 text-xs"
                        onClick={handleLinkEmail}
                        disabled={linking || !linkEmail.trim()}
                      >
                        {linking && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                        {language === 'ko' ? '연결' : 'Link'}
                      </Button>
                    </div>
                  </div>
                )}

                {profile.phone && (
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>{profile.phone}</span>
                  </div>
                )}
                {profile.address && (
                  <div className="flex items-center gap-3 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="line-clamp-2">{profile.address}</span>
                  </div>
                )}
                {profile.birthday && (
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>{profile.birthday}</span>
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border p-3 text-center">
                  <Users className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                  <p className="text-lg font-semibold">{downlineCount}</p>
                  <p className="text-xs text-muted-foreground">
                    {language === 'ko' ? '하위 멤버' : 'Downline'}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-3 text-center">
                  <DollarSign className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                  <p className="text-lg font-semibold">{investmentStats.count}</p>
                  <p className="text-xs text-muted-foreground">
                    {language === 'ko' ? '투자 건수' : 'Investments'}
                  </p>
                </div>
              </div>

              {investmentStats.totalAmount > 0 && (
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">
                    {language === 'ko' ? '총 투자금액' : 'Total Investment'}
                  </p>
                  <p className="text-lg font-semibold">{formatCurrency(investmentStats.totalAmount)}</p>
                </div>
              )}

              {/* Investment List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    {language === 'ko' ? '투자 목록' : 'Investment List'}
                  </h4>
                  {invFormMode === 'hidden' && (
                    <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={openAddInvestment}>
                      <Plus className="h-3 w-3 mr-0.5" />
                      {language === 'ko' ? '추가' : 'Add'}
                    </Button>
                  )}
                </div>

                {/* Investment Add/Edit Form */}
                {invFormMode !== 'hidden' && (
                  <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold">
                        {invFormMode === 'add'
                          ? (language === 'ko' ? '신규 투자 등록' : 'New Investment')
                          : (language === 'ko' ? '투자 수정' : 'Edit Investment')}
                      </p>
                      <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => setInvFormMode('hidden')}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {/* Product Select */}
                    <div className="space-y-1">
                      <Label className="text-[10px]">{language === 'ko' ? '상품' : 'Product'}</Label>
                      <Select value={invForm.product_id} onValueChange={handleProductChange}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder={language === 'ko' ? '상품 선택' : 'Select product'} />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((p) => (
                            <SelectItem key={p.id} value={p.id} className="text-xs">
                              {language === 'ko' ? p.name_ko : p.name_en}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Amount & Currency */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2 space-y-1">
                        <Label className="text-[10px]">{language === 'ko' ? '투자금액' : 'Amount'}</Label>
                        <Input
                          type="number"
                          min="0"
                          value={invForm.investment_amount}
                          onChange={(e) => setInvForm({ ...invForm, investment_amount: e.target.value })}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">{language === 'ko' ? '통화' : 'Currency'}</Label>
                        <Select value={invForm.invested_currency} onValueChange={(v) => setInvForm({ ...invForm, invested_currency: v })}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="USD" className="text-xs">USD</SelectItem>
                            <SelectItem value="KRW" className="text-xs">KRW</SelectItem>
                            <SelectItem value="EUR" className="text-xs">EUR</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Current Value */}
                    <div className="space-y-1">
                      <Label className="text-[10px]">{language === 'ko' ? '현재 가치' : 'Current Value'}</Label>
                      <Input
                        type="number"
                        min="0"
                        value={invForm.current_value}
                        onChange={(e) => setInvForm({ ...invForm, current_value: e.target.value })}
                        placeholder={invForm.investment_amount || '0'}
                        className="h-8 text-xs"
                      />
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px]">{language === 'ko' ? '시작일' : 'Start Date'}</Label>
                        <Input
                          type="date"
                          value={invForm.start_date}
                          onChange={(e) => setInvForm({ ...invForm, start_date: e.target.value })}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">{language === 'ko' ? '만기일' : 'Maturity'}</Label>
                        <Input
                          type="date"
                          value={invForm.maturity_date}
                          onChange={(e) => setInvForm({ ...invForm, maturity_date: e.target.value })}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>

                    {/* Status */}
                    <div className="space-y-1">
                      <Label className="text-[10px]">{language === 'ko' ? '상태' : 'Status'}</Label>
                      <Select value={invForm.status} onValueChange={(v) => setInvForm({ ...invForm, status: v })}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active" className="text-xs">{language === 'ko' ? '활성' : 'Active'}</SelectItem>
                          <SelectItem value="matured" className="text-xs">{language === 'ko' ? '만기' : 'Matured'}</SelectItem>
                          <SelectItem value="pending" className="text-xs">{language === 'ko' ? '대기' : 'Pending'}</SelectItem>
                          <SelectItem value="closed" className="text-xs">{language === 'ko' ? '종료' : 'Closed'}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Save / Cancel */}
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1 h-7 text-xs" onClick={() => setInvFormMode('hidden')} disabled={invSaving}>
                        {language === 'ko' ? '취소' : 'Cancel'}
                      </Button>
                      <Button size="sm" className="flex-1 h-7 text-xs" onClick={handleSaveInvestment} disabled={invSaving}>
                        {invSaving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
                        {language === 'ko' ? '저장' : 'Save'}
                      </Button>
                    </div>
                  </div>
                )}

                {investments.length === 0 && invFormMode === 'hidden' ? (
                  <p className="text-sm text-muted-foreground text-center py-3">
                    {language === 'ko' ? '투자 내역이 없습니다' : 'No investments yet'}
                  </p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {investments.map((inv) => {
                      const returnPct = inv.investment_amount > 0
                        ? ((inv.current_value - inv.investment_amount) / inv.investment_amount * 100)
                        : 0;
                      const isPositive = returnPct >= 0;
                      return (
                        <div key={inv.id} className="rounded-lg border border-border px-3 py-2.5 text-sm group relative">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium truncate mr-2">
                              {language === 'ko' ? inv.product_name_ko : inv.product_name_en}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 p-0 opacity-50 hover:opacity-100"
                                onClick={() => openEditInvestment(inv)}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                                {inv.status === 'active'
                                  ? (language === 'ko' ? '활성' : 'Active')
                                  : inv.status === 'matured'
                                  ? (language === 'ko' ? '만기' : 'Matured')
                                  : (inv.status || 'N/A')}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{language === 'ko' ? '투자금: ' : 'Invested: '}{formatCurrency(inv.investment_amount)}</span>
                            <span className={isPositive ? 'text-emerald-600' : 'text-destructive'}>
                              {isPositive ? '+' : ''}{returnPct.toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground mt-0.5">
                            <span>{language === 'ko' ? '현재가치: ' : 'Current: '}{formatCurrency(inv.current_value)}</span>
                            <span>{formatDate(inv.start_date)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Commission Section */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  {language === 'ko' ? '커미션 내역' : 'Commission History'}
                </h4>

                {/* Commission Summary */}
                {commissions.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg bg-muted/40 p-2 text-center">
                      <p className="text-[10px] text-muted-foreground">{language === 'ko' ? '지급완료' : 'Paid'}</p>
                      <p className="text-sm font-semibold text-success">{formatCommissionAmount(commSummary.paid, language)}</p>
                    </div>
                    <div className="rounded-lg bg-primary/5 p-2 text-center">
                      <p className="text-[10px] text-muted-foreground">{language === 'ko' ? '수령가능' : 'Available'}</p>
                      <p className="text-sm font-semibold text-primary">{formatCommissionAmount(commSummary.available, language)}</p>
                    </div>
                    <div className="rounded-lg bg-muted/40 p-2 text-center">
                      <p className="text-[10px] text-muted-foreground">{language === 'ko' ? '대기' : 'Pending'}</p>
                      <p className="text-sm font-semibold text-muted-foreground">{formatCommissionAmount(commSummary.pending, language)}</p>
                    </div>
                  </div>
                )}

                {/* Commission List */}
                {commissions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-3">
                    {language === 'ko' ? '커미션 내역이 없습니다' : 'No commissions yet'}
                  </p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {commissions.map((c) => {
                      const total = (Number(c.upfront_amount) || 0) + (Number(c.performance_amount) || 0);
                      const config = commStatusConfig(c.status);
                      const StatusIcon = config.icon;
                      return (
                        <div key={c.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                          <div className="flex items-center gap-2">
                            <StatusIcon className={`h-3.5 w-3.5 ${config.color.split(' ')[0]}`} />
                            <div>
                              <p className="font-medium">{formatCommissionAmount(total, language, c.currency)}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {Number(c.upfront_amount) > 0 && `U: ${formatCommissionAmount(Number(c.upfront_amount), language, c.currency)}`}
                                {Number(c.upfront_amount) > 0 && Number(c.performance_amount) > 0 && ' / '}
                                {Number(c.performance_amount) > 0 && `P: ${formatCommissionAmount(Number(c.performance_amount), language, c.currency)}`}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${config.color}`}>
                              {config.label}
                            </Badge>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{formatDate(c.created_at)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground text-right">
                {language === 'ko' ? '가입일: ' : 'Joined: '}
                {formatDate(profile.created_at)}
              </p>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
