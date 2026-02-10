import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { LayoutDashboard, Package, FileText, PlayCircle, TrendingUp, TrendingDown, ExternalLink, BookOpen, RefreshCw } from 'lucide-react';
import { MarketOverviewSection } from '@/components/market/MarketOverviewSection';
import { WeeklyStockPicksTable } from '@/components/market/WeeklyStockPicksTable';
import { MarketNewsSection } from '@/components/market/MarketNewsSection';
import { StockPickNewsSection } from '@/components/market/StockPickNewsSection';
import { NamsanViewpointSection } from '@/components/market/NamsanViewpointSection';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MarketIndex {
  id: string;
  symbol: string;
  name_ko: string;
  name_en: string;
  current_value: number;
  change_value: number;
  change_percent: number;
  external_link: string | null;
  color_class: string | null;
  display_order: number;
  updated_at: string;
}

export default function MarketData() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isUpdating, setIsUpdating] = useState(false);

  const { data: indices, isLoading } = useQuery({
    queryKey: ['market-indices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('market_indices')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      
      if (error) throw error;
      return data as MarketIndex[];
    },
  });

  const sections = [
    { path: '/market-data', label: t('marketData'), icon: TrendingUp, active: true },
    { path: '/dashboard', label: t('dashboard'), icon: LayoutDashboard },
    { path: '/products', label: t('products'), icon: Package },
    { path: '/research', label: t('research'), icon: FileText },
    { path: '/blog', label: language === 'ko' ? '블로그' : 'Blog', icon: BookOpen },
    { path: '/videos', label: t('videos'), icon: PlayCircle },
  ];

  const formatNumber = (value: number, symbol: string) => {
    // Korean indices use no decimals, US indices use 2 decimals
    if (symbol === 'KOSPI' || symbol === 'KOSDAQ') {
      return value.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatChange = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}`;
  };

  const handleUpdateIndices = async () => {
    setIsUpdating(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        toast.error(language === 'ko' ? '로그인이 필요합니다' : 'Login required');
        return;
      }
      const response = await supabase.functions.invoke('fetch-market-indices', {
        body: { updateOverview: true },
      });
      if (response.error) throw response.error;
      await queryClient.invalidateQueries({ queryKey: ['market-indices'] });
      await queryClient.invalidateQueries({ queryKey: ['market-overview'] });
      toast.success(language === 'ko' ? '시장 데이터가 업데이트되었습니다' : 'Market data updated');
    } catch (err) {
      console.error('Update failed:', err);
      toast.error(language === 'ko' ? '업데이트 실패' : 'Update failed');
    } finally {
      setIsUpdating(false);
    }
  };

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

        {/* Namsan View Point - moved to top */}
        <NamsanViewpointSection language={language} />

        {/* Weekly Stock Picks Table */}
        <WeeklyStockPicksTable language={language} />

        {/* Today's Market Closing News */}
        <MarketNewsSection language={language} />

        {/* Stock Pick News */}
        <StockPickNewsSection language={language} />

        {/* Main Index Cards */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-serif font-semibold text-lg">
            {language === 'ko' ? '주요 지수' : 'Major Indices'}
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={handleUpdateIndices}
            disabled={isUpdating}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
            {language === 'ko' ? '업데이트' : 'Update'}
          </Button>
        </div>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-6">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card-elevated overflow-hidden">
                <Skeleton className="h-2 w-full" />
                <div className="p-4 space-y-3">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-8 w-32" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
            ))
          ) : (
            indices?.map((index, i) => {
              const isPositive = index.change_value >= 0;
              const TrendIcon = isPositive ? TrendingUp : TrendingDown;
              
              return (
                <div
                  key={index.id}
                  className="card-elevated overflow-hidden animate-fade-in group hover:shadow-lg transition-all duration-300"
                  style={{ animationDelay: `${100 + i * 50}ms` }}
                >
                  <div className={`h-2 bg-gradient-to-r ${index.color_class || 'from-blue-500 to-blue-600'}`} />
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-serif font-semibold text-sm truncate">
                        {language === 'ko' ? index.name_ko : index.name_en}
                      </h3>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <a
                          href={index.external_link || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 rounded hover:bg-muted transition-colors text-[10px] font-medium text-muted-foreground hover:text-primary"
                          title={index.external_link?.includes('naver') ? '네이버 금융' : 'Yahoo Finance'}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                    
                    {/* Current Value */}
                    <div className="text-2xl font-bold text-foreground mb-2">
                      {formatNumber(index.current_value, index.symbol)}
                    </div>
                    
                    {/* Change Value and Percent */}
                    <div className={`flex items-center gap-2 ${isPositive ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
                      <TrendIcon className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        {formatChange(index.change_value)} ({formatChange(index.change_percent)}%)
                      </span>
                    </div>
                    
                    {/* Updated time */}
                    <p className="text-xs text-muted-foreground mt-2">
                      {language === 'ko' ? '업데이트: ' : 'Updated: '}
                      {new Date(index.updated_at).toLocaleString(language === 'ko' ? 'ko-KR' : 'en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 한눈에 보는 시장 - Dynamic from DB */}
        <MarketOverviewSection language={language} />
      </main>
    </div>
  );
}
