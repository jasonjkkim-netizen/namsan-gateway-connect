import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageToggle } from '@/components/LanguageToggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import logo from '@/assets/logo.jpg';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Invalid email address').max(255),
  password: z.string().min(6, 'Password must be at least 6 characters').max(100),
});

const signUpSchema = loginSchema.extend({
  fullName: z.string().min(1, 'Name is required').max(100),
});

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        const validation = signUpSchema.safeParse({ email, password, fullName });
        if (!validation.success) {
          toast.error(validation.error.errors[0].message);
          setLoading(false);
          return;
        }

        const { error } = await signUp(email, password, fullName);
        if (error) {
          toast.error(error.message);
        } else {
          toast.success('Account created! Please check your email to verify your account.');
          setIsSignUp(false);
        }
      } else {
        const validation = loginSchema.safeParse({ email, password });
        if (!validation.success) {
          toast.error(validation.error.errors[0].message);
          setLoading(false);
          return;
        }

        const { error } = await signIn(email, password);
        if (error) {
          toast.error(error.message);
        } else {
          navigate('/dashboard');
        }
      }
    } catch (err) {
      toast.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-secondary via-background to-secondary">
      <div className="absolute top-4 right-4">
        <LanguageToggle />
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="card-elevated p-8 animate-fade-in">
            {/* Logo Section */}
            <div className="text-center mb-8">
              <div className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-2xl p-6 mb-6 inline-block">
                <img 
                  src={logo} 
                  alt="Namsan Korea" 
                  className="h-24 w-auto mx-auto drop-shadow-md" 
                />
              </div>
              <h1 className="text-2xl font-serif font-semibold text-foreground mb-2">
                {language === 'ko' ? '남산 코리아' : 'Namsan Korea'}
              </h1>
              <p className="text-sm text-accent font-medium tracking-wide uppercase">
                {t('clientPortal')}
              </p>
              <p className="text-muted-foreground mt-2">
                {isSignUp ? t('signUp') : t('welcomeBack')}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {isSignUp && (
                <div className="space-y-2">
                  <Label htmlFor="fullName">{t('fullName')}</Label>
                  <Input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Kim Minsoo"
                    required
                    className="h-11"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">{t('email')}</Label>
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

              <div className="space-y-2">
                <Label htmlFor="password">{t('password')}</Label>
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

              <Button
                type="submit"
                className="w-full h-11 btn-gold font-medium"
                disabled={loading}
              >
                {loading ? t('loading') : (isSignUp ? t('signUp') : t('signIn'))}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {isSignUp ? t('hasAccount') : t('noAccount')}{' '}
                <span className="font-medium text-accent">
                  {isSignUp ? t('signIn') : t('signUp')}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
