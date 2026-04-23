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
import { Users, Coins, Briefcase, ChevronRight, TrendingUp, Plus, CheckCircle, Clock, Wallet, Download, CalendarIcon, Crown, UserCog, Settings, Pencil } from 'lucide-react';
import { CreateInvestmentDialog } from '@/components/sales/CreateInvestmentDialog';
import { SalesCommissionRates } from '@/components/sales/SalesCommissionRates';
import { SalesInvestmentManager } from '@/components/sales/SalesInvestmentManager';
import { MemberDetailDialog } from '@/components/sales/MemberDetailDialog';
import { AddMemberDialog } from '@/components/sales/AddMemberDialog';
import { EditMemberDialog } from '@/components/sales/EditMemberDialog';
import { PendingMemberApprovals } from '@/components/sales/PendingMemberApprovals';
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
  product_id?: string | null;
  product_name_en: string;
  product_name_ko: string;
  investment_amount?: number;
  current_value?: number;
  status: string | null;
  start_date: string;
  maturity_date?: string | null;
  invested_currency: string | null;
  created_at?: string;
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
  principal_agent: 'default',
  agent: 'outline',
  client: 'outline',
};

const ROLE_EXTRA_CLASS: Record<string, string> = {
  agent: 'border-green-500 bg-green-600 text-white',
  client: 'border-emerald-500 bg-emerald-600 text-white',
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
  const [showAddMember, setShowAddMember] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [editMemberId, setEditMemberId] = useState<string | null>(null);
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
    // Wait for profile to load before checking role
    if (!profile) return;
    
    // Block clients (lowest level) from accessing sales dashboard
    const salesRole = (profile as any)?.sales_role;
    if (!salesRole || salesRole === 'client') {
      navigate('/dashboard', { replace: true });
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

    if (canSeeAll) {
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, sales_role, sales_level, parent_id')
        .not('sales_role', 'is', null)
        .neq('user_id', user.id)
        .or('is_deleted.is.null,is_deleted.eq.false')
        .eq('is_approved', true);

      downlineData = (allProfiles || []).map((p: any) => ({
        user_id: p.user_id,
        full_name: p.full_name,
        sales_role: p.sales_role,
        sales_level: p.sales_level,
        parent_id: p.parent_id,
        depth: p.sales_level || 0,
      })) as DownlineMember[];
    } else if (isDMUser) {
      const { data: safeProfiles } = await supabase.rpc('get_manager_subtree_profiles', {
        _manager_id: user.id,
      });

      downlineData = (safeProfiles || [])
        .filter((p: any) => p.user_id !== user.id && p.sales_role)
        .map((p: any) => ({
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
      const invQuery = canSeeAll
        ? supabase.from('client_investments').select('*').order('start_date', { ascending: false }).limit(100)
        : supabase.rpc('get_manager_subtree_investment_summaries', { _manager_id: user.id });

      const { data: invData } = await invQuery;
      setDownlineInvestments((invData || []) as Investment[]);
    }

    // Fetch profiles for name resolution
    const allIds = [user.id, ...downlineIds];
    if (canSeeAll) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, sales_role');
      setProfiles((profileData || []) as Profile[]);
    } else {
      const { data: profileData } = await supabase
        .rpc('get_manager_subtree_profiles', { _manager_id: user.id });
      const safeProfiles = (profileData || []).filter((p: any) => allIds.includes(p.user_id));
      setProfiles(safeProfiles.map((p: any) => ({
        user_id: p.user_id,
        full_name: p.full_name,
        email: '',
        sales_role: p.sales_role,
      })) as Profile[]);
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
    (s, inv) => s + (Number(inv.investment_amount) || 0),
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

    // Helper: convert amount to USD and KRW
    const toUsdExcel = (amt: number, cur?: string | null) => {
      const src = cur || 'USD';
      return src === 'KRW' ? amt / usdKrwRate : amt;
    };
    const toKrwExcel = (amt: number, cur?: string | null) => {
      const src = cur || 'USD';
      return src === 'USD' ? amt * usdKrwRate : amt;
    };
    const fxNote = `${language === 'ko' ? '적용 환율' : 'FX Rate'}: 1 USD = ${usdKrwRate.toLocaleString()} KRW`;

    // Build investment_id -> product name map
    const invProductMap: Record<string, string> = {};
    downlineInvestments.forEach((inv) => {
      invProductMap[inv.id] = language === 'ko' ? inv.product_name_ko : inv.product_name_en;
    });

    ws.columns = [
      { header: language === 'ko' ? '수령자' : 'Recipient', key: 'recipient', width: 20 },
      { header: language === 'ko' ? '투자자' : 'Investor', key: 'investor', width: 20 },
      { header: language === 'ko' ? '상품명' : 'Product', key: 'product', width: 28 },
      { header: language === 'ko' ? '레이어' : 'Layer', key: 'layer', width: 10 },
      { header: language === 'ko' ? '선취 커미션' : 'Upfront', key: 'upfront', width: 18 },
      { header: language === 'ko' ? '성과 커미션' : 'Performance', key: 'performance', width: 18 },
      { header: language === 'ko' ? '합계' : 'Total', key: 'total', width: 18 },
      { header: language === 'ko' ? '합계(USD)' : 'Total(USD)', key: 'totalUsd', width: 18 },
      { header: language === 'ko' ? '합계(KRW)' : 'Total(KRW)', key: 'totalKrw', width: 18 },
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
      const total = upfront + perf;
      ws.addRow({
        recipient: getName(c.to_user_id),
        investor: c.from_user_id ? getName(c.from_user_id) : '—',
        product: invProductMap[c.investment_id] || '—',
        layer: c.layer,
        upfront,
        performance: perf,
        total,
        totalUsd: Math.round(toUsdExcel(total, c.currency) * 100) / 100,
        totalKrw: Math.round(toKrwExcel(total, c.currency)),
        rate: c.rate_used ? `${c.rate_used}%` : '—',
        currency: c.currency || 'USD',
        status: c.status,
        date: format(new Date(c.created_at), 'yyyy-MM-dd'),
      });
    });

    // Summary row
    const totalUp = filteredCommissions.reduce((s, c) => s + (Number(c.upfront_amount) || 0), 0);
    const totalPerf = filteredCommissions.reduce((s, c) => s + (Number(c.performance_amount) || 0), 0);
    const totalUsdSum = filteredCommissions.reduce((s, c) => s + toUsdExcel((Number(c.upfront_amount) || 0) + (Number(c.performance_amount) || 0), c.currency), 0);
    const totalKrwSum = filteredCommissions.reduce((s, c) => s + toKrwExcel((Number(c.upfront_amount) || 0) + (Number(c.performance_amount) || 0), c.currency), 0);
    const summaryRow = ws.addRow({
      investor: language === 'ko' ? '합계' : 'TOTAL',
      upfront: totalUp,
      performance: totalPerf,
      total: totalUp + totalPerf,
      totalUsd: Math.round(totalUsdSum * 100) / 100,
      totalKrw: Math.round(totalKrwSum),
    });
    summaryRow.font = { bold: true };
    // FX note row
    ws.addRow({});
    ws.addRow({ recipient: fxNote });

    // --- Sheet 2: Member Summary ---
    const wsMember = wb.addWorksheet(language === 'ko' ? '멤버별 요약' : 'By Member');
    wsMember.columns = [
      { header: language === 'ko' ? '이름' : 'Name', key: 'name', width: 22 },
      { header: language === 'ko' ? '역할' : 'Role', key: 'role', width: 18 },
      { header: language === 'ko' ? '건수' : 'Count', key: 'count', width: 10 },
      { header: language === 'ko' ? '선취 합계' : 'Upfront Total', key: 'upfront', width: 18 },
      { header: language === 'ko' ? '성과 합계' : 'Perf Total', key: 'performance', width: 18 },
      { header: language === 'ko' ? '합계' : 'Total', key: 'total', width: 18 },
      { header: language === 'ko' ? '합계(USD)' : 'Total(USD)', key: 'totalUsd', width: 18 },
      { header: language === 'ko' ? '합계(KRW)' : 'Total(KRW)', key: 'totalKrw', width: 18 },
    ];
    wsMember.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    wsMember.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1A2E' } };

    const memberAggExcel: Record<string, { upfront: number; performance: number; upfrontUsd: number; perfUsd: number; upfrontKrw: number; perfKrw: number; count: number; role: string }> = {};
    const profileRoleMapExcel: Record<string, string> = {};
    profiles.forEach((p) => { profileRoleMapExcel[p.user_id] = p.sales_role || 'client'; });
    if (user && userRole) profileRoleMapExcel[user.id] = userRole;

    filteredCommissions.forEach((c) => {
      if (!memberAggExcel[c.to_user_id]) {
        memberAggExcel[c.to_user_id] = { upfront: 0, performance: 0, upfrontUsd: 0, perfUsd: 0, upfrontKrw: 0, perfKrw: 0, count: 0, role: profileRoleMapExcel[c.to_user_id] || 'client' };
      }
      const up = Number(c.upfront_amount) || 0;
      const pf = Number(c.performance_amount) || 0;
      memberAggExcel[c.to_user_id].upfront += up;
      memberAggExcel[c.to_user_id].performance += pf;
      memberAggExcel[c.to_user_id].upfrontUsd += toUsdExcel(up, c.currency);
      memberAggExcel[c.to_user_id].perfUsd += toUsdExcel(pf, c.currency);
      memberAggExcel[c.to_user_id].upfrontKrw += toKrwExcel(up, c.currency);
      memberAggExcel[c.to_user_id].perfKrw += toKrwExcel(pf, c.currency);
      memberAggExcel[c.to_user_id].count++;
    });

    const ROLE_SORT: Record<string, number> = { webmaster: 0, district_manager: 1, deputy_district_manager: 2, principal_agent: 3, agent: 4, client: 5 };
    Object.entries(memberAggExcel)
      .sort((a, b) => (ROLE_SORT[a[1].role] ?? 99) - (ROLE_SORT[b[1].role] ?? 99))
      .forEach(([userId, agg]) => {
        wsMember.addRow({
          name: getName(userId),
          role: getRoleLabel(agg.role),
          count: agg.count,
          upfront: agg.upfront,
          performance: agg.performance,
          total: agg.upfront + agg.performance,
          totalUsd: Math.round((agg.upfrontUsd + agg.perfUsd) * 100) / 100,
          totalKrw: Math.round(agg.upfrontKrw + agg.perfKrw),
        });
      });
    const mTotalUsd = Object.values(memberAggExcel).reduce((s, a) => s + a.upfrontUsd + a.perfUsd, 0);
    const mTotalKrw = Object.values(memberAggExcel).reduce((s, a) => s + a.upfrontKrw + a.perfKrw, 0);
    const memberTotalRow = wsMember.addRow({
      name: language === 'ko' ? '합계' : 'TOTAL',
      upfront: Object.values(memberAggExcel).reduce((s, a) => s + a.upfront, 0),
      performance: Object.values(memberAggExcel).reduce((s, a) => s + a.performance, 0),
      total: Object.values(memberAggExcel).reduce((s, a) => s + a.upfront + a.performance, 0),
      totalUsd: Math.round(mTotalUsd * 100) / 100,
      totalKrw: Math.round(mTotalKrw),
    });
    memberTotalRow.font = { bold: true };
    wsMember.addRow({});
    wsMember.addRow({ name: fxNote });

    // --- Sheet 3: Level Summary ---
    const wsLevel = wb.addWorksheet(language === 'ko' ? '레벨별 요약' : 'By Level');
    wsLevel.columns = [
      { header: language === 'ko' ? '레벨' : 'Level', key: 'level', width: 20 },
      { header: language === 'ko' ? '인원' : 'Members', key: 'members', width: 10 },
      { header: language === 'ko' ? '건수' : 'Count', key: 'count', width: 10 },
      { header: language === 'ko' ? '선취 합계' : 'Upfront Total', key: 'upfront', width: 18 },
      { header: language === 'ko' ? '성과 합계' : 'Perf Total', key: 'performance', width: 18 },
      { header: language === 'ko' ? '합계' : 'Total', key: 'total', width: 18 },
      { header: language === 'ko' ? '합계(USD)' : 'Total(USD)', key: 'totalUsd', width: 18 },
      { header: language === 'ko' ? '합계(KRW)' : 'Total(KRW)', key: 'totalKrw', width: 18 },
    ];
    wsLevel.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    wsLevel.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1A2E' } };

    const ROLE_ORDER_EXCEL = ['webmaster', 'district_manager', 'deputy_district_manager', 'principal_agent', 'agent', 'client'];
    const levelAgg: Record<string, { upfront: number; performance: number; upfrontUsd: number; perfUsd: number; upfrontKrw: number; perfKrw: number; count: number; members: Set<string> }> = {};
    ROLE_ORDER_EXCEL.forEach((r) => { levelAgg[r] = { upfront: 0, performance: 0, upfrontUsd: 0, perfUsd: 0, upfrontKrw: 0, perfKrw: 0, count: 0, members: new Set() }; });

    filteredCommissions.forEach((c) => {
      const role = profileRoleMapExcel[c.to_user_id] || 'client';
      if (!levelAgg[role]) levelAgg[role] = { upfront: 0, performance: 0, upfrontUsd: 0, perfUsd: 0, upfrontKrw: 0, perfKrw: 0, count: 0, members: new Set() };
      const up = Number(c.upfront_amount) || 0;
      const pf = Number(c.performance_amount) || 0;
      levelAgg[role].upfront += up;
      levelAgg[role].performance += pf;
      levelAgg[role].upfrontUsd += toUsdExcel(up, c.currency);
      levelAgg[role].perfUsd += toUsdExcel(pf, c.currency);
      levelAgg[role].upfrontKrw += toKrwExcel(up, c.currency);
      levelAgg[role].perfKrw += toKrwExcel(pf, c.currency);
      levelAgg[role].count++;
      levelAgg[role].members.add(c.to_user_id);
    });

    ROLE_ORDER_EXCEL.filter((r) => levelAgg[r]?.count > 0).forEach((role) => {
      const agg = levelAgg[role];
      wsLevel.addRow({
        level: getRoleLabel(role),
        members: agg.members.size,
        count: agg.count,
        upfront: agg.upfront,
        performance: agg.performance,
        total: agg.upfront + agg.performance,
        totalUsd: Math.round((agg.upfrontUsd + agg.perfUsd) * 100) / 100,
        totalKrw: Math.round(agg.upfrontKrw + agg.perfKrw),
      });
    });
    const levelTotalRow = wsLevel.addRow({
      level: language === 'ko' ? '합계' : 'TOTAL',
      count: filteredCommissions.length,
      upfront: totalUp,
      performance: totalPerf,
      total: totalUp + totalPerf,
      totalUsd: Math.round(totalUsdSum * 100) / 100,
      totalKrw: Math.round(totalKrwSum),
    });
    levelTotalRow.font = { bold: true };
    wsLevel.addRow({});
    wsLevel.addRow({ level: fxNote });

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

      <main className="container py-4 sm:py-8 px-3 sm:px-4">
        {/* Header */}
        <div className="mb-4 sm:mb-8 animate-fade-in">
          <div className="flex items-center gap-2 sm:gap-3 mb-1">
            <h1 className="text-xl sm:text-3xl font-serif font-semibold text-foreground">
              {language === 'ko' ? '영업 대시보드' : 'Sales Dashboard'}
            </h1>
            {userRole && (
              <Badge variant={ROLE_COLORS[userRole] as any || 'secondary'} className={`text-[10px] sm:text-xs ${ROLE_EXTRA_CLASS[userRole] || ''}`}>
                {getRoleLabel(userRole)}
              </Badge>
            )}
          </div>
          <p className="text-xs sm:text-base text-muted-foreground">
            {language === 'ko'
              ? `${displayName}님의 영업 현황`
              : `Sales overview for ${displayName}`}
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 mb-4 animate-fade-in" style={{ animationDelay: '50ms' }}>
          <div className="rounded-xl border border-border bg-card p-3 sm:p-5">
            <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-sm text-muted-foreground mb-1 sm:mb-2">
              <Users className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
              <span className="truncate">{language === 'ko' ? '하위 영업인' : 'Downline'}</span>
            </div>
            {loading ? <Skeleton className="h-6 sm:h-8 w-12 sm:w-16" /> : (
              <p className="text-lg sm:text-2xl font-semibold">{downline.length}</p>
            )}
          </div>
          <div className="rounded-xl border border-border bg-card p-3 sm:p-5">
            <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-sm text-muted-foreground mb-1 sm:mb-2">
              <Coins className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
              <span className="truncate">{language === 'ko' 
                ? (canSeeTotalCommissions ? '총 선취' : '내 선취') 
                : (canSeeTotalCommissions ? 'Total Upfront' : 'My Upfront')}</span>
            </div>
            {loading ? <Skeleton className="h-6 sm:h-8 w-16 sm:w-24" /> : (
              <p className="text-base sm:text-2xl font-semibold text-success truncate">{formatCommAmount(totalUpfront)}</p>
            )}
          </div>
          <div className="rounded-xl border border-border bg-card p-3 sm:p-5">
            <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-sm text-muted-foreground mb-1 sm:mb-2">
              <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
              <span className="truncate">{language === 'ko' 
                ? (canSeeTotalCommissions ? '총 성과' : '내 성과') 
                : (canSeeTotalCommissions ? 'Total Perf.' : 'My Perf.')}</span>
            </div>
            {loading ? <Skeleton className="h-6 sm:h-8 w-16 sm:w-24" /> : (
              <p className="text-base sm:text-2xl font-semibold text-success truncate">{formatCommAmount(totalPerformance)}</p>
            )}
          </div>
          <div className="rounded-xl border border-border bg-card p-3 sm:p-5">
            <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-sm text-muted-foreground mb-1 sm:mb-2">
              <Briefcase className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
              <span className="truncate">{language === 'ko' ? '하위 투자 총액' : 'Downline AUM'}</span>
            </div>
            {loading ? <Skeleton className="h-6 sm:h-8 w-16 sm:w-24" /> : (
              <p className="text-base sm:text-2xl font-semibold truncate">{formatCurrency(totalDownlineInvested)}</p>
            )}
          </div>
        </div>

        {/* Commission Status Breakdown */}
        {!loading && commissions.length > 0 && (
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-8 animate-fade-in" style={{ animationDelay: '75ms' }}>
            <div className="rounded-xl border border-border bg-card p-2 sm:p-4 flex items-center gap-2 sm:gap-3">
              <div className="rounded-full bg-muted p-1.5 sm:p-2 shrink-0">
                <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-success" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground">{language === 'ko' ? '지급완료' : 'Paid'}</p>
                <p className="text-sm sm:text-lg font-semibold truncate">{formatCommAmount(paidTotal)}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">{paidCommissions.length}{language === 'ko' ? '건' : ' items'}</p>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-2 sm:p-4 flex items-center gap-2 sm:gap-3">
              <div className="rounded-full bg-muted p-1.5 sm:p-2 shrink-0">
                <Wallet className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground">{language === 'ko' ? '수령 가능' : 'Available'}</p>
                <p className="text-sm sm:text-lg font-semibold truncate">{formatCommAmount(availableTotal)}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">{availableCommissions.length}{language === 'ko' ? '건' : ' items'}</p>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-2 sm:p-4 flex items-center gap-2 sm:gap-3">
              <div className="rounded-full bg-muted p-1.5 sm:p-2 shrink-0">
                <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground">{language === 'ko' ? '대기중' : 'Pending'}</p>
                <p className="text-sm sm:text-lg font-semibold truncate">{formatCommAmount(pendingTotal)}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">{pendingCommissions.length}{language === 'ko' ? '건' : ' items'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="downline" className="space-y-4 sm:space-y-6 animate-fade-in" style={{ animationDelay: '100ms' }}>
          <TabsList className="flex flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="downline" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
              <Users className="h-3 w-3 sm:h-4 sm:w-4" />
              {language === 'ko' ? '조직도' : 'Downline'}
            </TabsTrigger>
            <TabsTrigger value="commissions" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
              <Coins className="h-3 w-3 sm:h-4 sm:w-4" />
              {language === 'ko' ? '커미션' : 'Commissions'}
            </TabsTrigger>
            <TabsTrigger value="rates" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
              <Settings className="h-3 w-3 sm:h-4 sm:w-4" />
              {language === 'ko' ? '수수료' : 'Rates'}
            </TabsTrigger>
            <TabsTrigger value="pipeline" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
              <Briefcase className="h-3 w-3 sm:h-4 sm:w-4" />
              {language === 'ko' ? '파이프라인' : 'Pipeline'}
            </TabsTrigger>
          </TabsList>

          {/* Downline Tree Tab */}
          <TabsContent value="downline">
            {/* Pending Member Approvals */}
            <PendingMemberApprovals onDataChange={fetchAll} />

            <div className="card-elevated">
              <div className="p-3 sm:p-6 border-b border-border flex items-center justify-between">
                <h2 className="text-sm sm:text-lg font-serif font-semibold">
                  {language === 'ko' ? '하위 영업 조직' : 'Sales Organization'}
                </h2>
                {userSalesRole && userSalesRole !== 'client' && (
                  <Button size="sm" onClick={() => setShowAddMember(true)} className="text-[9px] sm:text-xs h-6 sm:h-8 px-2 sm:px-3">
                    <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-0.5 sm:mr-1" />
                    {language === 'ko' ? '멤버 추가' : 'Add Member'}
                  </Button>
                )}
              </div>
              <div className="p-2 sm:p-6">
                {loading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-8 sm:h-12 w-full" />
                    ))}
                  </div>
                ) : downline.length === 0 ? (
                  <div className="text-center py-8 sm:py-12 text-muted-foreground">
                    <Users className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 opacity-40" />
                    <p className="text-xs sm:text-sm">
                      {language === 'ko'
                        ? '하위 영업인이 없습니다'
                        : 'No downline members yet'}
                    </p>
                  </div>
                ) : (() => {
                  // Group downline by role
                  const ROLE_ORDER_LIST = ['webmaster', 'district_manager', 'deputy_district_manager', 'principal_agent', 'agent', 'client'];
                  const byRole: Record<string, DownlineMember[]> = {};
                  downline.forEach((m) => {
                    if (!byRole[m.sales_role]) byRole[m.sales_role] = [];
                    byRole[m.sales_role].push(m);
                  });

                  return (
                    <div className="space-y-1">
                      {/* Self row */}
                      <div className="flex items-center gap-1.5 sm:gap-2 rounded border-2 border-primary/30 bg-primary/5 px-2 sm:px-3 py-1 sm:py-1.5">
                        <Crown className="h-3 w-3 text-primary shrink-0" />
                        <span className="font-semibold text-[10px] sm:text-xs truncate">
                          {profile?.full_name || user?.email}
                        </span>
                        <Badge variant="default" className="text-[7px] sm:text-[10px] h-4 shrink-0 whitespace-nowrap">
                          {(profile as any)?.sales_role ? getRoleLabel((profile as any).sales_role) : 'Admin'}
                        </Badge>
                      </div>

                      {/* Role-grouped table */}
                      {ROLE_ORDER_LIST.filter((r) => byRole[r]?.length).map((role) => (
                        <div key={role}>
                          <div className="flex items-center gap-1.5 mt-2 mb-0.5 px-1">
                            <Badge variant={(ROLE_COLORS[role] as any) || 'secondary'} className={`text-[7px] sm:text-[10px] h-4 whitespace-nowrap ${ROLE_EXTRA_CLASS[role] || ''}`}>
                              {getRoleLabel(role)}
                            </Badge>
                            <span className="text-[9px] sm:text-[11px] text-muted-foreground">
                              ({byRole[role].length})
                            </span>
                          </div>
                          <Table>
                            <TableBody>
                              {byRole[role].map((m) => (
                                <TableRow key={m.user_id} className="h-7 sm:h-8">
                                  <TableCell
                                    className="text-[10px] sm:text-xs py-1 px-2 cursor-pointer hover:text-primary truncate max-w-[160px] sm:max-w-none"
                                    onClick={() => navigate(`/members/${m.user_id}`)}
                                  >
                                    {m.full_name}
                                  </TableCell>
                                  <TableCell className="text-right py-1 px-1 w-[130px] sm:w-[180px]">
                                    <div className="flex items-center justify-end gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-5 w-5 sm:h-6 sm:w-6 p-0"
                                        onClick={(e) => { e.stopPropagation(); setEditMemberId(m.user_id); }}
                                        title={language === 'ko' ? '정보 수정' : 'Edit Info'}
                                      >
                                        <Pencil className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                      </Button>
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
                                          <SelectTrigger className="w-[80px] sm:w-[120px] h-5 sm:h-6 text-[8px] sm:text-[10px] whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                            <UserCog className="h-2.5 w-2.5 mr-0.5 shrink-0" />
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent className="bg-popover z-50">
                                            {isWebmaster && <SelectItem value="webmaster" className="text-xs">{language === 'ko' ? '웹마스터' : 'Webmaster'}</SelectItem>}
                                            {isWebmaster && <SelectItem value="district_manager" className="text-xs">{language === 'ko' ? '총괄관리' : 'General Manager'}</SelectItem>}
                                            {isDM && <SelectItem value="deputy_district_manager" className="text-xs">{language === 'ko' ? '부총괄' : 'Deputy GM'}</SelectItem>}
                                            <SelectItem value="principal_agent" className="text-xs">{language === 'ko' ? '수석' : 'Principal'}</SelectItem>
                                            <SelectItem value="agent" className="text-xs">{language === 'ko' ? '에이전트' : 'Agent'}</SelectItem>
                                            <SelectItem value="client" className="text-xs">{language === 'ko' ? '고객' : 'Client'}</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ))}
                    </div>
                  );
                })()
                }
              </div>
            </div>

            {/* Investment & Commission Manager below org tree */}
            <SalesInvestmentManager downline={downline} onDataChange={fetchAll} />
          </TabsContent>

          {/* Commissions Tab */}
          <TabsContent value="commissions">
            {/* Level-by-level commission summary */}
            {!loading && commissions.length > 0 && (() => {
              // Group commissions by to_user_id, then aggregate per role
              const ROLE_ORDER = ['webmaster', 'district_manager', 'deputy_district_manager', 'principal_agent', 'agent', 'client'];
              
              // Build role map from profiles
              const profileRoleMap: Record<string, string> = {};
              profiles.forEach((p) => { profileRoleMap[p.user_id] = p.sales_role || 'client'; });
              if (user && userRole) profileRoleMap[user.id] = userRole;

              // Aggregate by role level
              const roleAgg: Record<string, { upfront: number; performance: number; count: number; members: Set<string> }> = {};
              ROLE_ORDER.forEach((r) => { roleAgg[r] = { upfront: 0, performance: 0, count: 0, members: new Set() }; });

              commissions.forEach((c) => {
                const role = profileRoleMap[c.to_user_id] || 'client';
                if (!roleAgg[role]) roleAgg[role] = { upfront: 0, performance: 0, count: 0, members: new Set() };
                roleAgg[role].upfront += toUsd(Number(c.upfront_amount) || 0, c.currency);
                roleAgg[role].performance += toUsd(Number(c.performance_amount) || 0, c.currency);
                roleAgg[role].count++;
                roleAgg[role].members.add(c.to_user_id);
              });

              return (
                <div className="card-elevated mb-4">
                  <div className="p-3 sm:p-6 border-b border-border">
                    <h2 className="text-sm sm:text-lg font-serif font-semibold">
                      {language === 'ko' ? '레벨별 수수료 현황' : 'Commission by Level'}
                    </h2>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[10px] sm:text-xs">{language === 'ko' ? '레벨' : 'Level'}</TableHead>
                          <TableHead className="text-[10px] sm:text-xs text-center">{language === 'ko' ? '인원' : 'Members'}</TableHead>
                          <TableHead className="text-[10px] sm:text-xs text-center">{language === 'ko' ? '건수' : 'Count'}</TableHead>
                          <TableHead className="text-right text-[10px] sm:text-xs">{language === 'ko' ? '선취 합계' : 'Upfront Total'}</TableHead>
                          <TableHead className="text-right text-[10px] sm:text-xs">{language === 'ko' ? '성과 합계' : 'Perf Total'}</TableHead>
                          <TableHead className="text-right text-[10px] sm:text-xs">{language === 'ko' ? '합계' : 'Total'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ROLE_ORDER.filter((r) => roleAgg[r]?.count > 0).map((role) => {
                          const agg = roleAgg[role];
                          return (
                            <TableRow key={role}>
                              <TableCell>
                                <Badge variant="outline" className="text-[8px] sm:text-xs whitespace-nowrap">
                                  {getRoleLabel(role)}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center text-[10px] sm:text-sm">{agg.members.size}</TableCell>
                              <TableCell className="text-center text-[10px] sm:text-sm">{agg.count}</TableCell>
                              <TableCell className="text-right text-[10px] sm:text-sm font-mono text-success whitespace-nowrap">
                                {formatCommAmount(agg.upfront)}
                              </TableCell>
                              <TableCell className="text-right text-[10px] sm:text-sm font-mono text-success whitespace-nowrap">
                                {formatCommAmount(agg.performance)}
                              </TableCell>
                              <TableCell className="text-right text-[10px] sm:text-sm font-semibold font-mono whitespace-nowrap">
                                {formatCommAmount(agg.upfront + agg.performance)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {/* Grand total */}
                        <TableRow className="bg-muted/30 font-semibold border-t-2">
                          <TableCell className="text-[10px] sm:text-sm">{language === 'ko' ? '합계' : 'Total'}</TableCell>
                          <TableCell />
                          <TableCell className="text-center text-[10px] sm:text-sm">{commissions.length}</TableCell>
                          <TableCell className="text-right text-[10px] sm:text-sm font-mono whitespace-nowrap">{formatCommAmount(totalUpfront)}</TableCell>
                          <TableCell className="text-right text-[10px] sm:text-sm font-mono whitespace-nowrap">{formatCommAmount(totalPerformance)}</TableCell>
                          <TableCell className="text-right text-[10px] sm:text-sm font-mono whitespace-nowrap">{formatCommAmount(totalUpfront + totalPerformance)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              );
            })()}

            {/* Per-member commission breakdown */}
            {!loading && commissions.length > 0 && (() => {
              // Aggregate commissions per member
              const memberAgg: Record<string, { upfront: number; performance: number; count: number; role: string }> = {};
              const profileRoleMap: Record<string, string> = {};
              profiles.forEach((p) => { profileRoleMap[p.user_id] = p.sales_role || 'client'; });
              if (user && userRole) profileRoleMap[user.id] = userRole;

              commissions.forEach((c) => {
                if (!memberAgg[c.to_user_id]) {
                  memberAgg[c.to_user_id] = { upfront: 0, performance: 0, count: 0, role: profileRoleMap[c.to_user_id] || 'client' };
                }
                memberAgg[c.to_user_id].upfront += toUsd(Number(c.upfront_amount) || 0, c.currency);
                memberAgg[c.to_user_id].performance += toUsd(Number(c.performance_amount) || 0, c.currency);
                memberAgg[c.to_user_id].count++;
              });

              const ROLE_LEVELS_ORDER: Record<string, number> = {
                webmaster: 0, district_manager: 1, deputy_district_manager: 2,
                principal_agent: 3, agent: 4, client: 5,
              };

              const sortedMembers = Object.entries(memberAgg).sort((a, b) => {
                const lvlA = ROLE_LEVELS_ORDER[a[1].role] ?? 99;
                const lvlB = ROLE_LEVELS_ORDER[b[1].role] ?? 99;
                if (lvlA !== lvlB) return lvlA - lvlB;
                return (b[1].upfront + b[1].performance) - (a[1].upfront + a[1].performance);
              });

              return (
                <div className="card-elevated mb-4">
                  <div className="p-3 sm:p-6 border-b border-border">
                    <h2 className="text-sm sm:text-lg font-serif font-semibold">
                      {language === 'ko' ? '멤버별 수수료 현황' : 'Commission by Member'}
                    </h2>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[10px] sm:text-xs">{language === 'ko' ? '이름' : 'Name'}</TableHead>
                          <TableHead className="text-[10px] sm:text-xs">{language === 'ko' ? '역할' : 'Role'}</TableHead>
                          <TableHead className="text-center text-[10px] sm:text-xs">{language === 'ko' ? '건수' : 'Count'}</TableHead>
                          <TableHead className="text-right text-[10px] sm:text-xs">{language === 'ko' ? '선취' : 'Upfront'}</TableHead>
                          <TableHead className="text-right text-[10px] sm:text-xs">{language === 'ko' ? '성과' : 'Perf'}</TableHead>
                          <TableHead className="text-right text-[10px] sm:text-xs">{language === 'ko' ? '합계' : 'Total'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedMembers.map(([userId, agg]) => {
                          const isSelf = userId === user?.id;
                          return (
                            <TableRow key={userId} className={isSelf ? 'bg-primary/5' : ''}>
                              <TableCell className="text-[10px] sm:text-sm font-medium whitespace-nowrap">
                                {getName(userId)}
                                {isSelf && <span className="text-[8px] sm:text-xs text-primary ml-1">({language === 'ko' ? '나' : 'Me'})</span>}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-[8px] sm:text-xs whitespace-nowrap">
                                  {getRoleLabel(agg.role)}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center text-[10px] sm:text-sm">{agg.count}</TableCell>
                              <TableCell className="text-right text-[10px] sm:text-sm font-mono text-success whitespace-nowrap">
                                {formatCommAmount(agg.upfront)}
                              </TableCell>
                              <TableCell className="text-right text-[10px] sm:text-sm font-mono text-success whitespace-nowrap">
                                {formatCommAmount(agg.performance)}
                              </TableCell>
                              <TableCell className="text-right text-[10px] sm:text-sm font-semibold font-mono whitespace-nowrap">
                                {formatCommAmount(agg.upfront + agg.performance)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              );
            })()}

            {/* Commission Detail History */}
            <div className="card-elevated">
              <div className="p-3 sm:p-6 border-b border-border space-y-2 sm:space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm sm:text-lg font-serif font-semibold">
                    {language === 'ko' ? '커미션 상세 내역' : 'Commission Detail History'}
                  </h2>
                  <Button size="sm" variant="outline" onClick={exportToExcel} disabled={filteredCommissions.length === 0} className="text-[9px] sm:text-xs h-6 sm:h-8 px-2 sm:px-3">
                    <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-0.5 sm:mr-1" />
                    {language === 'ko' ? 'Excel' : 'Export'}
                  </Button>
                </div>
                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[100px] sm:w-[140px] h-7 sm:h-9 text-[10px] sm:text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs sm:text-sm">{language === 'ko' ? '전체 상태' : 'All Status'}</SelectItem>
                      <SelectItem value="pending" className="text-xs sm:text-sm">{language === 'ko' ? '대기' : 'Pending'}</SelectItem>
                      <SelectItem value="available" className="text-xs sm:text-sm">{language === 'ko' ? '수령가능' : 'Available'}</SelectItem>
                      <SelectItem value="paid" className="text-xs sm:text-sm">{language === 'ko' ? '지급완료' : 'Paid'}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal text-[10px] sm:text-xs h-7 sm:h-9 px-2 sm:px-3", !dateFrom && "text-muted-foreground")}>
                        <CalendarIcon className="h-3 w-3 sm:h-4 sm:w-4 mr-0.5 sm:mr-1" />
                        {dateFrom ? format(dateFrom, 'yyyy-MM-dd') : (language === 'ko' ? '시작일' : 'From')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} className={cn("p-3 pointer-events-auto")} />
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal text-[10px] sm:text-xs h-7 sm:h-9 px-2 sm:px-3", !dateTo && "text-muted-foreground")}>
                        <CalendarIcon className="h-3 w-3 sm:h-4 sm:w-4 mr-0.5 sm:mr-1" />
                        {dateTo ? format(dateTo, 'yyyy-MM-dd') : (language === 'ko' ? '종료일' : 'To')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={dateTo} onSelect={setDateTo} className={cn("p-3 pointer-events-auto")} />
                    </PopoverContent>
                  </Popover>
                  {(dateFrom || dateTo || statusFilter !== 'all') && (
                    <Button variant="ghost" size="sm" onClick={() => { setDateFrom(undefined); setDateTo(undefined); setStatusFilter('all'); }} className="text-[10px] sm:text-xs h-7 sm:h-9">
                      {language === 'ko' ? '초기화' : 'Clear'}
                    </Button>
                  )}
                  <span className="text-[10px] sm:text-xs text-muted-foreground ml-auto">
                    {filteredCommissions.length}{language === 'ko' ? '건' : ' records'}
                  </span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px] sm:text-xs">{language === 'ko' ? '수령자' : 'Recipient'}</TableHead>
                      <TableHead className="text-[10px] sm:text-xs">{language === 'ko' ? '투자자' : 'Investor'}</TableHead>
                      <TableHead className="text-[10px] sm:text-xs hidden sm:table-cell">{language === 'ko' ? '상품명' : 'Product'}</TableHead>
                      <TableHead className="text-[10px] sm:text-xs">{language === 'ko' ? '레이어' : 'Layer'}</TableHead>
                      <TableHead className="text-right text-[10px] sm:text-xs">{language === 'ko' ? '선취' : 'Upfront'}</TableHead>
                      <TableHead className="text-right text-[10px] sm:text-xs">{language === 'ko' ? '성과' : 'Perf'}</TableHead>
                      <TableHead className="text-[10px] sm:text-xs hidden sm:table-cell">{language === 'ko' ? '적용률' : 'Rate'}</TableHead>
                      <TableHead className="text-[10px] sm:text-xs">{language === 'ko' ? '상태' : 'Status'}</TableHead>
                      <TableHead className="text-[10px] sm:text-xs hidden md:table-cell">{language === 'ko' ? '일자' : 'Date'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 9 }).map((_, j) => (
                            <TableCell key={j}>
                              <Skeleton className="h-4 sm:h-5 w-14 sm:w-20" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : filteredCommissions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-6 sm:py-8 text-muted-foreground text-[10px] sm:text-sm">
                          {language === 'ko' ? '커미션 내역이 없습니다' : 'No commissions found'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredCommissions.map((c) => {
                        const isSelf = c.to_user_id === user?.id;
                        return (
                          <TableRow key={c.id} className={isSelf ? 'bg-primary/5' : ''}>
                            <TableCell className="font-medium text-[10px] sm:text-sm whitespace-nowrap">
                              {getName(c.to_user_id)}
                              {isSelf && <span className="text-[8px] sm:text-xs text-primary ml-1">★</span>}
                            </TableCell>
                            <TableCell className="text-[10px] sm:text-sm whitespace-nowrap">
                              {c.from_user_id ? getName(c.from_user_id) : '—'}
                            </TableCell>
                            <TableCell className="text-[10px] sm:text-sm hidden sm:table-cell max-w-[120px] truncate">
                              {(() => {
                                const inv = downlineInvestments.find((i) => i.id === c.investment_id);
                                if (!inv) return '—';
                                return language === 'ko' ? inv.product_name_ko : inv.product_name_en;
                              })()}
                            </TableCell>
                            <TableCell className="text-[10px] sm:text-sm">{c.layer}</TableCell>
                            <TableCell className="text-right text-[10px] sm:text-sm">
                              {c.upfront_amount ? (
                                <span className="text-success font-medium whitespace-nowrap">+{formatCommAmount(Number(c.upfront_amount), c.currency)}</span>
                              ) : '—'}
                            </TableCell>
                            <TableCell className="text-right text-[10px] sm:text-sm">
                              {c.performance_amount ? (
                                <span className="text-success font-medium whitespace-nowrap">+{formatCommAmount(Number(c.performance_amount), c.currency)}</span>
                              ) : '—'}
                            </TableCell>
                            <TableCell className="text-[10px] sm:text-sm hidden sm:table-cell">{c.rate_used ? `${c.rate_used}%` : '—'}</TableCell>
                            <TableCell>
                              <Badge variant={c.status === 'available' ? 'default' : c.status === 'paid' ? 'outline' : 'secondary'} className="text-[8px] sm:text-xs whitespace-nowrap">
                                {c.status === 'pending' ? (language === 'ko' ? '대기' : 'Pending')
                                  : c.status === 'available' ? (language === 'ko' ? '수령가능' : 'Available')
                                  : c.status === 'paid' ? (language === 'ko' ? '지급완료' : 'Paid')
                                  : c.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-[10px] sm:text-sm text-muted-foreground hidden md:table-cell">
                              {formatDate(c.created_at)}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          {/* Commission Rate Settings Tab */}
          <TabsContent value="rates">
            <div className="card-elevated p-3 sm:p-6">
              <SalesCommissionRates downline={downline} />
            </div>
          </TabsContent>

          {/* Investment Pipeline Tab */}
          <TabsContent value="pipeline">
            <div className="card-elevated">
              <div className="p-3 sm:p-6 border-b border-border flex items-center justify-between gap-2">
                <h2 className="text-xs sm:text-lg font-serif font-semibold truncate">
                  {language === 'ko'
                    ? '하위 조직 투자 현황'
                    : 'Downline Investment Pipeline'}
                </h2>
                {downline.length > 0 && (
                  <Button size="sm" onClick={() => setShowCreateInvestment(true)} className="text-[9px] sm:text-xs h-6 sm:h-8 px-2 sm:px-3 shrink-0">
                    <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-0.5 sm:mr-1" />
                    {language === 'ko' ? '등록' : 'New'}
                  </Button>
                )}
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px] sm:text-xs">
                        {language === 'ko' ? '투자자' : 'Investor'}
                      </TableHead>
                      <TableHead className="text-[10px] sm:text-xs">
                        {language === 'ko' ? '상품' : 'Product'}
                      </TableHead>
                      <TableHead className="text-[10px] sm:text-xs">
                        {language === 'ko' ? '투자금액' : 'Amount'}
                      </TableHead>
                      <TableHead className="text-[10px] sm:text-xs hidden sm:table-cell">
                        {language === 'ko' ? '현재가치' : 'Current'}
                      </TableHead>
                      <TableHead className="text-[10px] sm:text-xs">
                        {language === 'ko' ? '상태' : 'Status'}
                      </TableHead>
                      <TableHead className="text-[10px] sm:text-xs hidden md:table-cell">
                        {language === 'ko' ? '시작일' : 'Start'}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 6 }).map((_, j) => (
                            <TableCell key={j}>
                              <Skeleton className="h-4 sm:h-5 w-14 sm:w-20" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : downlineInvestments.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center py-6 sm:py-8 text-muted-foreground text-[10px] sm:text-sm"
                        >
                          {language === 'ko'
                            ? '하위 조직 투자가 없습니다'
                            : 'No downline investments yet'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      downlineInvestments.map((inv) => (
                        <TableRow key={inv.id}>
                          <TableCell className="font-medium text-[10px] sm:text-sm whitespace-nowrap">
                            {getName(inv.user_id)}
                          </TableCell>
                          <TableCell className="text-[10px] sm:text-sm max-w-[80px] sm:max-w-none truncate">
                            {language === 'ko'
                              ? inv.product_name_ko
                              : inv.product_name_en}
                          </TableCell>
                          <TableCell className="text-[10px] sm:text-sm whitespace-nowrap">
                            {formatCurrency(inv.investment_amount)}
                          </TableCell>
                          <TableCell className="text-[10px] sm:text-sm hidden sm:table-cell">
                            {formatCurrency(inv.current_value)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                inv.status === 'active'
                                  ? 'default'
                                  : 'secondary'
                              }
                              className="text-[8px] sm:text-xs whitespace-nowrap"
                            >
                              {inv.status || 'active'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-[10px] sm:text-sm text-muted-foreground hidden md:table-cell">
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

        <AddMemberDialog
          open={showAddMember}
          onOpenChange={setShowAddMember}
          onSuccess={fetchAll}
        />

        <EditMemberDialog
          open={!!editMemberId}
          onOpenChange={(open) => { if (!open) setEditMemberId(null); }}
          userId={editMemberId}
          onSuccess={fetchAll}
        />

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
