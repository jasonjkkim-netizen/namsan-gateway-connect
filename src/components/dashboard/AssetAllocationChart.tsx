import { useLanguage } from '@/contexts/LanguageContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';

interface Investment {
  id: string;
  product_name_en: string;
  product_name_ko: string;
  current_value: number;
}

interface AssetAllocationChartProps {
  investments: Investment[];
  loading: boolean;
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--accent))',
  'hsl(var(--success))',
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
];

export function AssetAllocationChart({ investments, loading }: AssetAllocationChartProps) {
  const { t, language, formatCurrency, formatPercent } = useLanguage();

  const totalValue = investments.reduce((sum, inv) => sum + Number(inv.current_value), 0);

  const chartData = investments.map((inv, index) => ({
    name: language === 'ko' ? inv.product_name_ko : inv.product_name_en,
    value: Number(inv.current_value),
    percentage: totalValue > 0 ? (Number(inv.current_value) / totalValue) * 100 : 0,
    color: COLORS[index % COLORS.length],
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border border-border rounded-lg shadow-lg p-3">
          <p className="font-medium text-foreground">{data.name}</p>
          <p className="text-sm text-muted-foreground">
            {formatCurrency(data.value)}
          </p>
          <p className="text-sm text-accent font-medium">
            {formatPercent(data.percentage)}
          </p>
        </div>
      );
    }
    return null;
  };

  const renderLegend = (props: any) => {
    const { payload } = props;
    return (
      <ul className="flex flex-wrap justify-center gap-4 mt-4">
        {payload.map((entry: any, index: number) => (
          <li key={`legend-${index}`} className="flex items-center gap-2 text-sm">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.value}</span>
          </li>
        ))}
      </ul>
    );
  };

  if (loading) {
    return (
      <div className="card-elevated p-6 animate-fade-in" style={{ animationDelay: '150ms' }}>
        <Skeleton className="h-6 w-48 mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (investments.length === 0) {
    return (
      <div className="card-elevated p-6 animate-fade-in" style={{ animationDelay: '150ms' }}>
        <h2 className="text-xl font-serif font-semibold mb-4">{t('assetAllocation')}</h2>
        <div className="h-64 flex items-center justify-center text-muted-foreground">
          {t('noData')}
        </div>
      </div>
    );
  }

  return (
    <div className="card-elevated p-6 animate-fade-in" style={{ animationDelay: '150ms' }}>
      <h2 className="text-xl font-serif font-semibold mb-4">{t('assetAllocation')}</h2>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
              label={({ percentage }) => `${percentage.toFixed(1)}%`}
              labelLine={false}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend content={renderLegend} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
