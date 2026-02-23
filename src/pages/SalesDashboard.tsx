import { useEffect, useState } from 'react';
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
import { Users, DollarSign, Briefcase, ChevronRight, TrendingUp, Plus } from 'lucide-react';
import { CreateInvestmentDialog } from '@/components/sales/CreateInvestmentDialog';

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
    district_manager: '지역 매니저',
    principal_agent: '수석 에이전트',
    agent: '에이전트',
    client: '고객',
  },
  en: {
    district_manager: 'District Manager',
    principal_agent: 'Principal Agent',
    agent: 'Agent',
    client: 'Client',
  },
};

const ROLE_COLORS: Record<string, string> = {
  district_manager: 'default',
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

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchAll();
  }, [user]);

  async function fetchAll() {
    if (!user) return;
    setLoading(true);

    // Fetch downline tree
    const { data: tree } = await supabase.rpc('get_sales_subtree', {
      _user_id: user.id,
    });

    const downlineData = (tree || []) as DownlineMember[];
    setDownline(downlineData);

    // Fetch commissions for this user
    const { data: commData } = await supabase
      .from('commission_distributions')
      .select('*')
      .eq('to_user_id', user.id)
      .order('created_at', { ascending: false });
    setCommissions((commData || []) as CommissionDist[]);

    // Fetch investments from downline members
    const downlineIds = downlineData.map((d) => d.user_id);
    if (downlineIds.length > 0) {
      const { data: invData } = await supabase
        .from('client_investments')
        .select('*')
        .in('user_id', downlineIds)
        .order('start_date', { ascending: false })
        .limit(50);
      setDownlineInvestments((invData || []) as Investment[]);
    }

    // Fetch profiles for name resolution
    const allIds = [user.id, ...downlineIds];
    const { data: profileData } = await supabase
      .from('profiles')
      .select('user_id, full_name, email, sales_role')
      .in('user_id', allIds);
    setProfiles((profileData || []) as Profile[]);

    setLoading(false);
  }

  const getName = (userId: string) => {
    const p = profiles.find((pr) => pr.user_id === userId);
    return p ? p.full_name : userId.slice(0, 8) + '…';
  };

  const getRoleLabel = (role: string) =>
    ROLE_LABELS[language]?.[role] || role;

  // Summary calculations
  const totalUpfront = commissions.reduce(
    (s, c) => s + (Number(c.upfront_amount) || 0),
    0
  );
  const totalPerformance = commissions.reduce(
    (s, c) => s + (Number(c.performance_amount) || 0),
    0
  );
  const pendingCommissions = commissions.filter((c) => c.status === 'pending');
  const availableCommissions = commissions.filter(
    (c) => c.status === 'available'
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 animate-fade-in" style={{ animationDelay: '50ms' }}>
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Users className="h-4 w-4" />
              {language === 'ko' ? '하위 영업인' : 'Downline'}
            </div>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-semibold">{downline.length}</p>
            )}
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <DollarSign className="h-4 w-4" />
              {language === 'ko' ? '총 선취 커미션' : 'Total Upfront'}
            </div>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-semibold text-success">
                {formatCurrency(totalUpfront)}
              </p>
            )}
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <TrendingUp className="h-4 w-4" />
              {language === 'ko' ? '총 성과 커미션' : 'Total Performance'}
            </div>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-semibold text-success">
                {formatCurrency(totalPerformance)}
              </p>
            )}
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Briefcase className="h-4 w-4" />
              {language === 'ko' ? '하위 투자 총액' : 'Downline AUM'}
            </div>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-semibold">
                {formatCurrency(totalDownlineInvested)}
              </p>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="downline" className="space-y-6 animate-fade-in" style={{ animationDelay: '100ms' }}>
          <TabsList>
            <TabsTrigger value="downline" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              {language === 'ko' ? '조직도' : 'Downline'}
            </TabsTrigger>
            <TabsTrigger value="commissions" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
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
                                  style={{ marginLeft: `${depth * 24}px` }}
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
              <div className="p-6 border-b border-border flex items-center justify-between">
                <h2 className="text-lg font-serif font-semibold">
                  {language === 'ko' ? '커미션 내역' : 'Commission History'}
                </h2>
                <div className="flex gap-3 text-sm">
                  <span className="text-muted-foreground">
                    {language === 'ko' ? '대기:' : 'Pending:'}{' '}
                    <span className="font-medium text-foreground">
                      {pendingCommissions.length}
                    </span>
                  </span>
                  <span className="text-muted-foreground">
                    {language === 'ko' ? '수령 가능:' : 'Available:'}{' '}
                    <span className="font-medium text-success">
                      {availableCommissions.length}
                    </span>
                  </span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        {language === 'ko' ? '투자자' : 'Investor'}
                      </TableHead>
                      <TableHead>
                        {language === 'ko' ? '레이어' : 'Layer'}
                      </TableHead>
                      <TableHead>
                        {language === 'ko' ? '선취' : 'Upfront'}
                      </TableHead>
                      <TableHead>
                        {language === 'ko' ? '성과' : 'Performance'}
                      </TableHead>
                      <TableHead>
                        {language === 'ko' ? '적용률' : 'Rate'}
                      </TableHead>
                      <TableHead>
                        {language === 'ko' ? '상태' : 'Status'}
                      </TableHead>
                      <TableHead>
                        {language === 'ko' ? '일자' : 'Date'}
                      </TableHead>
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
                    ) : commissions.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="text-center py-8 text-muted-foreground"
                        >
                          {language === 'ko'
                            ? '커미션 내역이 없습니다'
                            : 'No commissions yet'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      commissions.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">
                            {c.from_user_id
                              ? getName(c.from_user_id)
                              : '—'}
                          </TableCell>
                          <TableCell>{c.layer}</TableCell>
                          <TableCell>
                            {c.upfront_amount ? (
                              <span className="text-success font-medium">
                                +{formatCurrency(Number(c.upfront_amount))}
                              </span>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                          <TableCell>
                            {c.performance_amount ? (
                              <span className="text-success font-medium">
                                +
                                {formatCurrency(
                                  Number(c.performance_amount)
                                )}
                              </span>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                          <TableCell>
                            {c.rate_used ? `${c.rate_used}%` : '—'}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                c.status === 'available'
                                  ? 'default'
                                  : c.status === 'paid'
                                  ? 'outline'
                                  : 'secondary'
                              }
                            >
                              {c.status === 'pending'
                                ? language === 'ko'
                                  ? '대기'
                                  : 'Pending'
                                : c.status === 'available'
                                ? language === 'ko'
                                  ? '수령가능'
                                  : 'Available'
                                : c.status === 'paid'
                                ? language === 'ko'
                                  ? '지급완료'
                                  : 'Paid'
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
      </main>
    </div>
  );
}
