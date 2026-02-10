import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ExternalLink, TrendingUp, TrendingDown } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface MarketItem {
  id: string;
  symbol: string;
  title_ko: string;
  title_en: string;
  display_order: number;
  current_value: number | null;
  change_value: number | null;
  change_percent: number | null;
  updated_at: string;
}

// Category definitions for market items
const MARKET_CATEGORIES = {
  indices: { ko: '주요 지수', en: 'Major Indices', order: [1, 2, 3] },
  currencies: { ko: '주요 환율', en: 'Major Currencies', order: [10, 11, 12] },
  bonds: { ko: '채권', en: 'Bonds', order: [20, 21] },
  commodities: { ko: '원자재', en: 'Commodities', order: [30, 31, 32, 33] },
};

const getTradingViewUrl = (symbol: string) =>
  `https://www.tradingview.com/symbols/${symbol.replace(':', '-')}/`;

const getInvestingUrl = (symbol: string) => {
  const map: Record<string, string> = {
    'TVC:NI225': 'https://www.investing.com/indices/japan-ni225',
    'AMEX:SPY': 'https://www.investing.com/etfs/spdr-s-p-500',
    'TVC:DJI': 'https://www.investing.com/indices/us-30',
    'FX:EURUSD': 'https://www.investing.com/currencies/eur-usd',
    'FX:USDJPY': 'https://www.investing.com/currencies/usd-jpy',
    'FX:USDCNY': 'https://www.investing.com/currencies/usd-cny',
    'TVC:US10Y': 'https://www.investing.com/rates-bonds/u.s.-10-year-bond-yield',
    'TVC:US02Y': 'https://www.investing.com/rates-bonds/u.s.-2-year-bond-yield',
    'TVC:GOLD': 'https://www.investing.com/commodities/gold',
    'TVC:SILVER': 'https://www.investing.com/commodities/silver',
    'TVC:USOIL': 'https://www.investing.com/commodities/crude-oil',
    'NYMEX:NG1!': 'https://www.investing.com/commodities/natural-gas',
  };
  return map[symbol] || `https://www.investing.com/search/?q=${encodeURIComponent(symbol)}`;
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

      if (data) setItems(data as MarketItem[]);
      setLoading(false);
    }
    fetchItems();
  }, []);

  const getItemsByCategory = (orders: number[]) => {
    return items.filter(item => orders.includes(item.display_order));
  };

  const formatValue = (value: number | null) => {
    if (value === null || value === undefined) return '—';
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatChange = (value: number | null) => {
    if (value === null || value === undefined) return '';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}`;
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
          {language === 'ko' ? '주요 자산군별 시장 현황' : 'Market overview by asset class'}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {Object.entries(MARKET_CATEGORIES).map(([key, category]) => {
          const categoryItems = getItemsByCategory(category.order);
          if (categoryItems.length === 0) return null;

          return (
            <div key={key} className="card-elevated overflow-hidden">
              <div className="p-3 border-b border-border bg-muted/30">
                <h4 className="font-serif font-medium text-sm flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  {language === 'ko' ? category.ko : category.en}
                </h4>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs h-9">
                      {language === 'ko' ? '종목' : 'Item'}
                    </TableHead>
                    <TableHead className="text-xs h-9 text-right">
                      {language === 'ko' ? '현재가' : 'Price'}
                    </TableHead>
                    <TableHead className="text-xs h-9 text-right">
                      {language === 'ko' ? '변동' : 'Change'}
                    </TableHead>
                    <TableHead className="text-xs h-9 text-right w-16">
                      {language === 'ko' ? '링크' : 'Links'}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoryItems.map((item) => {
                    const isPositive = (item.change_value ?? 0) >= 0;
                    const hasData = item.current_value !== null && item.current_value !== undefined;
                    return (
                      <TableRow key={item.id} className="hover:bg-muted/50">
                        <TableCell className="py-2 font-medium text-sm">
                          {language === 'ko' ? item.title_ko : item.title_en}
                        </TableCell>
                        <TableCell className="py-2 text-right text-sm font-medium">
                          {formatValue(item.current_value)}
                        </TableCell>
                        <TableCell className="py-2 text-right">
                          {hasData && item.change_value !== null ? (
                            <div className={`flex items-center justify-end gap-1 text-xs ${isPositive ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
                              {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              <span>{formatChange(item.change_value)} ({formatChange(item.change_percent)}%)</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <a
                              href={getTradingViewUrl(item.symbol)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 rounded hover:bg-muted transition-colors"
                              title="TradingView"
                            >
                              <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-primary" />
                            </a>
                            <a
                              href={getInvestingUrl(item.symbol)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 rounded hover:bg-muted transition-colors text-[10px] font-medium text-muted-foreground hover:text-primary"
                              title="Investing.com"
                            >
                              inv
                            </a>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground text-center mt-4">
        {language === 'ko'
          ? '* 데이터는 Perplexity AI를 통해 업데이트됩니다. 실시간 시세와 차이가 있을 수 있습니다.'
          : '* Data updated via Perplexity AI. May differ from real-time quotes.'}
      </p>
    </div>
  );
}
