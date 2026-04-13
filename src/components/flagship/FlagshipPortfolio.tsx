import { useState, useMemo } from 'react';

import { format, parseISO } from 'date-fns';
import { ko as koLocale } from 'date-fns/locale';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePortfolioData } from './usePortfolioData';
import { GroupId, GROUP_META, BASE_DATE, PRESETS } from './portfolioTypes';
import { buildGroups, calcItemReturn, formatPct } from './portfolioUtils';
import { FlagshipCharts } from './FlagshipCharts';
import { FlagshipSimulator } from './FlagshipSimulator';
import { PortfolioAnalysis } from './PortfolioAnalysis';
import { CIOCommentary } from './CIOCommentary';
import { FlagshipReport } from './FlagshipReport';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TrendingUp, TrendingDown, Minus, FileText, CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FlagshipPortfolioProps {
  chartsOnly?: boolean;
}

export function FlagshipPortfolio({ chartsOnly = false }: FlagshipPortfolioProps) {
  const { language } = useLanguage();
  const { items, loading } = usePortfolioData();
  const ko = language === 'ko';
  const [activePresetId, setActivePresetId] = useState<'low' | 'mid' | 'high'>('mid');

  // Calculate initial weights from data
  const initialWeights = useMemo(() => {
    if (items.length === 0) return { shares: 50, bonds: 40, others: 10, cash: 0 };
    const w: Record<GroupId, number> = { shares: 0, bonds: 0, others: 0, cash: 0 };
    items.forEach(i => { w[i.groupId] = (w[i.groupId] || 0) + i.weight; });
    const total = Object.values(w).reduce((s, v) => s + v, 0);
    if (total > 0) {
      (Object.keys(w) as GroupId[]).forEach(k => { w[k] = Math.round(w[k] / total * 100 * 10) / 10; });
    }
    return w;
  }, [items]);

  const [groupWeights, setGroupWeights] = useState<Record<GroupId, number>>(initialWeights);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [baseDate, setBaseDate] = useState<Date>(parseISO(BASE_DATE));

  // Sync weights from data only on first load
  useMemo(() => {
    if (items.length > 0 && !hasInitialized) {
      setGroupWeights(initialWeights);
      setHasInitialized(true);
    }
  }, [items, initialWeights, hasInitialized]);

  const groups = useMemo(() => buildGroups(items, baseDate), [items, baseDate]);
  
  const baseDateLabel = ko 
    ? format(baseDate, 'yyyy년 M월 d일', { locale: koLocale })
    : format(baseDate, 'MMM d, yyyy');

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (items.length === 0) return null;

  // Charts-only mode for MarketData page — use Balanced preset weights
  const balancedPreset = PRESETS.find(p => p.id === 'mid')!;
  const balancedWeights = balancedPreset.groupWeights;

  if (chartsOnly) {
    return (
      <div className="animate-fade-in">
        <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-serif font-medium text-sm">
            {ko ? 'Namsan Flagship 포트폴리오 (균형형)' : 'Namsan Flagship Portfolio (Balanced)'}
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{ko ? '기준일:' : 'Base:'}</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                  <CalendarIcon className="h-3 w-3" />
                  {baseDateLabel}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={baseDate}
                  onSelect={(date) => date && setBaseDate(date)}
                  disabled={(date) => date > new Date() || date < new Date("2020-01-01")}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <FlagshipCharts items={items} groups={groups} groupWeights={balancedWeights} sideBySide baseDate={baseDate} />
      </div>
    );
  }

  

  // Calculate total allocation and blended performance
  const rawTotal = groups.reduce((sum, g) => sum + g.totalWeight, 0);
  const normalizedWeightPct = (g: typeof groups[number]) => rawTotal > 0 ? (g.totalWeight / rawTotal) * 100 : 0;
  const totalPerformance = groups.reduce((sum, g) => sum + g.totalWeight * g.performance, 0) / (rawTotal || 1);
  const TotalPerfIcon = totalPerformance > 0 ? TrendingUp : totalPerformance < 0 ? TrendingDown : Minus;
  const totalPerfColor = totalPerformance > 0 ? 'text-green-600' : totalPerformance < 0 ? 'text-red-500' : 'text-muted-foreground';

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <span className="text-sm font-medium text-accent tracking-widest uppercase mb-3 block">
          Flagship Portfolio
        </span>
        <h2 className="text-2xl md:text-3xl font-serif font-semibold text-foreground">
          {ko ? 'Namsan Flagship 투자 현황' : 'Namsan Flagship Investment Status'}
        </h2>
        
        {/* Date Picker */}
        <div className="flex items-center justify-center gap-2 mt-4">
          <span className="text-sm text-muted-foreground">
            {ko ? '기준일:' : 'Base Date:'}
          </span>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[180px] justify-start text-left font-normal",
                  !baseDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {baseDateLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center">
              <Calendar
                mode="single"
                selected={baseDate}
                onSelect={(date) => date && setBaseDate(date)}
                disabled={(date) =>
                  date > new Date() || date < new Date("2020-01-01")
                }
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>

        <p className="text-sm text-muted-foreground mt-2 max-w-2xl mx-auto">
          {ko
            ? `${baseDateLabel} 기준 포트폴리오 성과 및 자산 배분 현황`
            : `Portfolio performance and asset allocation since ${baseDateLabel}`}
        </p>
        <Button
          size="sm"
          variant="outline"
          className="mt-4 gap-2"
          onClick={() => setReportOpen(true)}
        >
          <FileText className="h-4 w-4" />
          {ko ? '리포트 생성' : 'Generate Report'}
        </Button>
      </div>

      {/* Table (full width on top) */}
      <div className="bg-background rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold">{ko ? '그룹' : 'Group'}</TableHead>
              <TableHead className="text-right font-semibold w-28">{ko ? '배분 (%)' : 'Allocation (%)'}</TableHead>
              <TableHead className="text-right font-semibold hidden sm:table-cell w-36">
                <div>{ko ? '수익률' : 'Performance'}</div>
                <div className="text-[10px] font-normal text-muted-foreground italic">{ko ? '(수수료·세금 차감전)' : '(Before Fees & Tax)'}</div>
              </TableHead>
              <TableHead className="hidden md:table-cell font-semibold">{ko ? '비고' : 'Notes'}</TableHead>
            </TableRow>
          </TableHeader>
        </Table>

        <Accordion type="multiple" className="w-full">
          {groups.map(group => {
            const perf = group.performance;
            const PerfIcon = perf > 0 ? TrendingUp : perf < 0 ? TrendingDown : Minus;
            const perfColor = perf > 0 ? 'text-green-600' : perf < 0 ? 'text-red-500' : 'text-muted-foreground';

            return (
              <AccordionItem key={group.id} value={group.id} className="border-b last:border-b-0">
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30">
                  <div className="flex items-center w-full">
                    <div className="flex-1 text-left font-medium text-sm">
                      {ko ? group.nameKo : group.nameEn}
                    </div>
                    <div className="w-28 text-right text-sm font-mono pr-4">
                      {normalizedWeightPct(group).toFixed(1)}%
                    </div>
                    <div className={`w-28 text-right text-sm font-mono hidden sm:flex items-center justify-end gap-1 pr-4 ${perfColor}`}>
                      <PerfIcon className="h-3 w-3" />
                      {formatPct(perf)}
                    </div>
                    <div className="w-20 hidden md:block" />
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="px-2 pb-2">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/20 text-[11px]">
                          <TableHead className="py-1.5 text-xs">{ko ? '종목' : 'Name'}</TableHead>
                          <TableHead className="py-1.5 text-xs hidden sm:table-cell">{ko ? '코드' : 'Ticker'}</TableHead>
                          <TableHead className="py-1.5 text-xs text-right">{ko ? '비중' : 'Weight'}</TableHead>
                          <TableHead className="py-1.5 text-xs text-right">{ko ? '수익률' : 'Return'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.items.map(item => {
                          const itemRet = calcItemReturn(item, baseDate);
                          const retColor = itemRet > 0 ? 'text-green-600' : itemRet < 0 ? 'text-red-500' : 'text-muted-foreground';
                          return (
                            <TableRow key={item.id} className="text-xs">
                              <TableCell className="py-1.5">
                                <span className="font-medium">{item.name}</span>
                                {item.assetType === 'bond' && item.targetAnnualReturn != null && (
                                  <Badge variant="outline" className="ml-2 text-[10px] py-0">
                                    {ko ? '연' : 'Ann.'} {formatPct(item.targetAnnualReturn)}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="py-1.5 text-muted-foreground hidden sm:table-cell">
                                {item.ticker || '-'}
                              </TableCell>
                              <TableCell className="py-1.5 text-right font-mono">
                                {item.weight.toFixed(1)}%
                              </TableCell>
                              <TableCell className={`py-1.5 text-right font-mono ${retColor}`}>
                                {item.assetType === 'bond'
                                  ? `${formatPct(itemRet)} ${ko ? '(경과)' : '(accrued)'}`
                                  : formatPct(itemRet)
                                }
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>

        {/* Total row */}
        <div className="border-t border-border bg-muted/40 px-4 py-3">
          <div className="flex items-center w-full">
            <div className="flex-1 text-left font-semibold text-sm">
              {ko ? '합계' : 'Total'}
            </div>
            <div className="w-36 text-right text-sm font-mono font-semibold pr-4">
              100.0%
            </div>
            <div className={`w-36 text-right text-sm font-mono font-semibold hidden sm:flex flex-col items-end pr-4 ${totalPerfColor}`}>
              <div className="flex items-center gap-1">
                <TotalPerfIcon className="h-3 w-3" />
                {formatPct(totalPerformance)}
              </div>
              <span className="text-[10px] font-normal text-muted-foreground italic">{ko ? '(수수료·세금 차감전)' : '(Before Fees & Tax)'}</span>
            </div>
            <div className="w-20 hidden md:block" />
          </div>
        </div>
      </div>

      {/* Charts side by side below table */}
      <FlagshipCharts items={items} groups={groups} groupWeights={groupWeights} sideBySide baseDate={baseDate} />

      {/* AI Analysis & CIO Commentary */}
      <PortfolioAnalysis items={items} groups={groups} onAnalysisChange={setAiAnalysis} />
      <CIOCommentary />

      {/* Simulator + Presets */}
      <FlagshipSimulator
        items={items}
        groups={groups}
        groupWeights={groupWeights}
        setGroupWeights={setGroupWeights}
        baseDate={baseDate}
      />

      {/* Disclaimer */}
      <p className="text-[11px] text-muted-foreground text-center max-w-3xl mx-auto leading-relaxed">
        {ko
          ? `${baseDateLabel} 이후 수익률은 이용 가능한 가격 데이터를 기반으로 합니다. 채권은 목표 연간 수익률을 사용하며, 실제 체결 및 가격은 다를 수 있습니다. 투자 시뮬레이션은 예측치이며 수익을 보장하지 않습니다.`
          : `Performance since ${baseDateLabel} is based on available price data. Bonds use target annual yield; actual execution and pricing may differ. Projections are not guarantees.`}
      </p>

      {/* Report Dialog */}
      <FlagshipReport
        open={reportOpen}
        onOpenChange={setReportOpen}
        items={items}
        groups={groups}
        groupWeights={groupWeights}
        aiAnalysis={aiAnalysis}
      />
    </div>
  );
}
