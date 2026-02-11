import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Check, X, Search, Clock, UserCheck, UserX, RotateCcw } from 'lucide-react';

interface PendingProfile {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  full_name_ko: string | null;
  phone: string | null;
  address: string | null;
  birthday: string | null;
  is_approved: boolean;
  is_rejected: boolean | null;
  rejected_at: string | null;
  created_at: string;
}

type ViewMode = 'pending' | 'approved' | 'rejected';

export function AdminApprovals() {
  const { language, formatDate } = useLanguage();
  const { user } = useAuth();
  const [pendingProfiles, setPendingProfiles] = useState<PendingProfile[]>([]);
  const [approvedProfiles, setApprovedProfiles] = useState<PendingProfile[]>([]);
  const [rejectedProfiles, setRejectedProfiles] = useState<PendingProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('pending');
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    profile: PendingProfile | null;
    action: 'approve' | 'reject' | 'restore';
  }>({ open: false, profile: null, action: 'approve' });

  useEffect(() => {
    fetchProfiles();
  }, []);

  async function fetchProfiles() {
    setLoading(true);
    
    const [pendingRes, approvedRes, rejectedRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .eq('is_approved', false)
        .or('is_rejected.is.null,is_rejected.eq.false')
        .order('created_at', { ascending: false }),
      supabase
        .from('profiles')
        .select('*')
        .eq('is_approved', true)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('profiles')
        .select('*')
        .eq('is_rejected', true)
        .order('rejected_at', { ascending: false }),
    ]);

    if (pendingRes.data) setPendingProfiles(pendingRes.data as PendingProfile[]);
    if (approvedRes.data) setApprovedProfiles(approvedRes.data as PendingProfile[]);
    if (rejectedRes.data) setRejectedProfiles(rejectedRes.data as PendingProfile[]);
    setLoading(false);
  }

  const handleApprove = async (profile: PendingProfile) => {
    const { error } = await supabase
      .from('profiles')
      .update({
        is_approved: true,
        is_rejected: false,
        rejected_at: null,
        rejected_by: null,
        approved_at: new Date().toISOString(),
        approved_by: user?.id,
      })
      .eq('id', profile.id);

    if (error) {
      toast.error(language === 'ko' ? '승인 실패' : 'Approval failed');
      console.error(error);
    } else {
      toast.success(
        language === 'ko'
          ? `${profile.full_name} 님이 승인되었습니다`
          : `${profile.full_name} has been approved`
      );
      fetchProfiles();
    }
    setConfirmDialog({ open: false, profile: null, action: 'approve' });
  };

  const handleReject = async (profile: PendingProfile) => {
    const { error } = await supabase
      .from('profiles')
      .update({
        is_rejected: true,
        rejected_at: new Date().toISOString(),
        rejected_by: user?.id,
      })
      .eq('id', profile.id);

    if (error) {
      toast.error(language === 'ko' ? '거절 실패' : 'Rejection failed');
      console.error(error);
    } else {
      toast.success(
        language === 'ko'
          ? `${profile.full_name} 님의 가입이 거절되었습니다`
          : `${profile.full_name}'s registration has been rejected`
      );
      fetchProfiles();
    }
    setConfirmDialog({ open: false, profile: null, action: 'reject' });
  };

  const handleRestore = async (profile: PendingProfile) => {
    const { error } = await supabase
      .from('profiles')
      .update({
        is_rejected: false,
        rejected_at: null,
        rejected_by: null,
      })
      .eq('id', profile.id);

    if (error) {
      toast.error(language === 'ko' ? '복원 실패' : 'Restore failed');
      console.error(error);
    } else {
      toast.success(
        language === 'ko'
          ? `${profile.full_name} 님이 대기 목록으로 복원되었습니다`
          : `${profile.full_name} has been restored to pending`
      );
      fetchProfiles();
    }
    setConfirmDialog({ open: false, profile: null, action: 'restore' });
  };

  const currentProfiles = viewMode === 'pending' ? pendingProfiles : viewMode === 'approved' ? approvedProfiles : rejectedProfiles;
  
  const filteredProfiles = currentProfiles.filter(
    (p) =>
      p.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.full_name_ko && p.full_name_ko.includes(searchTerm))
  );

  return (
    <div className="card-elevated">
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-serif font-semibold">
              {language === 'ko' ? '가입 승인 관리' : 'Registration Approvals'}
            </h2>
            {pendingProfiles.length > 0 && (
              <Badge variant="destructive" className="animate-pulse">
                {pendingProfiles.length} {language === 'ko' ? '대기' : 'pending'}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex gap-2">
              <Button
                variant={viewMode === 'pending' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('pending')}
              >
                <Clock className="h-4 w-4 mr-2" />
                {language === 'ko' ? '대기 중' : 'Pending'}
                {pendingProfiles.length > 0 && ` (${pendingProfiles.length})`}
              </Button>
              <Button
                variant={viewMode === 'approved' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('approved')}
              >
                <UserCheck className="h-4 w-4 mr-2" />
                {language === 'ko' ? '승인됨' : 'Approved'}
              </Button>
              <Button
                variant={viewMode === 'rejected' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('rejected')}
              >
                <UserX className="h-4 w-4 mr-2" />
                {language === 'ko' ? '거절됨' : 'Rejected'}
                {rejectedProfiles.length > 0 && ` (${rejectedProfiles.length})`}
              </Button>
            </div>
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
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{language === 'ko' ? '이메일' : 'Email'}</TableHead>
              <TableHead>{language === 'ko' ? '이름' : 'Name'}</TableHead>
              <TableHead>{language === 'ko' ? '연락처' : 'Phone'}</TableHead>
              <TableHead>{language === 'ko' ? '생년월일' : 'Birthday'}</TableHead>
              <TableHead>{language === 'ko' ? (viewMode === 'rejected' ? '거절일' : '가입일') : (viewMode === 'rejected' ? 'Rejected' : 'Registered')}</TableHead>
              {viewMode !== 'approved' && <TableHead>{language === 'ko' ? '작업' : 'Actions'}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: viewMode !== 'approved' ? 6 : 5 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-24" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : filteredProfiles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={viewMode !== 'approved' ? 6 : 5} className="text-center py-12">
                  <div className="text-muted-foreground">
                    {viewMode === 'pending' ? (
                      <>
                        <UserCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>{language === 'ko' ? '대기 중인 가입 요청이 없습니다' : 'No pending registrations'}</p>
                      </>
                    ) : viewMode === 'rejected' ? (
                      <>
                        <UserX className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>{language === 'ko' ? '거절된 가입자가 없습니다' : 'No rejected registrations'}</p>
                      </>
                    ) : (
                      <p>{language === 'ko' ? '승인된 사용자가 없습니다' : 'No approved users found'}</p>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredProfiles.map((profile) => (
                <TableRow key={profile.id}>
                  <TableCell className="font-medium">{profile.email}</TableCell>
                  <TableCell>
                    <div>
                      <div>{profile.full_name}</div>
                      {profile.full_name_ko && (
                        <div className="text-sm text-muted-foreground">{profile.full_name_ko}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{profile.phone || '-'}</TableCell>
                  <TableCell>{profile.birthday ? formatDate(profile.birthday) : '-'}</TableCell>
                  <TableCell>{viewMode === 'rejected' && profile.rejected_at ? formatDate(profile.rejected_at) : formatDate(profile.created_at)}</TableCell>
                  {viewMode === 'pending' && (
                    <TableCell>
                      <div className="flex items-center gap-2">
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
                      </div>
                    </TableCell>
                  )}
                  {viewMode === 'rejected' && (
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setConfirmDialog({ open: true, profile, action: 'restore' })}
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        {language === 'ko' ? '복원' : 'Restore'}
                      </Button>
                    </TableCell>
                  )}
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
              {confirmDialog.action === 'approve'
                ? (language === 'ko' ? '가입 승인' : 'Approve Registration')
                : confirmDialog.action === 'reject'
                ? (language === 'ko' ? '가입 거절' : 'Reject Registration')
                : (language === 'ko' ? '대기 목록 복원' : 'Restore to Pending')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.action === 'approve'
                ? (language === 'ko'
                    ? `${confirmDialog.profile?.full_name} 님의 가입을 승인하시겠습니까? 승인 후 해당 사용자는 서비스에 접근할 수 있습니다.`
                    : `Are you sure you want to approve ${confirmDialog.profile?.full_name}? They will be able to access the service after approval.`)
                : confirmDialog.action === 'reject'
                ? (language === 'ko'
                    ? `${confirmDialog.profile?.full_name} 님의 가입을 거절하시겠습니까? 거절된 사용자는 별도 목록에 보관됩니다.`
                    : `Are you sure you want to reject ${confirmDialog.profile?.full_name}? They will be moved to the rejected list.`)
                : (language === 'ko'
                    ? `${confirmDialog.profile?.full_name} 님을 대기 목록으로 복원하시겠습니까?`
                    : `Are you sure you want to restore ${confirmDialog.profile?.full_name} to the pending list?`)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {language === 'ko' ? '취소' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              className={confirmDialog.action === 'approve' ? 'btn-gold' : confirmDialog.action === 'reject' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
              onClick={() => {
                if (confirmDialog.profile) {
                  if (confirmDialog.action === 'approve') {
                    handleApprove(confirmDialog.profile);
                  } else if (confirmDialog.action === 'reject') {
                    handleReject(confirmDialog.profile);
                  } else {
                    handleRestore(confirmDialog.profile);
                  }
                }
              }}
            >
              {confirmDialog.action === 'approve'
                ? (language === 'ko' ? '승인' : 'Approve')
                : confirmDialog.action === 'reject'
                ? (language === 'ko' ? '거절' : 'Reject')
                : (language === 'ko' ? '복원' : 'Restore')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
