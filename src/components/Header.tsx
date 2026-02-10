import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageToggle } from './LanguageToggle';
import { Button } from '@/components/ui/button';
import { LogOut, Settings } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ConsultationButton } from './ConsultationButton';
import logo from '@/assets/namsan-logo.png';

export function Header() {
  const { user, profile, signOut } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function checkAdminRole() {
      if (!user) {
        setIsAdmin(false);
        return;
      }

      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      setIsAdmin(!!data);
    }

    checkAdminRole();
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const displayName = language === 'ko' && profile?.full_name_ko 
    ? profile.full_name_ko 
    : profile?.full_name || user?.email;

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to={user ? "/market-data" : "/"} className="flex items-center gap-3">
            <img src={logo} alt="Namsan Partners" className="h-20 w-auto" />
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <ConsultationButton variant="gold" size="sm" />
          <LanguageToggle />
          
          {user && (
            <>
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/admin')}
                  className="flex items-center gap-2"
                >
                  <Settings className="h-4 w-4" />
                  <span className="hidden md:inline">Admin</span>
                </Button>
              )}
              <span className="hidden md:block text-sm text-muted-foreground">
                {displayName}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden md:inline">{t('logout')}</span>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
