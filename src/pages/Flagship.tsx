import { Header } from '@/components/Header';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, Package, FileText, PlayCircle, TrendingUp, BookOpen, Newspaper, Star, MessageSquare } from 'lucide-react';
import { FlagshipPortfolio } from '@/components/flagship/FlagshipPortfolio';

export default function Flagship() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();

  const sections = [
    { path: '/market-data', label: t('marketData'), icon: TrendingUp },
    { path: '/flagship', label: language === 'ko' ? '남산 포트폴리오' : 'Namsan Portfolio', icon: Star, active: true },
    { path: '/news', label: language === 'ko' ? '뉴스' : 'News', icon: Newspaper },
    { path: '/dashboard', label: t('dashboard'), icon: LayoutDashboard },
    { path: '/products', label: t('products'), icon: Package },
    { path: '/research', label: t('research'), icon: FileText },
    { path: '/blog', label: language === 'ko' ? '블로그' : 'Blog', icon: BookOpen },
    { path: '/videos', label: t('videos'), icon: PlayCircle },
    { path: '/board', label: language === 'ko' ? '고객의 소리' : 'Voice of Customer', icon: MessageSquare },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8">
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl font-serif font-semibold text-foreground">
            {language === 'ko' ? '남산 포트폴리오' : 'Namsan Portfolio'}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {language === 'ko' ? 'Namsan Flagship 투자 현황 및 시뮬레이터' : 'Namsan Flagship investment status & simulator'}
          </p>
        </div>

        <div className="mb-8 animate-fade-in" style={{ animationDelay: '50ms' }}>
          <p className="text-sm text-muted-foreground mb-3">
            {language === 'ko' ? '섹션으로 이동' : 'Navigate to section'}
          </p>
          <div className="flex flex-wrap gap-3">
            {sections.map((section) => (
              <Button
                key={section.path}
                variant={section.active ? "default" : "outline"}
                onClick={() => !section.active && navigate(section.path)}
                className={`flex items-center gap-2 ${section.active ? 'pointer-events-none' : ''}`}
              >
                <section.icon className="h-4 w-4" />
                {section.label}
              </Button>
            ))}
          </div>
        </div>

        <FlagshipPortfolio />
      </main>
    </div>
  );
}
