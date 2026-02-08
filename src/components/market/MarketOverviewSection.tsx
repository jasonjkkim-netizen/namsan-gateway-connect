import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MarketItem {
  id: string;
  symbol: string;
  title_ko: string;
  title_en: string;
  display_order: number;
}

// Category definitions for market items
const MARKET_CATEGORIES = {
  indices: { ko: '주요 지수', en: 'Major Indices', order: [1, 2, 3] },
  currencies: { ko: '주요 환율', en: 'Major Currencies', order: [10, 11, 12] },
  bonds: { ko: '채권', en: 'Bonds', order: [20, 21] },
  commodities: { ko: '원자재', en: 'Commodities', order: [30, 31, 32, 33] },
  futures: { ko: '선물', en: 'Futures', order: [40, 41] },
};

interface MarketOverviewSectionProps {
  language: string;
}

export function MarketOverviewSection({ language }: MarketOverviewSectionProps) {
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

  const getItemsByCategory = (orders: number[]) => {
    return items.filter(item => orders.includes(item.display_order));
  };

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
      <div className="mb-6">
        <h3 className="font-serif font-semibold text-lg">
          {language === 'ko' ? '한눈에 보는 시장' : 'Market at a Glance'}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {language === 'ko' ? '주요 자산군별 실시간 시세' : 'Real-time prices by asset class'}
        </p>
      </div>

      {/* Category Sections with TradingView Mini Chart Widgets */}
      {Object.entries(MARKET_CATEGORIES).map(([key, category]) => {
        const categoryItems = getItemsByCategory(category.order);
        if (categoryItems.length === 0) return null;
        
        return (
          <div key={key} className="mb-8">
            <h4 className="font-serif font-medium text-base mb-4 flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-accent" />
              {language === 'ko' ? category.ko : category.en}
            </h4>
            <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {categoryItems.map((item, index) => (
                <div
                  key={item.id}
                  className="card-elevated overflow-hidden animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="p-2 border-b border-border">
                    <h5 className="font-serif font-medium text-xs truncate">
                      {language === 'ko' ? item.title_ko : item.title_en}
                    </h5>
                  </div>
                  <div className="h-[140px] w-full">
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
      })}
    </div>
  );
}
