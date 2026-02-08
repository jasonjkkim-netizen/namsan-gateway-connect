import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ExternalLink } from 'lucide-react';
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
}

// Category definitions for market items
const MARKET_CATEGORIES = {
  indices: { ko: '주요 지수', en: 'Major Indices', order: [1, 2, 3] },
  currencies: { ko: '주요 환율', en: 'Major Currencies', order: [10, 11, 12] },
  bonds: { ko: '채권', en: 'Bonds', order: [20, 21] },
  commodities: { ko: '원자재', en: 'Commodities', order: [30, 31, 32, 33] },
  futures: { ko: '선물', en: 'Futures', order: [40, 41] },
};

// External source links by symbol prefix
const getExternalLinks = (symbol: string) => {
  const tradingViewUrl = `https://www.tradingview.com/symbols/${symbol.replace(':', '-')}/`;
  const investingUrl = getInvestingUrl(symbol);
  
  return { tradingViewUrl, investingUrl };
};

const getInvestingUrl = (symbol: string) => {
  // Map common symbols to Investing.com URLs
  const investingMappings: Record<string, string> = {
    'KRX:KOSPI': 'https://www.investing.com/indices/kospi',
    'KRX:KOSDAQ': 'https://www.investing.com/indices/kosdaq',
    'NASDAQ:NDX': 'https://www.investing.com/indices/nq-100',
    'FOREXCOM:SPXUSD': 'https://www.investing.com/indices/us-spx-500',
    'FX_IDC:USDKRW': 'https://www.investing.com/currencies/usd-krw',
    'FX_IDC:EURKRW': 'https://www.investing.com/currencies/eur-krw',
    'FX_IDC:JPYKRW': 'https://www.investing.com/currencies/jpy-krw',
    'TVC:US10Y': 'https://www.investing.com/rates-bonds/u.s.-10-year-bond-yield',
    'TVC:KR10Y': 'https://www.investing.com/rates-bonds/south-korea-10-year-bond-yield',
    'TVC:GOLD': 'https://www.investing.com/commodities/gold',
    'TVC:SILVER': 'https://www.investing.com/commodities/silver',
    'NYMEX:CL1!': 'https://www.investing.com/commodities/crude-oil',
    'COMEX:GC1!': 'https://www.investing.com/commodities/gold',
  };
  
  return investingMappings[symbol] || `https://www.investing.com/search/?q=${encodeURIComponent(symbol)}`;
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
          {language === 'ko' ? '주요 자산군별 시장 현황 (외부 링크)' : 'Market overview by asset class (external links)'}
        </p>
      </div>

      {/* Category Tables */}
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
                      {language === 'ko' ? '외부 소스' : 'Sources'}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoryItems.map((item) => {
                    const links = getExternalLinks(item.symbol);
                    return (
                      <TableRow key={item.id} className="hover:bg-muted/50">
                        <TableCell className="py-2 font-medium text-sm">
                          {language === 'ko' ? item.title_ko : item.title_en}
                        </TableCell>
                        <TableCell className="py-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <a
                              href={links.tradingViewUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              TradingView
                              <ExternalLink className="h-3 w-3" />
                            </a>
                            <span className="text-muted-foreground">|</span>
                            <a
                              href={links.investingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              Investing.com
                              <ExternalLink className="h-3 w-3" />
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

      {/* Disclaimer */}
      <p className="text-xs text-muted-foreground text-center mt-4">
        {language === 'ko' 
          ? '* 실시간 시세는 외부 소스에서 확인하세요. 데이터는 지연될 수 있습니다.'
          : '* Check external sources for real-time quotes. Data may be delayed.'}
      </p>
    </div>
  );
}