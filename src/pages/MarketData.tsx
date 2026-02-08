import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, Package, FileText, PlayCircle, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface MarketItem {
  id: string;
  symbol: string;
  title_ko: string;
  title_en: string;
  display_order: number;
}

function MarketOverviewSection({ language }: { language: string }) {
  const [items, setItems] = useState<MarketItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchItems() {
      const { data } = await supabase
        .from('market_overview_items')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (data) setItems(data);
      setLoading(false);
    }
    fetchItems();
  }, []);

  if (loading) {
    return (
      <div className="mt-8 card-elevated overflow-hidden animate-fade-in" style={{ animationDelay: '500ms' }}>
        <div className="p-4 border-b border-border">
          <h3 className="font-serif font-semibold">
            {language === 'ko' ? '한눈에 보는 시장' : 'Market at a Glance'}
          </h3>
        </div>
        <div className="h-[200px] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="mt-8 animate-fade-in" style={{ animationDelay: '500ms' }}>
      <div className="mb-4">
        <h3 className="font-serif font-semibold text-lg">
          {language === 'ko' ? '한눈에 보는 시장' : 'Market at a Glance'}
        </h3>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {items.map((item, index) => (
          <div
            key={item.id}
            className="card-elevated overflow-hidden animate-fade-in"
            style={{ animationDelay: `${(index + 1) * 100}ms` }}
          >
            <div className="p-3 border-b border-border">
              <h4 className="font-serif font-semibold text-sm">
                {language === 'ko' ? item.title_ko : item.title_en}
              </h4>
            </div>
            <div className="h-[200px] w-full">
              <iframe
                src={`https://s.tradingview.com/embed-widget/mini-symbol-overview/?locale=${language === 'ko' ? 'kr' : 'en'}&symbol=${item.symbol}&width=100%25&height=100%25&dateRange=12M&colorTheme=light&isTransparent=true&autosize=true&largeChartUrl=`}
                className="w-full h-full border-0"
                allowTransparency={true}
                scrolling="no"
                allow="encrypted-media"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface StockPick {
  id: string;
  stock_name: string;
  recommendation_date: string;
  closing_price_at_recommendation: number;
  current_closing_price: number | null;
}

function WeeklyStockPicksTable({ language }: { language: string }) {
  const [stocks, setStocks] = useState<StockPick[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStocks() {
      const { data } = await supabase
        .from('weekly_stock_picks')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (data) setStocks(data);
      setLoading(false);
    }
    fetchStocks();
  }, []);

  function calculateReturn(recommendedPrice: number, currentPrice: number | null): string {
    if (!currentPrice) return '-';
    const returnPct = ((currentPrice - recommendedPrice) / recommendedPrice) * 100;
    return `${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(2)}%`;
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }

  if (loading) {
    return (
      <div className="mb-8 card-elevated overflow-hidden animate-fade-in">
        <div className="p-4 border-b border-border">
          <h3 className="font-serif font-semibold">
            {language === 'ko' ? '금주 관심 종목' : 'Weekly Stock Picks'}
          </h3>
        </div>
        <div className="h-[100px] flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  if (stocks.length === 0) return null;

  return (
    <div className="mb-8 card-elevated overflow-hidden animate-fade-in">
      <div className="p-4 border-b border-border">
        <h3 className="font-serif font-semibold">
          {language === 'ko' ? '금주 관심 종목' : 'Weekly Stock Picks'}
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                {language === 'ko' ? '추천 종목' : 'Stock'}
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                {language === 'ko' ? '2/1 종가' : '2/1 Close'}
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                {language === 'ko' ? '2/6 종가' : '2/6 Close'}
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                {language === 'ko' ? '수익률' : 'Return'}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {stocks.map((stock) => {
              const returnValue = stock.current_closing_price 
                ? ((stock.current_closing_price - stock.closing_price_at_recommendation) / stock.closing_price_at_recommendation) * 100
                : null;
              return (
                <tr key={stock.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{stock.stock_name}</td>
                  <td className="px-4 py-3 text-right">
                    {stock.closing_price_at_recommendation.toLocaleString()}원
                  </td>
                  <td className="px-4 py-3 text-right">
                    {stock.current_closing_price?.toLocaleString() || '-'}원
                  </td>
                  <td className={`px-4 py-3 text-right font-medium ${
                    returnValue !== null && returnValue > 0
                      ? 'text-green-600'
                      : returnValue !== null && returnValue < 0
                        ? 'text-red-600'
                        : ''
                  }`}>
                    {calculateReturn(stock.closing_price_at_recommendation, stock.current_closing_price)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function MarketData() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();

  const tradingViewWidgets = [
    { symbol: 'FX:USDKRW', title: t('usdKrw') },
    { symbol: 'NASDAQ:NDX', title: language === 'ko' ? '나스닥 100' : 'NASDAQ 100' },
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

        {/* Weekly Stock Picks Table */}
        <WeeklyStockPicksTable language={language} />

        {/* KOSPI & KOSDAQ - Naver Finance (smaller) */}
        <div className="grid gap-4 md:grid-cols-2 mb-6">
          {/* KOSPI */}
          <div 
            className="card-elevated overflow-hidden animate-fade-in"
            style={{ animationDelay: '100ms' }}
          >
            <div className="p-3 border-b border-border">
              <h3 className="font-serif font-semibold text-sm">{t('kospiIndex')}</h3>
            </div>
            <div className="h-[180px] w-full">
              <a 
                href="https://finance.naver.com/sise/sise_index.naver?code=KOSPI" 
                target="_blank" 
                rel="noopener noreferrer"
                className="block w-full h-full flex flex-col items-center justify-center"
              >
                <img 
                  src="https://ssl.pstatic.net/imgfinance/chart/sise/KOSPI_search.png" 
                  alt="KOSPI Chart"
                  className="w-full h-auto object-contain p-2 max-h-[140px]"
                />
                <div className="text-center text-xs text-muted-foreground pb-2">
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
            <div className="p-3 border-b border-border">
              <h3 className="font-serif font-semibold text-sm">
                {language === 'ko' ? '코스닥 지수' : 'KOSDAQ Index'}
              </h3>
            </div>
            <div className="h-[180px] w-full">
              <a 
                href="https://finance.naver.com/sise/sise_index.naver?code=KOSDAQ" 
                target="_blank" 
                rel="noopener noreferrer"
                className="block w-full h-full flex flex-col items-center justify-center"
              >
                <img 
                  src="https://ssl.pstatic.net/imgfinance/chart/sise/KOSDAQ_search.png" 
                  alt="KOSDAQ Chart"
                  className="w-full h-auto object-contain p-2 max-h-[140px]"
                />
                <div className="text-center text-xs text-muted-foreground pb-2">
                  {language === 'ko' ? '네이버 금융 →' : 'Naver Finance →'}
                </div>
              </a>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">

          {/* TradingView Widgets */}
          {tradingViewWidgets.map((widget, index) => (
            <div 
              key={widget.symbol} 
              className="card-elevated overflow-hidden animate-fade-in"
              style={{ animationDelay: `${(index + 2) * 100}ms` }}
            >
              <div className="p-3 border-b border-border">
                <h3 className="font-serif font-semibold text-sm">{widget.title}</h3>
              </div>
              <div className="h-[200px] w-full">
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

        {/* 한눈에 보는 시장 - Dynamic from DB */}
        <MarketOverviewSection language={language} />
      </main>
    </div>
  );
}
