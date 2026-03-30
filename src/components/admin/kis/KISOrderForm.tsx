import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Loader2, ShoppingCart, BadgeDollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { kisCall } from './kisApi';

export function KISOrderForm() {
  const { language } = useLanguage();
  const [market, setMarket] = useState<'domestic' | 'overseas'>('domestic');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [stockCode, setStockCode] = useState('');
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');
  const [orderType, setOrderType] = useState('01'); // 01=시장가, 00=지정가
  const [exchangeCode, setExchangeCode] = useState('NASD');
  const [loading, setLoading] = useState(false);

  const handleOrder = async () => {
    if (!stockCode.trim() || !qty.trim()) {
      toast.error(language === 'ko' ? '종목코드와 수량을 입력하세요' : 'Enter stock code and quantity');
      return;
    }
    if (orderType === '00' && !price.trim()) {
      toast.error(language === 'ko' ? '지정가 주문시 가격을 입력하세요' : 'Enter price for limit order');
      return;
    }

    setLoading(true);
    try {
      const action = market === 'domestic' ? 'domestic_order' : 'overseas_order';
      const params: Record<string, string> = {
        side,
        stockCode: stockCode.trim(),
        qty: qty.trim(),
        price: orderType === '01' ? '0' : price.trim(),
        orderType,
      };
      if (market === 'overseas') {
        params.exchangeCode = exchangeCode;
      }

      const result = await kisCall(action, params);
      const msg = result.msg1 || (language === 'ko' ? '주문이 접수되었습니다' : 'Order submitted');
      toast.success(msg);
      setStockCode('');
      setQty('');
      setPrice('');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const orderLabel = side === 'buy'
    ? (language === 'ko' ? '매수' : 'Buy')
    : (language === 'ko' ? '매도' : 'Sell');

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          {side === 'buy' ? <ShoppingCart className="h-5 w-5" /> : <BadgeDollarSign className="h-5 w-5" />}
          {language === 'ko' ? '주식 주문' : 'Stock Order'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label>{language === 'ko' ? '시장' : 'Market'}</Label>
            <Select value={market} onValueChange={(v) => setMarket(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="domestic">{language === 'ko' ? '🇰🇷 국내' : '🇰🇷 Domestic'}</SelectItem>
                <SelectItem value="overseas">{language === 'ko' ? '🌏 해외' : '🌏 Overseas'}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>{language === 'ko' ? '매매구분' : 'Side'}</Label>
            <Select value={side} onValueChange={(v) => setSide(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="buy">{language === 'ko' ? '매수' : 'Buy'}</SelectItem>
                <SelectItem value="sell">{language === 'ko' ? '매도' : 'Sell'}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>{language === 'ko' ? '주문유형' : 'Order Type'}</Label>
            <Select value={orderType} onValueChange={setOrderType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="01">{language === 'ko' ? '시장가' : 'Market'}</SelectItem>
                <SelectItem value="00">{language === 'ko' ? '지정가' : 'Limit'}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {market === 'overseas' && (
            <div>
              <Label>{language === 'ko' ? '거래소' : 'Exchange'}</Label>
              <Select value={exchangeCode} onValueChange={setExchangeCode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NASD">NASDAQ</SelectItem>
                  <SelectItem value="NYSE">NYSE</SelectItem>
                  <SelectItem value="AMEX">AMEX</SelectItem>
                  <SelectItem value="SEHK">HKEX</SelectItem>
                  <SelectItem value="TKSE">TSE</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label>{language === 'ko' ? '종목코드' : 'Stock Code'}</Label>
            <Input
              value={stockCode}
              onChange={(e) => setStockCode(e.target.value)}
              placeholder={market === 'domestic' ? '005930' : 'AAPL'}
            />
          </div>
          <div>
            <Label>{language === 'ko' ? '수량' : 'Quantity'}</Label>
            <Input
              type="number"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="1"
              min="1"
            />
          </div>
          {orderType === '00' && (
            <div>
              <Label>{language === 'ko' ? '가격' : 'Price'}</Label>
              <Input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0"
                min="0"
              />
            </div>
          )}
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              className={`w-full ${side === 'buy' ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'} text-white`}
              disabled={loading || !stockCode.trim() || !qty.trim()}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {orderLabel} {language === 'ko' ? '주문' : 'Order'}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {language === 'ko' ? '주문 확인' : 'Confirm Order'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                <div className="space-y-1 text-left">
                  <p><strong>{language === 'ko' ? '시장' : 'Market'}:</strong> {market === 'domestic' ? '국내' : `해외 (${exchangeCode})`}</p>
                  <p><strong>{language === 'ko' ? '구분' : 'Side'}:</strong> {orderLabel}</p>
                  <p><strong>{language === 'ko' ? '종목' : 'Stock'}:</strong> {stockCode}</p>
                  <p><strong>{language === 'ko' ? '수량' : 'Qty'}:</strong> {qty}</p>
                  <p><strong>{language === 'ko' ? '유형' : 'Type'}:</strong> {orderType === '01' ? (language === 'ko' ? '시장가' : 'Market') : `${language === 'ko' ? '지정가' : 'Limit'} ${price}`}</p>
                </div>
                <p className="mt-3 text-destructive font-medium">
                  {language === 'ko' ? '⚠️ 실전투자 주문입니다. 실제 매매가 체결됩니다.' : '⚠️ This is a LIVE order. Real trades will be executed.'}
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{language === 'ko' ? '취소' : 'Cancel'}</AlertDialogCancel>
              <AlertDialogAction onClick={handleOrder} className={side === 'buy' ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'}>
                {language === 'ko' ? '주문 실행' : 'Execute Order'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
