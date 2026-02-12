import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { StockDetailDialog } from './StockDetailDialog';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface StockPick {
  id: string;
  stock_name: string;
  stock_code: string | null;
  recommendation_date: string;
  price_reference_date: string | null;
  closing_price_at_recommendation: number;
  current_closing_price: number | null;
  market?: string;
}

interface WeeklyStockPicksTableProps {
  language: string;
}

function StockTable({
  stocks,
  language,
  market,
  title,
  onStockClick,
  onUpdatePrices,
  updatingPrices,
}: {
  stocks: StockPick[];
  language: string;
  market: 'KR' | 'US';
  title: string;
  onStockClick: (stock: StockPick) => void;
  onUpdatePrices: (market: 'KR' | 'US') => void;
  updatingPrices: boolean;
}) {
  if (stocks.length === 0) return null;

  const isKR = market === 'KR';
  const currencySymbol = isKR ? '원' : '$';

  const priceReferenceDate = stocks[0]?.price_reference_date
    ? new Date(stocks[0].price_reference_date)
    : stocks[0]?.recommendation_date
      ? new Date(stocks[0].recommendation_date)
      : new Date();

  const formatDateHeader = (date: Date, lang: string) => {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return lang === 'ko' ? `${month}/${day} 종가` : `${month}/${day} Close`;
  };

  const refDateHeader = formatDateHeader(priceReferenceDate, language);
  const todayHeader = language === 'ko' ? '현재 가격' : 'Current';

  const formatPrice = (price: number | null) => {
    if (price === null || price === undefined) return '-';
    if (isKR) return `${price.toLocaleString()}${currencySymbol}`;
    return `${currencySymbol}${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const calculateReturn = (recommendedPrice: number, currentPrice: number | null): string => {
    if (!currentPrice || recommendedPrice === 0) return '-';
    const returnPct = ((currentPrice - recommendedPrice) / recommendedPrice) * 100;
    return `${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(2)}%`;
  };

  const getStockLink = (stock: StockPick) => {
    if (!stock.stock_code) return null;
    if (isKR) return `https://finance.naver.com/item/main.naver?code=${stock.stock_code}`;
    return `https://finance.yahoo.com/quote/${stock.stock_code}`;
  };

  return (
    <div className="mb-8 card-elevated overflow-hidden animate-fade-in">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <h3 className="font-serif font-medium text-sm">{title}</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onUpdatePrices(market)}
          disabled={updatingPrices}
          className="h-7 px-2"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${updatingPrices ? 'animate-spin' : ''}`} />
          <span className="text-xs">{language === 'ko' ? '업데이트' : 'Update'}</span>
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                {language === 'ko' ? '추천 종목' : 'Stock'}
              </th>
              <th className="px-3 py-2 text-center font-medium text-muted-foreground">
                {language === 'ko' ? '추가일' : 'Added'}
              </th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                {refDateHeader}
              </th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                {todayHeader}
              </th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                {language === 'ko' ? '수익률' : 'Return'}
              </th>
              <th className="px-3 py-2 text-center font-medium text-muted-foreground">
                {language === 'ko' ? '링크' : 'Link'}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {stocks.map((stock) => {
              const returnValue = stock.current_closing_price && stock.closing_price_at_recommendation > 0
                ? ((stock.current_closing_price - stock.closing_price_at_recommendation) / stock.closing_price_at_recommendation) * 100
                : null;
              const stockUrl = getStockLink(stock);
              const addedDate = new Date(stock.recommendation_date);
              const addedDateStr = `${addedDate.getMonth() + 1}/${addedDate.getDate()}`;

              return (
                <tr
                  key={stock.id}
                  className="hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => onStockClick(stock)}
                >
                  <td className="px-3 py-2 font-medium">{stock.stock_name}</td>
                  <td className="px-3 py-2 text-center text-muted-foreground">{addedDateStr}</td>
                  <td className="px-3 py-2 text-right">
                    {stock.closing_price_at_recommendation > 0
                      ? formatPrice(stock.closing_price_at_recommendation)
                      : '-'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {stockUrl ? (
                      <a
                        href={stockUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-primary hover:underline"
                      >
                        {stock.current_closing_price ? formatPrice(stock.current_closing_price) : '-'}
                      </a>
                    ) : (
                      <>{stock.current_closing_price ? formatPrice(stock.current_closing_price) : '-'}</>
                    )}
                  </td>
                  <td className={`px-3 py-2 text-right font-medium ${
                    returnValue !== null && returnValue > 0
                      ? 'text-green-600'
                      : returnValue !== null && returnValue < 0
                        ? 'text-red-600'
                        : ''
                  }`}>
                    {calculateReturn(stock.closing_price_at_recommendation, stock.current_closing_price)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {stockUrl ? (
                      <a
                        href={stockUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-success hover:bg-success/80 text-success-foreground transition-colors"
                        title={isKR
                          ? (language === 'ko' ? '네이버 증권에서 보기' : 'View on Naver Finance')
                          : (language === 'ko' ? 'Yahoo Finance에서 보기' : 'View on Yahoo Finance')
                        }
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {(() => {
            const validStocks = stocks.filter(
              s => s.current_closing_price && s.closing_price_at_recommendation > 0
            );
            if (validStocks.length === 0) return null;
            const totalWeight = validStocks.reduce((sum, s) => sum + s.closing_price_at_recommendation, 0);
            const weightedReturn = validStocks.reduce((sum, s) => {
              const ret = ((s.current_closing_price! - s.closing_price_at_recommendation) / s.closing_price_at_recommendation) * 100;
              return sum + ret * (s.closing_price_at_recommendation / totalWeight);
            }, 0);
            return (
              <tfoot className="border-t-2 border-border bg-muted/30">
                <tr>
                  <td colSpan={4} className="px-3 py-2 text-right font-semibold text-xs">
                    {language === 'ko' ? '가중 평균 수익률' : 'Weighted Avg Return'}
                  </td>
                  <td className={`px-3 py-2 text-right font-bold text-xs ${
                    weightedReturn > 0 ? 'text-green-600' : weightedReturn < 0 ? 'text-red-600' : ''
                  }`}>
                    {weightedReturn >= 0 ? '+' : ''}{weightedReturn.toFixed(2)}%
                  </td>
                  <td className="px-3 py-2" />
                </tr>
              </tfoot>
            );
          })()}
        </table>
      </div>
    </div>
  );
}

export function WeeklyStockPicksTable({ language }: WeeklyStockPicksTableProps) {
  const [stocks, setStocks] = useState<StockPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingPrices, setUpdatingPrices] = useState(false);
  const [selectedStock, setSelectedStock] = useState<StockPick | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  async function fetchStocks() {
    const { data } = await supabase
      .from('weekly_stock_picks')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (data) setStocks(data as StockPick[]);
    setLoading(false);
  }

  useEffect(() => {
    fetchStocks();
  }, []);

  async function handleUpdatePrices(market: 'KR' | 'US') {
    setUpdatingPrices(true);
    toast.info(language === 'ko' ? '현재가 업데이트 중...' : 'Updating prices...');

    try {
      const marketStocks = stocks.filter(s => (s.market || 'KR') === market && s.stock_code);
      const { data, error } = await supabase.functions.invoke('fetch-stock-prices', {
        body: {
          stockCodes: marketStocks.map(s => ({ code: s.stock_code, name: s.stock_name })),
          market,
        }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error);

      let updatedCount = 0;
      for (const result of data.data) {
        if (result.currentPrice) {
          await supabase
            .from('weekly_stock_picks')
            .update({ current_closing_price: result.currentPrice, updated_at: new Date().toISOString() })
            .eq('stock_code', result.stockCode);
          updatedCount++;
        }
      }

      toast.success(language === 'ko' ? `${updatedCount}개 종목 업데이트 완료` : `Updated ${updatedCount} stocks`);
      await fetchStocks();
    } catch (err) {
      console.error('Price update error:', err);
      toast.error(language === 'ko' ? '업데이트 실패' : 'Update failed');
    } finally {
      setUpdatingPrices(false);
    }
  }

  const handleStockClick = (stock: StockPick) => {
    setSelectedStock(stock);
    setDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="mb-8 card-elevated overflow-hidden animate-fade-in">
        <div className="p-4 border-b border-border">
          <h3 className="font-serif font-semibold">
            {language === 'ko' ? '남산 관심 종목' : 'Namsan Stock Picks'}
          </h3>
        </div>
        <div className="h-[100px] flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  const krStocks = stocks.filter(s => (s.market || 'KR') === 'KR');
  const usStocks = stocks.filter(s => (s.market || 'KR') === 'US');

  if (krStocks.length === 0 && usStocks.length === 0) return null;

  return (
    <>
      <StockTable
        stocks={krStocks}
        language={language}
        market="KR"
        title={language === 'ko' ? '남산 관심 종목 (국장)' : 'Namsan Stock Picks (KR)'}
        onStockClick={handleStockClick}
        onUpdatePrices={handleUpdatePrices}
        updatingPrices={updatingPrices}
      />

      <StockTable
        stocks={usStocks}
        language={language}
        market="US"
        title={language === 'ko' ? '남산 관심 종목 (미장)' : 'Namsan Stock Picks (US)'}
        onStockClick={handleStockClick}
        onUpdatePrices={handleUpdatePrices}
        updatingPrices={updatingPrices}
      />

      <StockDetailDialog
        stock={selectedStock}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        language={language}
      />
    </>
  );
}
