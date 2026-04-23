import React, { useState, useEffect, useMemo } from 'react';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Search, Coins, History, RefreshCw, Settings, Plus, Pencil, Trash2, UserCog, Download, CalendarIcon, FileSpreadsheet, CheckSquare, Users, ChevronRight, Save, X, Loader2, ArrowDownUp, Eye } from 'lucide-react';
import { MemberLink } from '@/components/MemberLink';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { format } from 'date-fns';
import ExcelJS from 'exceljs';
import {
  COMMISSION_ROLES,
  CommissionDirection,
  CommissionRole,
  ProductCommissionConfig,
  buildProductCommissionConfig,
  computeCommissionPreview,
  DEFAULT_DIRECTION_PRESETS,
  deriveRatiosFromAbsoluteRates,
} from '@/lib/commission-defaults';
import { formatCommissionAmount } from '@/lib/commission-format';

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
  default_currency?: string | null;
  upfront_commission_percent?: number | null;
  performance_fee_percent?: number | null;
}

interface CommissionPreviewInput {
  investmentAmount: string;
  realizedReturnAmount: string;
  notes: string;
}

const ROLE_LABELS: Record<string, Record<string, string>> = {
  ko: { district_manager: '총괄관리', deputy_district_manager: '부총괄관리', principal_agent: '수석 에이전트', agent: '에이전트', client: '고객' },
  en: { district_manager: 'General Manager', deputy_district_manager: 'Deputy GM', principal_agent: 'Principal Agent', agent: 'Agent', client: 'Client' },
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'secondary',
  available: 'default',
  paid: 'outline',
  cancelled: 'destructive',
};

const SALES_ROLES = ['district_manager', 'deputy_district_manager', 'principal_agent', 'agent'] as const;
const ROLE_LEVELS: Record<string, number> = { district_manager: 1, deputy_district_manager: 2, principal_agent: 3, agent: 4 };
const ROLE_SEQUENCE = COMMISSION_ROLES as readonly CommissionRole[];

