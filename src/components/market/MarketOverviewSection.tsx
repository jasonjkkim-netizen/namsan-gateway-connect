import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ExternalLink, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
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
  crypto: { ko: '암호화폐', en: 'Cryptocurrency', order: [4, 5, 6] },
  currencies: { ko: '주요 환율', en: 'Major Currencies', order: [7, 8, 9, 10, 11, 12] },
  bonds: { ko: '채권', en: 'Bonds', order: [20, 21] },
  commodities: { ko: '원자재', en: 'Commodities', order: [30, 31, 32, 33] },
};

const getExternalUrl = (symbol: string) => {
  const map: Record<string, string> = {
    'TVC:NI225': 'https://finance.yahoo.com/quote/%5EN225/',
    'AMEX:SPY': 'https://finance.yahoo.com/quote/SPY/',
    'TVC:DJI': 'https://finance.yahoo.com/quote/%5EDJI/',
    'FX:USDKRW': 'https://finance.yahoo.com/quote/USDKRW=X/',
    'FX:JPYKRW': 'https://finance.yahoo.com/quote/JPYKRW=X/',
    'FX:HKDKRW': 'https://finance.yahoo.com/quote/HKDKRW=X/',
    'FX:EURUSD': 'https://finance.yahoo.com/quote/EURUSD=X/',
    'FX:USDJPY': 'https://finance.yahoo.com/quote/USDJPY=X/',
    'FX:USDCNY': 'https://finance.yahoo.com/quote/USDCNY=X/',
    'TVC:US10Y': 'https://finance.yahoo.com/quote/%5ETNX/',
    'TVC:US05Y': 'https://finance.yahoo.com/quote/%5EFVX/',
    'TVC:GOLD': 'https://finance.yahoo.com/quote/GC=F/',
    'TVC:SILVER': 'https://finance.yahoo.com/quote/SI=F/',
    'TVC:USOIL': 'https://finance.yahoo.com/quote/CL=F/',
    'NYMEX:NG1!': 'https://finance.yahoo.com/quote/NG=F/',
    'CRYPTO:BTC': 'https://finance.yahoo.com/quote/BTC-USD/',
    'CRYPTO:ETH': 'https://finance.yahoo.com/quote/ETH-USD/',
    'CRYPTO:XRP': 'https://finance.yahoo.com/quote/XRP-USD/',
  };
  return map[symbol] || `https://finance.yahoo.com/lookup/?s=${encodeURIComponent(symbol)}`;
};

interface MarketOverviewSectionProps {
  language: string;
}

export function MarketOverviewSection({ language }: MarketOverviewSectionProps) {
  const [items, setItems] = useState<MarketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  async function fetchItems() {
    const { data } = await supabase
      .from('market_overview_items')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (data) setItems(data as MarketItem[]);
    setLoading(false);
  }

  useEffect(() => {
    fetchItems();
  }, []);

  async function handleUpdatePrices() {
    setUpdating(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-market-indices', {
        body: { updateOverview: true },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(language === 'ko' ? '시장 데이터가 업데이트되었습니다' : 'Market data updated');
        await fetchItems();
      } else {
        throw new Error(data?.error || 'Update failed');
      }
    } catch (err) {
      console.error('Error updating market overview:', err);
      toast.error(language === 'ko' ? '업데이트에 실패했습니다' : 'Failed to update');
    } finally {
      setUpdating(false);
    }
  }

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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="font-serif font-semibold text-lg">
            {language === 'ko' ? '한눈에 보는 시장' : 'Market at a Glance'}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {language === 'ko' ? '주요 자산군별 시장 현황' : 'Market overview by asset class'}
            {items.length > 0 && items[0].updated_at && (
              <span className="ml-2 text-xs">
                ({language === 'ko' ? '업데이트: ' : 'Updated: '}
                {new Date(items[0].updated_at).toLocaleString(language === 'ko' ? 'ko-KR' : 'en-US', {
                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                })})
              </span>
            )}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleUpdatePrices}
          disabled={updating}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${updating ? 'animate-spin' : ''}`} />
          {language === 'ko' ? '업데이트' : 'Update'}
        </Button>
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
                          <a
                            href={getExternalUrl(item.symbol)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded hover:bg-muted transition-colors inline-flex"
                            title="Yahoo Finance"
                          >
                            <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-primary" />
                          </a>
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
        {items.length > 0 && items[0].updated_at && (
          <span className="block mb-1">
            {language === 'ko' ? '마지막 업데이트: ' : 'Last updated: '}
            {new Date(items[0].updated_at).toLocaleString(language === 'ko' ? 'ko-KR' : 'en-US', {
              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
            })}
          </span>
        )}
        {language === 'ko'
          ? '* 데이터는 Perplexity AI를 통해 업데이트됩니다. 실시간 시세와 차이가 있을 수 있습니다.'
          : '* Data updated via Perplexity AI. May differ from real-time quotes.'}
      </p>
    </div>
  );
}
