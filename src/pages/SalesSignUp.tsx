import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageToggle } from '@/components/LanguageToggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import logo from '@/assets/logo.jpg';
import { z } from 'zod';
import { ArrowLeft, Building2, UserCog, Users, User } from 'lucide-react';

type SalesRole = 'district_manager' | 'principal_agent' | 'agent' | 'client';

const ROLE_CONFIG: Record<SalesRole, {
  labelEn: string;
  labelKo: string;
  descEn: string;
  descKo: string;
  icon: typeof Building2;
  color: string;
}> = {
  district_manager: {
    labelEn: 'General Manager',
    labelKo: '총괄관리',
    descEn: 'Top-level sales leader managing teams and territories',
    descKo: '팀과 지역을 관리하는 최상위 영업 리더',
    icon: Building2,
    color: 'text-blue-600',
  },
  principal_agent: {
    labelEn: 'Principal Agent',
    labelKo: '수석 에이전트',
    descEn: 'Create personal investments and manage downlines',
    descKo: '개인 투자 생성 및 하위 에이전트 관리',
    icon: UserCog,
    color: 'text-emerald-600',
  },
  agent: {
    labelEn: 'Agent',
    labelKo: '에이전트',
    descEn: 'Sponsor clients and lower agents',
    descKo: '고객 및 하위 에이전트 후원',
    icon: Users,
    color: 'text-amber-600',
  },
  client: {
    labelEn: 'Client',
    labelKo: '고객',
    descEn: 'Access your investment portfolio',
    descKo: '투자 포트폴리오 이용',
    icon: User,
    color: 'text-purple-600',
  },
};

const signUpSchema = z.object({
  email: z.string().email('Invalid email address').max(255),
  password: z.string().min(6, 'Password must be at least 6 characters').max(100),
  fullName: z.string().min(1, 'Name is required').max(100),
  phone: z.string().min(10, 'Phone number must be at least 10 digits').max(20),
  address: z.string().min(5, 'Address must be at least 5 characters').max(500),
  birthYear: z.string().min(4, 'Year is required'),
  birthMonth: z.string().min(1, 'Month is required'),
  birthDay: z.string().min(1, 'Day is required'),
  sponsorEmail: z.string().email('Invalid sponsor email').max(255).optional().or(z.literal('')),
});

const currentYear = new Date().getFullYear();
const years = Array.from({ length: currentYear - 1919 }, (_, i) => currentYear - i);
const months = Array.from({ length: 12 }, (_, i) => i + 1);
const days = Array.from({ length: 31 }, (_, i) => i + 1);

