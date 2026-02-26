import { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { clientProfileSchema, validateFormData } from '@/lib/admin-validation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { Edit, Search, Trash2, RotateCcw, ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';

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
  is_deleted: boolean | null;
  deleted_at: string | null;
  deleted_by: string | null;
  parent_id: string | null;
  sales_role: string | null;
}

interface SalesMember {
  user_id: string;
  full_name: string;
  full_name_ko: string | null;
  sales_role: string | null;
}

export function AdminClients() {
  const { language, formatDate } = useLanguage();
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [salesMembers, setSalesMembers] = useState<SalesMember[]>([]);
  const [adminUserIds, setAdminUserIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [togglingAdmin, setTogglingAdmin] = useState<string | null>(null);
  const [updatingManager, setUpdatingManager] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<Profile | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [managerFilter, setManagerFilter] = useState<string>('__all__');
  const [expandedManagers, setExpandedManagers] = useState<Set<string>>(new Set(['__unassigned__']));

  const [formData, setFormData] = useState({
    full_name: '',
    full_name_ko: '',
    phone: '',
    address: '',
    birthday: '',
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
      const data = profilesRes.data as Profile[];
      setProfiles(data);
      // Build sales members list from profiles that have a sales_role and are not deleted
      const members = data
        .filter(p => p.sales_role && !p.is_deleted)
        .map(p => ({
          user_id: p.user_id,
          full_name: p.full_name,
          full_name_ko: p.full_name_ko,
          sales_role: p.sales_role,
        }));
      setSalesMembers(members);
      // Auto-expand all manager groups
      const allManagerKeys = new Set(data.filter(p => !p.is_deleted).map(p => p.parent_id || '__unassigned__'));
      setExpandedManagers(allManagerKeys);
    }

    if (!rolesRes.error && rolesRes.data) {
      setAdminUserIds(new Set(rolesRes.data.map(r => r.user_id)));
    }

    setLoading(false);
  }

  const roleLabel = (role: string | null) => {
    if (!role) return '';
    const labels: Record<string, string> = {
      webmaster: language === 'ko' ? '웹마스터' : 'Webmaster',
      district_manager: language === 'ko' ? '총괄관리인' : 'District Manager',
      deputy_district_manager: language === 'ko' ? '부총괄관리인' : 'Deputy DM',
      principal_agent: language === 'ko' ? '수석에이전트' : 'Principal Agent',
      agent: language === 'ko' ? '에이전트' : 'Agent',
      client: language === 'ko' ? '고객' : 'Client',
    };
    return labels[role] || role;
  };

  const getManagerName = (parentId: string | null) => {
    if (!parentId) return null;
    const manager = profiles.find(p => p.user_id === parentId);
    if (!manager) return null;
    return language === 'ko' && manager.full_name_ko
      ? manager.full_name_ko
      : manager.full_name;
  };

  const handleManagerChange = async (profileUserId: string, newParentId: string) => {
    setUpdatingManager(profileUserId);
    try {
      const value = newParentId === '__none__' ? null : newParentId;
      const { error } = await supabase
        .from('profiles')
        .update({ parent_id: value })
        .eq('user_id', profileUserId);

      if (error) {
        console.error('Manager update error:', error);
        toast.error(language === 'ko' ? '관리자 변경 실패' : 'Failed to change manager');
      } else {
        toast.success(language === 'ko' ? '관리자가 변경되었습니다' : 'Manager updated');
        // Update local state
        setProfiles(prev =>
          prev.map(p => p.user_id === profileUserId ? { ...p, parent_id: value } : p)
        );
      }
    } catch (err) {
      toast.error(language === 'ko' ? '관리자 변경 실패' : 'Failed to change manager');
    } finally {
      setUpdatingManager(null);
    }
  };

  const handleToggleAdmin = async (profile: Profile) => {
    const isCurrentlyAdmin = adminUserIds.has(profile.user_id);
    setTogglingAdmin(profile.user_id);

    try {
      if (isCurrentlyAdmin) {
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
      birthday: profile.birthday || '',
      preferred_language: profile.preferred_language || 'en',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editingProfile) return;

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
        birthday: formData.birthday || null,
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

  const handleDelete = async () => {
    if (!deleteTarget || !user) return;

    const { error } = await supabase
      .from('profiles')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by: user.id,
      })
      .eq('id', deleteTarget.id);

    if (error) {
      toast.error(language === 'ko' ? '삭제 실패' : 'Delete failed');
      console.error('Delete error:', error);
    } else {
      toast.success(language === 'ko' ? '고객이 삭제되었습니다' : 'Client deleted');
      fetchData();
    }
    setDeleteTarget(null);
  };

  const handlePermanentDelete = async () => {
    if (!permanentDeleteTarget) return;

    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', permanentDeleteTarget.id);

    if (error) {
      toast.error(language === 'ko' ? '영구 삭제 실패' : 'Permanent delete failed');
      console.error('Permanent delete error:', error);
    } else {
      toast.success(language === 'ko' ? '고객이 영구 삭제되었습니다' : 'Client permanently deleted');
      fetchData();
    }
    setPermanentDeleteTarget(null);
  };

  const handleRestore = async (profile: Profile) => {
    const { error } = await supabase
      .from('profiles')
      .update({
        is_deleted: false,
        deleted_at: null,
        deleted_by: null,
        is_rejected: false,
        rejected_at: null,
        rejected_by: null,
      })
      .eq('id', profile.id);

    if (error) {
      toast.error(language === 'ko' ? '복원 실패' : 'Restore failed');
    } else {
      toast.success(language === 'ko' ? '고객이 복원되었습니다' : 'Client restored');
      fetchData();
    }
  };

  const activeProfiles = profiles.filter(p => !p.is_deleted);
  const deletedProfiles = profiles.filter(p => p.is_deleted);

  const filteredProfiles = activeProfiles.filter(
    (p) =>
      (p.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.full_name_ko && p.full_name_ko.includes(searchTerm))) &&
      (managerFilter === '__all__' || 
       (managerFilter === '__unassigned__' ? !p.parent_id : p.parent_id === managerFilter))
  );

  const filteredDeleted = deletedProfiles.filter(
    (p) =>
      p.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.full_name_ko && p.full_name_ko.includes(searchTerm))
  );

  // Group active profiles by manager
  const groupedByManager = filteredProfiles.reduce<Record<string, Profile[]>>((acc, p) => {
    const key = p.parent_id || '__unassigned__';
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  const roleOrder: Record<string, number> = {
    webmaster: 0, district_manager: 1, deputy_district_manager: 2,
    principal_agent: 3, agent: 4, client: 5,
  };

  // Sort manager keys: by role level, then name, unassigned last
  const managerKeys = Object.keys(groupedByManager).sort((a, b) => {
    if (a === '__unassigned__') return 1;
    if (b === '__unassigned__') return -1;
    const profileA = profiles.find(p => p.user_id === a);
    const profileB = profiles.find(p => p.user_id === b);
    const levelA = roleOrder[profileA?.sales_role || ''] ?? 99;
    const levelB = roleOrder[profileB?.sales_role || ''] ?? 99;
    if (levelA !== levelB) return levelA - levelB;
    const nameA = getManagerName(a) || '';
    const nameB = getManagerName(b) || '';
    return nameA.localeCompare(nameB);
  });

  const toggleManagerExpand = (key: string) => {
    setExpandedManagers(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const expandAll = () => setExpandedManagers(new Set(managerKeys));
  const collapseAll = () => setExpandedManagers(new Set());

  const renderRows = (list: Profile[], isDeletedSection: boolean) => {
    if (loading) {
      return Array.from({ length: 3 }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: isDeletedSection ? 8 : 10 }).map((_, j) => (
            <TableCell key={j}><Skeleton className="h-5 w-24" /></TableCell>
          ))}
        </TableRow>
      ));
    }

    if (list.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={isDeletedSection ? 8 : 10} className="text-center py-8 text-muted-foreground">
            {language === 'ko' ? '데이터가 없습니다' : 'No data found'}
          </TableCell>
        </TableRow>
      );
    }

    return list.map((profile) => (
      <TableRow key={profile.id}>
        <TableCell className="font-medium max-w-[120px] sm:max-w-none truncate">{profile.email}</TableCell>
        <TableCell>
          <div>
            <div className="text-xs sm:text-sm">{profile.full_name}</div>
            {profile.full_name_ko && (
              <div className="text-xs text-muted-foreground">{profile.full_name_ko}</div>
            )}
          </div>
        </TableCell>
        <TableCell className="hidden md:table-cell">{profile.phone || '-'}</TableCell>
        {!isDeletedSection && <TableCell className="hidden lg:table-cell max-w-[150px] truncate">{profile.address || '-'}</TableCell>}
        <TableCell className="hidden md:table-cell">{profile.birthday ? formatDate(profile.birthday) : '-'}</TableCell>
        <TableCell className="hidden sm:table-cell whitespace-nowrap">{isDeletedSection && profile.deleted_at ? formatDate(profile.deleted_at) : formatDate(profile.created_at)}</TableCell>
        {!isDeletedSection && (
          <TableCell className="min-w-[90px] sm:min-w-[160px] max-w-[120px] sm:max-w-none">
            <Select
              value={profile.parent_id || '__none__'}
              onValueChange={(val) => handleManagerChange(profile.user_id, val)}
              disabled={updatingManager === profile.user_id}
            >
              <SelectTrigger className="h-7 sm:h-8 text-[10px] sm:text-xs w-full">
                <SelectValue placeholder={language === 'ko' ? '선택' : 'Select'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">
                  {language === 'ko' ? '없음' : 'None'}
                </SelectItem>
                {salesMembers
                  .filter(m => m.user_id !== profile.user_id)
                  .map(m => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      <span className="flex items-center gap-1 whitespace-nowrap">
                        {language === 'ko' && m.full_name_ko ? m.full_name_ko : m.full_name}
                        <span className="text-muted-foreground text-[10px]">
                          ({roleLabel(m.sales_role)})
                        </span>
                      </span>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </TableCell>
        )}
        {!isDeletedSection && (
          <TableCell className="text-center">
            <Switch
              checked={adminUserIds.has(profile.user_id)}
              onCheckedChange={() => handleToggleAdmin(profile)}
              disabled={togglingAdmin === profile.user_id}
            />
          </TableCell>
        )}
        <TableCell>
          <div className="flex items-center gap-1">
            {isDeletedSection ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => handleRestore(profile)} title={language === 'ko' ? '복원' : 'Restore'}>
                  <RotateCcw className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setPermanentDeleteTarget(profile)} className="text-destructive hover:text-destructive" title={language === 'ko' ? '영구 삭제' : 'Permanently Delete'}>
                  <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => handleEdit(profile)}>
                  <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(profile)} className="text-destructive hover:text-destructive">
                  <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
              </>
            )}
          </div>
        </TableCell>
      </TableRow>
    ));
  };

  const renderTableHeader = (isDeletedSection: boolean) => (
    <TableHeader>
      <TableRow>
        <TableHead className="whitespace-nowrap">{language === 'ko' ? '이메일' : 'Email'}</TableHead>
        <TableHead className="whitespace-nowrap">{language === 'ko' ? '이름' : 'Name'}</TableHead>
        <TableHead className="whitespace-nowrap hidden md:table-cell">{language === 'ko' ? '연락처' : 'Phone'}</TableHead>
        {!isDeletedSection && <TableHead className="whitespace-nowrap hidden lg:table-cell">{language === 'ko' ? '주소' : 'Address'}</TableHead>}
        <TableHead className="whitespace-nowrap hidden md:table-cell">{language === 'ko' ? '생년월일' : 'Birthday'}</TableHead>
        <TableHead className="whitespace-nowrap hidden sm:table-cell">{isDeletedSection ? (language === 'ko' ? '삭제일' : 'Deleted') : (language === 'ko' ? '가입일' : 'Joined')}</TableHead>
        {!isDeletedSection && <TableHead className="whitespace-nowrap">{language === 'ko' ? '담당자' : 'Manager'}</TableHead>}
        {!isDeletedSection && <TableHead className="text-center whitespace-nowrap">{language === 'ko' ? '관리자' : 'Admin'}</TableHead>}
        <TableHead className="whitespace-nowrap">{language === 'ko' ? '작업' : 'Actions'}</TableHead>
      </TableRow>
    </TableHeader>
  );

  // Unique managers for filter dropdown
  const uniqueManagers = useMemo(() => {
    const managerIds = new Set(activeProfiles.map(p => p.parent_id).filter(Boolean) as string[]);
    return Array.from(managerIds).map(id => {
      const m = profiles.find(p => p.user_id === id);
      return m ? { id, name: language === 'ko' && m.full_name_ko ? m.full_name_ko : m.full_name, role: m.sales_role } : null;
    }).filter(Boolean).sort((a, b) => (a!.name).localeCompare(b!.name));
  }, [profiles, activeProfiles, language]);

  return (
    <div className="space-y-6">
      {/* Active Clients */}
      <div className="card-elevated">
        <div className="p-4 sm:p-6 border-b border-border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          <h2 className="text-base sm:text-xl font-serif font-semibold">
            {language === 'ko' ? '고객 목록' : 'Client List'}
            <span className="text-muted-foreground text-xs ml-2">({filteredProfiles.length})</span>
          </h2>
          <div className="flex flex-col sm:flex-row gap-2">
            <Select value={managerFilter} onValueChange={setManagerFilter}>
              <SelectTrigger className="h-8 text-xs w-full sm:w-48">
                <SelectValue placeholder={language === 'ko' ? '담당자 필터' : 'Filter by manager'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{language === 'ko' ? '전체' : 'All'}</SelectItem>
                <SelectItem value="__unassigned__">{language === 'ko' ? '미배정' : 'Unassigned'}</SelectItem>
                {uniqueManagers.map(m => m && (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name} {m.role ? `(${roleLabel(m.role)})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative w-full sm:w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={language === 'ko' ? '검색...' : 'Search...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 text-sm h-8"
              />
            </div>
          </div>
        </div>

        {/* Expand/Collapse controls */}
        {managerFilter === '__all__' && managerKeys.length > 1 && (
          <div className="px-4 sm:px-6 py-2 border-b border-border flex gap-2">
            <Button variant="ghost" size="sm" className="text-xs h-6" onClick={expandAll}>
              <ChevronsUpDown className="h-3 w-3 mr-1" />
              {language === 'ko' ? '전체 펼치기' : 'Expand All'}
            </Button>
            <Button variant="ghost" size="sm" className="text-xs h-6" onClick={collapseAll}>
              {language === 'ko' ? '전체 접기' : 'Collapse All'}
            </Button>
          </div>
        )}

        {/* Grouped sections */}
        {managerFilter !== '__all__' ? (
          <div className="overflow-x-auto">
            <Table className="text-[11px] sm:text-xs">
              {renderTableHeader(false)}
              <TableBody>
                {renderRows(filteredProfiles, false)}
              </TableBody>
            </Table>
          </div>
        ) : (
          managerKeys.map(key => {
            const group = groupedByManager[key];
            const managerName = key === '__unassigned__'
              ? (language === 'ko' ? '미배정' : 'Unassigned')
              : getManagerName(key) || key;
            const isExpanded = expandedManagers.has(key);
            const managerProfile = key !== '__unassigned__' ? profiles.find(p => p.user_id === key) : null;
            const role = managerProfile?.sales_role;

            return (
              <div key={key} className="border-b border-border last:border-b-0">
                <button
                  onClick={() => toggleManagerExpand(key)}
                  className="w-full px-4 sm:px-6 py-2.5 flex items-center justify-between text-left hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    <span className="text-sm font-medium">{managerName}</span>
                    {role && <span className="text-[10px] text-muted-foreground">({roleLabel(role)})</span>}
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{group.length}</span>
                  </div>
                </button>
                {isExpanded && (
                  <div className="overflow-x-auto">
                    <Table className="text-[11px] sm:text-xs">
                      {renderTableHeader(false)}
                      <TableBody>
                        {renderRows(group, false)}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            );
          })
        )}

        {managerFilter === '__all__' && managerKeys.length === 0 && !loading && (
          <div className="p-8 text-center text-muted-foreground text-sm">
            {language === 'ko' ? '데이터가 없습니다' : 'No data found'}
          </div>
        )}
      </div>

      {/* Deleted Clients */}
      <div className="card-elevated">
        <button
          onClick={() => setShowDeleted(!showDeleted)}
          className="w-full p-6 flex items-center justify-between text-left border-b border-border"
        >
          <h2 className="text-xl font-serif font-semibold text-muted-foreground">
            {language === 'ko' ? `삭제된 고객 (${deletedProfiles.length})` : `Deleted Clients (${deletedProfiles.length})`}
          </h2>
          {showDeleted ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
        </button>
        {showDeleted && (
          <div className="overflow-x-auto">
            <Table className="text-[11px] sm:text-xs">
              {renderTableHeader(true)}
              <TableBody>
                {renderRows(filteredDeleted, true)}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
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
              <Input value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{language === 'ko' ? '이름 (한글)' : 'Name (Korean)'}</Label>
              <Input value={formData.full_name_ko} onChange={(e) => setFormData({ ...formData, full_name_ko: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{language === 'ko' ? '연락처' : 'Phone'}</Label>
              <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{language === 'ko' ? '주소' : 'Address'}</Label>
              <Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{language === 'ko' ? '생년월일' : 'Birthday'}</Label>
              <Input type="date" value={formData.birthday} onChange={(e) => setFormData({ ...formData, birthday: e.target.value })} />
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

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === 'ko' ? '고객 삭제' : 'Delete Client'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'ko'
                ? `"${deleteTarget?.full_name}" 고객을 삭제하시겠습니까? 삭제된 고객은 별도 보관되며 복원할 수 있습니다.`
                : `Are you sure you want to delete "${deleteTarget?.full_name}"? Deleted clients are archived and can be restored.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{language === 'ko' ? '취소' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {language === 'ko' ? '삭제' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Permanent Delete Confirmation */}
      <AlertDialog open={!!permanentDeleteTarget} onOpenChange={(open) => !open && setPermanentDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === 'ko' ? '⚠️ 영구 삭제' : '⚠️ Permanent Delete'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'ko'
                ? `"${permanentDeleteTarget?.full_name}" 고객을 영구적으로 삭제하시겠습니까? 이 작업은 되돌릴 수 없으며, 모든 데이터가 완전히 삭제됩니다.`
                : `Are you sure you want to permanently delete "${permanentDeleteTarget?.full_name}"? This action cannot be undone and all data will be permanently removed.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{language === 'ko' ? '취소' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={handlePermanentDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {language === 'ko' ? '영구 삭제' : 'Permanently Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
