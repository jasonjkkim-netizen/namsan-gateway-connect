import { useState, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, UserPlus } from 'lucide-react';
import { z } from 'zod';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const ROLE_LEVELS: Record<string, number> = {
  webmaster: 0,
  district_manager: 1,
  deputy_district_manager: 2,
  principal_agent: 3,
  agent: 4,
  client: 5,
};

const ROLE_LABELS: Record<string, Record<string, string>> = {
  ko: {
    district_manager: '총괄관리',
    deputy_district_manager: '부총괄관리',
    principal_agent: '수석 에이전트',
    agent: '에이전트',
    client: '고객',
  },
  en: {
    district_manager: 'General Manager',
    deputy_district_manager: 'Deputy GM',
    principal_agent: 'Principal Agent',
    agent: 'Agent',
    client: 'Client',
  },
};

const memberSchema = z.object({
  email: z.string().email().max(255),
  fullName: z.string().min(1).max(100),
  phone: z.string().min(10).max(20),
  address: z.string().min(5).max(500),
  birthYear: z.string().min(4),
  birthMonth: z.string().min(1),
  birthDay: z.string().min(1),
});

const currentYear = new Date().getFullYear();
const years = Array.from({ length: currentYear - 1919 }, (_, i) => currentYear - i);
const months = Array.from({ length: 12 }, (_, i) => i + 1);
const days = Array.from({ length: 31 }, (_, i) => i + 1);

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddMemberDialog({ open, onOpenChange, onSuccess }: Props) {
  const { language } = useLanguage();
  const { user, profile } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Quick add state
  const [quickName, setQuickName] = useState('');

  const userSalesRole = (profile as any)?.sales_role;
  const userLevel = ROLE_LEVELS[userSalesRole] ?? 0;
  const isWebmaster = userSalesRole === 'webmaster';

  // Roles the user can add (only levels below their own)
  const availableRoles = useMemo(() => {
    return Object.entries(ROLE_LEVELS)
      .filter(([role, level]) => level > userLevel && role !== 'webmaster')
      .map(([role]) => role);
  }, [userLevel]);

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setFullName('');
    setPhone('');
    setAddress('');
    setBirthYear('');
    setBirthMonth('');
    setBirthDay('');
    setSelectedRole('');
    setQuickName('');
  };

  const handleSubmit = async () => {
    if (!user || !profile) return;

    const validation = memberSchema.safeParse({
      email, fullName, phone, address,
      birthYear, birthMonth, birthDay,
    });

    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    if (!selectedRole) {
      toast.error(language === 'ko' ? '역할을 선택해주세요' : 'Please select a role');
      return;
    }

    if (!password || password.length < 6) {
      toast.error(language === 'ko' ? '비밀번호는 6자 이상이어야 합니다' : 'Password must be at least 6 characters');
      return;
    }

    setSubmitting(true);
    try {
      const birthday = `${birthYear}-${birthMonth.padStart(2, '0')}-${birthDay.padStart(2, '0')}`;

      // Create the user via Supabase auth
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: fullName },
        },
      });

      if (signUpError) {
        toast.error(signUpError.message);
        setSubmitting(false);
        return;
      }

      if (!signUpData.user) {
        toast.error(language === 'ko' ? '사용자 생성 실패' : 'Failed to create user');
        setSubmitting(false);
        return;
      }

      // Wait for profile to be created by trigger, then update it
      let profileUpdated = false;
      for (let attempt = 0; attempt < 8; attempt++) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            phone,
            address,
            birthday,
            sales_role: selectedRole,
            parent_id: user.id,
            sales_status: 'pending',
          })
          .eq('user_id', signUpData.user.id);

        if (!updateError) {
          profileUpdated = true;
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (!profileUpdated) {
        toast.error(language === 'ko' ? '프로필 업데이트 실패' : 'Failed to update profile');
        setSubmitting(false);
        return;
      }

      // Send notifications to upper manager, admin, DM, webmaster
      try {
        await supabase.functions.invoke('notify-sales', {
          body: {
            type: 'member_added',
            user_id: signUpData.user.id,
            user_name: fullName,
            user_email: email,
            role: selectedRole,
            sponsor_id: user.id,
            sponsor_name: profile.full_name,
          },
        });
      } catch (e) {
        console.error('Member added notification failed:', e);
      }

      toast.success(
        language === 'ko'
          ? `${fullName}님이 추가되었습니다. 상위 관리자의 승인을 기다립니다.`
          : `${fullName} has been added. Waiting for upper manager approval.`
      );

      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      console.error('Add member error:', err);
      toast.error(err.message || (language === 'ko' ? '오류가 발생했습니다' : 'An error occurred'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickSubmit = async () => {
    if (!user || !profile) return;
    const name = quickName.trim();
    if (!name || name.length < 1) {
      toast.error(language === 'ko' ? '고객 이름을 입력해주세요' : 'Please enter client name');
      return;
    }
    if (name.length > 100) {
      toast.error(language === 'ko' ? '이름은 100자 이하여야 합니다' : 'Name must be 100 characters or less');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('register-quick-client', {
        body: { full_name: name },
      });

      if (error) {
        toast.error(error.message || (language === 'ko' ? '등록 실패' : 'Registration failed'));
        setSubmitting(false);
        return;
      }

      toast.success(
        language === 'ko'
          ? `${name}님이 간편 등록되었습니다. 나중에 상세 정보를 입력해주세요.`
          : `${name} has been quick-registered. Please add details later.`
      );

      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      console.error('Quick register error:', err);
      toast.error(err.message || (language === 'ko' ? '오류가 발생했습니다' : 'An error occurred'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            {language === 'ko' ? '하위 멤버 추가' : 'Add Downline Member'}
          </DialogTitle>
          <DialogDescription>
            {language === 'ko'
              ? '새로운 하위 멤버를 직접 추가합니다.'
              : 'Add a new downline member directly.'}
          </DialogDescription>
        </DialogHeader>

        {isWebmaster ? (
          <Tabs defaultValue="quick" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="quick">
                {language === 'ko' ? '간편 등록' : 'Quick Add'}
              </TabsTrigger>
              <TabsTrigger value="full">
                {language === 'ko' ? '상세 등록' : 'Full Registration'}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="quick" className="space-y-4 pt-2">
              <p className="text-xs text-muted-foreground">
                {language === 'ko'
                  ? '고객 이름만으로 빠르게 등록합니다. 이메일, 연락처 등은 나중에 입력할 수 있습니다.'
                  : 'Quickly register with just the client name. Email, phone, etc. can be added later.'}
              </p>
              <div className="space-y-2">
                <Label>{language === 'ko' ? '고객 이름' : 'Client Name'} *</Label>
                <Input
                  value={quickName}
                  onChange={(e) => setQuickName(e.target.value)}
                  placeholder={language === 'ko' ? '홍길동' : 'John Doe'}
                  maxLength={100}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                  {language === 'ko' ? '취소' : 'Cancel'}
                </Button>
                <Button onClick={handleQuickSubmit} disabled={submitting || !quickName.trim()}>
                  {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  {language === 'ko' ? '간편 등록' : 'Quick Add'}
                </Button>
              </DialogFooter>
            </TabsContent>

            <TabsContent value="full">
              <FullRegistrationForm
                language={language}
                availableRoles={availableRoles}
                selectedRole={selectedRole} setSelectedRole={setSelectedRole}
                fullName={fullName} setFullName={setFullName}
                email={email} setEmail={setEmail}
                password={password} setPassword={setPassword}
                phone={phone} setPhone={setPhone}
                address={address} setAddress={setAddress}
                birthYear={birthYear} setBirthYear={setBirthYear}
                birthMonth={birthMonth} setBirthMonth={setBirthMonth}
                birthDay={birthDay} setBirthDay={setBirthDay}
                submitting={submitting}
                onCancel={() => onOpenChange(false)}
                onSubmit={handleSubmit}
              />
            </TabsContent>
          </Tabs>
        ) : (
          <FullRegistrationForm
            language={language}
            availableRoles={availableRoles}
            selectedRole={selectedRole} setSelectedRole={setSelectedRole}
            fullName={fullName} setFullName={setFullName}
            email={email} setEmail={setEmail}
            password={password} setPassword={setPassword}
            phone={phone} setPhone={setPhone}
            address={address} setAddress={setAddress}
            birthYear={birthYear} setBirthYear={setBirthYear}
            birthMonth={birthMonth} setBirthMonth={setBirthMonth}
            birthDay={birthDay} setBirthDay={setBirthDay}
            submitting={submitting}
            onCancel={() => onOpenChange(false)}
            onSubmit={handleSubmit}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Full Registration Sub-Component ---------- */

interface FullFormProps {
  language: string;
  availableRoles: string[];
  selectedRole: string; setSelectedRole: (v: string) => void;
  fullName: string; setFullName: (v: string) => void;
  email: string; setEmail: (v: string) => void;
  password: string; setPassword: (v: string) => void;
  phone: string; setPhone: (v: string) => void;
  address: string; setAddress: (v: string) => void;
  birthYear: string; setBirthYear: (v: string) => void;
  birthMonth: string; setBirthMonth: (v: string) => void;
  birthDay: string; setBirthDay: (v: string) => void;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}

function FullRegistrationForm({
  language, availableRoles,
  selectedRole, setSelectedRole,
  fullName, setFullName,
  email, setEmail,
  password, setPassword,
  phone, setPhone,
  address, setAddress,
  birthYear, setBirthYear,
  birthMonth, setBirthMonth,
  birthDay, setBirthDay,
  submitting, onCancel, onSubmit,
}: FullFormProps) {
  return (
    <>
      <div className="space-y-4 py-2">
        <div className="space-y-2">
          <Label>{language === 'ko' ? '역할' : 'Role'} *</Label>
          <Select value={selectedRole} onValueChange={setSelectedRole}>
            <SelectTrigger>
              <SelectValue placeholder={language === 'ko' ? '역할 선택' : 'Select role'} />
            </SelectTrigger>
            <SelectContent>
              {availableRoles.map((role) => (
                <SelectItem key={role} value={role}>
                  {ROLE_LABELS[language]?.[role] || role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{language === 'ko' ? '성명' : 'Full Name'} *</Label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Kim Minsoo" />
        </div>

        <div className="space-y-2">
          <Label>{language === 'ko' ? '이메일' : 'Email'} *</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>

        <div className="space-y-2">
          <Label>{language === 'ko' ? '임시 비밀번호' : 'Temporary Password'} *</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          <p className="text-xs text-muted-foreground">
            {language === 'ko' ? '멤버에게 이 비밀번호를 전달해주세요' : 'Share this password with the member'}
          </p>
        </div>

        <div className="space-y-2">
          <Label>{language === 'ko' ? '연락처' : 'Phone'} *</Label>
          <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+82 10 1234 5678" />
        </div>

        <div className="space-y-2">
          <Label>{language === 'ko' ? '주소' : 'Address'} *</Label>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={language === 'ko' ? '서울시 강남구...' : '123 Main Street...'} />
        </div>

        <div className="space-y-2">
          <Label>{language === 'ko' ? '생년월일' : 'Date of Birth'} *</Label>
          <div className="grid grid-cols-3 gap-2">
            <Select value={birthYear} onValueChange={setBirthYear}>
              <SelectTrigger><SelectValue placeholder={language === 'ko' ? '년' : 'Year'} /></SelectTrigger>
              <SelectContent>{years.map((y) => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={birthMonth} onValueChange={setBirthMonth}>
              <SelectTrigger><SelectValue placeholder={language === 'ko' ? '월' : 'Month'} /></SelectTrigger>
              <SelectContent>{months.map((m) => <SelectItem key={m} value={m.toString()}>{m.toString().padStart(2, '0')}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={birthDay} onValueChange={setBirthDay}>
              <SelectTrigger><SelectValue placeholder={language === 'ko' ? '일' : 'Day'} /></SelectTrigger>
              <SelectContent>{days.map((d) => <SelectItem key={d} value={d.toString()}>{d.toString().padStart(2, '0')}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={submitting}>
          {language === 'ko' ? '취소' : 'Cancel'}
        </Button>
        <Button onClick={onSubmit} disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          {language === 'ko' ? '멤버 추가' : 'Add Member'}
        </Button>
      </DialogFooter>
    </>
  );
}
