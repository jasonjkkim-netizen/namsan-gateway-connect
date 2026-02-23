import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { Search, DollarSign, History, Calculator, RefreshCw } from 'lucide-react';

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

export function AdminCommissions() {
  const { language, formatCurrency, formatDate } = useLanguage();
  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    const [distRes, auditRes, profilesRes] = await Promise.all([
      supabase
        .from('commission_distributions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('commission_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase.from('profiles').select('user_id, full_name, email, sales_role'),
    ]);

    if (distRes.data) setDistributions(distRes.data as Distribution[]);
    if (auditRes.data) setAuditLog(auditRes.data as AuditEntry[]);
    if (profilesRes.data) setProfiles(profilesRes.data as Profile[]);
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

  const handleStatusChange = async (id: string, toUserId: string, newStatus: string) => {
    const { error } = await supabase
      .from('commission_distributions')
      .update({ status: newStatus })
      .eq('id', id);
    if (error) {
      toast.error(language === 'ko' ? '상태 변경 실패' : 'Status update failed');
    } else {
      toast.success(language === 'ko' ? '상태 변경 완료' : 'Status updated');
      // Trigger notification
      supabase.functions.invoke('notify-sales', {
        body: {
          type: 'commission_status_changed',
          commission_id: id,
          new_status: newStatus,
          recipient_ids: [toUserId],
        },
      }).catch(console.error);
      fetchAll();
    }
  };

  const filteredDistributions = distributions.filter((d) => {
    const term = searchTerm.toLowerCase();
    return (
      getName(d.to_user_id).toLowerCase().includes(term) ||
      (d.from_user_id && getName(d.from_user_id).toLowerCase().includes(term)) ||
      d.investment_id.toLowerCase().includes(term)
    );
  });

  const totalUpfront = distributions.reduce((s, d) => s + (Number(d.upfront_amount) || 0), 0);
  const totalPerformance = distributions.reduce((s, d) => s + (Number(d.performance_amount) || 0), 0);
  const pendingCount = distributions.filter(d => d.status === 'pending').length;

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

        {/* Summary Cards */}
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
                          <span className="text-success font-medium">
                            {formatCurrency(Number(d.upfront_amount))}
                          </span>
                        ) : '—'}
                      </TableCell>
                      <TableCell>
                        {d.performance_amount ? (
                          <span className="text-success font-medium">
                            {formatCurrency(Number(d.performance_amount))}
                          </span>
                        ) : '—'}
                      </TableCell>
                      <TableCell>{d.rate_used ? `${d.rate_used}%` : '—'}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_COLORS[d.status] as any || 'secondary'}>
                          {d.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(d.created_at)}
                      </TableCell>
                      <TableCell>
                        {d.status === 'pending' && (
                          <div className="flex gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs"
                              onClick={() => handleStatusChange(d.id, d.to_user_id, 'available')}
                            >
                              {language === 'ko' ? '승인' : 'Approve'}
                            </Button>
                          </div>
                        )}
                        {d.status === 'available' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            onClick={() => handleStatusChange(d.id, d.to_user_id, 'paid')}
                          >
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
                      <TableCell>
                        <Badge variant="outline">{entry.action}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {entry.target_table && (
                          <span className="text-muted-foreground">{entry.target_table}</span>
                        )}
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
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(entry.created_at)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
