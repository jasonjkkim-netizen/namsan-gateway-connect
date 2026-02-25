import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/Header';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Users, Coins, Briefcase, ChevronRight, TrendingUp, Plus, CheckCircle, Clock, Wallet, Download, CalendarIcon, Crown, UserCog } from 'lucide-react';
import { CreateInvestmentDialog } from '@/components/sales/CreateInvestmentDialog';
import { MemberDetailDialog } from '@/components/sales/MemberDetailDialog';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import ExcelJS from 'exceljs';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

interface DownlineMember {
  user_id: string;
  full_name: string;
  sales_role: string;
  sales_level: number;
  parent_id: string;
  depth: number;
}

interface CommissionDist {
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

interface Investment {
  id: string;
  user_id: string;
  product_name_en: string;
  product_name_ko: string;
  investment_amount: number;
  current_value: number;
  status: string | null;
  start_date: string;
  invested_currency: string | null;
}

interface Profile {
  user_id: string;
  full_name: string;
  email: string;
  sales_role: string | null;
}

const ROLE_LABELS: Record<string, Record<string, string>> = {
  ko: {
    webmaster: '웹마스터',
    district_manager: '총괄관리',
    deputy_district_manager: '부총괄관리',
    principal_agent: '수석 에이전트',
    agent: '에이전트',
    client: '고객',
  },
  en: {
    webmaster: 'Webmaster',
    district_manager: 'General Manager',
    deputy_district_manager: 'Deputy GM',
    principal_agent: 'Principal Agent',
    agent: 'Agent',
    client: 'Client',
  },
};

const ROLE_COLORS: Record<string, string> = {
  webmaster: 'default',
  district_manager: 'default',
  deputy_district_manager: 'default',
  principal_agent: 'secondary',
  agent: 'outline',
  client: 'outline',
};

export default function SalesDashboard() {
  const { language, formatCurrency, formatDate } = useLanguage();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [downline, setDownline] = useState<DownlineMember[]>([]);
  const [commissions, setCommissions] = useState<CommissionDist[]>([]);
  const [downlineInvestments, setDownlineInvestments] = useState<Investment[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateInvestment, setShowCreateInvestment] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [displayCurrency, setDisplayCurrency] = useState<string>('KRW');
  const [usdKrwRate, setUsdKrwRate] = useState<number>(1350);
  const [roleChangeDialog, setRoleChangeDialog] = useState<{
    open: boolean;
    member: DownlineMember | null;
    newRole: string;
  }>({ open: false, member: null, newRole: '' });
  const [changingRoleId, setChangingRoleId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const userSalesRole = (profile as any)?.sales_role;
  const isWebmaster = userSalesRole === 'webmaster';
  const isDM = userSalesRole === 'district_manager' || isWebmaster;
  const isDeputyDM = userSalesRole === 'deputy_district_manager';
  const canChangeRoles = isDM || isDeputyDM;
  const canSeeTotalCommissions = isWebmaster || isAdmin;
  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    // Block clients (lowest level) from accessing sales dashboard
    const salesRole = (profile as any)?.sales_role;
    if (!salesRole || salesRole === 'client') {
      navigate('/dashboard');
      return;
    }
    fetchAll();
  }, [user, profile]);