// Reports sub-component
function AdminCommissionReports({
  distributions,
  profiles,
  language,
  formatCurrency,
  formatDate: formatDateFn,
  getName,
  getRole,
  loading,
}: {
  distributions: Distribution[];
  profiles: Profile[];
  language: string;
  formatCurrency: (v: number) => string;
  formatDate: (v: string) => string;
  getName: (id: string) => string;
  getRole: (id: string) => string | null;
  loading: boolean;
}) {
  const [reportDateFrom, setReportDateFrom] = useState<Date | undefined>(undefined);
  const [reportDateTo, setReportDateTo] = useState<Date | undefined>(undefined);
  const [reportStatus, setReportStatus] = useState('all');
  const [reportUser, setReportUser] = useState('all');

  const salesUsers = profiles.filter(p => p.sales_role && p.sales_role !== 'client');

  const filtered = useMemo(() => {
    return distributions.filter((d) => {
      if (reportStatus !== 'all' && d.status !== reportStatus) return false;
      if (reportUser !== 'all' && d.to_user_id !== reportUser) return false;
      if (reportDateFrom && new Date(d.created_at) < reportDateFrom) return false;
      if (reportDateTo) {
        const end = new Date(reportDateTo);
        end.setHours(23, 59, 59, 999);
        if (new Date(d.created_at) > end) return false;
      }
      return true;
    });
  }, [distributions, reportStatus, reportUser, reportDateFrom, reportDateTo]);

  const userSummary = useMemo(() => {
    const map: Record<string, { upfront: number; performance: number; count: number; name: string; role: string | null }> = {};
    filtered.forEach((d) => {
      if (!map[d.to_user_id]) {
        map[d.to_user_id] = { upfront: 0, performance: 0, count: 0, name: getName(d.to_user_id), role: getRole(d.to_user_id) };
      }
      map[d.to_user_id].upfront += Number(d.upfront_amount) || 0;
      map[d.to_user_id].performance += Number(d.performance_amount) || 0;
      map[d.to_user_id].count++;
    });
    return Object.entries(map).sort((a, b) => (b[1].upfront + b[1].performance) - (a[1].upfront + a[1].performance));
  }, [filtered]);

  const grandTotalUpfront = filtered.reduce((s, d) => s + (Number(d.upfront_amount) || 0), 0);
  const grandTotalPerf = filtered.reduce((s, d) => s + (Number(d.performance_amount) || 0), 0);

  const exportReport = async () => {
    const wb = new ExcelJS.Workbook();
    const summarySheet = wb.addWorksheet(language === 'ko' ? '요약' : 'Summary');
    summarySheet.columns = [
      { header: language === 'ko' ? '영업사원' : 'Sales Person', key: 'name', width: 25 },
      { header: language === 'ko' ? '역할' : 'Role', key: 'role', width: 18 },
      { header: language === 'ko' ? '건수' : 'Count', key: 'count', width: 10 },
      { header: language === 'ko' ? '선취 합계' : 'Upfront Total', key: 'upfront', width: 18 },
      { header: language === 'ko' ? '성과 합계' : 'Performance Total', key: 'performance', width: 18 },
      { header: language === 'ko' ? '총 합계' : 'Grand Total', key: 'total', width: 18 },
    ];
    summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    summarySheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1A2E' } };
    userSummary.forEach(([, s]) => {
      summarySheet.addRow({ name: s.name, role: s.role || '—', count: s.count, upfront: s.upfront, performance: s.performance, total: s.upfront + s.performance });
    });
    const totalRow = summarySheet.addRow({ name: language === 'ko' ? '합계' : 'TOTAL', count: filtered.length, upfront: grandTotalUpfront, performance: grandTotalPerf, total: grandTotalUpfront + grandTotalPerf });
    totalRow.font = { bold: true };

    const detailSheet = wb.addWorksheet(language === 'ko' ? '상세' : 'Details');
    detailSheet.columns = [
      { header: language === 'ko' ? '수취인' : 'Recipient', key: 'recipient', width: 20 },
      { header: language === 'ko' ? '역할' : 'Role', key: 'role', width: 15 },
      { header: language === 'ko' ? '투자자' : 'Investor', key: 'investor', width: 20 },
      { header: language === 'ko' ? '레이어' : 'Layer', key: 'layer', width: 8 },
      { header: language === 'ko' ? '선취' : 'Upfront', key: 'upfront', width: 15 },
      { header: language === 'ko' ? '성과' : 'Performance', key: 'performance', width: 15 },
      { header: language === 'ko' ? '합계' : 'Total', key: 'total', width: 15 },
      { header: language === 'ko' ? '적용률' : 'Rate', key: 'rate', width: 10 },
      { header: language === 'ko' ? '통화' : 'Currency', key: 'currency', width: 8 },
      { header: language === 'ko' ? '상태' : 'Status', key: 'status', width: 12 },
      { header: language === 'ko' ? '일자' : 'Date', key: 'date', width: 14 },
    ];
    detailSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    detailSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1A2E' } };
    filtered.forEach((d) => {
      const up = Number(d.upfront_amount) || 0;
      const perf = Number(d.performance_amount) || 0;
      detailSheet.addRow({
        recipient: getName(d.to_user_id), role: getRole(d.to_user_id) || '—',
        investor: d.from_user_id ? getName(d.from_user_id) : '—', layer: d.layer,
        upfront: up, performance: perf, total: up + perf,
        rate: d.rate_used ? `${d.rate_used}%` : '—', currency: d.currency || 'USD',
        status: d.status, date: format(new Date(d.created_at), 'yyyy-MM-dd'),
      });
    });

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `commission-payout-report-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={reportStatus} onValueChange={setReportStatus}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{language === 'ko' ? '전체 상태' : 'All Status'}</SelectItem>
            <SelectItem value="pending">{language === 'ko' ? '대기' : 'Pending'}</SelectItem>
            <SelectItem value="available">{language === 'ko' ? '수령가능' : 'Available'}</SelectItem>
            <SelectItem value="paid">{language === 'ko' ? '지급완료' : 'Paid'}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={reportUser} onValueChange={setReportUser}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{language === 'ko' ? '전체 영업사원' : 'All Sales Users'}</SelectItem>
            {salesUsers.map((u) => (
              <SelectItem key={u.user_id} value={u.user_id}>{u.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal", !reportDateFrom && "text-muted-foreground")}>
              <CalendarIcon className="h-4 w-4 mr-1" />
              {reportDateFrom ? format(reportDateFrom, 'yyyy-MM-dd') : (language === 'ko' ? '시작일' : 'From')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={reportDateFrom} onSelect={setReportDateFrom} className={cn("p-3 pointer-events-auto")} />
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal", !reportDateTo && "text-muted-foreground")}>
              <CalendarIcon className="h-4 w-4 mr-1" />
              {reportDateTo ? format(reportDateTo, 'yyyy-MM-dd') : (language === 'ko' ? '종료일' : 'To')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={reportDateTo} onSelect={setReportDateTo} className={cn("p-3 pointer-events-auto")} />
          </PopoverContent>
        </Popover>
        {(reportDateFrom || reportDateTo || reportStatus !== 'all' || reportUser !== 'all') && (
          <Button variant="ghost" size="sm" onClick={() => { setReportDateFrom(undefined); setReportDateTo(undefined); setReportStatus('all'); setReportUser('all'); }}>
            {language === 'ko' ? '초기화' : 'Clear'}
          </Button>
        )}
        <div className="ml-auto">
          <Button size="sm" onClick={exportReport} disabled={filtered.length === 0}>
            <Download className="h-4 w-4 mr-1" />
            {language === 'ko' ? 'Excel 다운로드' : 'Export Excel'}
          </Button>
        </div>
      </div>

      <div>
        <h3 className="text-base font-semibold mb-3">
          {language === 'ko' ? '영업사원별 요약' : 'Summary by Sales Person'}
          <span className="text-sm font-normal text-muted-foreground ml-2">({filtered.length}{language === 'ko' ? '건' : ' records'})</span>
        </h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{language === 'ko' ? '영업사원' : 'Sales Person'}</TableHead>
              <TableHead>{language === 'ko' ? '역할' : 'Role'}</TableHead>
              <TableHead>{language === 'ko' ? '건수' : 'Count'}</TableHead>
              <TableHead>{language === 'ko' ? '선취 합계' : 'Upfront'}</TableHead>
              <TableHead>{language === 'ko' ? '성과 합계' : 'Performance'}</TableHead>
              <TableHead>{language === 'ko' ? '총 합계' : 'Total'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-5 w-20" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : userSummary.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  {language === 'ko' ? '데이터가 없습니다' : 'No data found'}
                </TableCell>
              </TableRow>
            ) : (
              <>
                {userSummary.map(([userId, s]) => (
                  <TableRow key={userId}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.role ? <Badge variant="outline" className="text-xs">{s.role}</Badge> : '—'}</TableCell>
                    <TableCell>{s.count}</TableCell>
                    <TableCell className="text-success font-medium">{formatCommissionAmount(s.upfront, language as 'ko' | 'en')}</TableCell>
                    <TableCell className="text-success font-medium">{formatCommissionAmount(s.performance, language as 'ko' | 'en')}</TableCell>
                    <TableCell className="font-semibold">{formatCommissionAmount(s.upfront + s.performance, language as 'ko' | 'en')}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/30 font-semibold">
                  <TableCell>{language === 'ko' ? '합계' : 'TOTAL'}</TableCell>
                  <TableCell />
                  <TableCell>{filtered.length}</TableCell>
                  <TableCell className="text-success">{formatCommissionAmount(grandTotalUpfront, language as 'ko' | 'en')}</TableCell>
                  <TableCell className="text-success">{formatCommissionAmount(grandTotalPerf, language as 'ko' | 'en')}</TableCell>
                  <TableCell>{formatCommissionAmount(grandTotalUpfront + grandTotalPerf, language as 'ko' | 'en')}</TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function AdminCommissions() {
  const { language, formatCurrency, formatDate } = useLanguage();
  const { user } = useAuth();
  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('distributions');
  const [displayCurrency, setDisplayCurrency] = useState<string>('KRW');
  const [savingCurrency, setSavingCurrency] = useState(false);
  const [usdKrwRate, setUsdKrwRate] = useState<number>(1350);

  // Rates state
  const [rates, setRates] = useState<CommissionRate[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [rateDialogOpen, setRateDialogOpen] = useState(false);
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<CommissionRate | null>(null);
  const [rateForm, setRateForm] = useState({ sales_role: 'district_manager', upfront_rate: '0', performance_rate: '0' });
  const [overrideForm, setOverrideForm] = useState({ override_user_id: '', upfront_rate: '0', performance_rate: '0' });
  const [savingProductConfig, setSavingProductConfig] = useState(false);
  const [productConfigs, setProductConfigs] = useState<Record<string, ProductCommissionConfig>>({});
  const [draftConfig, setDraftConfig] = useState<ProductCommissionConfig | null>(null);
  const [previewInput, setPreviewInput] = useState<CommissionPreviewInput>({
    investmentAmount: '100000000',
    realizedReturnAmount: '5000000',
    notes: '',
  });

  useEffect(() => { fetchAll(); }, []);

  // Realtime subscription for commission_distributions
  useEffect(() => {
    const channel = supabase
      .channel('admin-commission-distributions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'commission_distributions' },
        () => { fetchAll(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function fetchAll() {
    setLoading(true);
    const [distRes, auditRes, profilesRes, productsRes, ratesRes, settingsRes, fxRes] = await Promise.all([
      supabase.from('commission_distributions').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('commission_audit_log').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('profiles').select('user_id, full_name, email, sales_role'),
      supabase.from('investment_products').select('id, name_en, name_ko, default_currency, upfront_commission_percent, performance_fee_percent').eq('is_active', true),
      supabase.from('commission_rates').select('*').order('sales_level', { ascending: true }),
      supabase.from('app_settings').select('*').eq('key', 'commission_display_currency').maybeSingle(),
      supabase.from('market_indices').select('current_value').eq('symbol', 'USDKRW=X').maybeSingle(),
    ]);

    if (distRes.data) setDistributions(distRes.data as Distribution[]);
    if (auditRes.data) setAuditLog(auditRes.data as AuditEntry[]);
    if (profilesRes.data) setProfiles(profilesRes.data as Profile[]);
    if (productsRes.data) {
      setProducts(productsRes.data as Product[]);
      if (!selectedProductId && productsRes.data.length > 0) setSelectedProductId(productsRes.data[0].id);
    }
    if (ratesRes.data) setRates(ratesRes.data as CommissionRate[]);
    if (settingsRes.data?.value) {
      const val = typeof settingsRes.data.value === 'string' ? settingsRes.data.value : JSON.stringify(settingsRes.data.value).replace(/"/g, '');
      setDisplayCurrency(val || 'KRW');
    }
    if (fxRes.data?.current_value) setUsdKrwRate(Number(fxRes.data.current_value));

    const productRows = (productsRes.data as Product[]) || [];
    const rateRows = (ratesRes.data as CommissionRate[]) || [];
    const nextConfigs = productRows.reduce<Record<string, ProductCommissionConfig>>((acc, product) => {
      const roleRates = rateRows.filter((rate) => rate.product_id === product.id && !rate.is_override);
      const totalUpfrontRate = Number(product.upfront_commission_percent) || 0;
      const derivedRatios = deriveRatiosFromAbsoluteRates(
        roleRates.reduce<Partial<Record<CommissionRole, number>>>((map, rate) => {
          if (ROLE_SEQUENCE.includes(rate.sales_role as CommissionRole)) {
            map[rate.sales_role as CommissionRole] = Number(rate.upfront_rate) || 0;
          }
          return map;
        }, {}),
        totalUpfrontRate,
      );

      acc[product.id] = buildProductCommissionConfig(null, derivedRatios);
      return acc;
    }, {});
    setProductConfigs(nextConfigs);
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

  const [recalculating, setRecalculating] = useState<Record<string, boolean>>({});
  const [bulkRecalculating, setBulkRecalculating] = useState(false);

  const handleSaveDisplayCurrency = async (newCurrency: string) => {
    setSavingCurrency(true);
    setDisplayCurrency(newCurrency);
    const { error } = await supabase
      .from('app_settings')
      .update({ value: JSON.stringify(newCurrency), updated_at: new Date().toISOString(), updated_by: user?.id })
      .eq('key', 'commission_display_currency');
    if (error) {
      toast.error(language === 'ko' ? '설정 저장 실패' : 'Failed to save setting');
    } else {
      toast.success(language === 'ko' ? '표시 통화 변경됨' : 'Display currency updated');
    }
    setSavingCurrency(false);
  };

  const formatCommAmount = (amount: number, currency?: string | null) => {
    const srcCurrency = currency || 'USD';
    if (displayCurrency === 'USD') {
      const usdAmount = srcCurrency === 'KRW' ? amount / usdKrwRate : amount;
      return `$${usdAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (displayCurrency === 'KRW') {
      const krwAmount = srcCurrency === 'USD' ? amount * usdKrwRate : amount;
      return `₩${krwAmount.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return formatCurrency(amount);
  };

  const getCommissionBreakdownItems = (upfront: number, performance: number) => {
    const normalizedUpfront = Number(upfront) || 0;
    const normalizedPerformance = Number(performance) || 0;
    const total = normalizedUpfront + normalizedPerformance;
    const other = Math.max(0, total - normalizedUpfront - normalizedPerformance);

    const items = [
      {
        key: 'upfront',
        label: language === 'ko' ? '선취' : 'Upfront',
        amount: normalizedUpfront,
      },
      {
        key: 'performance',
        label: language === 'ko' ? '성과' : 'Performance',
        amount: normalizedPerformance,
      },
      {
        key: 'other',
        label: language === 'ko' ? '기타' : 'Other',
        amount: other,
      },
    ];

    return items.map((item) => ({
      ...item,
      ratio: total > 0 ? (item.amount / total) * 100 : 0,
    }));
  };

  const getBreakdownSortRatio = (
    source: { upfront: number; performance: number },
    sortKey: 'upfront' | 'performance' | 'other'
  ) => getCommissionBreakdownItems(source.upfront, source.performance)
    .find((item) => item.key === sortKey)?.ratio ?? 0;

  // Per-person attribution
  const personAttribution = useMemo(() => {
    const map: Record<string, {
      name: string;
      role: string | null;
      totalUpfront: number;
      totalPerformance: number;
      sources: { investorName: string; investmentId: string; upfront: number; performance: number; rate: number | null; currency: string; status: string; date: string }[];
    }> = {};
    distributions.forEach((d) => {
      if (!map[d.to_user_id]) {
        map[d.to_user_id] = {
          name: getName(d.to_user_id),
          role: getRole(d.to_user_id),
          totalUpfront: 0,
          totalPerformance: 0,
          sources: [],
        };
      }
      const up = Number(d.upfront_amount) || 0;
      const perf = Number(d.performance_amount) || 0;
      map[d.to_user_id].totalUpfront += up;
      map[d.to_user_id].totalPerformance += perf;
      map[d.to_user_id].sources.push({
        investorName: d.from_user_id ? getName(d.from_user_id) : '—',
        investmentId: d.investment_id,
        upfront: up,
        performance: perf,
        rate: d.rate_used,
        currency: d.currency || 'USD',
        status: d.status,
        date: d.created_at,
      });
    });
    return Object.entries(map).sort((a, b) => (b[1].totalUpfront + b[1].totalPerformance) - (a[1].totalUpfront + a[1].totalPerformance));
  }, [distributions, profiles]);

  const [expandedPerson, setExpandedPerson] = useState<string | null>(null);
  const [attributionSearchTerm, setAttributionSearchTerm] = useState('');
  const [attributionStatus, setAttributionStatus] = useState('all');
  const [attributionDateFrom, setAttributionDateFrom] = useState<Date | undefined>(undefined);
  const [attributionDateTo, setAttributionDateTo] = useState<Date | undefined>(undefined);
  const [attributionBreakdownSort, setAttributionBreakdownSort] = useState<'upfront' | 'performance' | 'other'>('upfront');

  const filteredPersonAttribution = useMemo(() => {
    const query = attributionSearchTerm.trim().toLowerCase();

    return personAttribution
      .map(([userId, data]) => {
        const filteredSources = data.sources.filter((src) => {
          if (attributionStatus !== 'all' && src.status !== attributionStatus) return false;

          const sourceDate = new Date(src.date);
          if (attributionDateFrom && sourceDate < attributionDateFrom) return false;
          if (attributionDateTo) {
            const end = new Date(attributionDateTo);
            end.setHours(23, 59, 59, 999);
            if (sourceDate > end) return false;
          }

          if (!query) return true;

          const haystack = [
            data.name,
            data.role || '',
            src.investorName,
            src.investmentId,
            src.currency,
            src.status,
          ]
            .join(' ')
            .toLowerCase();

          return haystack.includes(query);
        });

        if (filteredSources.length === 0) return null;

        return [userId, {
          ...data,
          totalUpfront: filteredSources.reduce((sum, src) => sum + src.upfront, 0),
          totalPerformance: filteredSources.reduce((sum, src) => sum + src.performance, 0),
          sources: filteredSources,
        }] as const;
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      .sort((a, b) => (b[1].totalUpfront + b[1].totalPerformance) - (a[1].totalUpfront + a[1].totalPerformance));
  }, [personAttribution, attributionSearchTerm, attributionStatus, attributionDateFrom, attributionDateTo]);

  const exportAttribution = async () => {
    const toDisplay = (amount: number, srcCurrency: string) => {
      if (displayCurrency === 'USD') return srcCurrency === 'KRW' ? amount / usdKrwRate : amount;
      if (displayCurrency === 'KRW') return srcCurrency === 'USD' ? amount * usdKrwRate : amount;
      return amount;
    };
    const dispLabel = displayCurrency === 'KRW' ? '₩' : '$';
    const wb = new ExcelJS.Workbook();

    // Summary sheet with converted totals
    const summarySheet = wb.addWorksheet(language === 'ko' ? '개인별 요약' : 'Attribution Summary');
    summarySheet.columns = [
      { header: language === 'ko' ? '영업사원' : 'Sales Person', key: 'name', width: 25 },
      { header: language === 'ko' ? '역할' : 'Role', key: 'role', width: 18 },
      { header: language === 'ko' ? '선취 (원본)' : 'Upfront (Raw)', key: 'upfront', width: 18 },
      { header: language === 'ko' ? '성과 (원본)' : 'Performance (Raw)', key: 'performance', width: 18 },
      { header: `${language === 'ko' ? '선취' : 'Upfront'} (${dispLabel}${displayCurrency})`, key: 'upfront_conv', width: 20 },
      { header: `${language === 'ko' ? '성과' : 'Performance'} (${dispLabel}${displayCurrency})`, key: 'performance_conv', width: 20 },
      { header: `${language === 'ko' ? '총 합계' : 'Total'} (${dispLabel}${displayCurrency})`, key: 'total_conv', width: 20 },
      { header: language === 'ko' ? '건수' : 'Count', key: 'count', width: 10 },
    ];
    summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    summarySheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1A2E' } };
    filteredPersonAttribution.forEach(([, data]) => {
      // Sum converted amounts per source
      let convUp = 0, convPerf = 0;
      data.sources.forEach((src) => {
        convUp += toDisplay(src.upfront, src.currency);
        convPerf += toDisplay(src.performance, src.currency);
      });
      summarySheet.addRow({
        name: data.name, role: data.role || '—',
        upfront: data.totalUpfront, performance: data.totalPerformance,
        upfront_conv: Math.round(convUp * 100) / 100,
        performance_conv: Math.round(convPerf * 100) / 100,
        total_conv: Math.round((convUp + convPerf) * 100) / 100,
        count: data.sources.length,
      });
    });

    // Detail sheet with converted columns
    const detailSheet = wb.addWorksheet(language === 'ko' ? '귀속 상세' : 'Attribution Detail');
    detailSheet.columns = [
      { header: language === 'ko' ? '수취인' : 'Recipient', key: 'recipient', width: 22 },
      { header: language === 'ko' ? '역할' : 'Role', key: 'role', width: 18 },
      { header: language === 'ko' ? '투자자' : 'Investor', key: 'investor', width: 22 },
      { header: language === 'ko' ? '선취 (원본)' : 'Upfront (Raw)', key: 'upfront', width: 15 },
      { header: language === 'ko' ? '성과 (원본)' : 'Performance (Raw)', key: 'performance', width: 15 },
      { header: language === 'ko' ? '통화' : 'Currency', key: 'currency', width: 8 },
      { header: `${language === 'ko' ? '선취' : 'Upfront'} (${displayCurrency})`, key: 'upfront_conv', width: 18 },
      { header: `${language === 'ko' ? '성과' : 'Perf'} (${displayCurrency})`, key: 'performance_conv', width: 18 },
      { header: `${language === 'ko' ? '합계' : 'Total'} (${displayCurrency})`, key: 'total_conv', width: 18 },
      { header: language === 'ko' ? '상태' : 'Status', key: 'status', width: 12 },
      { header: language === 'ko' ? '일자' : 'Date', key: 'date', width: 14 },
    ];
    detailSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    detailSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1A2E' } };
    filteredPersonAttribution.forEach(([, data]) => {
      data.sources.forEach((src) => {
        const convUp = toDisplay(src.upfront, src.currency);
        const convPerf = toDisplay(src.performance, src.currency);
        detailSheet.addRow({
          recipient: data.name, role: data.role || '—', investor: src.investorName,
          upfront: src.upfront, performance: src.performance, currency: src.currency,
          upfront_conv: Math.round(convUp * 100) / 100,
          performance_conv: Math.round(convPerf * 100) / 100,
          total_conv: Math.round((convUp + convPerf) * 100) / 100,
          status: src.status, date: format(new Date(src.date), 'yyyy-MM-dd'),
        });
      });
    });

    // Exchange rate info sheet
    const fxSheet = wb.addWorksheet(language === 'ko' ? '환율 정보' : 'Exchange Rate');
    fxSheet.columns = [
      { header: language === 'ko' ? '항목' : 'Item', key: 'item', width: 30 },
      { header: language === 'ko' ? '값' : 'Value', key: 'value', width: 25 },
    ];
    fxSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    fxSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1A2E' } };
    fxSheet.addRow({ item: language === 'ko' ? '적용 환율 (USD/KRW)' : 'Applied Rate (USD/KRW)', value: usdKrwRate.toLocaleString() });
    fxSheet.addRow({ item: language === 'ko' ? '표시 통화' : 'Display Currency', value: displayCurrency });
    fxSheet.addRow({ item: language === 'ko' ? '리포트 생성일' : 'Report Date', value: format(new Date(), 'yyyy-MM-dd HH:mm:ss') });
    fxSheet.addRow({ item: language === 'ko' ? '비고' : 'Note', value: language === 'ko' ? '환율은 시장 지수(USDKRW=X) 기준 최신 값입니다' : 'Rate is the latest value from market indices (USDKRW=X)' });

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attribution-report-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRecalculate = async (investmentId: string) => {
    setRecalculating(prev => ({ ...prev, [investmentId]: true }));
    try {
      const { data, error } = await supabase.functions.invoke('calculate-commissions', {
        body: { investment_id: investmentId },
      });
      if (error) throw error;
      toast.success(
        language === 'ko'
          ? `커미션 재계산 완료 (${data?.distributions_created || 0}건)`
          : `Commissions recalculated (${data?.distributions_created || 0} distributions)`
      );
      fetchAll();
    } catch (err: any) {
      toast.error(language === 'ko' ? '재계산 실패' : 'Recalculation failed');
      console.error(err);
    } finally {
      setRecalculating(prev => ({ ...prev, [investmentId]: false }));
    }
  };

  const handleBulkRecalculate = async () => {
    const uniqueInvestmentIds = [...new Set(distributions.map(d => d.investment_id))];
    if (uniqueInvestmentIds.length === 0) return;
    setBulkRecalculating(true);
    let success = 0;
    let failed = 0;
    for (const invId of uniqueInvestmentIds) {
      try {
        const { error } = await supabase.functions.invoke('calculate-commissions', {
          body: { investment_id: invId },
        });
        if (error) throw error;
        success++;
      } catch {
        failed++;
      }
    }
    toast.success(
      language === 'ko'
        ? `재계산 완료: ${success}건 성공, ${failed}건 실패`
        : `Recalculated: ${success} succeeded, ${failed} failed`
    );
    setBulkRecalculating(false);
    fetchAll();
  };

  const openAttributionForDistribution = (distribution: Distribution) => {
    setActiveTab('attribution');
    setAttributionSearchTerm(distribution.investment_id);
    setAttributionStatus('all');
    setAttributionDateFrom(undefined);
    setAttributionDateTo(undefined);
    setExpandedPerson(distribution.to_user_id);
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

  // === Bulk Selection ===
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [editingDistId, setEditingDistId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ upfront: '', performance: '', status: '' });
  const [savingEdit, setSavingEdit] = useState(false);

  const startEditDist = (d: Distribution) => {
    setEditingDistId(d.id);
    setEditForm({
      upfront: String(d.upfront_amount ?? ''),
      performance: String(d.performance_amount ?? ''),
      status: d.status,
    });
  };

  const cancelEditDist = () => { setEditingDistId(null); };

  const saveEditDist = async (d: Distribution) => {
    const upfrontNum = editForm.upfront === '' ? null : Number(editForm.upfront);
    const perfNum = editForm.performance === '' ? null : Number(editForm.performance);
    if (upfrontNum !== null && (isNaN(upfrontNum) || upfrontNum < 0)) {
      toast.error(language === 'ko' ? '선취 금액이 유효하지 않습니다' : 'Invalid upfront amount');
      return;
    }
    if (perfNum !== null && (isNaN(perfNum) || perfNum < 0)) {
      toast.error(language === 'ko' ? '성과 금액이 유효하지 않습니다' : 'Invalid performance amount');
      return;
    }
    setSavingEdit(true);
    const { error } = await supabase
      .from('commission_distributions')
      .update({ upfront_amount: upfrontNum, performance_amount: perfNum, status: editForm.status })
      .eq('id', d.id);
    setSavingEdit(false);
    if (error) {
      toast.error(language === 'ko' ? '커미션 수정 실패' : 'Failed to update commission');
    } else {
      toast.success(language === 'ko' ? '커미션 수정 완료' : 'Commission updated');
      setEditingDistId(null);
      // Notify the recipient
      supabase.functions.invoke('notify-sales', {
        body: { type: 'commission_status_changed', commission_id: d.id, new_status: editForm.status, recipient_ids: [d.to_user_id] },
      }).catch(console.error);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());


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

  // Bulk selection helpers (depend on filteredDistributions)
  const selectAllFiltered = (status: string) => {
    const ids = filteredDistributions.filter(d => d.status === status).map(d => d.id);
    setSelectedIds(new Set(ids));
  };
  const selectedDistributions = filteredDistributions.filter(d => selectedIds.has(d.id));
  const selectedTotal = selectedDistributions.reduce((s, d) => s + (Number(d.upfront_amount) || 0) + (Number(d.performance_amount) || 0), 0);
  const canBulkApprove = selectedDistributions.some(d => d.status === 'pending');
  const canBulkPay = selectedDistributions.some(d => d.status === 'available');

  const handleBulkStatusChange = async (newStatus: string) => {
    if (selectedIds.size === 0) return;
    setBulkProcessing(true);
    let success = 0;
    let failed = 0;
    const recipientIds = new Set<string>();
    for (const id of selectedIds) {
      const dist = distributions.find(d => d.id === id);
      if (!dist) continue;
      // Only change if valid transition
      if (newStatus === 'available' && dist.status !== 'pending') continue;
      if (newStatus === 'paid' && dist.status !== 'available') continue;
      const { error } = await supabase.from('commission_distributions').update({ status: newStatus }).eq('id', id);
      if (error) { failed++; } else { success++; recipientIds.add(dist.to_user_id); }
    }
    if (recipientIds.size > 0) {
      supabase.functions.invoke('notify-sales', {
        body: { type: 'commission_status_changed', new_status: newStatus, recipient_ids: [...recipientIds] },
      }).catch(console.error);
    }
    toast.success(
      language === 'ko'
        ? `일괄 처리 완료: ${success}건 성공, ${failed}건 실패`
        : `Bulk update: ${success} succeeded, ${failed} failed`
    );
    setBulkProcessing(false);
    clearSelection();
    fetchAll();
  };

  // Normalize amounts to display currency before summing
  const normalizeToDisplay = (amount: number, srcCurrency: string) => {
    if (displayCurrency === 'USD') {
      return srcCurrency === 'KRW' ? amount / usdKrwRate : amount;
    }
    if (displayCurrency === 'KRW') {
      return srcCurrency === 'USD' ? amount * usdKrwRate : amount;
    }
    return amount;
  };

  const getAttributionDisplayTotals = (sources: { upfront: number; performance: number; currency: string }[]) => {
    const upfront = sources.reduce((sum, src) => sum + normalizeToDisplay(src.upfront, src.currency || 'USD'), 0);
    const performance = sources.reduce((sum, src) => sum + normalizeToDisplay(src.performance, src.currency || 'USD'), 0);

    return {
      upfront,
      performance,
      total: upfront + performance,
    };
  };

  const totalUpfront = distributions.reduce((s, d) => s + normalizeToDisplay(Number(d.upfront_amount) || 0, d.currency || 'USD'), 0);
  const totalPerformance = distributions.reduce((s, d) => s + normalizeToDisplay(Number(d.performance_amount) || 0, d.currency || 'USD'), 0);
  const totalCommission = totalUpfront + totalPerformance;
  const pendingCount = distributions.filter(d => d.status === 'pending').length;
  const availableCount = distributions.filter(d => d.status === 'available').length;

  // Rates filtered by selected product
  const defaultRates = rates.filter(r => r.product_id === selectedProductId && !r.is_override);
  const overrideRates = rates.filter(r => r.product_id === selectedProductId && r.is_override);

  const salesUsers = profiles.filter(p => p.sales_role && p.sales_role !== 'client');
  const selectedProduct = products.find((product) => product.id === selectedProductId);

  useEffect(() => {
    if (!selectedProductId) {
      setDraftConfig(null);
      return;
    }

    setDraftConfig(productConfigs[selectedProductId] || buildProductCommissionConfig());
  }, [selectedProductId, productConfigs]);

  const previewRows = useMemo(() => {
    if (!selectedProduct || !draftConfig) return [];

    return computeCommissionPreview({
      totalUpfrontRate: Number(selectedProduct.upfront_commission_percent) || 0,
      totalPerformanceRate: Number(selectedProduct.performance_fee_percent) || 0,
      investmentAmount: Number(previewInput.investmentAmount) || 0,
      realizedReturnAmount: Number(previewInput.realizedReturnAmount) || 0,
      ratios: draftConfig.ratios,
    });
  }, [selectedProduct, draftConfig, previewInput]);

  const previewTotals = useMemo(() => previewRows.reduce((acc, row) => {
    acc.share += row.sharePercent;
    acc.upfrontRate += row.upfrontRate;
    acc.performanceRate += row.performanceRate;
    acc.upfrontAmount += row.upfrontAmount;
    acc.performanceAmount += row.performanceAmount;
    return acc;
  }, { share: 0, upfrontRate: 0, performanceRate: 0, upfrontAmount: 0, performanceAmount: 0 }), [previewRows]);

  const handleDirectionChange = (direction: CommissionDirection) => {
    setDraftConfig({ direction, ratios: { ...DEFAULT_DIRECTION_PRESETS[direction] } });
  };

  const handleDraftRatioChange = (role: CommissionRole, value: string) => {
    const numeric = Number(value);
    setDraftConfig((current) => current ? {
      ...current,
      ratios: {
        ...current.ratios,
        [role]: Number.isFinite(numeric) && numeric >= 0 ? numeric : 0,
      },
    } : current);
  };

  const handleSaveProductConfig = async () => {
    if (!selectedProductId || !selectedProduct || !draftConfig || !user) return;

    const totalUpfrontRate = Number(selectedProduct.upfront_commission_percent) || 0;
    const totalPerformanceRate = Number(selectedProduct.performance_fee_percent) || 0;
    const normalizedRows = computeCommissionPreview({
      totalUpfrontRate,
      totalPerformanceRate,
      investmentAmount: Number(previewInput.investmentAmount) || 0,
      realizedReturnAmount: Number(previewInput.realizedReturnAmount) || 0,
      ratios: draftConfig.ratios,
    });

    setSavingProductConfig(true);
    try {
      const deletePromise = supabase
        .from('commission_rates')
        .delete()
        .eq('product_id', selectedProductId)
        .eq('is_override', false);

      const insertPromise = deletePromise.then(({ error }) => {
        if (error) throw error;
        return supabase.from('commission_rates').insert(
          normalizedRows.map((row) => ({
            product_id: selectedProductId,
            sales_role: row.role,
            sales_level: ROLE_LEVELS[row.role] || 0,
            upfront_rate: row.upfrontRate,
            performance_rate: row.performanceRate,
            is_override: false,
            set_by: user.id,
          }))
        );
      });

      const { error: insertError } = await insertPromise;
      if (insertError) throw insertError;

      setProductConfigs((current) => ({
        ...current,
        [selectedProductId]: draftConfig,
      }));

      toast.success(language === 'ko' ? '상품별 커미션 방향과 기본 비율을 저장했습니다' : 'Saved commission direction and default ratios');
      await fetchAll();

      const { data: investments } = await supabase.from('client_investments').select('id').eq('product_id', selectedProductId);
      if (investments?.length) {
        await Promise.all(
          investments.map((investment) =>
            supabase.functions.invoke('calculate-commissions', {
              body: { investment_id: investment.id },
            })
          )
        );
      }
    } catch (error: any) {
      toast.error(error?.message || (language === 'ko' ? '상품 설정 저장 실패' : 'Failed to save product settings'));
    } finally {
      setSavingProductConfig(false);
    }
  };

  return (
    <div className="card-elevated">
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-xl font-serif font-semibold">
            {language === 'ko' ? '커미션 관리' : 'Commission Management'}
          </h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">{language === 'ko' ? '표시 통화' : 'Display'}</Label>
              <Select value={displayCurrency} onValueChange={handleSaveDisplayCurrency} disabled={savingCurrency}>
                <SelectTrigger className="w-[100px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="KRW">₩ KRW</SelectItem>
                  <SelectItem value="USD">$ USD</SelectItem>
                </SelectContent>
              </Select>
              {usdKrwRate > 0 && (
                <span className="text-xs text-muted-foreground">
                  1 USD = ₩{usdKrwRate.toLocaleString()}
                </span>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={fetchAll}>
              <RefreshCw className="h-4 w-4 mr-2" />
              {language === 'ko' ? '새로고침' : 'Refresh'}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 mt-4 sm:grid-cols-2 xl:grid-cols-4">
          <button
            type="button"
            onClick={() => setActiveTab('attribution')}
            className="rounded-lg border border-border p-4 text-left transition-colors hover:bg-muted/40"
          >
            <p className="text-sm text-muted-foreground">{language === 'ko' ? '총 선취 커미션' : 'Total Upfront'}</p>
            <p className="text-2xl font-semibold">
              {displayCurrency === 'KRW'
                ? `₩${Math.round(totalUpfront).toLocaleString('ko-KR')}`
                : `$${totalUpfront.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {language === 'ko' ? '클릭하여 전체 귀속 breakdown 보기' : 'Click to view full attribution breakdown'}
            </p>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('attribution')}
            className="rounded-lg border border-border p-4 text-left transition-colors hover:bg-muted/40"
          >
            <p className="text-sm text-muted-foreground">{language === 'ko' ? '총 성과 커미션' : 'Total Performance'}</p>
            <p className="text-2xl font-semibold">
              {displayCurrency === 'KRW'
                ? `₩${Math.round(totalPerformance).toLocaleString('ko-KR')}`
                : `$${totalPerformance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {language === 'ko' ? '클릭하여 전체 귀속 breakdown 보기' : 'Click to view full attribution breakdown'}
            </p>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('attribution')}
            className="rounded-lg border border-border p-4 text-left transition-colors hover:bg-muted/40"
          >
            <p className="text-sm text-muted-foreground">{language === 'ko' ? '총 커미션' : 'Total Commission'}</p>
            <p className="text-2xl font-semibold">
              {displayCurrency === 'KRW'
                ? `₩${Math.round(totalCommission).toLocaleString('ko-KR')}`
                : `$${totalCommission.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {language === 'ko' ? '클릭하여 수수료 전체 내역으로 이동' : 'Click to open the full commission breakdown'}
            </p>
          </button>
          <div className="rounded-lg border border-border p-4">
            <p className="text-sm text-muted-foreground">{language === 'ko' ? '대기중' : 'Pending'}</p>
            <p className="text-2xl font-semibold">{pendingCount}</p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="p-6">
        <TabsList>
          <TabsTrigger value="distributions" className="flex items-center gap-2">
            <Coins className="h-4 w-4" />
            {language === 'ko' ? '분배 내역' : 'Distributions'}
          </TabsTrigger>
          <TabsTrigger value="rates" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            {language === 'ko' ? '요율 설정' : 'Rate Settings'}
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            {language === 'ko' ? '보고서' : 'Reports'}
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            {language === 'ko' ? '감사 로그' : 'Audit Log'}
          </TabsTrigger>
          <TabsTrigger value="attribution" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            {language === 'ko' ? '개인별 귀속' : 'Attribution'}
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
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex flex-wrap items-center gap-2">
              {selectedIds.size > 0 && (
                <>
                  <span className="text-sm text-muted-foreground">
                    {selectedIds.size}{language === 'ko' ? '건 선택' : ' selected'}
                    {selectedTotal > 0 && ` · ${formatCommissionAmount(selectedTotal, language as 'ko' | 'en')}`}
                  </span>
                  {canBulkApprove && (
                    <Button size="sm" onClick={() => handleBulkStatusChange('available')} disabled={bulkProcessing}>
                      <CheckSquare className="h-4 w-4 mr-1" />
                      {language === 'ko' ? '일괄 승인' : 'Bulk Approve'}
                    </Button>
                  )}
                  {canBulkPay && (
                    <Button size="sm" variant="outline" onClick={() => handleBulkStatusChange('paid')} disabled={bulkProcessing}>
                      <Coins className="h-4 w-4 mr-1" />
                      {language === 'ko' ? '일괄 지급' : 'Bulk Pay'}
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={clearSelection}>
                    {language === 'ko' ? '선택 해제' : 'Clear'}
                  </Button>
                </>
              )}
              {selectedIds.size === 0 && (
                <div className="flex gap-2">
                  {pendingCount > 0 && (
                    <Button size="sm" variant="outline" onClick={() => selectAllFiltered('pending')}>
                      {language === 'ko' ? `대기중 전체 선택 (${pendingCount})` : `Select All Pending (${pendingCount})`}
                    </Button>
                  )}
                  {availableCount > 0 && (
                    <Button size="sm" variant="outline" onClick={() => selectAllFiltered('available')}>
                      {language === 'ko' ? `수령가능 전체 선택 (${availableCount})` : `Select All Available (${availableCount})`}
                    </Button>
                  )}
                </div>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkRecalculate}
              disabled={bulkRecalculating || distributions.length === 0}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${bulkRecalculating ? 'animate-spin' : ''}`} />
              {language === 'ko' ? '전체 재계산' : 'Recalculate All'}
            </Button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={filteredDistributions.length > 0 && selectedIds.size === filteredDistributions.length}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedIds(new Set(filteredDistributions.map(d => d.id)));
                        } else {
                          clearSelection();
                        }
                      }}
                    />
                  </TableHead>
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
                      {Array.from({ length: 11 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-5 w-20" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filteredDistributions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                      <div className="space-y-3">
                        <p>{language === 'ko' ? '분배 내역이 없습니다' : 'No distributions found'}</p>
                        {distributions.length === 0 && (
                          <>
                            <p className="text-xs">
                              {language === 'ko' ? '최근 갱신: ' : 'Last refreshed: '}
                              {format(new Date(), 'yyyy-MM-dd HH:mm:ss')}
                            </p>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                if (!user || profiles.length < 2) {
                                  toast.error(language === 'ko' ? '프로필이 부족합니다' : 'Not enough profiles');
                                  return;
                                }
                                const salesUser = profiles.find(p => p.sales_role && p.sales_role !== 'client');
                                const investor = profiles.find(p => p.user_id !== salesUser?.user_id);
                                if (!salesUser || !investor) return;
                                // Find any investment to link
                                const { data: inv } = await supabase.from('client_investments').select('id').limit(1).maybeSingle();
                                if (!inv) {
                                  toast.error(language === 'ko' ? '투자 내역이 없어 샘플을 생성할 수 없습니다' : 'No investments exist to link a sample commission');
                                  return;
                                }
                                const { error } = await supabase.from('commission_distributions').insert({
                                  investment_id: inv.id,
                                  to_user_id: salesUser.user_id,
                                  from_user_id: investor.user_id,
                                  layer: 1,
                                  upfront_amount: 100,
                                  performance_amount: 50,
                                  rate_used: 1.0,
                                  currency: 'USD',
                                  status: 'pending',
                                });
                                if (error) { toast.error(error.message); }
                                else { toast.success(language === 'ko' ? '샘플 커미션 생성 완료' : 'Sample commission created'); fetchAll(); }
                              }}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              {language === 'ko' ? '샘플 커미션 생성' : 'Create Sample Commission'}
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDistributions.map((d) => (
                    <TableRow key={d.id} data-state={selectedIds.has(d.id) ? 'selected' : undefined} className={editingDistId === d.id ? 'bg-primary/5' : ''}>
                      <TableCell>
                        <Checkbox checked={selectedIds.has(d.id)} onCheckedChange={() => toggleSelect(d.id)} />
                      </TableCell>
                      <TableCell className="font-medium">
                        <MemberLink userId={d.to_user_id}>{getName(d.to_user_id)}</MemberLink>
                      </TableCell>
                      <TableCell>
                        {getRole(d.to_user_id) ? (
                          <Badge variant="outline" className="text-xs">{getRole(d.to_user_id)}</Badge>
                        ) : '—'}
                      </TableCell>
                      <TableCell>{d.layer}</TableCell>
                      <TableCell>
                        {d.from_user_id ? <MemberLink userId={d.from_user_id}>{getName(d.from_user_id)}</MemberLink> : '—'}
                      </TableCell>
                      <TableCell>
                        {editingDistId === d.id ? (
                          <Input type="number" step="0.01" min="0" value={editForm.upfront} onChange={(e) => setEditForm(f => ({ ...f, upfront: e.target.value }))} className="h-7 text-xs w-24" />
                        ) : d.upfront_amount ? (
                          <button
                            type="button"
                            onClick={() => openAttributionForDistribution(d)}
                            className="font-medium text-success underline-offset-4 transition-colors hover:text-foreground hover:underline"
                            title={language === 'ko' ? '귀속 상세 보기' : 'Open attribution detail'}
                          >
                            {formatCommAmount(Number(d.upfront_amount), d.currency)}
                          </button>
                        ) : '—'}
                      </TableCell>
                      <TableCell>
                        {editingDistId === d.id ? (
                          <Input type="number" step="0.01" min="0" value={editForm.performance} onChange={(e) => setEditForm(f => ({ ...f, performance: e.target.value }))} className="h-7 text-xs w-24" />
                        ) : d.performance_amount ? (
                          <span className="text-success font-medium">{formatCommAmount(Number(d.performance_amount), d.currency)}</span>
                        ) : '—'}
                      </TableCell>
                      <TableCell>{d.rate_used ? `${d.rate_used}%` : '—'}</TableCell>
                      <TableCell>
                        {editingDistId === d.id ? (
                          <Select value={editForm.status} onValueChange={(v) => setEditForm(f => ({ ...f, status: v }))}>
                            <SelectTrigger className="h-7 text-[10px] w-24"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="available">available</SelectItem>
                              <SelectItem value="pending">pending</SelectItem>
                              <SelectItem value="paid">paid</SelectItem>
                              <SelectItem value="cancelled">cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant={STATUS_COLORS[d.status] as any || 'secondary'}>{d.status}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(d.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {editingDistId === d.id ? (
                            <>
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => saveEditDist(d)} disabled={savingEdit}>
                                {savingEdit ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                              </Button>
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={cancelEditDist} disabled={savingEdit}>
                                <X className="h-3 w-3" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => startEditDist(d)} title={language === 'ko' ? '수정' : 'Edit'}>
                                <Pencil className="h-3 w-3" />
                              </Button>
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
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs"
                                disabled={recalculating[d.investment_id]}
                                onClick={() => handleRecalculate(d.investment_id)}
                                title={language === 'ko' ? '재계산' : 'Recalculate'}
                              >
                                <RefreshCw className={`h-3.5 w-3.5 ${recalculating[d.investment_id] ? 'animate-spin' : ''}`} />
                              </Button>
                            </>
                          )}
                        </div>
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
            <div className="flex flex-wrap items-center gap-4">
              <Label className="whitespace-nowrap font-medium">
                {language === 'ko' ? '상품 선택' : 'Select Product'}
              </Label>
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger className="w-[320px]">
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

            {selectedProduct && draftConfig ? (
              <>
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                  <section className="rounded-lg border border-border p-4 space-y-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <h3 className="text-base font-semibold flex items-center gap-2">
                          <ArrowDownUp className="h-4 w-4" />
                          {language === 'ko' ? '상품별 커미션 방향 / 기본 비율' : 'Per-product direction / default ratios'}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {language === 'ko'
                            ? '각 역할의 배분 비율을 바꾸면 우측 미리보기가 즉시 재계산됩니다.'
                            : 'Adjust role share ratios and the preview updates immediately.'}
                        </p>
                      </div>
                      <Button onClick={handleSaveProductConfig} disabled={savingProductConfig}>
                        <Save className="h-4 w-4 mr-2" />
                        {savingProductConfig ? (language === 'ko' ? '저장중...' : 'Saving...') : (language === 'ko' ? '상품 설정 저장' : 'Save Product Settings')}
                      </Button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => handleDirectionChange('agent-first')}
                        className={cn(
                          'rounded-md border p-3 text-left transition-colors',
                          draftConfig.direction === 'agent-first' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'
                        )}
                      >
                        <div className="font-medium">{language === 'ko' ? '하위 우선' : 'Agent first'}</div>
                        <div className="text-sm text-muted-foreground mt-1">{language === 'ko' ? '에이전트가 가장 크고 총괄이 가장 작음' : 'Agent gets the largest share, manager the smallest.'}</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDirectionChange('manager-first')}
                        className={cn(
                          'rounded-md border p-3 text-left transition-colors',
                          draftConfig.direction === 'manager-first' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'
                        )}
                      >
                        <div className="font-medium">{language === 'ko' ? '상위 우선' : 'Manager first'}</div>
                        <div className="text-sm text-muted-foreground mt-1">{language === 'ko' ? '총괄이 가장 크고 에이전트가 가장 작음' : 'Manager gets the largest share, agent the smallest.'}</div>
                      </button>
                    </div>

                    <div className="rounded-md border border-border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{language === 'ko' ? '역할' : 'Role'}</TableHead>
                            <TableHead>{language === 'ko' ? '기본 비율 (%)' : 'Default ratio (%)'}</TableHead>
                            <TableHead>{language === 'ko' ? '현재 선취 요율' : 'Current upfront rate'}</TableHead>
                            <TableHead>{language === 'ko' ? '현재 성과 요율' : 'Current performance rate'}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {ROLE_SEQUENCE.map((role) => {
                            const rateRow = previewRows.find((row) => row.role === role);
                            return (
                              <TableRow key={role}>
                                <TableCell>
                                  <Badge variant="outline">{ROLE_LABELS[language]?.[role] || role}</Badge>
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.1"
                                    value={draftConfig.ratios[role]}
                                    onChange={(e) => handleDraftRatioChange(role, e.target.value)}
                                    className="h-9 w-28"
                                  />
                                </TableCell>
                                <TableCell className="font-medium">{rateRow?.upfrontRate.toFixed(2) || '0.00'}%</TableCell>
                                <TableCell className="font-medium">{rateRow?.performanceRate.toFixed(2) || '0.00'}%</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-md border border-border p-3">
                        <div className="text-xs text-muted-foreground">{language === 'ko' ? '상품 총 선취' : 'Product upfront total'}</div>
                        <div className="mt-1 font-semibold">{(Number(selectedProduct.upfront_commission_percent) || 0).toFixed(2)}%</div>
                      </div>
                      <div className="rounded-md border border-border p-3">
                        <div className="text-xs text-muted-foreground">{language === 'ko' ? '상품 총 성과' : 'Product performance total'}</div>
                        <div className="mt-1 font-semibold">{(Number(selectedProduct.performance_fee_percent) || 0).toFixed(2)}%</div>
                      </div>
                      <div className="rounded-md border border-border p-3">
                        <div className="text-xs text-muted-foreground">{language === 'ko' ? '비율 합계' : 'Ratio total'}</div>
                        <div className="mt-1 font-semibold">{previewTotals.share.toFixed(2)}%</div>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-lg border border-border p-4 space-y-4">
                    <div>
                      <h3 className="text-base font-semibold flex items-center gap-2">
                        <Eye className="h-4 w-4" />
                        {language === 'ko' ? '즉시 재계산 미리보기' : 'Immediate recalculation preview'}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {language === 'ko'
                          ? '샘플 투자금과 실현수익을 기준으로 역할별 커미션을 바로 확인합니다.'
                          : 'See the recalculated commission result instantly using sample inputs.'}
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label>{language === 'ko' ? '샘플 투자금' : 'Sample investment amount'}</Label>
                        <Input type="number" min="0" value={previewInput.investmentAmount} onChange={(e) => setPreviewInput((current) => ({ ...current, investmentAmount: e.target.value }))} className="mt-1" />
                      </div>
                      <div>
                        <Label>{language === 'ko' ? '샘플 실현수익' : 'Sample realized return'}</Label>
                        <Input type="number" min="0" value={previewInput.realizedReturnAmount} onChange={(e) => setPreviewInput((current) => ({ ...current, realizedReturnAmount: e.target.value }))} className="mt-1" />
                      </div>
                    </div>

                    <div>
                      <Label>{language === 'ko' ? '메모' : 'Notes'}</Label>
                      <Textarea value={previewInput.notes} onChange={(e) => setPreviewInput((current) => ({ ...current, notes: e.target.value }))} className="mt-1 min-h-20" placeholder={language === 'ko' ? '시나리오 메모를 남길 수 있습니다.' : 'Optional scenario notes.'} />
                    </div>

                    <div className="rounded-md border border-border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{language === 'ko' ? '역할' : 'Role'}</TableHead>
                              <TableHead>{language === 'ko' ? '비중' : 'Share'}</TableHead>
                              <TableHead>{language === 'ko' ? '선취 요율' : 'Upfront rate'}</TableHead>
                              <TableHead>{language === 'ko' ? '성과 요율' : 'Performance rate'}</TableHead>
                              <TableHead>{language === 'ko' ? '선취 금액' : 'Upfront amount'}</TableHead>
                              <TableHead>{language === 'ko' ? '성과 금액' : 'Performance amount'}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {previewRows.map((row) => (
                              <TableRow key={row.role}>
                                <TableCell>
                                  <Badge variant="outline">{ROLE_LABELS[language]?.[row.role] || row.role}</Badge>
                                </TableCell>
                                <TableCell>{row.sharePercent.toFixed(2)}%</TableCell>
                                <TableCell>{row.upfrontRate.toFixed(2)}%</TableCell>
                                <TableCell>{row.performanceRate.toFixed(2)}%</TableCell>
                                <TableCell className="font-medium">{formatCommAmount(row.upfrontAmount, selectedProduct.default_currency || 'USD')}</TableCell>
                                <TableCell className="font-medium">{formatCommAmount(row.performanceAmount, selectedProduct.default_currency || 'USD')}</TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="bg-muted/30 font-semibold">
                              <TableCell>{language === 'ko' ? '합계' : 'Total'}</TableCell>
                              <TableCell>{previewTotals.share.toFixed(2)}%</TableCell>
                              <TableCell>{previewTotals.upfrontRate.toFixed(2)}%</TableCell>
                              <TableCell>{previewTotals.performanceRate.toFixed(2)}%</TableCell>
                              <TableCell>{formatCommAmount(previewTotals.upfrontAmount, selectedProduct.default_currency || 'USD')}</TableCell>
                              <TableCell>{formatCommAmount(previewTotals.performanceAmount, selectedProduct.default_currency || 'USD')}</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                    </div>

                    <div className="rounded-md border border-border bg-muted/20 p-3 text-sm space-y-1">
                      <div className="flex justify-between gap-3"><span className="text-muted-foreground">{language === 'ko' ? '선취 요율 합계' : 'Total upfront rate'}</span><span className="font-medium">{previewTotals.upfrontRate.toFixed(2)}%</span></div>
                      <div className="flex justify-between gap-3"><span className="text-muted-foreground">{language === 'ko' ? '성과 요율 합계' : 'Total performance rate'}</span><span className="font-medium">{previewTotals.performanceRate.toFixed(2)}%</span></div>
                      <div className="flex justify-between gap-3"><span className="text-muted-foreground">{language === 'ko' ? '선취 커미션 합계' : 'Total upfront commission'}</span><span className="font-medium">{formatCommAmount(previewTotals.upfrontAmount, selectedProduct.default_currency || 'USD')}</span></div>
                      <div className="flex justify-between gap-3"><span className="text-muted-foreground">{language === 'ko' ? '성과 커미션 합계' : 'Total performance commission'}</span><span className="font-medium">{formatCommAmount(previewTotals.performanceAmount, selectedProduct.default_currency || 'USD')}</span></div>
                    </div>
                  </section>
                </div>

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
                            <TableCell className="font-medium">{r.override_user_id ? getName(r.override_user_id) : '—'}</TableCell>
                            <TableCell><Badge variant="outline" className="text-xs">{ROLE_LABELS[language]?.[r.sales_role] || r.sales_role}</Badge></TableCell>
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
              </>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
                {language === 'ko' ? '상품을 선택하면 커미션 방향과 기본 비율을 편집할 수 있습니다.' : 'Select a product to edit commission direction and default ratios.'}
              </div>
            )}

            {/* Per-User Overrides Section */}
          </div>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports">
          <AdminCommissionReports
            distributions={distributions}
            profiles={profiles}
            language={language}
            formatCurrency={formatCurrency}
            formatDate={formatDate}
            getName={getName}
            getRole={getRole}
            loading={loading}
          />
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

        {/* Per-Person Attribution Tab */}
        <TabsContent value="attribution">
          <div className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <p className="text-sm text-muted-foreground">
                {language === 'ko'
                  ? '개인별 커미션 귀속 내역입니다. 각 영업사원을 클릭하면 출처별 상세 내역을 확인할 수 있습니다.'
                  : 'Per-person commission attribution. Click on each salesperson to see detailed breakdown by source.'}
              </p>
              <Button size="sm" onClick={exportAttribution} disabled={filteredPersonAttribution.length === 0}>
                <Download className="h-4 w-4 mr-1" />
                {language === 'ko' ? 'Excel 다운로드' : 'Export Excel'}
              </Button>
            </div>
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              <div className="relative w-full xl:max-w-xs">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={language === 'ko' ? '영업사원/투자자/투자 ID 검색' : 'Search salesperson / investor / investment ID'}
                  value={attributionSearchTerm}
                  onChange={(e) => setAttributionSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap xl:flex-nowrap">
                <Select value={attributionStatus} onValueChange={setAttributionStatus}>
                  <SelectTrigger className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{language === 'ko' ? '전체 상태' : 'All Status'}</SelectItem>
                    <SelectItem value="pending">{language === 'ko' ? '대기중' : 'Pending'}</SelectItem>
                    <SelectItem value="available">{language === 'ko' ? '확정' : 'Confirmed'}</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={attributionBreakdownSort} onValueChange={(value: 'upfront' | 'performance' | 'other') => setAttributionBreakdownSort(value)}>
                  <SelectTrigger className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upfront">{language === 'ko' ? '선취 비중순' : 'Sort by Upfront %'}</SelectItem>
                    <SelectItem value="performance">{language === 'ko' ? '성과 비중순' : 'Sort by Performance %'}</SelectItem>
                    <SelectItem value="other">{language === 'ko' ? '기타 비중순' : 'Sort by Other %'}</SelectItem>
                  </SelectContent>
                </Select>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('w-full justify-start text-left font-normal sm:w-[160px]', !attributionDateFrom && 'text-muted-foreground')}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {attributionDateFrom ? format(attributionDateFrom, 'yyyy-MM-dd') : (language === 'ko' ? '시작일' : 'From')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={attributionDateFrom} onSelect={setAttributionDateFrom} className={cn('p-3 pointer-events-auto')} />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('w-full justify-start text-left font-normal sm:w-[160px]', !attributionDateTo && 'text-muted-foreground')}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {attributionDateTo ? format(attributionDateTo, 'yyyy-MM-dd') : (language === 'ko' ? '종료일' : 'To')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={attributionDateTo} onSelect={setAttributionDateTo} className={cn('p-3 pointer-events-auto')} />
                  </PopoverContent>
                </Popover>
                {(attributionSearchTerm || attributionStatus !== 'all' || attributionDateFrom || attributionDateTo) && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setAttributionSearchTerm('');
                      setAttributionStatus('all');
                      setAttributionDateFrom(undefined);
                      setAttributionDateTo(undefined);
                    }}
                  >
                    {language === 'ko' ? '초기화' : 'Clear'}
                  </Button>
                )}
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === 'ko' ? '영업사원' : 'Sales Person'}</TableHead>
                  <TableHead>{language === 'ko' ? '역할' : 'Role'}</TableHead>
                  <TableHead>{language === 'ko' ? '선취 합계' : 'Upfront Total'}</TableHead>
                  <TableHead>{language === 'ko' ? '성과 합계' : 'Performance Total'}</TableHead>
                  <TableHead>{language === 'ko' ? '총 합계' : 'Grand Total'}</TableHead>
                  <TableHead>{language === 'ko' ? '건수' : 'Count'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPersonAttribution.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {language === 'ko' ? '조건에 맞는 귀속 내역이 없습니다' : 'No attribution data matches the current filters'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPersonAttribution.map(([userId, data]) => {
                    const displayTotals = getAttributionDisplayTotals(data.sources);

                    return (
                    <React.Fragment key={userId}>
                      <TableRow
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setExpandedPerson(expandedPerson === userId ? null : userId)}
                      >
                        <TableCell className="font-medium">
                          <span className="flex items-center gap-1">
                            <ChevronRight className={`h-4 w-4 transition-transform ${expandedPerson === userId ? 'rotate-90' : ''}`} />
                            {data.name}
                          </span>
                        </TableCell>
                        <TableCell>
                          {data.role ? <Badge variant="outline" className="text-xs">{data.role}</Badge> : '—'}
                        </TableCell>
                        <TableCell className="text-success font-medium">{formatCommAmount(displayTotals.upfront, displayCurrency)}</TableCell>
                        <TableCell className="text-success font-medium">{formatCommAmount(displayTotals.performance, displayCurrency)}</TableCell>
                        <TableCell className="font-semibold">{formatCommAmount(displayTotals.total, displayCurrency)}</TableCell>
                        <TableCell>{data.sources.length}</TableCell>
                      </TableRow>
                      {expandedPerson === userId && (
                        <TableRow>
                          <TableCell colSpan={7} className="bg-muted/20 p-0">
                            <div className="px-8 py-3">
                              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                                {language === 'ko' ? '출처별 상세 내역' : 'Breakdown by Source'}
                              </p>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="text-xs">{language === 'ko' ? '투자자' : 'Investor'}</TableHead>
                                    <TableHead className="text-xs">{language === 'ko' ? '항목별 분해' : 'Item Breakdown'}</TableHead>
                                    <TableHead className="text-xs">{language === 'ko' ? '선취' : 'Upfront'}</TableHead>
                                    <TableHead className="text-xs">{language === 'ko' ? '성과' : 'Performance'}</TableHead>
                                    <TableHead className="text-xs">{language === 'ko' ? '요율' : 'Rate'}</TableHead>
                                    <TableHead className="text-xs">{language === 'ko' ? '통화' : 'Currency'}</TableHead>
                                    <TableHead className="text-xs">{language === 'ko' ? '상태' : 'Status'}</TableHead>
                                    <TableHead className="text-xs">{language === 'ko' ? '일자' : 'Date'}</TableHead>
                                    <TableHead className="text-xs">{language === 'ko' ? 'D+' : 'Days'}</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {[...data.sources]
                                    .sort((a, b) => getBreakdownSortRatio(b, attributionBreakdownSort) - getBreakdownSortRatio(a, attributionBreakdownSort))
                                    .map((src, idx) => (
                                    <TableRow key={idx}>
                                      <TableCell className="text-sm">{src.investorName}</TableCell>
                                      <TableCell className="min-w-[280px]">
                                        <div className="rounded-md border border-border bg-background p-2">
                                          <div className="grid gap-2 md:grid-cols-3">
                                            {getCommissionBreakdownItems(src.upfront, src.performance).map((item) => (
                                              <div key={item.key} className="rounded-sm border border-border/70 bg-muted/20 p-2">
                                                <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                                                  <span className="font-medium text-foreground">{item.label}</span>
                                                  <span className="tabular-nums text-muted-foreground">{item.ratio.toFixed(2)}%</span>
                                                </div>
                                                <div className="truncate text-[11px] font-medium text-foreground">
                                                  {formatCommAmount(item.amount, src.currency)}
                                                </div>
                                                <Progress value={item.ratio} className="mt-2 h-1.5" />
                                              </div>
                                            ))}
                                          </div>
                                          <div className="flex items-center justify-between border-t border-border pt-2 text-[11px] font-medium">
                                            <span>{language === 'ko' ? '총합' : 'Total'}</span>
                                            <span>{formatCommAmount(src.upfront + src.performance, src.currency)}</span>
                                          </div>
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-sm text-success">{formatCommAmount(src.upfront, src.currency)}</TableCell>
                                      <TableCell className="text-sm text-success">{formatCommAmount(src.performance, src.currency)}</TableCell>
                                      <TableCell className="text-sm">{src.rate != null ? `${src.rate}%` : '—'}</TableCell>
                                      <TableCell className="text-sm">{src.currency}</TableCell>
                                      <TableCell>
                                        <Badge variant={STATUS_COLORS[src.status] as any || 'secondary'} className="text-xs">{src.status}</Badge>
                                      </TableCell>
                                      <TableCell className="text-sm text-muted-foreground">{formatDate(src.date)}</TableCell>
                                      <TableCell className="text-sm text-muted-foreground">
                                        D+{Math.floor((Date.now() - new Date(src.date).getTime()) / (1000 * 60 * 60 * 24))}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  )})
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
