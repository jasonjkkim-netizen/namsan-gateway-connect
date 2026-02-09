import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { clientProfileSchema, validateFormData } from '@/lib/admin-validation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { Edit, Search } from 'lucide-react';

interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  full_name_ko: string | null;
  phone: string | null;
  address: string | null;
  preferred_language: string | null;
  birthday: string | null;
  created_at: string;
}

export function AdminClients() {
  const { language, formatDate } = useLanguage();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [adminUserIds, setAdminUserIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [togglingAdmin, setTogglingAdmin] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    full_name: '',
    full_name_ko: '',
    phone: '',
    address: '',
    preferred_language: 'en',
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const [profilesRes, rolesRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('user_roles')
        .select('user_id, role')
        .eq('role', 'admin')
    ]);

    if (profilesRes.error) {
      toast.error(language === 'ko' ? '고객 목록 조회 실패' : 'Failed to fetch clients');
    } else {
      setProfiles(profilesRes.data as Profile[]);
    }

    if (!rolesRes.error && rolesRes.data) {
      setAdminUserIds(new Set(rolesRes.data.map(r => r.user_id)));
    }

    setLoading(false);
  }

  const handleToggleAdmin = async (profile: Profile) => {
    const isCurrentlyAdmin = adminUserIds.has(profile.user_id);
    setTogglingAdmin(profile.user_id);

    try {
      if (isCurrentlyAdmin) {
        // Remove admin role
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', profile.user_id)
          .eq('role', 'admin');

        if (error) {
          if (error.message.includes('count')) {
            toast.error(language === 'ko' ? '마지막 관리자는 삭제할 수 없습니다' : 'Cannot remove the last admin');
          } else {
            throw error;
          }
        } else {
          setAdminUserIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(profile.user_id);
            return newSet;
          });
          toast.success(language === 'ko' ? '관리자 권한이 해제되었습니다' : 'Admin role removed');
        }
      } else {
        // Add admin role
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: profile.user_id, role: 'admin' });

        if (error) throw error;

        setAdminUserIds(prev => new Set([...prev, profile.user_id]));
        toast.success(language === 'ko' ? '관리자 권한이 부여되었습니다' : 'Admin role granted');
      }
    } catch (error: any) {
      toast.error(language === 'ko' ? '권한 변경 실패' : 'Failed to change role');
      console.error('Toggle admin error:', error);
    } finally {
      setTogglingAdmin(null);
    }
  };

  const handleEdit = (profile: Profile) => {
    setEditingProfile(profile);
    setFormData({
      full_name: profile.full_name,
      full_name_ko: profile.full_name_ko || '',
      phone: profile.phone || '',
      address: profile.address || '',
      preferred_language: profile.preferred_language || 'en',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editingProfile) return;

    // Validate form data
    const validationResult = validateFormData(clientProfileSchema, {
      full_name: formData.full_name,
      full_name_ko: formData.full_name_ko || null,
      phone: formData.phone || null,
      address: formData.address || null,
      preferred_language: formData.preferred_language as 'en' | 'ko',
    }, language);

    if (!validationResult.success) {
      toast.error(validationResult.error);
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: validationResult.data.full_name!,
        full_name_ko: validationResult.data.full_name_ko ?? null,
        phone: validationResult.data.phone ?? null,
        address: validationResult.data.address ?? null,
        preferred_language: validationResult.data.preferred_language!,
      })
      .eq('id', editingProfile.id);

    if (error) {
      toast.error(language === 'ko' ? '업데이트 실패' : 'Update failed');
    } else {
      toast.success(language === 'ko' ? '업데이트 완료' : 'Updated successfully');
      setDialogOpen(false);
      fetchData();
    }
  };

  const filteredProfiles = profiles.filter(
    (p) =>
      p.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.full_name_ko && p.full_name_ko.includes(searchTerm))
  );

  return (
    <div className="card-elevated">
      <div className="p-6 border-b border-border flex items-center justify-between">
        <h2 className="text-xl font-serif font-semibold">
          {language === 'ko' ? '고객 목록' : 'Client List'}
        </h2>
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

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{language === 'ko' ? '이메일' : 'Email'}</TableHead>
              <TableHead>{language === 'ko' ? '이름 (영문)' : 'Name (EN)'}</TableHead>
              <TableHead>{language === 'ko' ? '이름 (한글)' : 'Name (KO)'}</TableHead>
              <TableHead>{language === 'ko' ? '연락처' : 'Phone'}</TableHead>
              <TableHead>{language === 'ko' ? '주소' : 'Address'}</TableHead>
              <TableHead>{language === 'ko' ? '생년월일' : 'Birthday'}</TableHead>
              <TableHead>{language === 'ko' ? '가입일' : 'Joined'}</TableHead>
              <TableHead className="text-center">{language === 'ko' ? '관리자' : 'Admin'}</TableHead>
              <TableHead>{language === 'ko' ? '작업' : 'Actions'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 9 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-24" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : filteredProfiles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  {language === 'ko' ? '데이터가 없습니다' : 'No data found'}
                </TableCell>
              </TableRow>
            ) : (
              filteredProfiles.map((profile) => (
                <TableRow key={profile.id}>
                  <TableCell className="font-medium">{profile.email}</TableCell>
                  <TableCell>{profile.full_name}</TableCell>
                  <TableCell>{profile.full_name_ko || '-'}</TableCell>
                  <TableCell>{profile.phone || '-'}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{profile.address || '-'}</TableCell>
                  <TableCell>{profile.birthday ? formatDate(profile.birthday) : '-'}</TableCell>
                  <TableCell>{formatDate(profile.created_at)}</TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={adminUserIds.has(profile.user_id)}
                      onCheckedChange={() => handleToggleAdmin(profile)}
                      disabled={togglingAdmin === profile.user_id}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(profile)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {language === 'ko' ? '고객 정보 수정' : 'Edit Client'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>{language === 'ko' ? '이름 (영문)' : 'Name (English)'}</Label>
              <Input
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{language === 'ko' ? '이름 (한글)' : 'Name (Korean)'}</Label>
              <Input
                value={formData.full_name_ko}
                onChange={(e) => setFormData({ ...formData, full_name_ko: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{language === 'ko' ? '연락처' : 'Phone'}</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{language === 'ko' ? '주소' : 'Address'}</Label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                {language === 'ko' ? '취소' : 'Cancel'}
              </Button>
              <Button onClick={handleSave} className="btn-gold">
                {language === 'ko' ? '저장' : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}