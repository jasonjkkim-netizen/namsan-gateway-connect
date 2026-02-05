import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { LanguageToggle } from '@/components/LanguageToggle';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';
import logo from '@/assets/logo.jpg';

export default function Home() {
  const { language } = useLanguage();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Redirect logged-in users to dashboard
  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, loading, navigate]);

  // Show nothing while checking auth to prevent flash
  if (loading || user) {
    return null;
  }

  const navLinks = [
    { href: '#about', label: language === 'ko' ? '회사소개' : 'About Us' },
    { href: '#contact', label: language === 'ko' ? '연락처' : 'Contact' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-secondary via-background to-secondary">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-50 px-6 py-4">
        <div className="container flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Namsan Korea" className="h-12 w-auto" />
            <span className="text-lg font-semibold text-primary hidden sm:inline">
              Namsan Korea
            </span>
          </div>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <a 
                key={link.href}
                href={link.href} 
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </a>
            ))}
            <Link to="/login">
              <Button variant="outline" size="sm">
                {language === 'ko' ? '고객 로그인' : 'Client Login'}
              </Button>
            </Link>
            <LanguageToggle />
          </nav>

          {/* Mobile Menu Button */}
          <div className="flex items-center gap-3 md:hidden">
            <LanguageToggle />
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 text-foreground hover:bg-muted rounded-md transition-colors"
              aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-background border-b border-border shadow-lg animate-fade-in">
            <nav className="container py-4 flex flex-col gap-2">
              {navLinks.map((link) => (
                <a 
                  key={link.href}
                  href={link.href} 
                  className="px-4 py-3 text-base font-medium text-foreground hover:bg-muted rounded-md transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              <Link 
                to="/login" 
                className="px-4 py-3 text-base font-medium text-accent hover:bg-muted rounded-md transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {language === 'ko' ? '고객 로그인' : 'Client Login'}
              </Link>
            </nav>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="flex-1 flex items-center justify-center pt-24 pb-16 px-6">
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-serif font-medium leading-relaxed mb-6 text-foreground">
            {language === 'ko' 
              ? '변화하는 시장 속에서도 흔들리지 않는 기반' 
              : 'An unshaken foundation, through every turn of the market'}
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            {language === 'ko'
              ? '아시아 중심 패밀리 오피스 투자 전문가'
              : 'Asia Focused Family Office Investment Specialist'}
          </p>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-16 md:py-24 px-6 bg-background">
        <div className="container max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-serif font-semibold text-foreground mb-8">
            {language === 'ko' ? '남산 코리아' : 'Namsan Korea'}
          </h2>
          
          <div className="space-y-6 text-muted-foreground leading-relaxed">
            <p className="text-lg">
              {language === 'ko'
                ? '남산코리아는 아시아 지역의 고액자산가 고객을 위한 외부자산운용 서비스를 제공하고 있습니다.'
                : 'Namsan Korea has expanded External Asset Management services for clients with high-net worths in the Asia region.'}
            </p>
            
            <p className="text-lg">
              {language === 'ko'
                ? '엄격한 리스크 관리와 혁신적인 투자 전략을 통해, 경험이 풍부한 투자팀이 고객에게 보수적이면서도 시장을 상회하는 성과를 제공하기 위해 노력합니다.'
                : 'Through rigorous risk management and innovative investment strategies, our experienced investment team strives to deliver conservative yet above market results to our clients.'}
            </p>

            <p className="text-lg italic text-foreground/80">
              {language === 'ko'
                ? '오랜 신뢰와 견고한 파트너십을 바탕으로, 지속적인 투자 성과를 함께 만들어 갑니다.'
                : 'Built on enduring trust and lasting partnerships, we deliver consistent investment returns together.'}
            </p>
          </div>

        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-16 md:py-24 px-6 bg-muted/50">
        <div className="container max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-serif font-semibold text-foreground mb-8">
            {language === 'ko' ? '연락처' : "Let's Connect"}
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {language === 'ko' ? '주소' : 'Address'}
              </h3>
              <p className="text-foreground">
                {language === 'ko' 
                  ? '서울특별시 중구 남산동'
                  : 'Namsan-dong, Jung-gu'}
                <br />
                {language === 'ko' ? '서울, 대한민국' : 'Seoul, South Korea'}
              </p>
            </div>
            
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {language === 'ko' ? '이메일' : 'Email'}
              </h3>
              <a 
                href="mailto:info@namsankorea.com" 
                className="text-foreground hover:text-accent transition-colors"
              >
                info@namsankorea.com
              </a>
            </div>
            
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {language === 'ko' ? '전화' : 'Phone'}
              </h3>
              <p className="text-foreground">+82 2 1234 5678</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 bg-primary text-primary-foreground">
        <div className="container max-w-4xl mx-auto text-center text-sm opacity-80">
          © {new Date().getFullYear()} Namsan Korea. {language === 'ko' ? '모든 권리 보유.' : 'All rights reserved.'}
        </div>
      </footer>
    </div>
  );
}
