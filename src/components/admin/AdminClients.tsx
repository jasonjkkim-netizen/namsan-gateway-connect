import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Plus, Edit, Search } from 'lucide-react';

interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  full_name_ko: string | null;
  phone: string | null;
  preferred_language: string | null;
  birthday: string | null;
  created_at: string;
}

export function AdminClients() {
  const { language, formatDate } = useLanguage();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    full_name: '',
    full_name_ko: '',
    phone: '',
    preferred_language: 'en',
  });

  useEffect(() => {
    fetchProfiles();
  }, []);

  async function fetchProfiles() {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error(language === 'ko' ? '고객 목록 조회 실패' : 'Failed to fetch clients');
    } else {
      setProfiles(data as Profile[]);
    }
    setLoading(false);
  }

  const handleEdit = (profile: Profile) => {
    setEditingProfile(profile);
    setFormData({
      full_name: profile.full_name,
      full_name_ko: profile.full_name_ko || '',
      phone: profile.phone || '',
      preferred_language: profile.preferred_language || 'en',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editingProfile) return;

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: formData.full_name,
        full_name_ko: formData.full_name_ko || null,
        phone: formData.phone || null,
        preferred_language: formData.preferred_language,
      })
      .eq('id', editingProfile.id);

    if (error) {
      toast.error(language === 'ko' ? '업데이트 실패' : 'Update failed');
    } else {
      toast.success(language === 'ko' ? '업데이트 완료' : 'Updated successfully');
      setDialogOpen(false);
      fetchProfiles();
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
              <TableHead>{language === 'ko' ? '생년월일' : 'Birthday'}</TableHead>
              <TableHead>{language === 'ko' ? '가입일' : 'Joined'}</TableHead>
              <TableHead>{language === 'ko' ? '작업' : 'Actions'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-24" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : filteredProfiles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
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
                  <TableCell>{profile.birthday ? formatDate(profile.birthday) : '-'}</TableCell>
                  <TableCell>{formatDate(profile.created_at)}</TableCell>
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
