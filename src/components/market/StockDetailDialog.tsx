import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Calendar, DollarSign, ExternalLink } from 'lucide-react';

interface StockPick {
  id: string;
  stock_name: string;
  stock_code: string | null;
  recommendation_date: string;
  closing_price_at_recommendation: number;
  current_closing_price: number | null;
}

interface StockDetailDialogProps {
  stock: StockPick | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  language: string;
}

export function StockDetailDialog({ stock, open, onOpenChange, language }: StockDetailDialogProps) {
  if (!stock) return null;

  const returnValue = stock.current_closing_price
    ? ((stock.current_closing_price - stock.closing_price_at_recommendation) / stock.closing_price_at_recommendation) * 100
    : null;

  const isPositive = returnValue !== null && returnValue > 0;
  const isNegative = returnValue !== null && returnValue < 0;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return language === 'ko'
      ? `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`
      : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-serif">
            {stock.stock_name}
            {stock.stock_code && (
              <span className="text-sm font-normal text-muted-foreground">
                ({stock.stock_code})
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Return Summary */}
          <div className={`p-4 rounded-lg ${
            isPositive ? 'bg-green-50 dark:bg-green-950/30' : 
            isNegative ? 'bg-red-50 dark:bg-red-950/30' : 
            'bg-muted/50'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {language === 'ko' ? '수익률' : 'Return'}
              </span>
              <div className={`flex items-center gap-1 text-2xl font-bold ${
                isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : ''
              }`}>
                {isPositive && <TrendingUp className="h-5 w-5" />}
                {isNegative && <TrendingDown className="h-5 w-5" />}
                {returnValue !== null ? `${returnValue >= 0 ? '+' : ''}${returnValue.toFixed(2)}%` : '-'}
              </div>
            </div>
          </div>

          {/* Price Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <DollarSign className="h-4 w-4" />
                {language === 'ko' ? '추천 시 종가' : 'Price at Recommendation'}
              </div>
              <div className="text-lg font-semibold">
                ₩{stock.closing_price_at_recommendation.toLocaleString()}
              </div>
            </div>

            <div className="p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <DollarSign className="h-4 w-4" />
                {language === 'ko' ? '현재 종가' : 'Current Price'}
              </div>
              <div className="text-lg font-semibold">
                {stock.current_closing_price ? `₩${stock.current_closing_price.toLocaleString()}` : '-'}
              </div>
            </div>
          </div>

          {/* Recommendation Date */}
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Calendar className="h-4 w-4" />
              {language === 'ko' ? '추천일' : 'Recommendation Date'}
            </div>
            <div className="text-base font-medium">
              {formatDate(stock.recommendation_date)}
            </div>
          </div>

          {/* Naver Finance Chart - if stock code is available */}
          {stock.stock_code && (
            <div className="rounded-lg border overflow-hidden">
              <div className="p-2 border-b bg-muted/30">
                <span className="text-xs text-muted-foreground">
                  {language === 'ko' ? '차트 (네이버 금융)' : 'Chart (Naver Finance)'}
                </span>
              </div>
              <div className="h-[200px]">
                <iframe
                  src={`https://ssl.pstatic.net/imgfinance/chart/item/area/day/${stock.stock_code}.png?sidcode=${Date.now()}`}
                  className="w-full h-full border-0 object-contain"
                  scrolling="no"
                />
              </div>
            </div>
          )}

          {/* Naver Finance Link */}
          {stock.stock_code && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.open(`https://finance.naver.com/item/main.naver?code=${stock.stock_code}`, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              {language === 'ko' ? '네이버 금융에서 보기' : 'View on Naver Finance'}
            </Button>
          )}

          {/* Disclaimer */}
          <p className="text-xs text-muted-foreground text-center">
            {language === 'ko' 
              ? '* 본 정보는 투자 권유가 아니며, 투자 판단의 책임은 본인에게 있습니다.'
              : '* This information is not investment advice. Investment decisions are your own responsibility.'}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