export default function SalesSignUp() {
  const [searchParams] = useSearchParams();
  const initialRole = (searchParams.get('role') as SalesRole) || null;

  const [selectedRole, setSelectedRole] = useState<SalesRole | null>(initialRole);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [sponsorEmail, setSponsorEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, loading: authLoading, signUp } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && user) {
      navigate('/market-data', { replace: true });
    }
  }, [user, authLoading, navigate]);

  if (authLoading || user) return null;

  // Role selection screen
  if (!selectedRole) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-secondary via-background to-secondary">
        <div className="absolute top-4 left-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {language === 'ko' ? '홈으로' : 'Back to Home'}
          </Button>
        </div>
        <div className="absolute top-4 right-4">
          <LanguageToggle />
        </div>

        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl">
            <div className="text-center mb-8">
              <div className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-2xl p-6 mb-6 inline-block">
                <img src={logo} alt="Namsan Korea" className="h-20 w-auto mx-auto drop-shadow-md" />
              </div>
              <h1 className="text-3xl font-serif font-semibold text-foreground mb-2">
                {language === 'ko' ? '남산 코리아 가입' : 'Join Namsan Korea'}
              </h1>
              <p className="text-muted-foreground">
                {language === 'ko' ? '가입 유형을 선택해주세요' : 'Select how you would like to join'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(Object.entries(ROLE_CONFIG) as [SalesRole, typeof ROLE_CONFIG[SalesRole]][]).map(([role, config]) => {
                const Icon = config.icon;
                return (
                  <button
                    key={role}
                    onClick={() => setSelectedRole(role)}
                    className="card-elevated p-6 text-left hover:border-accent/50 transition-all duration-200 hover:shadow-lg group"
                  >
                    <Icon className={`h-8 w-8 ${config.color} mb-3 group-hover:scale-110 transition-transform`} />
                    <h3 className="font-serif font-semibold text-foreground text-lg mb-1">
                      {language === 'ko' ? config.labelKo : config.labelEn}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {language === 'ko' ? config.descKo : config.descEn}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {language === 'ko' ? '이미 계정이 있으신가요?' : 'Already have an account?'}{' '}
                <span className="font-medium text-accent">
                  {language === 'ko' ? '로그인' : 'Sign In'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const roleConfig = ROLE_CONFIG[selectedRole];
  const needsSponsor = selectedRole !== 'district_manager';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validation = signUpSchema.safeParse({
        email, password, fullName, phone, address,
        birthYear, birthMonth, birthDay,
        sponsorEmail: needsSponsor ? sponsorEmail : '',
      });

      if (!validation.success) {
        toast.error(validation.error.errors[0].message);
        setLoading(false);
        return;
      }

      // Validate sponsor exists if required
      const ROLE_LEVELS: Record<string, number> = {
        district_manager: 1,
        principal_agent: 2,
        agent: 3,
        client: 4,
      };

      let sponsorUserId: string | null = null;
      if (needsSponsor && sponsorEmail) {
        const { data: sponsorProfile } = await supabase
          .from('profiles')
          .select('user_id, sales_role, sales_status')
          .eq('email', sponsorEmail)
          .maybeSingle();

        if (!sponsorProfile) {
          toast.error(language === 'ko' ? '스폰서 이메일을 찾을 수 없습니다' : 'Sponsor email not found');
          setLoading(false);
          return;
        }

        if (sponsorProfile.sales_status !== 'active') {
          toast.error(language === 'ko' ? '스폰서가 활성 상태가 아닙니다' : 'Sponsor is not active');
          setLoading(false);
          return;
        }

        // Role hierarchy validation: sponsor must be a higher role (lower level number)
        const sponsorLevel = ROLE_LEVELS[sponsorProfile.sales_role || ''] || 0;
        const myLevel = ROLE_LEVELS[selectedRole] || 0;

        if (sponsorLevel >= myLevel) {
          const sponsorRoleLabel = ROLE_CONFIG[sponsorProfile.sales_role as SalesRole];
          toast.error(
            language === 'ko'
              ? `${sponsorRoleLabel?.labelKo || sponsorProfile.sales_role}은(는) ${roleConfig.labelKo}를 후원할 수 없습니다. 상위 역할의 스폰서가 필요합니다.`
              : `A ${sponsorRoleLabel?.labelEn || sponsorProfile.sales_role} cannot sponsor a ${roleConfig.labelEn}. You need a sponsor with a higher role.`
          );
          setLoading(false);
          return;
        }

        if (sponsorProfile.sales_role === 'client') {
          toast.error(language === 'ko' ? '고객은 다른 사용자를 후원할 수 없습니다' : 'Clients cannot sponsor other users');
          setLoading(false);
          return;
        }

        sponsorUserId = sponsorProfile.user_id;
      }

      const birthday = `${birthYear}-${birthMonth.padStart(2, '0')}-${birthDay.padStart(2, '0')}`;

      const { error, data } = await signUp(email, password, fullName);
      if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
      }

      // Update profile with sales fields
      if (data?.user) {
        let profileUpdated = false;
        for (let attempt = 0; attempt < 5; attempt++) {
          const { error: updateError } = await supabase
            .from('profiles')
            .update({
              phone,
              address,
              birthday,
              sales_role: selectedRole,
              parent_id: sponsorUserId,
              sales_status: 'pending',
            })
            .eq('user_id', data.user.id);

          if (!updateError) {
            profileUpdated = true;
            break;
          }
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Notify admin
        try {
          await supabase.functions.invoke('notify-admin-signup', {
            body: {
              userName: fullName,
              userEmail: email,
              userPhone: phone,
              userAddress: address,
              userBirthday: birthday,
              salesRole: selectedRole,
              sponsorEmail: sponsorEmail || 'N/A',
              signupDate: new Date().toLocaleString('ko-KR', {
                timeZone: 'Asia/Seoul',
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit',
              }),
            },
          });
        } catch (notifyError) {
          console.error('Failed to send admin notification:', notifyError);
        }
      }

      toast.success(
        language === 'ko'
          ? '계정이 생성되었습니다! 이메일을 확인한 후 관리자 승인을 기다려주세요.'
          : 'Account created! Please verify your email and wait for admin approval.'
      );
      navigate('/login');
    } catch (err) {
      toast.error(language === 'ko' ? '오류가 발생했습니다' : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const RoleIcon = roleConfig.icon;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-secondary via-background to-secondary">
      <div className="absolute top-4 left-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedRole(null)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {language === 'ko' ? '역할 선택' : 'Choose Role'}
        </Button>
      </div>
      <div className="absolute top-4 right-4">
        <LanguageToggle />
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="card-elevated p-8 animate-fade-in">
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary mb-4">
                <RoleIcon className={`h-5 w-5 ${roleConfig.color}`} />
                <span className="font-medium text-sm">
                  {language === 'ko' ? roleConfig.labelKo : roleConfig.labelEn}
                </span>
              </div>
              <h1 className="text-2xl font-serif font-semibold text-foreground mb-1">
                {language === 'ko' ? '회원가입' : 'Sign Up'}
              </h1>
              <p className="text-sm text-muted-foreground">
                {language === 'ko' ? roleConfig.descKo : roleConfig.descEn}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">{language === 'ko' ? '성명' : 'Full Name'} *</Label>
                <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Kim Minsoo" required className="h-11" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">{language === 'ko' ? '이메일' : 'Email'} *</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required className="h-11" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">{language === 'ko' ? '비밀번호' : 'Password'} *</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required className="h-11" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">{language === 'ko' ? '연락처' : 'Phone Number'} *</Label>
                <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+82 10 1234 5678" required className="h-11" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">{language === 'ko' ? '주소' : 'Residential Address'} *</Label>
                <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder={language === 'ko' ? '서울시 강남구...' : '123 Main Street...'} required className="h-11" />
              </div>

              <div className="space-y-2">
                <Label>{language === 'ko' ? '생년월일' : 'Date of Birth'} *</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Select value={birthYear} onValueChange={setBirthYear} required>
                    <SelectTrigger className="h-11"><SelectValue placeholder={language === 'ko' ? '년' : 'Year'} /></SelectTrigger>
                    <SelectContent>{years.map((y) => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={birthMonth} onValueChange={setBirthMonth} required>
                    <SelectTrigger className="h-11"><SelectValue placeholder={language === 'ko' ? '월' : 'Month'} /></SelectTrigger>
                    <SelectContent>{months.map((m) => <SelectItem key={m} value={m.toString()}>{m.toString().padStart(2, '0')}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={birthDay} onValueChange={setBirthDay} required>
                    <SelectTrigger className="h-11"><SelectValue placeholder={language === 'ko' ? '일' : 'Day'} /></SelectTrigger>
                    <SelectContent>{days.map((d) => <SelectItem key={d} value={d.toString()}>{d.toString().padStart(2, '0')}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              {needsSponsor && (
                <div className="space-y-2">
                  <Label htmlFor="sponsorEmail">
                    {language === 'ko' ? '스폰서 이메일' : 'Sponsor Email'}
                    {selectedRole === 'client' ? '' : ' *'}
                  </Label>
                  <Input
                    id="sponsorEmail"
                    type="email"
                    value={sponsorEmail}
                    onChange={(e) => setSponsorEmail(e.target.value)}
                    placeholder={language === 'ko' ? '스폰서의 이메일 주소' : 'Your sponsor\'s email address'}
                    required={selectedRole !== 'client'}
                    className="h-11"
                  />
                  <p className="text-xs text-muted-foreground">
                    {language === 'ko'
                      ? '당신을 초대한 분의 이메일을 입력해주세요'
                      : 'Enter the email of the person who referred you'}
                  </p>
                </div>
              )}

              <Button type="submit" className="w-full h-11 btn-gold font-medium" disabled={loading}>
                {loading
                  ? (language === 'ko' ? '처리 중...' : 'Processing...')
                  : (language === 'ko' ? '가입 신청' : 'Submit Application')}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {language === 'ko' ? '이미 계정이 있으신가요?' : 'Already have an account?'}{' '}
                <span className="font-medium text-accent">{language === 'ko' ? '로그인' : 'Sign In'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
