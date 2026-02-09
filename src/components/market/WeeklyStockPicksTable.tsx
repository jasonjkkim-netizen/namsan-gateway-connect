import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { StockDetailDialog } from './StockDetailDialog';

interface StockPick {
  id: string;
  stock_name: string;
  stock_code: string | null;
  recommendation_date: string;
  closing_price_at_recommendation: number;
  current_closing_price: number | null;
}

interface WeeklyStockPicksTableProps {
  language: string;
}

export function WeeklyStockPicksTable({ language }: WeeklyStockPicksTableProps) {
  const [stocks, setStocks] = useState<StockPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStock, setSelectedStock] = useState<StockPick | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

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

  const handleStockClick = (stock: StockPick) => {
    setSelectedStock(stock);
    setDialogOpen(true);
  };

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

  // Get recommendation date from first stock (all should have same date)
  const recommendationDate = stocks[0]?.recommendation_date 
    ? new Date(stocks[0].recommendation_date) 
    : new Date();
  
  // Format dates for headers
  const formatDateHeader = (date: Date, lang: string) => {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return lang === 'ko' ? `${month}/${day} 종가` : `${month}/${day} Close`;
  };

  const today = new Date();
  const recDateHeader = formatDateHeader(recommendationDate, language);
  const todayHeader = formatDateHeader(today, language);

  return (
    <>
      <div className="mb-8 card-elevated overflow-hidden animate-fade-in">
        <div className="p-3 border-b border-border">
          <h3 className="font-serif font-medium text-sm">
            {language === 'ko' ? '금주 관심 종목' : 'Weekly Stock Picks'}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                  {language === 'ko' ? '추천 종목' : 'Stock'}
                </th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                  {recDateHeader}
                </th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                  {todayHeader}
                </th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">
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
                  <tr 
                    key={stock.id} 
                    className="hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => handleStockClick(stock)}
                  >
                    <td className="px-3 py-2 font-medium">{stock.stock_name}</td>
                    <td className="px-3 py-2 text-right">
                      {stock.closing_price_at_recommendation.toLocaleString()}원
                    </td>
                    <td className="px-3 py-2 text-right">
                      {stock.current_closing_price?.toLocaleString() || '-'}원
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