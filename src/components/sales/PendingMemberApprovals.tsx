import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Check, X, Clock, UserCheck } from 'lucide-react';

interface PendingMember {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  phone: string | null;
  sales_role: string | null;
  sales_status: string | null;
  parent_id: string | null;
  created_at: string;
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

interface Props {
  onDataChange?: () => void;
}

export function PendingMemberApprovals({ onDataChange }: Props) {
  const { language, formatDate } = useLanguage();
  const { user } = useAuth();
  const [pending, setPending] = useState<PendingMember[]>([]);
  const [sponsorNames, setSponsorNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    member: PendingMember | null;
    action: 'approve' | 'reject';
  }>({ open: false, member: null, action: 'approve' });

  useEffect(() => {
    fetchPending();
  }, [user]);

  async function fetchPending() {
    if (!user) return;
    setLoading(true);

    // Get user's subtree to find pending members under them
    const { data: subtree } = await supabase.rpc('get_sales_subtree', {
      _user_id: user.id,
    });

    const subtreeIds = (subtree || []).map((s: any) => s.user_id);
    
    // Also include direct children (parent_id = current user)
    const { data: directChildren } = await supabase
      .from('profiles')
      .select('id, user_id, email, full_name, phone, sales_role, sales_status, parent_id, created_at')
      .eq('parent_id', user.id)
      .eq('sales_status', 'pending')
      .or('is_deleted.is.null,is_deleted.eq.false');

    // Get pending members from subtree
    let subtreePending: PendingMember[] = [];
    if (subtreeIds.length > 0) {
      const { data: subPending } = await supabase
        .from('profiles')
        .select('id, user_id, email, full_name, phone, sales_role, sales_status, parent_id, created_at')
        .in('user_id', subtreeIds)
        .eq('sales_status', 'pending')
        .or('is_deleted.is.null,is_deleted.eq.false');
      subtreePending = (subPending || []) as PendingMember[];
    }

    // Merge and deduplicate
    const allPending = [...(directChildren || []), ...subtreePending] as PendingMember[];
    const uniqueMap = new Map<string, PendingMember>();
    allPending.forEach((m) => uniqueMap.set(m.user_id, m));
    const uniquePending = Array.from(uniqueMap.values());
    setPending(uniquePending);

    // Fetch sponsor names
    const parentIds = [...new Set(uniquePending.map(m => m.parent_id).filter(Boolean))] as string[];
    if (parentIds.length > 0) {
      const { data: parents } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', parentIds);
      const nameMap: Record<string, string> = {};
      (parents || []).forEach((p: any) => { nameMap[p.user_id] = p.full_name; });
      setSponsorNames(nameMap);
    }

    setLoading(false);
  }

  const handleAction = async (member: PendingMember, action: 'approve' | 'reject') => {
    if (!user) return;

    const updateData: Record<string, unknown> = {
      sales_status: action === 'approve' ? 'active' : 'rejected',
    };

    if (action === 'approve') {
      updateData.is_approved = true;
      updateData.is_rejected = false;
      updateData.approved_at = new Date().toISOString();
      updateData.approved_by = user.id;
    } else {
      updateData.is_rejected = true;
      updateData.rejected_at = new Date().toISOString();
      updateData.rejected_by = user.id;
    }

    const { error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', member.id);

    if (error) {
      toast.error(language === 'ko' ? '작업 실패' : 'Action failed');
      console.error(error);
    } else {
      toast.success(
        language === 'ko'
          ? `${member.full_name}님이 ${action === 'approve' ? '승인' : '거절'}되었습니다`
          : `${member.full_name} has been ${action === 'approve' ? 'approved' : 'rejected'}`
      );

      // Send notification on approval
      if (action === 'approve' && member.sales_role) {
        try {
          await supabase.functions.invoke('notify-sales', {
            body: {
              type: 'role_approved',
              user_id: member.user_id,
              user_name: member.full_name,
              user_email: member.email,
              role: member.sales_role,
            },
          });
        } catch (e) {
          console.error('Approval notification failed:', e);
        }
      }

      fetchPending();
      onDataChange?.();
    }
    setConfirmDialog({ open: false, member: null, action: 'approve' });
  };

  const getRoleLabel = (role: string | null) => {
    if (!role) return '—';
    return ROLE_LABELS[language]?.[role] || role;
  };

  if (loading) {
    return (
      <div className="card-elevated p-4">
        <Skeleton className="h-6 w-48 mb-4" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (pending.length === 0) return null;

  return (
    <div className="card-elevated mb-4">
      <div className="p-3 sm:p-6 border-b border-border flex items-center gap-2">
        <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-warning" />
        <h2 className="text-sm sm:text-lg font-serif font-semibold">
          {language === 'ko' ? '승인 대기 멤버' : 'Pending Member Approvals'}
        </h2>
        <Badge variant="destructive" className="animate-pulse text-xs">
          {pending.length}
        </Badge>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">{language === 'ko' ? '이름' : 'Name'}</TableHead>
              <TableHead className="text-xs">{language === 'ko' ? '이메일' : 'Email'}</TableHead>
              <TableHead className="text-xs">{language === 'ko' ? '역할' : 'Role'}</TableHead>
              <TableHead className="text-xs hidden sm:table-cell">{language === 'ko' ? '스폰서' : 'Sponsor'}</TableHead>
              <TableHead className="text-xs hidden sm:table-cell">{language === 'ko' ? '연락처' : 'Phone'}</TableHead>
              <TableHead className="text-xs">{language === 'ko' ? '작업' : 'Actions'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pending.map((member) => (
              <TableRow key={member.id}>
                <TableCell className="font-medium text-xs sm:text-sm">{member.full_name}</TableCell>
                <TableCell className="text-xs sm:text-sm">{member.email}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-xs">
                    {getRoleLabel(member.sales_role)}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground hidden sm:table-cell">
                  {member.parent_id ? (sponsorNames[member.parent_id] || member.parent_id.slice(0, 8)) : '—'}
                </TableCell>
                <TableCell className="text-xs hidden sm:table-cell">{member.phone || '—'}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="default"
                      className="h-7 px-2 text-xs"
                      onClick={() => setConfirmDialog({ open: true, member, action: 'approve' })}
                    >
                      <Check className="h-3 w-3 mr-1" />
                      {language === 'ko' ? '승인' : 'Approve'}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 px-2 text-xs"
                      onClick={() => setConfirmDialog({ open: true, member, action: 'reject' })}
                    >
                      <X className="h-3 w-3 mr-1" />
                      {language === 'ko' ? '거절' : 'Reject'}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Confirm Dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog({ open: false, member: null, action: 'approve' })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.action === 'approve'
                ? (language === 'ko' ? '멤버 승인' : 'Approve Member')
                : (language === 'ko' ? '멤버 거절' : 'Reject Member')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.member && (
                confirmDialog.action === 'approve'
                  ? (language === 'ko'
                    ? `${confirmDialog.member.full_name}님을 ${getRoleLabel(confirmDialog.member.sales_role)}(으)로 승인하시겠습니까?`
                    : `Approve ${confirmDialog.member.full_name} as ${getRoleLabel(confirmDialog.member.sales_role)}?`)
                  : (language === 'ko'
                    ? `${confirmDialog.member.full_name}님의 가입을 거절하시겠습니까?`
                    : `Reject ${confirmDialog.member.full_name}'s application?`)
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{language === 'ko' ? '취소' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDialog.member && handleAction(confirmDialog.member, confirmDialog.action)}
              className={confirmDialog.action === 'reject' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            >
              {confirmDialog.action === 'approve'
                ? (language === 'ko' ? '승인' : 'Approve')
                : (language === 'ko' ? '거절' : 'Reject')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
