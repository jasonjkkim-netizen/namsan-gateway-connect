import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageToggle } from '@/components/LanguageToggle';
import { Button } from '@/components/ui/button';
import logo from '@/assets/logo.jpg';
import heroImage from '@/assets/hero-mountain.jpg';

export default function Home() {
  const { language } = useLanguage();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-50 px-6 py-4 bg-white/90 backdrop-blur-sm">
        <div className="container flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Namsan Korea" className="h-12 w-auto" />
            <span className="text-lg font-semibold text-primary hidden sm:inline">
              Namsan Korea
            </span>
          </div>
          <nav className="flex items-center gap-6">
            <a 
              href="#about" 
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hidden md:inline"
            >
              {language === 'ko' ? '회사소개' : 'About Us'}
            </a>
            <a 
              href="#contact" 
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hidden md:inline"
            >
              {language === 'ko' ? '연락처' : 'Contact'}
            </a>
            <LanguageToggle />
          </nav>
        </div>
      </header>

      {/* Hero Section with Full-Height Background */}
      <section className="relative min-h-[70vh] flex items-center justify-center">
        {/* Background Image */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${heroImage})` }}
        >
          <div className="absolute inset-0 bg-black/30" />
        </div>
        
        {/* Hero Content */}
        <div className="relative z-10 text-center text-white px-6 max-w-4xl mx-auto pt-20">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-serif font-medium leading-relaxed mb-6 drop-shadow-lg">
            {language === 'ko' 
              ? '변화하는 시장 속에서도 흔들리지 않는 기반' 
              : 'An unshaken foundation, through every turn of the market'}
          </h1>
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
                ? '비바람이나 맑은 날씨, 어둠과 빛, 그리고 시장의 모든 변화에도 굳건히 서 있는 견고한 요새.'
                : 'A steadfast stronghold, withstanding rain or shine, dark or light, and every turn of the market.'}
            </p>
          </div>

          {/* Client Login Button */}
          <div className="mt-12">
            <Link to="/login">
              <Button 
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-primary/90 px-8 py-6 h-auto text-base font-medium"
              >
                {language === 'ko' ? '고객 로그인' : 'Client Login'}
              </Button>
            </Link>
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
