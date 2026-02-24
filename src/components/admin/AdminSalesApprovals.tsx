import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Check, X, Search, Clock, UserCheck, UserX, RotateCcw, Building2, UserCog, Users, User } from 'lucide-react';

interface SalesProfile {
  id: string;
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
  created_at: string;
}

type ViewMode = 'pending' | 'active' | 'suspended' | 'rejected';

const ROLE_LABELS: Record<string, { en: string; ko: string }> = {
  district_manager: { en: 'General Manager', ko: '총괄관리' },
  principal_agent: { en: 'Principal Agent', ko: '수석 에이전트' },
  agent: { en: 'Agent', ko: '에이전트' },
  client: { en: 'Client', ko: '고객' },
};

const ROLE_ICONS: Record<string, typeof Building2> = {
  district_manager: Building2,
  principal_agent: UserCog,
  agent: Users,
  client: User,
};

function RoleBadge({ role, language }: { role: string | null; language: string }) {
  if (!role) return <Badge variant="outline">—</Badge>;
  const label = ROLE_LABELS[role];
  const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
    district_manager: 'default',
    principal_agent: 'secondary',
    agent: 'outline',
    client: 'outline',
  };
  return (
    <Badge variant={variants[role] || 'outline'}>
      {language === 'ko' ? label?.ko : label?.en}
    </Badge>
  );
}

