import { useLanguage } from '@/contexts/LanguageContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Area, AreaChart } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO } from 'date-fns';

interface Investment {
  id: string;
  product_name_en: string;
  product_name_ko: string;
  investment_amount: number;
  current_value: number;
  start_date: string;
}

interface PortfolioValueChartProps {
  investments: Investment[];
  loading: boolean;
}

export function PortfolioValueChart({ investments, loading }: PortfolioValueChartProps) {
  const { t, language, formatCurrency } = useLanguage();

  if (loading) {
    return (
      <div className="card-elevated p-6 animate-fade-in" style={{ animationDelay: '200ms' }}>
        <Skeleton className="h-6 w-48 mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (investments.length === 0) {
    return (
      <div className="card-elevated p-6 animate-fade-in" style={{ animationDelay: '200ms' }}>
        <h2 className="text-xl font-serif font-semibold mb-4">
          {language === 'ko' ? '투자 현황' : 'Investment Overview'}
        </h2>
        <div className="h-64 flex items-center justify-center text-muted-foreground">
          {t('noData')}
        </div>
      </div>
    );
  }

  // Build chart data: each investment as a data point showing invested vs current
  const chartData = investments
    .slice()
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .map((inv) => ({
      name: language === 'ko' ? inv.product_name_ko : inv.product_name_en,
      date: format(parseISO(inv.start_date), 'yy/MM'),
      invested: Number(inv.investment_amount),
      current: Number(inv.current_value),
      gain: Number(inv.current_value) - Number(inv.investment_amount),
    }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg shadow-lg p-3 text-sm">
          <p className="font-medium text-foreground mb-1">{payload[0]?.payload?.name}</p>
          {payload.map((entry: any, i: number) => (
            <p key={i} style={{ color: entry.color }}>
              {entry.name === 'invested'
                ? (language === 'ko' ? '투자금액' : 'Invested')
                : (language === 'ko' ? '현재가치' : 'Current Value')}
              : {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="card-elevated p-6 animate-fade-in" style={{ animationDelay: '200ms' }}>
      <h2 className="text-xl font-serif font-semibold mb-4">
        {language === 'ko' ? '투자 현황' : 'Investment Overview'}
      </h2>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <defs>
              <linearGradient id="investedGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="currentGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              angle={-20}
              textAnchor="end"
              height={60}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={(v) => {
                if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
                if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
                if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
                return v;
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="invested"
              stroke="hsl(var(--primary))"
              fill="url(#investedGrad)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="current"
              stroke="hsl(var(--success))"
              fill="url(#currentGrad)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-center gap-6 mt-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="w-3 h-3 rounded-full bg-primary" />
          {language === 'ko' ? '투자금액' : 'Invested'}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="w-3 h-3 rounded-full bg-success" />
          {language === 'ko' ? '현재가치' : 'Current Value'}
        </div>
      </div>
    </div>
  );
}
