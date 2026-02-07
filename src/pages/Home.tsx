import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { LanguageToggle } from '@/components/LanguageToggle';
import { Button } from '@/components/ui/button';
import { Menu, X, TrendingUp, Shield, Users, Globe } from 'lucide-react';
import logo from '@/assets/logo.jpg';
import namsanTowerBg from '@/assets/namsan-tower-night.jpg';

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
    { href: '#philosophy', label: language === 'ko' ? '투자철학' : 'Philosophy' },
    { href: '#contact', label: language === 'ko' ? '연락처' : 'Contact' },
  ];

  const values = [
    {
      icon: Shield,
      titleKo: '안정적 수익',
      titleEn: 'Stable Returns',
      descKo: '장기적 관점에서 안정적인 수익을 추구합니다',
      descEn: 'Pursuing stable returns from a long-term perspective',
    },
    {
      icon: TrendingUp,
      titleKo: '전문성',
      titleEn: 'Expertise',
      descKo: '풍부한 경험을 바탕으로 한 전문적인 자산관리',
      descEn: 'Professional asset management based on extensive experience',
    },
    {
      icon: Users,
      titleKo: '신뢰',
      titleEn: 'Trust',
      descKo: '고객과의 신뢰를 최우선 가치로 삼습니다',
      descEn: 'We prioritize trust with our clients above all',
    },
    {
      icon: Globe,
      titleKo: '글로벌 네트워크',
      titleEn: 'Global Network',
      descKo: '아시아 전역의 투자 네트워크를 보유하고 있습니다',
      descEn: 'We have an investment network across Asia',
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border">
        <div className="container flex items-center justify-between h-20">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Namsan Korea" className="h-14 w-auto" />
            <span className="text-xl font-semibold text-primary hidden sm:inline tracking-wide">
              NAMSAN KOREA
            </span>
          </div>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a 
                key={link.href}
                href={link.href} 
                className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors tracking-wide"
              >
                {link.label}
              </a>
            ))}
            <Link to="/login">
              <Button variant="outline" size="sm" className="ml-4">
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
      <section 
        className="relative flex-1 flex items-center justify-center pt-32 pb-24 px-6 min-h-[80vh]"
        style={{
          backgroundImage: `url(${namsanTowerBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 bg-black/60" />
        
        <div className="relative z-10 text-center max-w-4xl mx-auto">
          <div className="mb-8">
            <span className="text-sm font-medium text-accent tracking-widest uppercase">
              {language === 'ko' ? '아시아 패밀리오피스 전문' : 'Asia Family Office Specialist'}
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-medium leading-tight mb-8 text-white">
            {language === 'ko' 
              ? '변화하는 시장 속에서도\n흔들리지 않는 기반' 
              : 'An Unshaken Foundation\nThrough Every Turn of the Market'}
          </h1>
          <p className="text-lg md:text-xl text-gray-200 mb-12 max-w-2xl mx-auto leading-relaxed">
            {language === 'ko'
              ? '장기적인 관점과 철저한 리스크 관리로\n고객의 자산 가치를 지켜갑니다'
              : 'Protecting your asset value through\nlong-term perspectives and thorough risk management'}
          </p>
          <a href="#about">
            <Button size="lg" className="px-8 py-6 text-base">
              {language === 'ko' ? '더 알아보기' : 'Learn More'}
            </Button>
          </a>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-24 md:py-32 px-6 bg-background">
        <div className="container max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-sm font-medium text-accent tracking-widest uppercase mb-4 block">
              About Us
            </span>
            <h2 className="text-3xl md:text-4xl font-serif font-semibold text-foreground">
              {language === 'ko' ? '남산 코리아' : 'Namsan Korea'}
            </h2>
          </div>
          
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6 text-muted-foreground leading-relaxed">
              <p className="text-lg">
                {language === 'ko'
                  ? '남산코리아는 아시아 지역의 고액자산가 고객을 위한 자산관리(Wealth Management) 서비스를 제공하고 있습니다.'
                  : 'Namsan Korea provides Wealth Management services for high-net-worth clients in the Asia region.'}
              </p>
              
              <p className="text-lg">
                {language === 'ko'
                  ? '엄격한 리스크 관리와 혁신적인 투자 전략을 통해, 경험이 풍부한 투자팀이 고객에게 보수적이면서도 시장을 상회하는 성과를 제공하기 위해 노력합니다.'
                  : 'Through rigorous risk management and innovative investment strategies, our experienced investment team strives to deliver conservative yet above-market results to our clients.'}
              </p>

              <p className="text-lg font-medium text-foreground">
                {language === 'ko'
                  ? '오랜 신뢰와 견고한 파트너십을 바탕으로, 지속적인 투자 성과를 함께 만들어 갑니다.'
                  : 'Built on enduring trust and lasting partnerships, we deliver consistent investment returns together.'}
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              {values.map((value, index) => (
                <div 
                  key={index}
                  className="p-6 rounded-lg bg-secondary/50 border border-border hover:border-accent/50 transition-colors"
                >
                  <value.icon className="h-8 w-8 text-accent mb-4" />
                  <h3 className="font-semibold text-foreground mb-2">
                    {language === 'ko' ? value.titleKo : value.titleEn}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {language === 'ko' ? value.descKo : value.descEn}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Philosophy Section */}
      <section id="philosophy" className="py-24 md:py-32 px-6 bg-secondary/30">
        <div className="container max-w-4xl mx-auto text-center">
          <span className="text-sm font-medium text-accent tracking-widest uppercase mb-4 block">
            Philosophy
          </span>
          <h2 className="text-3xl md:text-4xl font-serif font-semibold text-foreground mb-12">
            {language === 'ko' ? '투자 철학' : 'Investment Philosophy'}
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-8 bg-background rounded-lg border border-border">
              <div className="text-4xl font-serif text-accent mb-4">01</div>
              <h3 className="text-lg font-semibold text-foreground mb-3">
                {language === 'ko' ? '장기적 관점' : 'Long-term Perspective'}
              </h3>
              <p className="text-muted-foreground text-sm">
                {language === 'ko'
                  ? '단기 수익보다 장기적인 자산 증식에 초점을 맞춥니다'
                  : 'We focus on long-term asset growth rather than short-term gains'}
              </p>
            </div>
            
            <div className="p-8 bg-background rounded-lg border border-border">
              <div className="text-4xl font-serif text-accent mb-4">02</div>
              <h3 className="text-lg font-semibold text-foreground mb-3">
                {language === 'ko' ? '리스크 관리' : 'Risk Management'}
              </h3>
              <p className="text-muted-foreground text-sm">
                {language === 'ko'
                  ? '철저한 분석과 분산투자로 리스크를 최소화합니다'
                  : 'We minimize risk through thorough analysis and diversification'}
              </p>
            </div>
            
            <div className="p-8 bg-background rounded-lg border border-border">
              <div className="text-4xl font-serif text-accent mb-4">03</div>
              <h3 className="text-lg font-semibold text-foreground mb-3">
                {language === 'ko' ? '투명한 운용' : 'Transparent Management'}
              </h3>
              <p className="text-muted-foreground text-sm">
                {language === 'ko'
                  ? '정기적인 리포트와 소통으로 투명성을 유지합니다'
                  : 'We maintain transparency through regular reports and communication'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-24 md:py-32 px-6 bg-background">
        <div className="container max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-sm font-medium text-accent tracking-widest uppercase mb-4 block">
              Contact
            </span>
            <h2 className="text-3xl md:text-4xl font-serif font-semibold text-foreground">
              {language === 'ko' ? '연락처' : "Let's Connect"}
            </h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div className="p-8 rounded-lg bg-secondary/30 border border-border">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
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
            
            <div className="p-8 rounded-lg bg-secondary/30 border border-border">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                {language === 'ko' ? '이메일' : 'Email'}
              </h3>
              <a 
                href="mailto:info@namsankorea.com" 
                className="text-foreground hover:text-accent transition-colors"
              >
                info@namsankorea.com
              </a>
            </div>
            
            <div className="p-8 rounded-lg bg-secondary/30 border border-border">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                {language === 'ko' ? '전화' : 'Phone'}
              </h3>
              <p className="text-foreground">+82 2 1234 5678</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 bg-primary text-primary-foreground">
        <div className="container max-w-4xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src={logo} alt="Namsan Korea" className="h-10 w-auto brightness-0 invert" />
              <span className="font-semibold tracking-wide">NAMSAN KOREA</span>
            </div>
            <p className="text-sm opacity-80">
              © {new Date().getFullYear()} Namsan Korea. {language === 'ko' ? '모든 권리 보유.' : 'All rights reserved.'}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
