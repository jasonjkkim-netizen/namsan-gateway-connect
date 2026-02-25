import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageToggle } from './LanguageToggle';
import { Button } from '@/components/ui/button';
import { LogOut, Settings, BarChart3 } from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { supabase } from '@/integrations/supabase/client';
import { ConsultationButton } from './ConsultationButton';
import logo from '@/assets/namsan-logo.png';

export function Header() {
  const { user, profile, signOut } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const salesRole = (profile as any)?.sales_role;
  const hasSalesRole = !!salesRole && salesRole !== 'client';

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
      <div className="container flex h-24 items-center justify-between">
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
              <NotificationBell />
              {hasSalesRole && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/sales-dashboard')}
                  className="flex items-center gap-2"
                >
                  <BarChart3 className="h-4 w-4" />
                  <span className="hidden md:inline">{language === 'ko' ? '영업' : 'Sales'}</span>
                </Button>
              )}
              {(isAdmin || salesRole === 'webmaster') && (
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
