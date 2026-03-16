import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine, Label } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProductPosition {
  name_ko: string;
  name_en: string;
  returnRate: number;
  risk: number;
  color: string;
  emoji: string;
}

const products: ProductPosition[] = [
  {
    name_ko: '링스 사모사채',
    name_en: 'LYNX Private Bond',
    returnRate: 7.0,
    risk: 2.0,
    color: 'hsl(210, 70%, 50%)',
    emoji: '🔵',
  },
  {
    name_ko: '공모주 솔류션',
    name_en: 'IPO Solution',
    returnRate: 9.0,
    risk: 4.5,
    color: 'hsl(170, 60%, 45%)',
    emoji: '🟢',
  },
  {
    name_ko: '안전형 포트폴리오',
    name_en: 'Conservative Portfolio',
    returnRate: 9.5,
    risk: 3.5,
    color: 'hsl(145, 55%, 42%)',
    emoji: '🟩',
  },
  {
    name_ko: '균형형 포트폴리오',
    name_en: 'Balanced Portfolio',
    returnRate: 11.5,
    risk: 5.5,
    color: 'hsl(45, 80%, 50%)',
    emoji: '🟡',
  },
  {
    name_ko: '공격형 포트폴리오',
    name_en: 'Growth Portfolio',
    returnRate: 14.0,
    risk: 7.5,
    color: 'hsl(0, 70%, 55%)',
    emoji: '🔴',
  },
];

interface BenchmarkData {
  average_return_percent: number;
  range_low_percent?: number;
  range_high_percent?: number;
  maturity_years: number;
  sample_products?: string[];
  data_date?: string;
  notes?: string;
  updated_at?: string;
}

const DEFAULT_BENCHMARK: BenchmarkData = {
  average_return_percent: 6.5,
  maturity_years: 20,
};

const CustomTooltip = ({ active, payload, language }: any) => {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload as ProductPosition;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
      <p className="font-semibold text-sm text-foreground">
        {data.emoji} {language === 'ko' ? data.name_ko : data.name_en}
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        {language === 'ko' ? '기대 수익률' : 'Expected Return'}: <span className="font-medium text-foreground">{data.returnRate.toFixed(1)}%</span>
      </p>
      <p className="text-xs text-muted-foreground">
        {language === 'ko' ? '위험도' : 'Risk Level'}: <span className="font-medium text-foreground">{data.risk.toFixed(1)}/10</span>
      </p>
    </div>
  );
};

const CustomDot = (props: any) => {
  const { cx, cy, payload } = props;
  if (!cx || !cy) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={20} fill={payload.color} fillOpacity={0.15} stroke={payload.color} strokeWidth={1.5} />
      <circle cx={cx} cy={cy} r={8} fill={payload.color} fillOpacity={0.9} stroke="white" strokeWidth={2} />
    </g>
  );
};

