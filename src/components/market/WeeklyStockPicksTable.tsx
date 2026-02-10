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
}

interface WeeklyStockPicksTableProps {
  language: string;
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

    if (data) setStocks(data);
    setLoading(false);
  }

  useEffect(() => {
    fetchStocks();
  }, []);

  async function handleUpdatePrices() {
    setUpdatingPrices(true);
    toast.info(language === 'ko' ? '현재가 업데이트 중...' : 'Updating prices...');

    try {
      const stocksWithCodes = stocks.filter(s => s.stock_code);
      const { data, error } = await supabase.functions.invoke('fetch-stock-prices', {
        body: {
          stockCodes: stocksWithCodes.map(s => ({ code: s.stock_code, name: s.stock_name }))
        }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error);

      // Update DB with fetched prices
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

  function calculateReturn(recommendedPrice: number, currentPrice: number | null): string {
    if (!currentPrice) return '-';
    const returnPct = ((currentPrice - recommendedPrice) / recommendedPrice) * 100;
    return `${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(2)}%`;
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

  if (stocks.length === 0) return null;

  // Get price reference date from first stock (base price date, e.g., Jan 30)
  const priceReferenceDate = stocks[0]?.price_reference_date 
    ? new Date(stocks[0].price_reference_date) 
    : stocks[0]?.recommendation_date 
      ? new Date(stocks[0].recommendation_date)
      : new Date();
  
  // Format dates for headers
  const formatDateHeader = (date: Date, lang: string) => {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return lang === 'ko' ? `${month}/${day} 종가` : `${month}/${day} Close`;
  };

  const refDateHeader = formatDateHeader(priceReferenceDate, language);
  const todayHeader = language === 'ko' ? '현재 가격' : 'Current';
  
  // Check if any stock was added on a different date (newly added stocks)
  const hasNewlyAddedStocks = stocks.some(stock => {
    const refDate = stock.price_reference_date || stock.recommendation_date;
    return refDate !== stocks[0]?.price_reference_date;
  });

  return (
    <>
      <div className="mb-8 card-elevated overflow-hidden animate-fade-in">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <h3 className="font-serif font-medium text-sm">
            {language === 'ko' ? '남산 관심 종목' : 'Namsan Stock Picks'}
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleUpdatePrices}
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
                const returnValue = stock.current_closing_price 
                  ? ((stock.current_closing_price - stock.closing_price_at_recommendation) / stock.closing_price_at_recommendation) * 100
                  : null;
                const naverUrl = stock.stock_code 
                  ? `https://finance.naver.com/item/main.naver?code=${stock.stock_code}`
                  : null;
                // Format the added date (recommendation_date)
                const addedDate = new Date(stock.recommendation_date);
                const addedDateStr = `${addedDate.getMonth() + 1}/${addedDate.getDate()}`;
                
                return (
                  <tr 
                    key={stock.id} 
                    className="hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => handleStockClick(stock)}
                  >
                    <td className="px-3 py-2 font-medium">{stock.stock_name}</td>
                    <td className="px-3 py-2 text-center text-muted-foreground">
                      {addedDateStr}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {stock.closing_price_at_recommendation.toLocaleString()}원
                    </td>
                    <td className="px-3 py-2 text-right">
                      {naverUrl ? (
                        <a
                          href={naverUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-primary hover:underline"
                        >
                          {stock.current_closing_price?.toLocaleString() || '-'}원
                        </a>
                      ) : (
                        <>{stock.current_closing_price?.toLocaleString() || '-'}원</>
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
                      {naverUrl ? (
                        <a
                          href={naverUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-success hover:bg-success/80 text-success-foreground transition-colors"
                          title={language === 'ko' ? '네이버 증권에서 보기' : 'View on Naver Finance'}
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
          </table>
        </div>
      </div>

      <StockDetailDialog
        stock={selectedStock}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        language={language}
      />
    </>
  );
}