  async function fetchAll() {
    if (!user) return;
    setLoading(true);

    // Check admin role
    const { data: adminData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();
    const userIsAdmin = !!adminData;
    setIsAdmin(userIsAdmin);

    const currentRole = (profile as any)?.sales_role;
    const isDMUser = currentRole === 'district_manager' || currentRole === 'webmaster';
    const canSeeAll = currentRole === 'webmaster' || userIsAdmin;

    let downlineData: DownlineMember[];

    if (isDMUser) {
      // DM sees ALL sales members (not just subtree)
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, sales_role, sales_level, parent_id, depth:sales_level')
        .not('sales_role', 'is', null)
        .neq('user_id', user.id);

      downlineData = (allProfiles || []).map((p: any) => ({
        user_id: p.user_id,
        full_name: p.full_name,
        sales_role: p.sales_role,
        sales_level: p.sales_level,
        parent_id: p.parent_id,
        depth: p.sales_level || 0,
      })) as DownlineMember[];
    } else {
      // Normal: subtree only
      const { data: tree } = await supabase.rpc('get_sales_subtree', {
        _user_id: user.id,
      });
      downlineData = (tree || []) as DownlineMember[];
    }

    setDownline(downlineData);

    // Fetch commissions based on role visibility
    let commQuery;
    if (canSeeAll) {
      // Webmaster/Admin: see ALL commissions
      commQuery = supabase
        .from('commission_distributions')
        .select('*')
        .order('created_at', { ascending: false });
    } else if (isDMUser) {
      // DM: see own + all subtree commissions
      const downlineIds = downlineData.map((d) => d.user_id);
      const allIds = [user.id, ...downlineIds];
      commQuery = supabase
        .from('commission_distributions')
        .select('*')
        .in('to_user_id', allIds)
        .order('created_at', { ascending: false });
    } else {
      // Others: see own + subtree commissions
      const downlineIds = downlineData.map((d) => d.user_id);
      const allIds = [user.id, ...downlineIds];
      commQuery = supabase
        .from('commission_distributions')
        .select('*')
        .in('to_user_id', allIds)
        .order('created_at', { ascending: false });
    }
    const { data: commData } = await commQuery;
    setCommissions((commData || []) as CommissionDist[]);

    // Fetch investments from downline members
    const downlineIds = downlineData.map((d) => d.user_id);
    if (downlineIds.length > 0) {
      // For DM, fetch all investments; for others, only subtree
      const invQuery = isDMUser
        ? supabase.from('client_investments').select('*').order('start_date', { ascending: false }).limit(100)
        : supabase.from('client_investments').select('*').in('user_id', downlineIds).order('start_date', { ascending: false }).limit(50);

      const { data: invData } = await invQuery;
      setDownlineInvestments((invData || []) as Investment[]);
    }

    // Fetch profiles for name resolution
    const allIds = [user.id, ...downlineIds];
    if (isDMUser) {
      // DM: fetch all profiles
      const { data: profileData } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, sales_role');
      setProfiles((profileData || []) as Profile[]);
    } else {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, sales_role')
        .in('user_id', allIds);
      setProfiles((profileData || []) as Profile[]);
    }

    // Fetch display currency setting and exchange rate
    const [settingsRes, fxRes] = await Promise.all([
      supabase.from('app_settings').select('*').eq('key', 'commission_display_currency').maybeSingle(),
      supabase.from('market_indices').select('current_value').eq('symbol', 'USDKRW=X').maybeSingle(),
    ]);
    if (settingsRes.data?.value) {
      const val = typeof settingsRes.data.value === 'string' ? settingsRes.data.value : JSON.stringify(settingsRes.data.value).replace(/"/g, '');
      setDisplayCurrency(val || 'KRW');
    }
    if (fxRes.data?.current_value) setUsdKrwRate(Number(fxRes.data.current_value));

    setLoading(false);
  }

  const ROLE_LEVELS: Record<string, number> = {
    webmaster: 0,
    district_manager: 1,
    deputy_district_manager: 2,
    principal_agent: 3,
    agent: 4,
    client: 5,
  };

  const handleRoleChange = async (member: DownlineMember, newRole: string) => {
    if (newRole === member.sales_role) return;
    setChangingRoleId(member.user_id);
    try {
      const newLevel = ROLE_LEVELS[newRole] || 0;

      // Update profile role and level
      const { error } = await supabase
        .from('profiles')
        .update({ sales_role: newRole, sales_level: newLevel })
        .eq('user_id', member.user_id);

      if (error) throw error;

      // Recalculate commissions
      const { data: investments } = await supabase
        .from('client_investments')
        .select('id')
        .eq('user_id', member.user_id);

      if (investments && investments.length > 0) {
        for (const inv of investments) {
          try {
            await supabase.functions.invoke('calculate-commissions', {
              body: { investment_id: inv.id },
            });
          } catch (e) {
            console.error('Commission recalc failed for', inv.id, e);
          }
        }
      }

      toast.success(
        language === 'ko'
          ? `${member.full_name} 님의 역할이 ${getRoleLabel(newRole)}(으)로 변경되었습니다`
          : `${member.full_name}'s role changed to ${getRoleLabel(newRole)}`
      );

      // Send role change notification
      try {
        await supabase.functions.invoke('notify-sales', {
          body: {
            type: 'role_changed',
            user_id: member.user_id,
            user_name: member.full_name,
            role: newRole,
            old_role: member.sales_role || '',
          },
        });
      } catch (e) {
        console.error('Role change notification failed:', e);
      }

      fetchAll();
    } catch (err: any) {
      console.error(err);
      toast.error(language === 'ko' ? '역할 변경 실패' : 'Failed to change role');
    } finally {
      setChangingRoleId(null);
      setRoleChangeDialog({ open: false, member: null, newRole: '' });
    }
  };

  const getName = (userId: string) => {
    const p = profiles.find((pr) => pr.user_id === userId);
    return p ? p.full_name : userId.slice(0, 8) + '…';
  };

  const getRoleLabel = (role: string) =>
    ROLE_LABELS[language]?.[role] || role;

  const formatCommAmount = (amount: number, currency?: string | null) => {
    const srcCurrency = currency || 'USD';
    if (displayCurrency === 'USD') {
      const usdAmount = srcCurrency === 'KRW' ? amount / usdKrwRate : amount;
      return `$${usdAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (displayCurrency === 'KRW') {
      const krwAmount = srcCurrency === 'USD' ? amount * usdKrwRate : amount;
      return `₩${Math.round(krwAmount).toLocaleString('ko-KR')}`;
    }
    return formatCurrency(amount);
  };

  // Normalize a single commission amount to a common base (USD) for aggregation
  const toUsd = (amount: number, currency?: string | null) => {
    const src = currency || 'USD';
    return src === 'KRW' ? amount / usdKrwRate : amount;
  };

  // Summary calculations (normalized to USD, then formatted via formatCommAmount)
  const totalUpfront = commissions.reduce(
    (s, c) => s + toUsd(Number(c.upfront_amount) || 0, c.currency),
    0
  );
  const totalPerformance = commissions.reduce(
    (s, c) => s + toUsd(Number(c.performance_amount) || 0, c.currency),
    0
  );
  const pendingCommissions = commissions.filter((c) => c.status === 'pending');
  const availableCommissions = commissions.filter(
    (c) => c.status === 'available'
  );
  const paidCommissions = commissions.filter((c) => c.status === 'paid');

  const paidTotal = paidCommissions.reduce(
    (s, c) => s + toUsd((Number(c.upfront_amount) || 0) + (Number(c.performance_amount) || 0), c.currency),
    0
  );
  const availableTotal = availableCommissions.reduce(
    (s, c) => s + toUsd((Number(c.upfront_amount) || 0) + (Number(c.performance_amount) || 0), c.currency),
    0
  );
  const pendingTotal = pendingCommissions.reduce(
    (s, c) => s + toUsd((Number(c.upfront_amount) || 0) + (Number(c.performance_amount) || 0), c.currency),
    0
  );

  const totalDownlineInvested = downlineInvestments.reduce(
    (s, inv) => s + Number(inv.investment_amount),
    0
  );

  // Group downline by depth for tree display
  const downlineByDepth: Record<number, DownlineMember[]> = {};
  downline.forEach((m) => {
    if (!downlineByDepth[m.depth]) downlineByDepth[m.depth] = [];
    downlineByDepth[m.depth].push(m);
  });

  // Commission report filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  const filteredCommissions = useMemo(() => {
    return commissions.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (dateFrom && new Date(c.created_at) < dateFrom) return false;
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        if (new Date(c.created_at) > end) return false;
      }
      return true;
    });
  }, [commissions, statusFilter, dateFrom, dateTo]);

  const exportToExcel = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(language === 'ko' ? '커미션 리포트' : 'Commission Report');

    ws.columns = [
      { header: language === 'ko' ? '투자자' : 'Investor', key: 'investor', width: 20 },
      { header: language === 'ko' ? '레이어' : 'Layer', key: 'layer', width: 10 },
      { header: language === 'ko' ? '선취 커미션' : 'Upfront', key: 'upfront', width: 18 },
      { header: language === 'ko' ? '성과 커미션' : 'Performance', key: 'performance', width: 18 },
      { header: language === 'ko' ? '합계' : 'Total', key: 'total', width: 18 },
      { header: language === 'ko' ? '적용률' : 'Rate', key: 'rate', width: 10 },
      { header: language === 'ko' ? '통화' : 'Currency', key: 'currency', width: 10 },
      { header: language === 'ko' ? '상태' : 'Status', key: 'status', width: 12 },
      { header: language === 'ko' ? '일자' : 'Date', key: 'date', width: 14 },
    ];

    // Style header
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1A2E' } };
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    filteredCommissions.forEach((c) => {
      const upfront = Number(c.upfront_amount) || 0;
      const perf = Number(c.performance_amount) || 0;
      ws.addRow({
        investor: c.from_user_id ? getName(c.from_user_id) : '—',
        layer: c.layer,
        upfront,
        performance: perf,
        total: upfront + perf,
        rate: c.rate_used ? `${c.rate_used}%` : '—',
        currency: c.currency || 'USD',
        status: c.status,
        date: format(new Date(c.created_at), 'yyyy-MM-dd'),
      });
    });

    // Summary row
    const totalUp = filteredCommissions.reduce((s, c) => s + (Number(c.upfront_amount) || 0), 0);
    const totalPerf = filteredCommissions.reduce((s, c) => s + (Number(c.performance_amount) || 0), 0);
    const summaryRow = ws.addRow({
      investor: language === 'ko' ? '합계' : 'TOTAL',
      upfront: totalUp,
      performance: totalPerf,
      total: totalUp + totalPerf,
    });
    summaryRow.font = { bold: true };

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `commission-report-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const displayName =
    language === 'ko' && (profile as any)?.full_name_ko
      ? (profile as any).full_name_ko
      : profile?.full_name;

  const userRole = (profile as any)?.sales_role;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-8">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-serif font-semibold text-foreground">
              {language === 'ko' ? '영업 대시보드' : 'Sales Dashboard'}
            </h1>
            {userRole && (
              <Badge variant={ROLE_COLORS[userRole] as any || 'secondary'}>
                {getRoleLabel(userRole)}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            {language === 'ko'
              ? `${displayName}님의 영업 현황`
              : `Sales overview for ${displayName}`}
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 animate-fade-in" style={{ animationDelay: '50ms' }}>
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Users className="h-4 w-4" />
              {language === 'ko' ? '하위 영업인' : 'Downline'}
            </div>
            {loading ? <Skeleton className="h-8 w-16" /> : (
              <p className="text-2xl font-semibold">{downline.length}</p>
            )}
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Coins className="h-4 w-4" />
              {language === 'ko' 
                ? (canSeeTotalCommissions ? '총 선취 커미션' : '내 선취 커미션') 
                : (canSeeTotalCommissions ? 'Total Upfront' : 'My Upfront')}
            </div>
            {loading ? <Skeleton className="h-8 w-24" /> : (
              <p className="text-2xl font-semibold text-success">{formatCommAmount(totalUpfront)}</p>
            )}
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <TrendingUp className="h-4 w-4" />
              {language === 'ko' 
                ? (canSeeTotalCommissions ? '총 성과 커미션' : '내 성과 커미션') 
                : (canSeeTotalCommissions ? 'Total Performance' : 'My Performance')}
            </div>
            {loading ? <Skeleton className="h-8 w-24" /> : (
              <p className="text-2xl font-semibold text-success">{formatCommAmount(totalPerformance)}</p>
            )}
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Briefcase className="h-4 w-4" />
              {language === 'ko' ? '하위 투자 총액' : 'Downline AUM'}
            </div>
            {loading ? <Skeleton className="h-8 w-24" /> : (
              <p className="text-2xl font-semibold">{formatCurrency(totalDownlineInvested)}</p>
            )}
          </div>
        </div>

        {/* Commission Status Breakdown */}
        {!loading && commissions.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-8 animate-fade-in" style={{ animationDelay: '75ms' }}>
            <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
              <div className="rounded-full bg-muted p-2">
                <CheckCircle className="h-4 w-4 text-success" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{language === 'ko' ? '지급완료' : 'Paid'}</p>
                <p className="text-lg font-semibold">{formatCommAmount(paidTotal)}</p>
                <p className="text-xs text-muted-foreground">{paidCommissions.length}{language === 'ko' ? '건' : ' items'}</p>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
              <div className="rounded-full bg-muted p-2">
                <Wallet className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{language === 'ko' ? '수령 가능' : 'Available'}</p>
                <p className="text-lg font-semibold">{formatCommAmount(availableTotal)}</p>
                <p className="text-xs text-muted-foreground">{availableCommissions.length}{language === 'ko' ? '건' : ' items'}</p>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
              <div className="rounded-full bg-muted p-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{language === 'ko' ? '대기중' : 'Pending'}</p>
                <p className="text-lg font-semibold">{formatCommAmount(pendingTotal)}</p>
                <p className="text-xs text-muted-foreground">{pendingCommissions.length}{language === 'ko' ? '건' : ' items'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="downline" className="space-y-6 animate-fade-in" style={{ animationDelay: '100ms' }}>
          <TabsList>
            <TabsTrigger value="downline" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              {language === 'ko' ? '조직도' : 'Downline'}
            </TabsTrigger>
            <TabsTrigger value="commissions" className="flex items-center gap-2">
              <Coins className="h-4 w-4" />
              {language === 'ko' ? '커미션' : 'Commissions'}
            </TabsTrigger>
            <TabsTrigger value="pipeline" className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              {language === 'ko' ? '투자 파이프라인' : 'Pipeline'}
            </TabsTrigger>
          </TabsList>

          {/* Downline Tree Tab */}
          <TabsContent value="downline">
            <div className="card-elevated">
              <div className="p-6 border-b border-border">
                <h2 className="text-lg font-serif font-semibold">
                  {language === 'ko' ? '하위 영업 조직' : 'Sales Organization'}
                </h2>
              </div>
              <div className="p-6">
                {loading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : downline.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-40" />
                    <p>
                      {language === 'ko'
                        ? '하위 영업인이 없습니다'
                        : 'No downline members yet'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Root: current user (self) */}
                    <div className="flex items-center gap-3 rounded-lg border-2 border-primary/30 bg-primary/5 px-4 py-3">
                      <Crown className="h-4 w-4 text-primary" />
                      <span className="font-semibold">
                        {profile?.full_name || user?.email}
                      </span>
                      <Badge variant="default" className="text-xs">
                        {(profile as any)?.sales_role
                          ? getRoleLabel((profile as any).sales_role)
                          : 'Admin'}
                      </Badge>
                    </div>
                    {Object.keys(downlineByDepth)
                      .sort((a, b) => Number(a) - Number(b))
                      .map((depthStr) => {
                        const depth = Number(depthStr);
                        const members = downlineByDepth[depth];
                        return (
                          <div key={depth}>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                              {language === 'ko'
                                ? `${depth + 1}단계`
                                : `Level ${depth + 1}`}
                            </p>
                            <div className="space-y-1 mb-4">
                              {members.map((m) => (
                                <div
                                  key={m.user_id}
                                  className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 hover:bg-muted/30 transition-colors"
                                  style={{ marginLeft: `${(depth + 1) * 24}px` }}
                                >
                                  <div
                                    className="flex items-center gap-3 flex-1 cursor-pointer"
                                    onClick={() => setSelectedMemberId(m.user_id)}
                                  >
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium">
                                      {m.full_name}
                                    </span>
                                    <Badge
                                      variant={
                                        (ROLE_COLORS[m.sales_role] as any) ||
                                        'secondary'
                                      }
                                      className="text-xs"
                                    >
                                      {getRoleLabel(m.sales_role)}
                                    </Badge>
                                  </div>
                                  {canChangeRoles && m.user_id !== user?.id && (isDM || m.sales_role !== 'deputy_district_manager') && (
                                    <Select
                                      value={m.sales_role}
                                      onValueChange={(newRole) => {
                                        if (newRole !== m.sales_role) {
                                          setRoleChangeDialog({ open: true, member: m, newRole });
                                        }
                                      }}
                                      disabled={changingRoleId === m.user_id}
                                    >
                                      <SelectTrigger className="w-[130px] h-7 text-xs" onClick={(e) => e.stopPropagation()}>
                                        <UserCog className="h-3 w-3 mr-1" />
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent className="bg-popover z-50">
                                        {isDM && <SelectItem value="deputy_district_manager">{language === 'ko' ? '부총괄관리' : 'Deputy GM'}</SelectItem>}
                                        <SelectItem value="principal_agent">{language === 'ko' ? '수석 에이전트' : 'Principal Agent'}</SelectItem>
                                        <SelectItem value="agent">{language === 'ko' ? '에이전트' : 'Agent'}</SelectItem>
                                        <SelectItem value="client">{language === 'ko' ? '고객' : 'Client'}</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Commissions Tab */}
          <TabsContent value="commissions">
            <div className="card-elevated">
              <div className="p-6 border-b border-border space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-serif font-semibold">
                    {language === 'ko' ? '커미션 내역' : 'Commission History'}
                  </h2>
                  <Button size="sm" variant="outline" onClick={exportToExcel} disabled={filteredCommissions.length === 0}>
                    <Download className="h-4 w-4 mr-1" />
                    {language === 'ko' ? 'Excel 다운로드' : 'Export Excel'}
                  </Button>
                </div>
                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{language === 'ko' ? '전체 상태' : 'All Status'}</SelectItem>
                      <SelectItem value="pending">{language === 'ko' ? '대기' : 'Pending'}</SelectItem>
                      <SelectItem value="available">{language === 'ko' ? '수령가능' : 'Available'}</SelectItem>
                      <SelectItem value="paid">{language === 'ko' ? '지급완료' : 'Paid'}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                        <CalendarIcon className="h-4 w-4 mr-1" />
                        {dateFrom ? format(dateFrom, 'yyyy-MM-dd') : (language === 'ko' ? '시작일' : 'From')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} className={cn("p-3 pointer-events-auto")} />
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                        <CalendarIcon className="h-4 w-4 mr-1" />
                        {dateTo ? format(dateTo, 'yyyy-MM-dd') : (language === 'ko' ? '종료일' : 'To')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={dateTo} onSelect={setDateTo} className={cn("p-3 pointer-events-auto")} />
                    </PopoverContent>
                  </Popover>
                  {(dateFrom || dateTo || statusFilter !== 'all') && (
                    <Button variant="ghost" size="sm" onClick={() => { setDateFrom(undefined); setDateTo(undefined); setStatusFilter('all'); }}>
                      {language === 'ko' ? '초기화' : 'Clear'}
                    </Button>
                  )}
                  <span className="text-xs text-muted-foreground ml-auto">
                    {filteredCommissions.length}{language === 'ko' ? '건' : ' records'}
                  </span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{language === 'ko' ? '투자자' : 'Investor'}</TableHead>
                      <TableHead>{language === 'ko' ? '레이어' : 'Layer'}</TableHead>
                      <TableHead>{language === 'ko' ? '선취' : 'Upfront'}</TableHead>
                      <TableHead>{language === 'ko' ? '성과' : 'Performance'}</TableHead>
                      <TableHead>{language === 'ko' ? '적용률' : 'Rate'}</TableHead>
                      <TableHead>{language === 'ko' ? '상태' : 'Status'}</TableHead>
                      <TableHead>{language === 'ko' ? '일자' : 'Date'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 7 }).map((_, j) => (
                            <TableCell key={j}>
                              <Skeleton className="h-5 w-20" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : filteredCommissions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          {language === 'ko' ? '커미션 내역이 없습니다' : 'No commissions found'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredCommissions.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">
                            {c.from_user_id ? getName(c.from_user_id) : '—'}
                          </TableCell>
                          <TableCell>{c.layer}</TableCell>
                          <TableCell>
                            {c.upfront_amount ? (
                              <span className="text-success font-medium">+{formatCommAmount(Number(c.upfront_amount), c.currency)}</span>
                            ) : '—'}
                          </TableCell>
                          <TableCell>
                            {c.performance_amount ? (
                              <span className="text-success font-medium">+{formatCommAmount(Number(c.performance_amount), c.currency)}</span>
                            ) : '—'}
                          </TableCell>
                          <TableCell>{c.rate_used ? `${c.rate_used}%` : '—'}</TableCell>
                          <TableCell>
                            <Badge variant={c.status === 'available' ? 'default' : c.status === 'paid' ? 'outline' : 'secondary'}>
                              {c.status === 'pending' ? (language === 'ko' ? '대기' : 'Pending')
                                : c.status === 'available' ? (language === 'ko' ? '수령가능' : 'Available')
                                : c.status === 'paid' ? (language === 'ko' ? '지급완료' : 'Paid')
                                : c.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(c.created_at)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          {/* Investment Pipeline Tab */}
          <TabsContent value="pipeline">
            <div className="card-elevated">
              <div className="p-6 border-b border-border flex items-center justify-between">
                <h2 className="text-lg font-serif font-semibold">
                  {language === 'ko'
                    ? '하위 조직 투자 현황'
                    : 'Downline Investment Pipeline'}
                </h2>
                {downline.length > 0 && (
                  <Button size="sm" onClick={() => setShowCreateInvestment(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    {language === 'ko' ? '투자 등록' : 'New Investment'}
                  </Button>
                )}
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        {language === 'ko' ? '투자자' : 'Investor'}
                      </TableHead>
                      <TableHead>
                        {language === 'ko' ? '상품' : 'Product'}
                      </TableHead>
                      <TableHead>
                        {language === 'ko' ? '투자금액' : 'Amount'}
                      </TableHead>
                      <TableHead>
                        {language === 'ko' ? '현재가치' : 'Current Value'}
                      </TableHead>
                      <TableHead>
                        {language === 'ko' ? '상태' : 'Status'}
                      </TableHead>
                      <TableHead>
                        {language === 'ko' ? '시작일' : 'Start Date'}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 6 }).map((_, j) => (
                            <TableCell key={j}>
                              <Skeleton className="h-5 w-20" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : downlineInvestments.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center py-8 text-muted-foreground"
                        >
                          {language === 'ko'
                            ? '하위 조직 투자가 없습니다'
                            : 'No downline investments yet'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      downlineInvestments.map((inv) => (
                        <TableRow key={inv.id}>
                          <TableCell className="font-medium">
                            {getName(inv.user_id)}
                          </TableCell>
                          <TableCell>
                            {language === 'ko'
                              ? inv.product_name_ko
                              : inv.product_name_en}
                          </TableCell>
                          <TableCell>
                            {formatCurrency(inv.investment_amount)}
                          </TableCell>
                          <TableCell>
                            {formatCurrency(inv.current_value)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                inv.status === 'active'
                                  ? 'default'
                                  : 'secondary'
                              }
                            >
                              {inv.status || 'active'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(inv.start_date)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <CreateInvestmentDialog
          open={showCreateInvestment}
          onOpenChange={setShowCreateInvestment}
          downline={downline}
          onCreated={fetchAll}
        />
        <MemberDetailDialog
          open={!!selectedMemberId}
          onOpenChange={(open) => { if (!open) setSelectedMemberId(null); }}
          userId={selectedMemberId}
        />

        {/* Role Change Confirmation Dialog */}
        <AlertDialog open={roleChangeDialog.open} onOpenChange={(open) => setRoleChangeDialog({ ...roleChangeDialog, open })}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {language === 'ko' ? '역할 변경 확인' : 'Confirm Role Change'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {language === 'ko'
                  ? `${roleChangeDialog.member?.full_name} 님의 역할을 "${getRoleLabel(roleChangeDialog.member?.sales_role || '')}"에서 "${getRoleLabel(roleChangeDialog.newRole)}"(으)로 변경하시겠습니까? 관련 커미션이 자동으로 재계산됩니다.`
                  : `Change ${roleChangeDialog.member?.full_name}'s role from "${getRoleLabel(roleChangeDialog.member?.sales_role || '')}" to "${getRoleLabel(roleChangeDialog.newRole)}"? Related commissions will be recalculated automatically.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{language === 'ko' ? '취소' : 'Cancel'}</AlertDialogCancel>
              <AlertDialogAction
                className="btn-gold"
                onClick={() => {
                  if (roleChangeDialog.member) {
                    handleRoleChange(roleChangeDialog.member, roleChangeDialog.newRole);
                  }
                }}
              >
                {language === 'ko' ? '변경' : 'Change'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
}
