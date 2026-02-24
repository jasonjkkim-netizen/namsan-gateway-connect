import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Mail, Phone, MapPin, Calendar, Users, DollarSign, CheckCircle, Clock, Wallet } from 'lucide-react';

const ROLE_LABELS: Record<string, Record<string, string>> = {
  ko: { district_manager: '총괄관리', principal_agent: '수석 에이전트', agent: '에이전트', client: '고객' },
  en: { district_manager: 'General Manager', principal_agent: 'Principal Agent', agent: 'Agent', client: 'Client' },
};

interface MemberProfile {
  full_name: string;
  full_name_ko: string | null;
  email: string;
  phone: string | null;
  address: string | null;
  birthday: string | null;
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

interface MemberDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
}

export function MemberDetailDialog({ open, onOpenChange, userId }: MemberDetailDialogProps) {
  const { language, formatCurrency, formatDate } = useLanguage();
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [investmentStats, setInvestmentStats] = useState({ count: 0, totalAmount: 0 });
  const [downlineCount, setDownlineCount] = useState(0);
  const [commissions, setCommissions] = useState<CommissionRecord[]>([]);

  useEffect(() => {
    if (!open || !userId) return;
    setLoading(true);

    const fetchData = async () => {
      const [profileRes, investRes, downlineRes, commRes] = await Promise.all([
        supabase.from('profiles').select('full_name, full_name_ko, email, phone, address, birthday, sales_role, sales_status, sales_level, created_at').eq('user_id', userId).maybeSingle(),
        supabase.from('client_investments').select('investment_amount').eq('user_id', userId),
        supabase.rpc('get_sales_subtree', { _user_id: userId }),
        supabase.from('commission_distributions').select('id, upfront_amount, performance_amount, currency, status, created_at').eq('to_user_id', userId).order('created_at', { ascending: false }).limit(20),
      ]);

      setProfile(profileRes.data as MemberProfile | null);

      const investments = investRes.data || [];
      setInvestmentStats({
        count: investments.length,
        totalAmount: investments.reduce((s, i) => s + (Number(i.investment_amount) || 0), 0),
      });

      setDownlineCount((downlineRes.data || []).length);
      setCommissions((commRes.data || []) as CommissionRecord[]);
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
                  <span className="truncate">{profile.email}</span>
                </div>
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

              {/* Commission Section */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  {language === 'ko' ? '커미션 내역' : 'Commission History'}
                </h4>

                {/* Commission Summary */}
                {commissions.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-2 text-center">
                      <p className="text-[10px] text-muted-foreground">{language === 'ko' ? '지급완료' : 'Paid'}</p>
                      <p className="text-sm font-semibold text-emerald-600">{formatCurrency(commSummary.paid)}</p>
                    </div>
                    <div className="rounded-lg bg-primary/5 p-2 text-center">
                      <p className="text-[10px] text-muted-foreground">{language === 'ko' ? '수령가능' : 'Available'}</p>
                      <p className="text-sm font-semibold text-primary">{formatCurrency(commSummary.available)}</p>
                    </div>
                    <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-2 text-center">
                      <p className="text-[10px] text-muted-foreground">{language === 'ko' ? '대기' : 'Pending'}</p>
                      <p className="text-sm font-semibold text-amber-600">{formatCurrency(commSummary.pending)}</p>
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
                              <p className="font-medium">{formatCurrency(total)}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {Number(c.upfront_amount) > 0 && `U: ${formatCurrency(Number(c.upfront_amount))}`}
                                {Number(c.upfront_amount) > 0 && Number(c.performance_amount) > 0 && ' / '}
                                {Number(c.performance_amount) > 0 && `P: ${formatCurrency(Number(c.performance_amount))}`}
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
