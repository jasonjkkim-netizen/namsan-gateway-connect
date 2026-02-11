import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageToggle } from '@/components/LanguageToggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import logo from '@/assets/logo.jpg';
import { z } from 'zod';

const passwordSchema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters').max(100),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const [checking, setChecking] = useState(true);
  const { language } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    // Listen for PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsValidSession(true);
      }
      setChecking(false);
    });

    // Also check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsValidSession(true);
      }
      setChecking(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = passwordSchema.safeParse({ password, confirmPassword });
    if (!validation.success) {
      toast.error(
        language === 'ko' && validation.error.errors[0].message === 'Passwords do not match'
          ? '비밀번호가 일치하지 않습니다'
          : language === 'ko' && validation.error.errors[0].message.includes('at least 6')
          ? '비밀번호는 최소 6자 이상이어야 합니다'
          : validation.error.errors[0].message
      );
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success(
          language === 'ko'
            ? '비밀번호가 성공적으로 변경되었습니다.'
            : 'Password has been updated successfully.'
        );
        navigate('/login');
      }
    } catch {
      toast.error(language === 'ko' ? '오류가 발생했습니다' : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return null;
  }

  if (!isValidSession) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-secondary via-background to-secondary">
        <div className="absolute top-4 right-4">
          <LanguageToggle />
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <div className="card-elevated p-8 animate-fade-in text-center">
              <div className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-2xl p-6 mb-6 inline-block">
                <img src={logo} alt="Namsan Korea" className="h-24 w-auto mx-auto drop-shadow-md" />
              </div>
              <h1 className="text-2xl font-serif font-semibold text-foreground mb-4">
                {language === 'ko' ? '링크가 만료되었습니다' : 'Link Expired'}
              </h1>
              <p className="text-muted-foreground mb-6">
                {language === 'ko'
                  ? '비밀번호 재설정 링크가 만료되었거나 유효하지 않습니다. 다시 요청해주세요.'
                  : 'This password reset link has expired or is invalid. Please request a new one.'}
              </p>
              <Button onClick={() => navigate('/forgot-password')} className="w-full h-11 btn-gold font-medium">
                {language === 'ko' ? '다시 요청하기' : 'Request New Link'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-secondary via-background to-secondary">
      <div className="absolute top-4 right-4">
        <LanguageToggle />
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="card-elevated p-8 animate-fade-in">
            <div className="text-center mb-8">
              <div className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-2xl p-6 mb-6 inline-block">
                <img src={logo} alt="Namsan Korea" className="h-24 w-auto mx-auto drop-shadow-md" />
              </div>
              <h1 className="text-2xl font-serif font-semibold text-foreground mb-2">
                {language === 'ko' ? '새 비밀번호 설정' : 'Set New Password'}
              </h1>
              <p className="text-muted-foreground mt-2">
                {language === 'ko' ? '새로운 비밀번호를 입력해주세요.' : 'Please enter your new password.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="password">
                  {language === 'ko' ? '새 비밀번호' : 'New Password'} *
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">
                  {language === 'ko' ? '비밀번호 확인' : 'Confirm Password'} *
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="h-11"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-11 btn-gold font-medium"
                disabled={loading}
              >
                {loading
                  ? (language === 'ko' ? '변경 중...' : 'Updating...')
                  : (language === 'ko' ? '비밀번호 변경' : 'Update Password')}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
