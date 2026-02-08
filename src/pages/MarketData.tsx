import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, Package, FileText, PlayCircle, TrendingUp, ExternalLink } from 'lucide-react';
import { MarketOverviewSection } from '@/components/market/MarketOverviewSection';
import { WeeklyStockPicksTable } from '@/components/market/WeeklyStockPicksTable';

const indexData = [
  {
    id: 'kospi',
    nameKo: 'KOSPI 지수',
    nameEn: 'KOSPI Index',
    symbol: 'KOSPI',
    link: 'https://finance.naver.com/sise/sise_index.naver?code=KOSPI',
    investingLink: 'https://www.investing.com/indices/kospi',
    color: 'from-blue-500 to-blue-600',
  },
  {
    id: 'kosdaq',
    nameKo: '코스닥 지수',
    nameEn: 'KOSDAQ Index',
    symbol: 'KOSDAQ',
    link: 'https://finance.naver.com/sise/sise_index.naver?code=KOSDAQ',
    investingLink: 'https://www.investing.com/indices/kosdaq',
    color: 'from-emerald-500 to-emerald-600',
  },
  {
    id: 'nasdaq',
    nameKo: '나스닥 100',
    nameEn: 'NASDAQ 100',
    symbol: 'NDX',
    link: 'https://www.investing.com/indices/nq-100',
    investingLink: 'https://www.investing.com/indices/nq-100',
    color: 'from-purple-500 to-purple-600',
  },
  {
    id: 'sp500',
    nameKo: 'S&P 500',
    nameEn: 'S&P 500',
    symbol: 'SPX',
    link: 'https://www.investing.com/indices/us-spx-500',
    investingLink: 'https://www.investing.com/indices/us-spx-500',
    color: 'from-orange-500 to-orange-600',
  },
];

export default function MarketData() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();

  const sections = [
    { path: '/market-data', label: t('marketData'), icon: TrendingUp, active: true },
    { path: '/dashboard', label: t('dashboard'), icon: LayoutDashboard },
    { path: '/products', label: t('products'), icon: Package },
    { path: '/research', label: t('research'), icon: FileText },
    { path: '/videos', label: t('videos'), icon: PlayCircle },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl font-serif font-semibold text-foreground">{t('marketDataTitle')}</h1>
          <p className="mt-1 text-muted-foreground">
            {language === 'ko' ? '실시간 글로벌 시장 데이터' : 'Real-time global market data'}
          </p>
        </div>

        {/* Section Navigation Buttons */}
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

        {/* Weekly Stock Picks Table */}
        <WeeklyStockPicksTable language={language} />

        {/* Main Index Cards - 4 in a row */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-6">
          {indexData.map((index, i) => (
            <a
              key={index.id}
              href={index.investingLink}
              target="_blank"
              rel="noopener noreferrer"
              className="card-elevated overflow-hidden animate-fade-in group hover:shadow-lg transition-all duration-300"
              style={{ animationDelay: `${100 + i * 50}ms` }}
            >
              <div className={`h-2 bg-gradient-to-r ${index.color}`} />
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-serif font-semibold text-sm">
                    {language === 'ko' ? index.nameKo : index.nameEn}
                  </h3>
                  <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground font-mono">{index.symbol}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  {language === 'ko' ? 'Investing.com에서 실시간 시세 확인 →' : 'View live quotes on Investing.com →'}
                </p>
              </div>
            </a>
          ))}
        </div>

        {/* 한눈에 보는 시장 - Dynamic from DB */}
        <MarketOverviewSection language={language} />
      </main>
    </div>
  );
}
