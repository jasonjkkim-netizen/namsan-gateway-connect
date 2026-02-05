import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageToggle } from '@/components/LanguageToggle';
import { Button } from '@/components/ui/button';
import { ArrowRight, Shield, TrendingUp, Users } from 'lucide-react';
import logo from '@/assets/logo.jpg';

export default function Home() {
  const { language } = useLanguage();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-50 px-6 py-4">
        <div className="container flex items-center justify-between">
          <img src={logo} alt="Namsan Korea" className="h-16 w-auto" />
          <LanguageToggle />
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-semibold text-foreground leading-tight">
            {language === 'ko' 
              ? '남산 코리아' 
              : 'Namsan Korea'}
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground font-light">
            {language === 'ko'
              ? '한국 대체투자 전문 외부자산운용사'
              : 'Korea-Focused Alternative Investment Specialist'}
          </p>

          <div className="pt-8">
            <Link to="/login">
              <Button 
                size="lg" 
                className="btn-gold text-lg px-8 py-6 h-auto group"
              >
                {language === 'ko' ? '클라이언트 로그인' : 'Client Login'}
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Features Section */}
        <div className="absolute bottom-16 left-0 right-0 px-6">
          <div className="container max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
              <div className="space-y-2">
                <Shield className="h-8 w-8 mx-auto text-accent" />
                <h3 className="font-medium text-foreground">
                  {language === 'ko' ? '전문성' : 'Expertise'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {language === 'ko' 
                    ? '한국 시장에 특화된 투자 전략' 
                    : 'Specialized Korean market strategies'}
                </p>
              </div>
              <div className="space-y-2">
                <TrendingUp className="h-8 w-8 mx-auto text-accent" />
                <h3 className="font-medium text-foreground">
                  {language === 'ko' ? '성과' : 'Performance'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {language === 'ko' 
                    ? '검증된 투자 실적' 
                    : 'Proven investment track record'}
                </p>
              </div>
              <div className="space-y-2">
                <Users className="h-8 w-8 mx-auto text-accent" />
                <h3 className="font-medium text-foreground">
                  {language === 'ko' ? '파트너십' : 'Partnership'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {language === 'ko' 
                    ? '글로벌 기관 투자자와 협력' 
                    : 'Global institutional partnerships'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-sm text-muted-foreground border-t border-border">
        <div className="container">
          © {new Date().getFullYear()} Namsan Korea. {language === 'ko' ? '모든 권리 보유.' : 'All rights reserved.'}
        </div>
      </footer>
    </div>
  );
}
