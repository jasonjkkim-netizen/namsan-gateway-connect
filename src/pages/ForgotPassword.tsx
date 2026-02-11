import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageToggle } from '@/components/LanguageToggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import logo from '@/assets/logo.jpg';
import { z } from 'zod';

const emailSchema = z.string().email('Invalid email address').max(255);

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { language } = useLanguage();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = emailSchema.safeParse(email);
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        toast.error(error.message);
      } else {
        setSent(true);
        toast.success(
          language === 'ko'
            ? '비밀번호 재설정 링크가 이메일로 전송되었습니다.'
            : 'Password reset link has been sent to your email.'
        );
      }
    } catch {
      toast.error(language === 'ko' ? '오류가 발생했습니다' : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-secondary via-background to-secondary">
      <div className="absolute top-4 left-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/login')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {language === 'ko' ? '로그인으로' : 'Back to Login'}
        </Button>
      </div>
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
                {language === 'ko' ? '비밀번호 찾기' : 'Forgot Password'}
              </h1>
              <p className="text-muted-foreground mt-2">
                {language === 'ko'
                  ? '가입한 이메일 주소를 입력하면 비밀번호 재설정 링크를 보내드립니다.'
                  : 'Enter your email address and we will send you a password reset link.'}
              </p>
            </div>

            {sent ? (
              <div className="text-center space-y-4">
                <div className="bg-primary/10 rounded-lg p-4">
                  <p className="text-sm text-foreground">
                    {language === 'ko'
                      ? '이메일을 확인해주세요. 비밀번호 재설정 링크가 전송되었습니다. 이메일이 보이지 않으면 스팸 폴더를 확인해주세요.'
                      : 'Please check your email. A password reset link has been sent. If you don\'t see it, check your spam folder.'}
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => navigate('/login')}
                  className="w-full h-11"
                >
                  {language === 'ko' ? '로그인으로 돌아가기' : 'Back to Login'}
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email">{language === 'ko' ? '이메일' : 'Email'} *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
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
                    ? (language === 'ko' ? '전송 중...' : 'Sending...')
                    : (language === 'ko' ? '재설정 링크 전송' : 'Send Reset Link')}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
