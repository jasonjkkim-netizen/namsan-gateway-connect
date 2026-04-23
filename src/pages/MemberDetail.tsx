import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import {
  ArrowLeft, Mail, Phone, MapPin, Calendar, User as UserIcon,
  Users, Briefcase, Coins, Save, ChevronUp, ChevronDown, Pencil, AlertTriangle,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { MemberLink } from '@/components/MemberLink';
import { InlineInvestmentForm } from '@/components/sales/InlineInvestmentForm';
import { EditableCommissionRow } from '@/components/sales/EditableCommissionRow';
import { EditableInvestmentRow } from '@/components/sales/EditableInvestmentRow';
import { computeInvestmentValuation } from '@/lib/investment-valuation';

const ROLE_LABELS: Record<string, { en: string; ko: string }> = {
  webmaster: { en: 'Webmaster', ko: '웹마스터' },
  district_manager: { en: 'General Manager', ko: '총괄관리' },
  deputy_district_manager: { en: 'Deputy GM', ko: '부총괄관리' },
  principal_agent: { en: 'Principal Agent', ko: '수석 에이전트' },
  agent: { en: 'Agent', ko: '에이전트' },
  client: { en: 'Client', ko: '고객' },
};

interface MemberProfile {
  user_id: string;
  email: string;
  full_name: string;
  full_name_ko: string | null;
  phone: string | null;
  address: string | null;
  birthday: string | null;
  sales_role: string | null;
  sales_status: string | null;
  sales_level: number | null;
  parent_id: string | null;
  admin_notes: string | null;
  created_at: string;
  is_approved: boolean | null;
}

interface InvestmentRow {
  id: string;
  product_name_en: string;
  product_name_ko: string;
  investment_amount: number;
  current_value: number;
  status: string | null;
  start_date: string;
  maturity_date: string | null;
  invested_currency: string | null;
  realized_return_amount: number | null;
  product_id?: string | null;
  product_maturity_date?: string | null;
  annual_rate_percent?: number | null;
  display_current_value?: number;
  display_return_percent?: number;
  valuation_warning?: string | null;
  accrued_interest?: number;
  product_mapping_status?: string;
  computed_mark_to_market?: number;
}

interface CommissionRow {
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

interface AncestorRow {
  user_id: string;
  full_name: string;
  sales_role: string;
  sales_level: number;
  depth: number;
}

interface DownlineRow {
  user_id: string;
  full_name: string;
  sales_role: string;
  sales_level: number;
  parent_id: string;
  depth: number;
}

export default function MemberDetail() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { language, formatCurrency, formatDate } = useLanguage();
  const { user, isAdmin, profile: myProfile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [investments, setInvestments] = useState<InvestmentRow[]>([]);
  const [commissions, setCommissions] = useState<CommissionRow[]>([]);
  const [ancestors, setAncestors] = useState<AncestorRow[]>([]);
  const [downline, setDownline] = useState<DownlineRow[]>([]);
  const [parentName, setParentName] = useState<string>('');
  const [downlineNames, setDownlineNames] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'profile');

  const salesTab = searchParams.get('salesTab') || 'downline';
  const fromSalesDashboard = searchParams.get('from') === 'sales-dashboard';
  const fromProductDetail = searchParams.get('from') === 'product-detail';
  const productId = searchParams.get('productId');
  const productSection = searchParams.get('productSection') || 'investors';
  const productInvestment = searchParams.get('productInvestment');
  const productSource = searchParams.get('productSource');
  const productSalesTab = searchParams.get('productSalesTab');

  const openMemberTab = (tab: string) => {
    setActiveTab(tab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      return next;
    });
  };

  const handleBack = () => {
    if (fromProductDetail && productId) {
      const params = new URLSearchParams({
        productSection,
      });

      if (productInvestment) params.set('productInvestment', productInvestment);
      if (productSource === 'sales-dashboard') {
        params.set('from', 'sales-dashboard');
        params.set('salesTab', productSalesTab || 'downline');
      }

      navigate(`/products/${productId}?${params.toString()}`);
      return;
    }

    if (fromSalesDashboard) {
      navigate(`/sales-dashboard?tab=${encodeURIComponent(salesTab)}`);
      return;
    }

    navigate(-1);
  };

  // Memo (admin notes)
  const [notesDraft, setNotesDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const canEditNotes = isAdmin;

  // Inline profile editing
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState({
    full_name: '',
    full_name_ko: '' as string,
    email: '',
    phone: '' as string,
    address: '' as string,
    birthday: '' as string,
  });
  const myRole = (myProfile as any)?.sales_role;
  const isDM = myRole === 'district_manager' || myRole === 'webmaster';
  const [savingProfile, setSavingProfile] = useState(false);
  const canEditProfile = !!(isAdmin || user?.id === userId);

  const startEditProfile = () => {
    if (!profile) return;
    setProfileDraft({
      full_name: profile.full_name || '',
      full_name_ko: profile.full_name_ko || '',
      email: profile.email || '',
      phone: profile.phone || '',
      address: profile.address || '',
      birthday: profile.birthday || '',
    });
    setEditingProfile(true);
  };

  const cancelEditProfile = () => setEditingProfile(false);

  const saveProfile = async () => {
    if (!profile) return;
    setSavingProfile(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: profileDraft.full_name.trim() || profile.full_name,
        full_name_ko: profileDraft.full_name_ko.trim() || null,
        email: profileDraft.email.trim() || profile.email,
        phone: profileDraft.phone.trim() || null,
        address: profileDraft.address.trim() || null,
        birthday: profileDraft.birthday || null,
      })
      .eq('user_id', profile.user_id);
    setSavingProfile(false);
    if (error) {
      console.error('Profile save error:', error);
      toast.error(language === 'ko' ? '프로필 저장 실패' : 'Failed to save profile');
    } else {
      toast.success(language === 'ko' ? '프로필 저장 완료' : 'Profile saved');
      setEditingProfile(false);
      loadAll();
    }
  };

  useEffect(() => {
    if (!user || !userId) return;
    loadAll();
  }, [user, userId]);

  useEffect(() => {
    setActiveTab(searchParams.get('tab') || 'profile');
  }, [searchParams]);

  // Realtime subscription for commission_distributions changes
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`member-commissions-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'commission_distributions' },
        (payload: any) => {
          const row = payload.new || payload.old;
          if (row && (row.to_user_id === userId || row.from_user_id === userId)) {
            loadAll();
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, user]);

  async function loadAll() {
    if (!userId || !user) return;
    setLoading(true);
    setAccessDenied(false);

    try {
      // 1) Permission gate: admin sees all; DM/sales must be in subtree (or self)
      let allowed = isAdmin || user.id === userId;
      if (!allowed) {
        const { data: subtree } = await supabase.rpc('is_in_subtree', {
          _ancestor_id: user.id,
          _descendant_id: userId,
        });
        allowed = !!subtree;
      }

      if (!allowed) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      // 2) Fetch profile
      const profileQuery = isAdmin || user.id === userId
        ? supabase
            .from('profiles')
            .select('user_id, email, full_name, full_name_ko, phone, address, birthday, sales_role, sales_status, sales_level, parent_id, admin_notes, created_at, is_approved')
            .eq('user_id', userId)
            .maybeSingle()
        : supabase
            .rpc('get_manager_subtree_profiles', { _manager_id: user.id })
            .then(({ data, error }) => ({
              data: (data || []).find((row: any) => row.user_id === userId) || null,
              error,
            }));

      const { data: prof, error: profErr } = await profileQuery;

      if (profErr || !prof) {
        toast.error(language === 'ko' ? '프로필을 불러올 수 없습니다' : 'Cannot load profile');
        setLoading(false);
        return;
      }

      setProfile(prof as MemberProfile);
      setNotesDraft((prof as MemberProfile).admin_notes || '');

      // 3) Parallel fetches
      const [invRes, commRes, ancRes, subRes] = await Promise.all([
        isAdmin || user.id === userId
          ? supabase
              .from('client_investments')
                .select('id, product_id, product_name_en, product_name_ko, investment_amount, current_value, status, start_date, maturity_date, invested_currency, realized_return_amount')
              .eq('user_id', userId)
              .neq('status', 'deleted')
              .order('start_date', { ascending: false })
          : supabase
              .rpc('get_manager_subtree_investment_summaries', { _manager_id: user.id })
              .then(({ data, error }) => ({
                data: (data || []).filter((row: any) => row.user_id === userId),
                error,
              })),
        supabase
          .from('commission_distributions')
          .select('*')
          .or(`to_user_id.eq.${userId},from_user_id.eq.${userId}`)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase.rpc('get_sales_ancestors', { _user_id: userId }),
        supabase.rpc('get_sales_subtree', { _user_id: userId }),
      ]);

      const rawInvestments = (invRes.data || []) as InvestmentRow[];
      const productIds = Array.from(new Set(rawInvestments.map((row) => row.product_id).filter(Boolean))) as string[];

      let mergedInvestments = rawInvestments;
      if (productIds.length > 0) {
        const { data: products } = await supabase
          .from('investment_products')
          .select('id, fixed_return_percent, target_return, maturity_date')
          .in('id', productIds);

        const productMap = new Map((products || []).map((product: any) => [product.id, product]));
        mergedInvestments = rawInvestments.map((row) => {
          const product = row.product_id ? productMap.get(row.product_id) : null;
          return {
            ...row,
            product_maturity_date: product?.maturity_date ?? null,
            annual_rate_percent: product?.fixed_return_percent ?? product?.target_return ?? null,
          };
        });
      }

      const displayInvestments = mergedInvestments.map((row) => {
        const valuation = computeInvestmentValuation({
          investmentAmount: row.investment_amount,
          currentValue: row.current_value,
          startDate: row.start_date,
          investmentMaturityDate: row.maturity_date,
          productMaturityDate: row.product_maturity_date,
          annualRatePercent: row.annual_rate_percent,
          status: row.status,
        });

        const valuationWarning = !row.product_id
          ? (language === 'ko' ? '상품 연결 없음: 요율 매핑 확인 필요' : 'Missing product link: rate mapping required')
          : row.annual_rate_percent == null
            ? (language === 'ko' ? '예상 수익률 없음: 상품 요율 확인 필요' : 'Missing expected return: product rate required')
            : null;

        const productMappingStatus = !row.product_id
          ? 'missing_product_id'
          : row.annual_rate_percent == null
            ? 'missing_rate'
            : 'mapped';

        return {
          ...row,
          accrued_interest: valuation.accruedInterest,
          display_current_value: valuation.displayCurrentValue,
          display_return_percent: valuation.displayReturnPercent,
          valuation_warning: valuationWarning,
          product_mapping_status: productMappingStatus,
          computed_mark_to_market: valuation.displayCurrentValue,
        };
      });

      setInvestments(displayInvestments);
      setCommissions((commRes.data || []) as CommissionRow[]);
      setAncestors((ancRes.data || []) as AncestorRow[]);
      setDownline((subRes.data || []) as DownlineRow[]);

      // 4) Resolve parent name + downline names
      if (prof.parent_id) {
        const { data: parent } = await supabase
          .from('profiles')
          .select('full_name, full_name_ko')
          .eq('user_id', prof.parent_id)
          .maybeSingle();
        if (parent) {
          setParentName(language === 'ko' && parent.full_name_ko ? parent.full_name_ko : parent.full_name);
        }
      }

      // Resolve commission counterpart names
      const counterpartIds = new Set<string>();
      (commRes.data || []).forEach((c: any) => {
        if (c.from_user_id && c.from_user_id !== userId) counterpartIds.add(c.from_user_id);
        if (c.to_user_id !== userId) counterpartIds.add(c.to_user_id);
      });
      if (counterpartIds.size > 0) {
        const { data: cps } = await supabase
          .from('profiles')
          .select('user_id, full_name, full_name_ko')
          .in('user_id', Array.from(counterpartIds));
        const map: Record<string, string> = {};
        (cps || []).forEach((p: any) => {
          map[p.user_id] = language === 'ko' && p.full_name_ko ? p.full_name_ko : p.full_name;
        });
        setDownlineNames(map);
      }
    } catch (err) {
      console.error('MemberDetail load error:', err);
      toast.error(language === 'ko' ? '데이터 로드 실패' : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  const displayName = profile
    ? (language === 'ko' && profile.full_name_ko ? profile.full_name_ko : profile.full_name)
    : '';
  const altName = profile
    ? (language === 'ko' && profile.full_name_ko ? profile.full_name : profile.full_name_ko || '')
    : '';
  const roleLabel = profile?.sales_role
    ? ROLE_LABELS[profile.sales_role]?.[language === 'ko' ? 'ko' : 'en'] || profile.sales_role
    : '—';

  const handleSaveNotes = async () => {
    if (!profile) return;
    setSavingNotes(true);
    const cleanNotes = (notesDraft || '').slice(0, 5000) || null;
    const { error } = await supabase
      .from('profiles')
      .update({ admin_notes: cleanNotes })
      .eq('user_id', profile.user_id);
    setSavingNotes(false);
    if (error) {
      toast.error(language === 'ko' ? '메모 저장 실패' : 'Failed to save notes');
    } else {
      toast.success(language === 'ko' ? '메모 저장 완료' : 'Notes saved');
      setProfile({ ...profile, admin_notes: cleanNotes });
    }
  };

  // Aggregations
  const totalInvested = investments.reduce((s, investment) => s + (Number(investment.investment_amount) || 0), 0);
  const totalCurrent = investments.reduce((s, investment) => s + (Number(investment.display_current_value) || 0), 0);
  const valuationWarnings = investments.filter((investment) => investment.valuation_warning);
  const showDeveloperDebugPanel = import.meta.env.DEV;
  const earnedTotal = commissions
    .filter((c) => c.to_user_id === userId)
    .reduce((s, c) => s + (Number(c.upfront_amount) || 0) + (Number(c.performance_amount) || 0), 0);

  // Permission: admin OR a sales-role ancestor (viewer is in upline of this member,
  // i.e., this member is in viewer's subtree AND viewer != member).
  const canRegisterInvestment = !!(
    profile && user && (isAdmin || (user.id !== userId && !accessDenied))
  );

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-12 text-center">
          <h1 className="text-2xl font-serif font-semibold mb-3">
            {language === 'ko' ? '접근 권한 없음' : 'Access Denied'}
          </h1>
          <p className="text-muted-foreground mb-6">
            {language === 'ko'
              ? '이 멤버 정보를 볼 수 있는 권한이 없습니다.'
              : 'You do not have permission to view this member.'}
          </p>
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {language === 'ko' ? '뒤로' : 'Back'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container py-4 sm:py-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={handleBack} className="h-8 px-2">
            <ArrowLeft className="h-4 w-4 mr-1" />
            <span className="text-xs sm:text-sm">{language === 'ko' ? '뒤로' : 'Back'}</span>
          </Button>
        </div>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : !profile ? (
          <div className="py-12 text-center">
            <UserIcon className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h2 className="text-lg font-serif font-semibold mb-2">
              {language === 'ko' ? '멤버를 찾을 수 없습니다' : 'Member Not Found'}
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              {language === 'ko'
                ? '해당 멤버 정보가 존재하지 않거나 삭제되었습니다.'
                : 'This member does not exist or has been removed.'}
            </p>
            <Button variant="outline" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {language === 'ko' ? '뒤로 가기' : 'Go Back'}
            </Button>
          </div>
        ) : (
          <>
            {/* Header card */}
            <Card className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="rounded-full bg-primary/10 p-3 shrink-0">
                    <UserIcon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-lg sm:text-2xl font-serif font-semibold truncate">{displayName}</h1>
                    {altName && <p className="text-xs sm:text-sm text-muted-foreground truncate">{altName}</p>}
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <Badge variant="default" className="text-[10px] sm:text-xs">{roleLabel}</Badge>
                      {profile.sales_status && (
                        <Badge variant="outline" className="text-[10px] sm:text-xs capitalize">{profile.sales_status}</Badge>
                      )}
                      {profile.is_approved === false && (
                        <Badge variant="destructive" className="text-[10px] sm:text-xs">
                          {language === 'ko' ? '미승인' : 'Unapproved'}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full sm:w-auto">
                  <div className="text-center px-2 py-1 sm:px-3 sm:py-2 rounded border border-border">
                    <div className="text-[9px] sm:text-[10px] text-muted-foreground">
                      {language === 'ko' ? '투자건수' : 'Investments'}
                    </div>
                    <div className="text-sm sm:text-base font-semibold">{investments.length}</div>
                  </div>
                  <div className="text-center px-2 py-1 sm:px-3 sm:py-2 rounded border border-border">
                    <div className="text-[9px] sm:text-[10px] text-muted-foreground">
                      {language === 'ko' ? '하부 인원' : 'Downline'}
                    </div>
                    <div className="text-sm sm:text-base font-semibold">{downline.length}</div>
                  </div>
                  <div className="text-center px-2 py-1 sm:px-3 sm:py-2 rounded border border-border">
                    <div className="text-[9px] sm:text-[10px] text-muted-foreground">
                      {language === 'ko' ? '커미션' : 'Commissions'}
                    </div>
                    <div className="text-sm sm:text-base font-semibold">{commissions.length}</div>
                  </div>
                </div>
              </div>
            </Card>

            <Tabs value={activeTab} onValueChange={openMemberTab} className="space-y-4">
              <TabsList className="w-full justify-start overflow-x-auto">
                <TabsTrigger value="profile" className="text-xs sm:text-sm">
                  {language === 'ko' ? '프로필' : 'Profile'}
                </TabsTrigger>
                <TabsTrigger value="investments" className="text-xs sm:text-sm">
                  {language === 'ko' ? '투자 내역' : 'Investments'}
                </TabsTrigger>
                <TabsTrigger value="organization" className="text-xs sm:text-sm">
                  {language === 'ko' ? '조직 정보' : 'Organization'}
                </TabsTrigger>
                <TabsTrigger value="commissions" className="text-xs sm:text-sm">
                  {language === 'ko' ? '커미션 내역' : 'Commissions'}
                </TabsTrigger>
              </TabsList>

              {/* Profile Tab */}
              <TabsContent value="profile" className="space-y-4">
                <Card className="p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm sm:text-base font-semibold">
                      {language === 'ko' ? '기본 정보' : 'Basic Info'}
                    </h2>
                    {canEditProfile && !editingProfile && (
                      <Button size="sm" variant="outline" onClick={startEditProfile} className="h-7 text-xs">
                        <Pencil className="h-3 w-3 mr-1" />
                        {language === 'ko' ? '수정' : 'Edit'}
                      </Button>
                    )}
                    {editingProfile && (
                      <div className="flex gap-1">
                        <Button size="sm" onClick={saveProfile} disabled={savingProfile} className="h-7 text-xs">
                          <Save className="h-3 w-3 mr-1" />
                          {language === 'ko' ? '저장' : 'Save'}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancelEditProfile} disabled={savingProfile} className="h-7 text-xs">
                          {language === 'ko' ? '취소' : 'Cancel'}
                        </Button>
                      </div>
                    )}
                  </div>

                  {editingProfile ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <EditField icon={UserIcon} label={language === 'ko' ? '영문 이름' : 'English Name'} value={profileDraft.full_name} onChange={(v) => setProfileDraft({ ...profileDraft, full_name: v })} />
                      <EditField icon={UserIcon} label={language === 'ko' ? '한국어 이름' : 'Korean Name'} value={profileDraft.full_name_ko} onChange={(v) => setProfileDraft({ ...profileDraft, full_name_ko: v })} />
                      <EditField icon={Mail} label={language === 'ko' ? '이메일' : 'Email'} value={profileDraft.email} onChange={(v) => setProfileDraft({ ...profileDraft, email: v })} type="email" />
                      <EditField icon={Phone} label={language === 'ko' ? '연락처' : 'Phone'} value={profileDraft.phone} onChange={(v) => setProfileDraft({ ...profileDraft, phone: v })} type="tel" />
                      <EditField icon={MapPin} label={language === 'ko' ? '주소' : 'Address'} value={profileDraft.address} onChange={(v) => setProfileDraft({ ...profileDraft, address: v })} />
                      <EditField icon={Calendar} label={language === 'ko' ? '생년월일' : 'Birthday'} value={profileDraft.birthday} onChange={(v) => setProfileDraft({ ...profileDraft, birthday: v })} type="date" />
                      <InfoRow icon={Calendar} label={language === 'ko' ? '가입일' : 'Joined'} value={formatDate(profile.created_at)} />
                      {profile.parent_id && (
                        <div className="flex items-start gap-2">
                          <Users className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <div className="text-[10px] text-muted-foreground">{language === 'ko' ? '상위 담당' : 'Sponsor'}</div>
                            <MemberLink userId={profile.parent_id} className="text-xs sm:text-sm font-medium">
                              {parentName || profile.parent_id.slice(0, 8) + '…'}
                            </MemberLink>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <InfoRow icon={UserIcon} label={language === 'ko' ? '영문 이름' : 'English Name'} value={profile.full_name} />
                      <InfoRow icon={UserIcon} label={language === 'ko' ? '한국어 이름' : 'Korean Name'} value={profile.full_name_ko || '—'} />
                      <InfoRow icon={Mail} label={language === 'ko' ? '이메일' : 'Email'} value={profile.email} />
                      <InfoRow icon={Phone} label={language === 'ko' ? '연락처' : 'Phone'} value={profile.phone || '—'} />
                      <InfoRow icon={MapPin} label={language === 'ko' ? '주소' : 'Address'} value={profile.address || '—'} />
                      <InfoRow icon={Calendar} label={language === 'ko' ? '생년월일' : 'Birthday'} value={profile.birthday ? formatDate(profile.birthday) : '—'} />
                      <InfoRow icon={Calendar} label={language === 'ko' ? '가입일' : 'Joined'} value={formatDate(profile.created_at)} />
                      {profile.parent_id && (
                        <div className="flex items-start gap-2">
                          <Users className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <div className="text-[10px] text-muted-foreground">{language === 'ko' ? '상위 담당' : 'Sponsor'}</div>
                            <MemberLink userId={profile.parent_id} className="text-xs sm:text-sm font-medium">
                              {parentName || profile.parent_id.slice(0, 8) + '…'}
                            </MemberLink>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </Card>

                <Card className="p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm sm:text-base font-semibold">
                      {language === 'ko' ? '관리자 메모' : 'Admin Notes'}
                    </h2>
                    {canEditNotes && (
                      <Button size="sm" onClick={handleSaveNotes} disabled={savingNotes} className="h-7 text-xs">
                        <Save className="h-3 w-3 mr-1" />
                        {language === 'ko' ? '저장' : 'Save'}
                      </Button>
                    )}
                  </div>
                  {canEditNotes ? (
                    <Textarea
                      value={notesDraft}
                      onChange={(e) => setNotesDraft(e.target.value)}
                      placeholder={language === 'ko' ? '고객별 특수 정보, 메모 등' : 'Client-specific notes...'}
                      rows={6}
                      maxLength={5000}
                      className="text-sm"
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {profile.admin_notes || (language === 'ko' ? '메모 없음' : 'No notes')}
                    </p>
                  )}
                </Card>
              </TabsContent>

              {/* Investments Tab */}
              <TabsContent value="investments" className="space-y-4">
                <Card className="p-4 sm:p-6">
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                    <div className="flex flex-wrap gap-3">
                      <Stat label={language === 'ko' ? '총 투자' : 'Total Invested'} value={formatCurrency(totalInvested)} />
                      <Stat label={language === 'ko' ? '현재 가치' : 'Current Value'} value={formatCurrency(totalCurrent)} />
                      <Stat
                        label={language === 'ko' ? '평가 손익' : 'Unrealized P/L'}
                        value={formatCurrency(totalCurrent - totalInvested)}
                        positive={totalCurrent - totalInvested >= 0}
                      />
                    </div>
                    {canRegisterInvestment && (
                      <InlineInvestmentForm
                        clientUserId={profile.user_id}
                        onCreated={loadAll}
                      />
                    )}
                  </div>
                  {valuationWarnings.length > 0 && (
                    <div className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-medium text-foreground">
                            {language === 'ko'
                              ? '일부 투자 행에 예상 수익률 또는 상품 요율 매핑이 없습니다.'
                              : 'Some investment rows are missing expected return or product rate mapping.'}
                          </p>
                          <ul className="mt-2 space-y-1 text-[11px] sm:text-xs text-muted-foreground">
                            {valuationWarnings.map((investment) => (
                              <li key={investment.id}>
                                <span className="font-medium text-foreground">
                                  {language === 'ko' ? investment.product_name_ko : investment.product_name_en}
                                </span>
                                {' — '}
                                {investment.valuation_warning}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                  {showDeveloperDebugPanel && investments.length > 0 && (
                    <div className="mb-4 rounded-md border border-dashed border-border bg-muted/30 p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                        <p className="text-xs sm:text-sm font-medium text-foreground">
                          {language === 'ko' ? '개발자 디버그 · 투자 평가 계산' : 'Developer Debug · Investment valuation'}
                        </p>
                      </div>
                      <div className="space-y-2">
                        {investments.map((investment) => (
                          <div
                            key={`debug-${investment.id}`}
                            className="grid gap-2 rounded-md border border-border bg-background px-3 py-2 text-[11px] sm:grid-cols-5 sm:text-xs"
                          >
                            <div className="sm:col-span-5 font-medium text-foreground">
                              {language === 'ko' ? investment.product_name_ko : investment.product_name_en}
                            </div>
                            <div>
                              <div className="text-muted-foreground">product_id</div>
                              <div className="font-mono text-foreground break-all">{investment.product_id || '—'}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">base rate</div>
                              <div className="font-mono text-foreground">
                                {investment.annual_rate_percent != null ? `${Number(investment.annual_rate_percent).toFixed(2)}%` : '—'}
                              </div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">mapping</div>
                              <div className="font-mono text-foreground">{investment.product_mapping_status || '—'}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">accrued interest</div>
                              <div className="font-mono text-foreground">
                                {formatCurrency(Number(investment.accrued_interest) || 0, investment.invested_currency || undefined)}
                              </div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">computed MTM</div>
                              <div className="font-mono text-foreground">
                                {formatCurrency(Number(investment.computed_mark_to_market) || 0, investment.invested_currency || undefined)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="overflow-x-auto">
                    <Table className="text-xs">
                      <TableHeader>
                        <TableRow>
                          <TableHead>{language === 'ko' ? '상품' : 'Product'}</TableHead>
                          <TableHead className="text-right">{language === 'ko' ? '투자금액' : 'Amount'}</TableHead>
                          <TableHead className="text-right">{language === 'ko' ? '현재가치' : 'Current'}</TableHead>
                          <TableHead className="text-right hidden sm:table-cell">{language === 'ko' ? '수익률' : 'Return'}</TableHead>
                          <TableHead className="hidden md:table-cell">{language === 'ko' ? '만기일' : 'Maturity'}</TableHead>
                          <TableHead>{language === 'ko' ? '상태' : 'Status'}</TableHead>
                          <TableHead className="text-right w-16">{language === 'ko' ? '편집' : 'Edit'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {investments.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                              {language === 'ko' ? '투자 내역이 없습니다' : 'No investments'}
                            </TableCell>
                          </TableRow>
                        ) : (
                          investments.map((inv) => (
                            <EditableInvestmentRow
                              key={inv.id}
                              inv={inv}
                              canEdit={canRegisterInvestment}
                              onChanged={loadAll}
                            />
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </TabsContent>

              {/* Organization Tab */}
              <TabsContent value="organization" className="space-y-4">
                <Card className="p-4 sm:p-6">
                  <h2 className="text-sm sm:text-base font-semibold mb-3 flex items-center gap-2">
                    <ChevronUp className="h-4 w-4" />
                    {language === 'ko' ? '상위 조직 (Sponsor 체인)' : 'Upline (Sponsor Chain)'}
                  </h2>
                  {ancestors.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {language === 'ko' ? '상위 멤버 없음' : 'No ancestors'}
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {ancestors.map((a) => (
                        <div key={a.user_id} className="flex items-center justify-between rounded border border-border px-3 py-2 text-xs sm:text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-muted-foreground text-[10px] w-6 shrink-0">L{a.depth}</span>
                            <MemberLink userId={a.user_id} className="font-medium truncate">
                              {a.full_name}
                            </MemberLink>
                          </div>
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            {ROLE_LABELS[a.sales_role]?.[language === 'ko' ? 'ko' : 'en'] || a.sales_role}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                <Card className="p-4 sm:p-6">
                  <h2 className="text-sm sm:text-base font-semibold mb-3 flex items-center gap-2">
                    <ChevronDown className="h-4 w-4" />
                    {language === 'ko' ? `하위 조직 (${downline.length}명)` : `Downline (${downline.length})`}
                  </h2>
                  {downline.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {language === 'ko' ? '하위 멤버 없음' : 'No downline'}
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-96 overflow-y-auto">
                      {downline.map((d) => (
                        <div
                          key={d.user_id}
                          className="flex items-center justify-between rounded border border-border px-3 py-2 text-xs sm:text-sm"
                          style={{ paddingLeft: `${d.depth * 12 + 12}px` }}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <MemberLink userId={d.user_id} className="font-medium truncate">
                              {d.full_name}
                            </MemberLink>
                          </div>
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            {ROLE_LABELS[d.sales_role]?.[language === 'ko' ? 'ko' : 'en'] || d.sales_role}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </TabsContent>

              {/* Commissions Tab */}
              <TabsContent value="commissions" className="space-y-4">
                <Card className="p-4 sm:p-6">
                  <div className="flex flex-wrap gap-3 mb-4">
                    <Stat
                      label={language === 'ko' ? '수령 합계' : 'Earned Total'}
                      value={formatCurrency(earnedTotal)}
                      positive
                    />
                    <Stat label={language === 'ko' ? '건수' : 'Count'} value={String(commissions.length)} />
                  </div>
                  <div className="overflow-x-auto">
                    <Table className="text-xs">
                      <TableHeader>
                        <TableRow>
                          <TableHead>{language === 'ko' ? '방향' : 'Direction'}</TableHead>
                          <TableHead>{language === 'ko' ? '상대' : 'Counterpart'}</TableHead>
                          <TableHead className="text-right">{language === 'ko' ? '선취' : 'Upfront'}</TableHead>
                          <TableHead className="text-right">{language === 'ko' ? '성과' : 'Performance'}</TableHead>
                          <TableHead className="hidden sm:table-cell">{language === 'ko' ? '레이어' : 'Layer'}</TableHead>
                          <TableHead>{language === 'ko' ? '상태' : 'Status'}</TableHead>
                          <TableHead className="hidden md:table-cell">{language === 'ko' ? '일자' : 'Date'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {commissions.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                              {language === 'ko' ? '커미션 내역이 없습니다' : 'No commissions'}
                            </TableCell>
                          </TableRow>
                        ) : (
                          commissions.map((c) => {
                            const isEarned = c.to_user_id === userId;
                            const counterpartId = isEarned ? c.from_user_id : c.to_user_id;
                            const counterpartName = counterpartId
                              ? downlineNames[counterpartId] || counterpartId.slice(0, 8) + '…'
                              : '—';
                            return (
                              <EditableCommissionRow
                                key={c.id}
                                row={c}
                                viewerUserId={user?.id || ''}
                                isAdmin={!!isAdmin}
                                counterpartName={counterpartName}
                                counterpartId={counterpartId}
                                isEarned={isEarned}
                                onChanged={loadAll}
                              />
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-[10px] text-muted-foreground">{label}</div>
        <div className="text-xs sm:text-sm break-all">{value}</div>
      </div>
    </div>
  );
}

function Stat({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="flex-1 min-w-[100px] rounded border border-border p-2 sm:p-3">
      <div className="text-[10px] sm:text-xs text-muted-foreground">{label}</div>
      <div className={`text-sm sm:text-lg font-semibold ${positive === true ? 'text-emerald-600' : positive === false ? 'text-destructive' : ''}`}>
        {value}
      </div>
    </div>
  );
}

function EditField({ icon: Icon, label, value, onChange, type = 'text' }: {
  icon: any; label: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-4 w-4 text-muted-foreground mt-2 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-[10px] text-muted-foreground mb-0.5">{label}</div>
        <Input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 text-xs sm:text-sm"
        />
      </div>
    </div>
  );
}
