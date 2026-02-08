import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { useLanguage } from '@/contexts/LanguageContext';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, Package, FileText, PlayCircle, TrendingUp } from 'lucide-react';
import { MarketOverviewSection } from '@/components/market/MarketOverviewSection';
import { WeeklyStockPicksTable } from '@/components/market/WeeklyStockPicksTable';

export default function MarketData() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  
  // Cache-busting timestamp for Naver Finance images
  const [cacheKey, setCacheKey] = useState(Date.now());
  
  // Refresh Naver images every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      setCacheKey(Date.now());
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);


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

        {/* Main Index Charts - 4 in a row */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-6">
          {/* KOSPI */}
          <div 
            className="card-elevated overflow-hidden animate-fade-in"
            style={{ animationDelay: '100ms' }}
          >
            <div className="p-2 border-b border-border">
              <h3 className="font-serif font-semibold text-xs">{t('kospiIndex')}</h3>
            </div>
            <div className="h-[140px] w-full">
              <a 
                href="https://finance.naver.com/sise/sise_index.naver?code=KOSPI" 
                target="_blank" 
                rel="noopener noreferrer"
                className="block w-full h-full flex flex-col items-center justify-center"
              >
                <img 
                  src={`https://ssl.pstatic.net/imgfinance/chart/sise/KOSPI_search.png?t=${cacheKey}`} 
                  alt="KOSPI Chart"
                  className="w-full h-auto object-contain p-1 max-h-[110px]"
                />
                <div className="text-center text-xs text-muted-foreground pb-1">
                  {language === 'ko' ? '네이버 금융 →' : 'Naver Finance →'}
                </div>
              </a>
            </div>
          </div>

          {/* KOSDAQ */}
          <div 
            className="card-elevated overflow-hidden animate-fade-in"
            style={{ animationDelay: '150ms' }}
          >
            <div className="p-2 border-b border-border">
              <h3 className="font-serif font-semibold text-xs">
                {language === 'ko' ? '코스닥 지수' : 'KOSDAQ Index'}
              </h3>
            </div>
            <div className="h-[140px] w-full">
              <a 
                href="https://finance.naver.com/sise/sise_index.naver?code=KOSDAQ" 
                target="_blank" 
                rel="noopener noreferrer"
                className="block w-full h-full flex flex-col items-center justify-center"
              >
                <img 
                  src={`https://ssl.pstatic.net/imgfinance/chart/sise/KOSDAQ_search.png?t=${cacheKey}`} 
                  alt="KOSDAQ Chart"
                  className="w-full h-auto object-contain p-1 max-h-[110px]"
                />
                <div className="text-center text-xs text-muted-foreground pb-1">
                  {language === 'ko' ? '네이버 금융 →' : 'Naver Finance →'}
                </div>
              </a>
            </div>
          </div>

          {/* NASDAQ 100 */}
          <div 
            className="card-elevated overflow-hidden animate-fade-in"
            style={{ animationDelay: '200ms' }}
          >
            <div className="p-2 border-b border-border">
              <h3 className="font-serif font-semibold text-xs">
                {language === 'ko' ? '나스닥 100' : 'NASDAQ 100'}
              </h3>
            </div>
            <div className="h-[140px] w-full">
              <iframe
                src={`https://s.tradingview.com/embed-widget/mini-symbol-overview/?locale=${language === 'ko' ? 'kr' : 'en'}&symbol=NASDAQ:NDX&width=100%25&height=100%25&dateRange=12M&colorTheme=${resolvedTheme === 'dark' ? 'dark' : 'light'}&isTransparent=true&autosize=true&largeChartUrl=`}
                className="w-full h-full border-0"
                allowTransparency={true}
                scrolling="no"
                allow="encrypted-media"
              />
            </div>
          </div>

          {/* S&P 500 */}
          <div 
            className="card-elevated overflow-hidden animate-fade-in"
            style={{ animationDelay: '250ms' }}
          >
            <div className="p-2 border-b border-border">
              <h3 className="font-serif font-semibold text-xs">{t('sp500')}</h3>
            </div>
            <div className="h-[140px] w-full">
              <iframe
                src={`https://s.tradingview.com/embed-widget/mini-symbol-overview/?locale=${language === 'ko' ? 'kr' : 'en'}&symbol=FOREXCOM:SPXUSD&width=100%25&height=100%25&dateRange=12M&colorTheme=${resolvedTheme === 'dark' ? 'dark' : 'light'}&isTransparent=true&autosize=true&largeChartUrl=`}
                className="w-full h-full border-0"
                allowTransparency={true}
                scrolling="no"
                allow="encrypted-media"
              />
            </div>
          </div>
        </div>

        {/* 한눈에 보는 시장 - Dynamic from DB */}
        <MarketOverviewSection language={language} />
      </main>
    </div>
  );
}
