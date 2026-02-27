import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageToggle } from './LanguageToggle';
import { Button } from '@/components/ui/button';
import { LogOut, Settings, BarChart3, ArrowLeft } from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { supabase } from '@/integrations/supabase/client';
import { ConsultationButton } from './ConsultationButton';
import logo from '@/assets/namsan-logo.png';

export function Header() {
  const { user, profile, signOut } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState(false);
  const salesRole = (profile as any)?.sales_role;
  const hasSalesRole = !!salesRole && salesRole !== 'client';
  const isAdminPage = location.pathname === '/admin';

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

  const ROLE_LABELS: Record<string, { en: string; ko: string }> = {
    webmaster: { en: 'Webmaster', ko: '웹마스터' },
    district_manager: { en: 'General Manager', ko: '총괄관리' },
    deputy_district_manager: { en: 'Deputy General Manager', ko: '부총괄관리' },
    principal_agent: { en: 'Principal Agent', ko: '수석 에이전트' },
    agent: { en: 'Agent', ko: '에이전트' },
    client: { en: 'Client', ko: '고객' },
  };

  // Default to Korean name
  const displayName = profile?.full_name_ko || profile?.full_name || user?.email;
  const roleLabel = salesRole ? (language === 'ko' ? ROLE_LABELS[salesRole]?.ko : ROLE_LABELS[salesRole]?.en) : null;

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="container flex h-16 md:h-24 items-center justify-between">
        <div className="flex items-center gap-2 md:gap-6 min-w-0">
          {/* Back button on admin page (mobile) */}
          {isAdminPage && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/market-data')}
              className="md:hidden h-7 w-7 p-0 shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <Link to={user ? "/market-data" : "/"} className="flex items-center gap-3 shrink-0">
            <img src={logo} alt="Namsan Partners" className="h-10 md:h-20 w-auto" />
          </Link>
        </div>

        <div className="flex items-center gap-1 md:gap-4">
          {/* Hide consultation button on admin page */}
          {!isAdminPage && (
            <ConsultationButton variant="gold" size="sm" className="h-7 px-2 text-xs md:h-9 md:px-3 md:text-sm" />
          )}
          <LanguageToggle />
          
          {user && (
            <>
              <NotificationBell />
              {hasSalesRole && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/sales-dashboard')}
                  className="flex items-center gap-1 md:gap-2 h-7 px-2 md:h-9 md:px-3"
                >
                  <BarChart3 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  <span className="hidden md:inline">{language === 'ko' ? '영업' : 'Sales'}</span>
                </Button>
              )}
              {(isAdmin || salesRole === 'webmaster') && !isAdminPage && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/admin')}
                  className="flex items-center gap-1 md:gap-2 h-7 px-2 md:h-9 md:px-3"
                >
                  <Settings className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  <span className="hidden md:inline">Admin</span>
                </Button>
              )}
              {/* Show back to market button on admin page (desktop) */}
              {isAdminPage && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/market-data')}
                  className="hidden md:flex items-center gap-2 h-9 px-3"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {language === 'ko' ? '시장 데이터' : 'Market Data'}
                </Button>
              )}
              <div className="hidden md:flex flex-col items-end">
                <span className="text-sm text-foreground font-medium">{displayName}</span>
                {roleLabel && (
                  <span className="text-[10px] text-muted-foreground">{roleLabel}</span>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="flex items-center gap-1 md:gap-2 h-7 px-2 md:h-9 md:px-3"
              >
                <LogOut className="h-3.5 w-3.5 md:h-4 md:w-4" />
                <span className="hidden md:inline">{t('logout')}</span>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