export function RiskReturnMatrix() {
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const [isUpdating, setIsUpdating] = useState(false);

  const { data: benchmark } = useQuery({
    queryKey: ['hk-insurance-benchmark'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'hk_insurance_benchmark')
        .maybeSingle();
      
      if (error || !data) return DEFAULT_BENCHMARK;
      const val = data.value as any;
      if (typeof val?.average_return_percent === 'number') {
        return val as BenchmarkData;
      }
      return DEFAULT_BENCHMARK;
    },
    staleTime: 30_000,
  });

  const benchmarkRate = benchmark?.average_return_percent ?? DEFAULT_BENCHMARK.average_return_percent;
  const maturityYears = benchmark?.maturity_years ?? 20;
  const BENCHMARK_RISK = 1.5; // Savings insurance = very low risk

  // Benchmark as a scatter point
  const benchmarkPoint = [{
    name_ko: `HK 배당보험 (${maturityYears}년)`,
    name_en: `HK Savings Insurance (${maturityYears}yr)`,
    returnRate: benchmarkRate,
    risk: BENCHMARK_RISK,
    color: 'hsl(var(--primary))',
    emoji: '📊',
  }];

  const handleRefreshBenchmark = async () => {
    setIsUpdating(true);
    try {
      const response = await supabase.functions.invoke('fetch-hk-insurance-benchmark');
      if (response.error) throw response.error;
      await queryClient.invalidateQueries({ queryKey: ['hk-insurance-benchmark'] });
      toast.success(language === 'ko' ? '벤치마크가 업데이트되었습니다' : 'Benchmark updated');
    } catch (err) {
      console.error('Benchmark update failed:', err);
      toast.error(language === 'ko' ? '업데이트 실패' : 'Update failed');
    } finally {
      setIsUpdating(false);
    }
  };

  const benchmarkLabel = language === 'ko'
    ? `HK 배당보험 ${benchmarkRate.toFixed(1)}% (${maturityYears}년)`
    : `HK Savings Ins. ${benchmarkRate.toFixed(1)}% (${maturityYears}yr)`;

  const benchmarkSubtext = benchmark?.data_date
    ? `${language === 'ko' ? '기준: ' : 'As of: '}${benchmark.data_date}`
    : '';

  return (
    <Card className="card-elevated animate-fade-in mb-6">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-serif">
            <TrendingUp className="h-5 w-5 text-primary" />
            {language === 'ko' ? '리스크-리턴 매트릭스' : 'Risk-Return Matrix'}
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshBenchmark}
            disabled={isUpdating}
            className="flex items-center gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3 w-3 ${isUpdating ? 'animate-spin' : ''}`} />
            {language === 'ko' ? '벤치마크 갱신' : 'Update Benchmark'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {language === 'ko'
            ? '남산 투자 상품 포지셔닝 (수수료 차감 후 기대 최대 수익률 기준)'
            : 'Namsan product positioning (max expected return after fees)'}
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-[340px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 30, bottom: 30, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis
                type="number"
                dataKey="returnRate"
                domain={[6, 16]}
                ticks={[7, 8, 9, 10, 11, 12, 13, 14, 15]}
                tickFormatter={(v) => `${v}%`}
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
              >
                <Label
                  value={language === 'ko' ? '기대 수익률 (수수료 후)' : 'Expected Return (After Fees)'}
                  position="bottom"
                  offset={10}
                  style={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                />
              </XAxis>
              <YAxis
                type="number"
                dataKey="risk"
                domain={[0, 10]}
                ticks={[1, 2, 3, 4, 5, 6, 7, 8, 9]}
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickFormatter={(v) => {
                  if (language === 'ko') {
                    if (v <= 2) return '낮음';
                    if (v <= 5) return '중간';
                    if (v <= 7) return '높음';
                    return '매우높음';
                  }
                  if (v <= 2) return 'Low';
                  if (v <= 5) return 'Med';
                  if (v <= 7) return 'High';
                  return 'V.High';
                }}
              >
                <Label
                  value={language === 'ko' ? '위험도' : 'Risk Level'}
                  angle={-90}
                  position="insideLeft"
                  offset={-5}
                  style={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                />
              </YAxis>
              <Tooltip content={<CustomTooltip language={language} />} />
              
              {/* HK Savings Insurance Benchmark - horizontal reference line at benchmark risk level */}
              <ReferenceLine
                y={BENCHMARK_RISK}
                stroke="hsl(var(--primary))"
                strokeDasharray="8 4"
                strokeOpacity={0.5}
                strokeWidth={1.5}
              >
                <Label
                  value={benchmarkLabel}
                  position="right"
                  offset={5}
                  style={{ fill: 'hsl(var(--primary))', fontSize: 9, fontWeight: 500 }}
                />
              </ReferenceLine>

              {/* Diagonal guide line */}
              <ReferenceLine
                segment={[{ x: 6, y: 0 }, { x: 16, y: 10 }]}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="6 4"
                strokeOpacity={0.25}
              />

              {/* Benchmark point */}
              <Scatter data={benchmarkPoint} shape={(props: any) => {
                const { cx, cy } = props;
                if (!cx || !cy) return null;
                return (
                  <g>
                    <rect x={cx - 12} y={cy - 12} width={24} height={24} rx={4} fill="hsl(var(--primary))" fillOpacity={0.12} stroke="hsl(var(--primary))" strokeWidth={1.5} strokeDasharray="4 2" />
                    <circle cx={cx} cy={cy} r={6} fill="hsl(var(--primary))" fillOpacity={0.8} stroke="white" strokeWidth={2} />
                  </g>
                );
              }} />

              {/* Product scatter points */}
              <Scatter data={products} shape={<CustomDot />}>
                {products.map((product, index) => (
                  <Cell key={index} fill={product.color} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-3">
          {products.map((product) => (
            <div key={product.name_ko} className="flex items-center gap-1.5">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: product.color }}
              />
              <span className="text-xs text-muted-foreground">
                {language === 'ko' ? product.name_ko : product.name_en}
              </span>
              <span className="text-xs font-medium text-foreground">
                {product.returnRate}%
              </span>
            </div>
          ))}
          {/* Benchmark legend item */}
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-0 border-t-2 border-dashed border-primary" />
            <span className="text-xs text-muted-foreground">
              {language === 'ko' ? 'HK 배당보험' : 'HK Savings Ins.'}
            </span>
            <span className="text-xs font-medium text-foreground">
              {benchmarkRate.toFixed(1)}%
            </span>
            {benchmarkSubtext && (
              <span className="text-[10px] text-muted-foreground">({benchmarkSubtext})</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