export function AdminSalesApprovals() {
  const { language, formatDate } = useLanguage();
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<SalesProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('pending');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    profile: SalesProfile | null;
    action: 'approve' | 'reject' | 'suspend' | 'restore';
  }>({ open: false, profile: null, action: 'approve' });

  const [counts, setCounts] = useState({ pending: 0, active: 0, suspended: 0, rejected: 0 });

  useEffect(() => {
    fetchProfiles();
  }, [viewMode]);

  async function fetchProfiles() {
    setLoading(true);

    // Build query based on view mode
    let query = supabase
      .from('profiles')
      .select('*')
      .not('sales_role', 'is', null);

    if (viewMode === 'pending') {
      query = query.eq('sales_status', 'pending');
    } else if (viewMode === 'active') {
      query = query.eq('sales_status', 'active');
    } else if (viewMode === 'suspended') {
      query = query.eq('sales_status', 'suspended');
    } else if (viewMode === 'rejected') {
      query = query.eq('sales_status', 'rejected');
    }

    const { data } = await query.order('created_at', { ascending: false });
    setProfiles((data || []) as SalesProfile[]);

    // Fetch counts for badges
    const [pendingRes, activeRes, suspendedRes, rejectedRes] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }).not('sales_role', 'is', null).eq('sales_status', 'pending'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).not('sales_role', 'is', null).eq('sales_status', 'active'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).not('sales_role', 'is', null).eq('sales_status', 'suspended'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).not('sales_role', 'is', null).eq('sales_status', 'rejected'),
    ]);

    setCounts({
      pending: pendingRes.count || 0,
      active: activeRes.count || 0,
      suspended: suspendedRes.count || 0,
      rejected: rejectedRes.count || 0,
    });

    setLoading(false);
  }

  const handleAction = async (profile: SalesProfile, action: 'approve' | 'reject' | 'suspend' | 'restore') => {
    const statusMap: Record<string, string> = {
      approve: 'active',
      reject: 'rejected',
      suspend: 'suspended',
      restore: 'pending',
    };

    const updateData: Record<string, unknown> = {
      sales_status: statusMap[action],
    };

    // When approving, also approve the main profile
    if (action === 'approve') {
      updateData.is_approved = true;
      updateData.is_rejected = false;
      updateData.approved_at = new Date().toISOString();
      updateData.approved_by = user?.id;
    }

    if (action === 'reject') {
      updateData.is_rejected = true;
      updateData.rejected_at = new Date().toISOString();
      updateData.rejected_by = user?.id;
    }

    const { error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', profile.id);

    if (error) {
      toast.error(language === 'ko' ? '작업 실패' : 'Action failed');
      console.error(error);
    } else {
      const actionLabels: Record<string, { en: string; ko: string }> = {
        approve: { en: 'approved', ko: '승인되었습니다' },
        reject: { en: 'rejected', ko: '거절되었습니다' },
        suspend: { en: 'suspended', ko: '정지되었습니다' },
        restore: { en: 'restored to pending', ko: '대기 상태로 복원되었습니다' },
      };
      toast.success(
        language === 'ko'
          ? `${profile.full_name} 님이 ${actionLabels[action].ko}`
          : `${profile.full_name} has been ${actionLabels[action].en}`
      );
      fetchProfiles();
    }
    setConfirmDialog({ open: false, profile: null, action: 'approve' });
  };

  const filteredProfiles = profiles.filter((p) => {
    const matchesSearch =
      p.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.full_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || p.sales_role === roleFilter;
    return matchesSearch && matchesRole;
  });

  // Get sponsor name helper
  const getSponsorInfo = (profile: SalesProfile) => {
    if (!profile.parent_id) return '—';
    return profile.parent_id.substring(0, 8) + '...';
  };

  return (
    <div className="card-elevated">
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-serif font-semibold">
              {language === 'ko' ? '영업 사용자 관리' : 'Sales User Management'}
            </h2>
            {counts.pending > 0 && (
              <Badge variant="destructive" className="animate-pulse">
                {counts.pending} {language === 'ko' ? '대기' : 'pending'}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 mt-4 flex-wrap">
          <div className="flex gap-2 flex-wrap">
            {(['pending', 'active', 'suspended', 'rejected'] as ViewMode[]).map((mode) => {
              const icons = { pending: Clock, active: UserCheck, suspended: UserX, rejected: X };
              const labels = {
                pending: { en: 'Pending', ko: '대기 중' },
                active: { en: 'Active', ko: '활성' },
                suspended: { en: 'Suspended', ko: '정지' },
                rejected: { en: 'Rejected', ko: '거절' },
              };
              const Icon = icons[mode];
              return (
                <Button
                  key={mode}
                  variant={viewMode === mode ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode(mode)}
                >
                  <Icon className="h-4 w-4 mr-1" />
                  {language === 'ko' ? labels[mode].ko : labels[mode].en}
                  {counts[mode] > 0 && ` (${counts[mode]})`}
                </Button>
              );
            })}
          </div>

          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{language === 'ko' ? '모든 역할' : 'All Roles'}</SelectItem>
              <SelectItem value="district_manager">{language === 'ko' ? '총괄관리' : 'General Manager'}</SelectItem>
              <SelectItem value="principal_agent">{language === 'ko' ? '수석 에이전트' : 'Principal Agent'}</SelectItem>
              <SelectItem value="agent">{language === 'ko' ? '에이전트' : 'Agent'}</SelectItem>
              <SelectItem value="client">{language === 'ko' ? '고객' : 'Client'}</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={language === 'ko' ? '검색...' : 'Search...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{language === 'ko' ? '이름' : 'Name'}</TableHead>
              <TableHead>{language === 'ko' ? '이메일' : 'Email'}</TableHead>
              <TableHead>{language === 'ko' ? '역할' : 'Role'}</TableHead>
              <TableHead>{language === 'ko' ? '연락처' : 'Phone'}</TableHead>
              <TableHead>{language === 'ko' ? '가입일' : 'Registered'}</TableHead>
              <TableHead>{language === 'ko' ? '작업' : 'Actions'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-5 w-24" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : filteredProfiles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <div className="text-muted-foreground">
                    <UserCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>{language === 'ko' ? '사용자가 없습니다' : 'No users found'}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredProfiles.map((profile) => (
                <TableRow key={profile.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{profile.full_name}</div>
                      {profile.full_name_ko && (
                        <div className="text-sm text-muted-foreground">{profile.full_name_ko}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{profile.email}</TableCell>
                  <TableCell><RoleBadge role={profile.sales_role} language={language} /></TableCell>
                  <TableCell className="text-sm">{profile.phone || '—'}</TableCell>
                  <TableCell className="text-sm">{formatDate(profile.created_at)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {viewMode === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            className="btn-gold"
                            onClick={() => setConfirmDialog({ open: true, profile, action: 'approve' })}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            {language === 'ko' ? '승인' : 'Approve'}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setConfirmDialog({ open: true, profile, action: 'reject' })}
                          >
                            <X className="h-4 w-4 mr-1" />
                            {language === 'ko' ? '거절' : 'Reject'}
                          </Button>
                        </>
                      )}
                      {viewMode === 'active' && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setConfirmDialog({ open: true, profile, action: 'suspend' })}
                        >
                          <UserX className="h-4 w-4 mr-1" />
                          {language === 'ko' ? '정지' : 'Suspend'}
                        </Button>
                      )}
                      {(viewMode === 'suspended' || viewMode === 'rejected') && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setConfirmDialog({ open: true, profile, action: 'restore' })}
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          {language === 'ko' ? '복원' : 'Restore'}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.action === 'approve' && (language === 'ko' ? '영업 사용자 승인' : 'Approve Sales User')}
              {confirmDialog.action === 'reject' && (language === 'ko' ? '영업 사용자 거절' : 'Reject Sales User')}
              {confirmDialog.action === 'suspend' && (language === 'ko' ? '영업 사용자 정지' : 'Suspend Sales User')}
              {confirmDialog.action === 'restore' && (language === 'ko' ? '대기 상태 복원' : 'Restore to Pending')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'ko'
                ? `${confirmDialog.profile?.full_name} 님에 대해 이 작업을 수행하시겠습니까?`
                : `Are you sure you want to ${confirmDialog.action} ${confirmDialog.profile?.full_name}?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{language === 'ko' ? '취소' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction
              className={confirmDialog.action === 'approve' ? 'btn-gold' : confirmDialog.action === 'reject' || confirmDialog.action === 'suspend' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
              onClick={() => {
                if (confirmDialog.profile) {
                  handleAction(confirmDialog.profile, confirmDialog.action);
                }
              }}
            >
              {confirmDialog.action === 'approve' && (language === 'ko' ? '승인' : 'Approve')}
              {confirmDialog.action === 'reject' && (language === 'ko' ? '거절' : 'Reject')}
              {confirmDialog.action === 'suspend' && (language === 'ko' ? '정지' : 'Suspend')}
              {confirmDialog.action === 'restore' && (language === 'ko' ? '복원' : 'Restore')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
