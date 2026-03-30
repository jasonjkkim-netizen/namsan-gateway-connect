import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { kisCall } from './kisApi';

interface StockItem {
  pdno: string;
  prdt_name: string;
  hldg_qty: string;
  pchs_avg_pric: string;
  prpr: string;
  evlu_pfls_amt: string;
  evlu_pfls_rt: string;
  evlu_amt: string;
}

interface OverseasItem {
  ovrs_pdno: string;
  ovrs_item_name: string;
  cblc_qty13: string;
  pchs_avg_pric: string;
  now_pric2: string;
  frcr_evlu_pfls_amt: string;
  evlu_pfls_rt: string;
  frcr_evlu_amt: string;
}

export function KISBalanceView() {
  const { language } = useLanguage();
  const [domesticItems, setDomesticItems] = useState<StockItem[]>([]);
  const [overseasItems, setOverseasItems] = useState<OverseasItem[]>([]);
  const [domesticSummary, setDomesticSummary] = useState<Record<string, string>>({});
  const [overseasSummary, setOverseasSummary] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const fetchBalance = async () => {
    setLoading(true);
    try {
      const [domestic, overseas] = await Promise.all([
        kisCall('domestic_balance'),
        kisCall('overseas_balance'),
      ]);

      setDomesticItems(domestic.output1 || []);
      setDomesticSummary(domestic.output2?.[0] || {});
      setOverseasItems(overseas.output1 || []);
      setOverseasSummary(overseas.output3 || {});
      setLoaded(true);
      toast.success(language === 'ko' ? '잔고를 조회했습니다' : 'Balance loaded');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatNum = (v: string) => {
    const n = parseFloat(v);
    if (isNaN(n)) return v || '-';
    return n.toLocaleString();
  };

  const formatPct = (v: string) => {
    const n = parseFloat(v);
    if (isNaN(n)) return v || '-';
    return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
  };

  const pctColor = (v: string) => {
    const n = parseFloat(v);
    if (isNaN(n)) return '';
    return n >= 0 ? 'text-red-500' : 'text-blue-500';
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">
          {language === 'ko' ? '계좌 잔고' : 'Account Balance'}
        </h3>
        <Button onClick={fetchBalance} disabled={loading} size="sm">
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
          {language === 'ko' ? '조회' : 'Refresh'}
        </Button>
      </div>

      {!loaded ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {language === 'ko' ? '"조회" 버튼을 눌러 잔고를 확인하세요' : 'Click "Refresh" to load balance'}
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="domestic">
          <TabsList>
            <TabsTrigger value="domestic">{language === 'ko' ? '🇰🇷 국내' : '🇰🇷 Domestic'}</TabsTrigger>
            <TabsTrigger value="overseas">{language === 'ko' ? '🌏 해외' : '🌏 Overseas'}</TabsTrigger>
          </TabsList>

          <TabsContent value="domestic">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex justify-between">
                  <span>{language === 'ko' ? '국내 보유종목' : 'Domestic Holdings'}</span>
                  <span className="text-sm font-normal text-muted-foreground">
                    {language === 'ko' ? '총 평가금액' : 'Total'}: ₩{formatNum(domesticSummary.tot_evlu_amt || '0')}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{language === 'ko' ? '종목' : 'Stock'}</TableHead>
                      <TableHead className="text-right">{language === 'ko' ? '수량' : 'Qty'}</TableHead>
                      <TableHead className="text-right">{language === 'ko' ? '평균가' : 'Avg Price'}</TableHead>
                      <TableHead className="text-right">{language === 'ko' ? '현재가' : 'Current'}</TableHead>
                      <TableHead className="text-right">{language === 'ko' ? '평가금액' : 'Value'}</TableHead>
                      <TableHead className="text-right">{language === 'ko' ? '손익' : 'P&L'}</TableHead>
                      <TableHead className="text-right">{language === 'ko' ? '수익률' : 'Return'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {domesticItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          {language === 'ko' ? '보유 종목이 없습니다' : 'No holdings'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      domesticItems.map((item) => (
                        <TableRow key={item.pdno}>
                          <TableCell>
                            <div className="font-medium">{item.prdt_name}</div>
                            <div className="text-xs text-muted-foreground">{item.pdno}</div>
                          </TableCell>
                          <TableCell className="text-right">{formatNum(item.hldg_qty)}</TableCell>
                          <TableCell className="text-right">₩{formatNum(item.pchs_avg_pric)}</TableCell>
                          <TableCell className="text-right">₩{formatNum(item.prpr)}</TableCell>
                          <TableCell className="text-right">₩{formatNum(item.evlu_amt)}</TableCell>
                          <TableCell className={`text-right ${pctColor(item.evlu_pfls_amt)}`}>
                            ₩{formatNum(item.evlu_pfls_amt)}
                          </TableCell>
                          <TableCell className={`text-right font-medium ${pctColor(item.evlu_pfls_rt)}`}>
                            {formatPct(item.evlu_pfls_rt)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="overseas">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex justify-between">
                  <span>{language === 'ko' ? '해외 보유종목' : 'Overseas Holdings'}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{language === 'ko' ? '종목' : 'Stock'}</TableHead>
                      <TableHead className="text-right">{language === 'ko' ? '수량' : 'Qty'}</TableHead>
                      <TableHead className="text-right">{language === 'ko' ? '평균가' : 'Avg Price'}</TableHead>
                      <TableHead className="text-right">{language === 'ko' ? '현재가' : 'Current'}</TableHead>
                      <TableHead className="text-right">{language === 'ko' ? '평가금액' : 'Value'}</TableHead>
                      <TableHead className="text-right">{language === 'ko' ? '손익' : 'P&L'}</TableHead>
                      <TableHead className="text-right">{language === 'ko' ? '수익률' : 'Return'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overseasItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          {language === 'ko' ? '보유 종목이 없습니다' : 'No holdings'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      overseasItems.map((item) => (
                        <TableRow key={item.ovrs_pdno}>
                          <TableCell>
                            <div className="font-medium">{item.ovrs_item_name}</div>
                            <div className="text-xs text-muted-foreground">{item.ovrs_pdno}</div>
                          </TableCell>
                          <TableCell className="text-right">{formatNum(item.cblc_qty13)}</TableCell>
                          <TableCell className="text-right">${formatNum(item.pchs_avg_pric)}</TableCell>
                          <TableCell className="text-right">${formatNum(item.now_pric2)}</TableCell>
                          <TableCell className="text-right">${formatNum(item.frcr_evlu_amt)}</TableCell>
                          <TableCell className={`text-right ${pctColor(item.frcr_evlu_pfls_amt)}`}>
                            ${formatNum(item.frcr_evlu_pfls_amt)}
                          </TableCell>
                          <TableCell className={`text-right font-medium ${pctColor(item.evlu_pfls_rt)}`}>
                            {formatPct(item.evlu_pfls_rt)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
