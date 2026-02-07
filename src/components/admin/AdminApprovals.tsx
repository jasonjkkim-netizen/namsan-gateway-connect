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
import { Check, X, Search, Clock, UserCheck } from 'lucide-react';

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
  created_at: string;
}

export function AdminApprovals() {
  const { language, formatDate } = useLanguage();
  const { user } = useAuth();
  const [pendingProfiles, setPendingProfiles] = useState<PendingProfile[]>([]);
  const [approvedProfiles, setApprovedProfiles] = useState<PendingProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPending, setShowPending] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    profile: PendingProfile | null;
    action: 'approve' | 'reject';
  }>({ open: false, profile: null, action: 'approve' });

  useEffect(() => {
    fetchProfiles();
  }, []);

  async function fetchProfiles() {
    setLoading(true);
    
    const [pendingRes, approvedRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .eq('is_approved', false)
        .order('created_at', { ascending: false }),
      supabase
        .from('profiles')
        .select('*')
        .eq('is_approved', true)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    if (pendingRes.data) setPendingProfiles(pendingRes.data as PendingProfile[]);
    if (approvedRes.data) setApprovedProfiles(approvedRes.data as PendingProfile[]);
    setLoading(false);
  }

  const handleApprove = async (profile: PendingProfile) => {
    const { error } = await supabase
      .from('profiles')
      .update({
        is_approved: true,
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
    // Delete the profile and the auth user
    // Note: In production, you might want to just mark as rejected instead of deleting
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', profile.id);

    if (profileError) {
      toast.error(language === 'ko' ? '거절 실패' : 'Rejection failed');
      console.error(profileError);
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

  const currentProfiles = showPending ? pendingProfiles : approvedProfiles;
  
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
                variant={showPending ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowPending(true)}
              >
                <Clock className="h-4 w-4 mr-2" />
                {language === 'ko' ? '대기 중' : 'Pending'}
                {pendingProfiles.length > 0 && ` (${pendingProfiles.length})`}
              </Button>
              <Button
                variant={!showPending ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowPending(false)}
              >
                <UserCheck className="h-4 w-4 mr-2" />
                {language === 'ko' ? '승인됨' : 'Approved'}
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
              <TableHead>{language === 'ko' ? '가입일' : 'Registered'}</TableHead>
              {showPending && <TableHead>{language === 'ko' ? '작업' : 'Actions'}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: showPending ? 6 : 5 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-24" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : filteredProfiles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showPending ? 6 : 5} className="text-center py-12">
                  <div className="text-muted-foreground">
                    {showPending ? (
                      <>
                        <UserCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>{language === 'ko' ? '대기 중인 가입 요청이 없습니다' : 'No pending registrations'}</p>
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
                  <TableCell>{formatDate(profile.created_at)}</TableCell>
                  {showPending && (
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
                : (language === 'ko' ? '가입 거절' : 'Reject Registration')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.action === 'approve'
                ? (language === 'ko'
                    ? `${confirmDialog.profile?.full_name} 님의 가입을 승인하시겠습니까? 승인 후 해당 사용자는 서비스에 접근할 수 있습니다.`
                    : `Are you sure you want to approve ${confirmDialog.profile?.full_name}? They will be able to access the service after approval.`)
                : (language === 'ko'
                    ? `${confirmDialog.profile?.full_name} 님의 가입을 거절하시겠습니까? 이 작업은 되돌릴 수 없습니다.`
                    : `Are you sure you want to reject ${confirmDialog.profile?.full_name}? This action cannot be undone.`)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {language === 'ko' ? '취소' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              className={confirmDialog.action === 'approve' ? 'btn-gold' : 'bg-destructive text-destructive-foreground hover:bg-destructive/90'}
              onClick={() => {
                if (confirmDialog.profile) {
                  if (confirmDialog.action === 'approve') {
                    handleApprove(confirmDialog.profile);
                  } else {
                    handleReject(confirmDialog.profile);
                  }
                }
              }}
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
