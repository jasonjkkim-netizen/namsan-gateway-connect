import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, Package, FileText, PlayCircle, TrendingUp } from 'lucide-react';

export default function MarketData() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();

  const tradingViewWidgets = [
    { symbol: 'FX:USDKRW', title: t('usdKrw') },
    { symbol: 'TVC:US10Y', title: t('us10yTreasury') },
    { symbol: 'FOREXCOM:SPXUSD', title: t('sp500') },
  ];

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

        <div className="grid gap-6 md:grid-cols-2">
          {/* KOSPI - Naver Finance */}
          <div 
            className="card-elevated overflow-hidden animate-fade-in"
            style={{ animationDelay: '100ms' }}
          >
            <div className="p-4 border-b border-border">
              <h3 className="font-serif font-semibold">{t('kospiIndex')}</h3>
            </div>
            <div className="h-[350px] w-full">
              <iframe
                src="https://ssl.pstatic.net/imgfinance/chart/mobile/world/day/KOSPI_search.png"
                className="w-full h-full border-0 hidden"
              />
              <a 
                href="https://finance.naver.com/sise/sise_index.naver?code=KOSPI" 
                target="_blank" 
                rel="noopener noreferrer"
                className="block w-full h-full"
              >
                <img 
                  src="https://ssl.pstatic.net/imgfinance/chart/sise/KOSPI_search.png" 
                  alt="KOSPI Chart"
                  className="w-full h-auto object-contain p-4"
                />
                <div className="text-center text-sm text-muted-foreground pb-4">
                  {language === 'ko' ? '네이버 금융에서 자세히 보기 →' : 'View details on Naver Finance →'}
                </div>
              </a>
            </div>
          </div>

          {/* TradingView Widgets */}
          {tradingViewWidgets.map((widget, index) => (
            <div 
              key={widget.symbol} 
              className="card-elevated overflow-hidden animate-fade-in"
              style={{ animationDelay: `${(index + 2) * 100}ms` }}
            >
              <div className="p-4 border-b border-border">
                <h3 className="font-serif font-semibold">{widget.title}</h3>
              </div>
              <div className="h-[350px] w-full">
                <iframe
                  src={`https://s.tradingview.com/embed-widget/mini-symbol-overview/?locale=${language === 'ko' ? 'kr' : 'en'}&symbol=${widget.symbol}&width=100%25&height=100%25&dateRange=12M&colorTheme=light&isTransparent=true&autosize=true&largeChartUrl=`}
                  className="w-full h-full border-0"
                  allowTransparency={true}
                  scrolling="no"
                  allow="encrypted-media"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Full Market Overview Widget */}
        <div className="mt-8 card-elevated overflow-hidden animate-fade-in" style={{ animationDelay: '500ms' }}>
          <div className="p-4 border-b border-border">
            <h3 className="font-serif font-semibold">
              {language === 'ko' ? '시장 개요' : 'Market Overview'}
            </h3>
          </div>
          <div className="h-[500px] w-full">
            <iframe 
              src={`https://s.tradingview.com/embed-widget/market-overview/?locale=${language === 'ko' ? 'kr' : 'en'}&colorTheme=light&dateRange=12M&showChart=true&isTransparent=true&width=100%25&height=100%25&tabs=forex%2Cindices`}
              className="w-full h-full border-0"
              allowTransparency={true}
              scrolling="no"
              allow="encrypted-media"
            />
          </div>
        </div>
      </main>
    </div>
  );
}
