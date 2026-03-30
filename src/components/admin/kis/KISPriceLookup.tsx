import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';
import { kisCall } from './kisApi';

export function KISPriceLookup() {
  const { language } = useLanguage();
  const [stockCode, setStockCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [priceData, setPriceData] = useState<Record<string, string> | null>(null);

  const handleSearch = async () => {
    if (!stockCode.trim()) return;
    setLoading(true);
    try {
      const data = await kisCall('domestic_price', { stockCode: stockCode.trim() });
      setPriceData(data.output || null);
      if (!data.output) toast.error(language === 'ko' ? '종목을 찾을 수 없습니다' : 'Stock not found');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatNum = (v: string) => {
    const n = parseFloat(v);
    return isNaN(n) ? v || '-' : n.toLocaleString();
  };

  const isUp = priceData ? parseFloat(priceData.prdy_vrss || '0') >= 0 : false;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          value={stockCode}
          onChange={(e) => setStockCode(e.target.value)}
          placeholder={language === 'ko' ? '종목코드 입력 (예: 005930)' : 'Stock code (e.g. 005930)'}
          className="max-w-xs"
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <Button onClick={handleSearch} disabled={loading || !stockCode.trim()}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-1" />}
          {language === 'ko' ? '조회' : 'Search'}
        </Button>
      </div>

      {priceData && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <div>
                <span className="text-xl">{priceData.stck_prpr ? `₩${formatNum(priceData.stck_prpr)}` : '-'}</span>
                <span className={`ml-3 text-sm ${isUp ? 'text-red-500' : 'text-blue-500'}`}>
                  {isUp ? <TrendingUp className="inline h-4 w-4 mr-1" /> : <TrendingDown className="inline h-4 w-4 mr-1" />}
                  {priceData.prdy_vrss ? formatNum(priceData.prdy_vrss) : '-'}
                  ({priceData.prdy_ctrt ? `${parseFloat(priceData.prdy_ctrt) >= 0 ? '+' : ''}${priceData.prdy_ctrt}%` : '-'})
                </span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {[
                [language === 'ko' ? '시가' : 'Open', formatNum(priceData.stck_oprc)],
                [language === 'ko' ? '고가' : 'High', formatNum(priceData.stck_hgpr)],
                [language === 'ko' ? '저가' : 'Low', formatNum(priceData.stck_lwpr)],
                [language === 'ko' ? '거래량' : 'Volume', formatNum(priceData.acml_vol)],
                [language === 'ko' ? '거래대금' : 'Turnover', `₩${formatNum(priceData.acml_tr_pbmn)}`],
                [language === 'ko' ? '52주 고가' : '52W High', formatNum(priceData.stck_dryy_hgpr)],
                [language === 'ko' ? '52주 저가' : '52W Low', formatNum(priceData.stck_dryy_lwpr)],
                ['PER', priceData.per || '-'],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <div className="text-muted-foreground">{label}</div>
                  <div className="font-medium">₩{value}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
