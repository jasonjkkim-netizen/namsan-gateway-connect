import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageToggle } from './LanguageToggle';
import { Button } from '@/components/ui/button';
import { 
  LayoutDashboard, 
  Package, 
  FileText, 
  PlayCircle, 
  TrendingUp, 
  LogOut,
  Menu,
  X,
  Settings,
  Home
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import logo from '@/assets/logo.jpg';

export function Header() {
  const { user, profile, signOut } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

  const navItems = [
    { path: '/', label: language === 'ko' ? '홈' : 'Home', icon: Home },
    { path: '/market-data', label: t('marketData'), icon: TrendingUp },
    { path: '/dashboard', label: t('dashboard'), icon: LayoutDashboard },
    { path: '/products', label: t('products'), icon: Package },
    { path: '/research', label: t('research'), icon: FileText },
    { path: '/videos', label: t('videos'), icon: PlayCircle },
  ];

  // Add admin link if user is admin
  if (isAdmin) {
    navItems.push({ 
      path: '/admin', 
      label: language === 'ko' ? '관리자' : 'Admin', 
      icon: Settings 
    });
  }

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
          
          {user && (
            <nav className="hidden lg:flex items-center gap-1">
              {navItems.map(({ path, label, icon: Icon }) => (
                <Link
                  key={path}
                  to={path}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    path === '/'
                      ? 'text-accent hover:text-accent/80 hover:bg-accent/10'
                      : location.pathname === path
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${path === '/' ? 'text-accent' : ''}`} />
                  {label}
                </Link>
              ))}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-4">
          <LanguageToggle />
          
          {user && (
            <>
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

          {user && (
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          )}
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && user && (
        <div className="lg:hidden border-t border-border bg-card">
          <nav className="container py-4 flex flex-col gap-2">
            {navItems.map(({ path, label, icon: Icon }) => (
              <Link
                key={path}
                to={path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors ${
                  path === '/'
                    ? 'text-accent border border-accent/20 bg-accent/5'
                    : location.pathname === path
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <Icon className={`h-5 w-5 ${path === '/' ? 'text-accent' : ''}`} />
                {label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
