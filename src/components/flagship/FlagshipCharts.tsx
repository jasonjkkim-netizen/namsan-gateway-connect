import { useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { GroupId, GroupData, PortfolioItem, GROUP_META } from './portfolioTypes';
import { buildReturnSeries } from './portfolioUtils';

const GROUP_COLORS: Record<string, string> = {
  shares: 'hsl(var(--accent))',
  bonds: 'hsl(var(--primary))',
  others: 'hsl(var(--success, 142 71% 45%))',
  cash: 'hsl(var(--muted-foreground))',
};

interface Props {
  items: PortfolioItem[];
  groups: GroupData[];
  groupWeights: Record<GroupId, number>;
  sideBySide?: boolean;
}

export function FlagshipCharts({ items, groups, groupWeights, sideBySide = false }: Props) {
  const { language } = useLanguage();
  const ko = language === 'ko';

  const pieData = groups
    .filter(g => (groupWeights[g.id] || 0) > 0)
    .map(g => ({
      name: ko ? g.nameKo : g.nameEn,
      value: groupWeights[g.id] || 0,
      color: GROUP_COLORS[g.id] || '#888',
    }));

  const lineSeries = useMemo(
    () => buildReturnSeries(items, groupWeights),
    [items, groupWeights],
  );

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload?.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-card border border-border rounded-lg shadow-lg p-2 text-xs">
          <p className="font-medium">{d.name || d.date}</p>
          <p className="text-accent">{typeof d.value === 'number' ? `${d.value.toFixed(2)}%` : ''}</p>
        </div>
      );
    }
    return null;
  };

  const containerClass = sideBySide
    ? 'grid grid-cols-1 md:grid-cols-2 gap-4'
    : 'flex flex-col gap-4';

  return (
    <div className={containerClass}>
      {/* Pie Chart */}
      <div className="bg-background rounded-lg border border-border p-4">
        <h3 className="text-sm font-semibold mb-3">{ko ? '자산 배분' : 'Asset Allocation'}</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={75}
                paddingAngle={2}
                dataKey="value"
                label={({ name, value }) => `${value.toFixed(0)}%`}
                labelLine={false}
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} strokeWidth={0} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap justify-center gap-3 mt-2">
          {pieData.map((d, i) => (
            <div key={i} className="flex items-center gap-1.5 text-[11px]">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
              <span className="text-muted-foreground">{d.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Line Chart */}
      <div className="bg-background rounded-lg border border-border p-4">
        <h3 className="text-sm font-semibold mb-3">
          {ko ? '포트폴리오 수익률 추이' : 'Portfolio Performance'}
        </h3>
        <div className="h-48">
          {lineSeries.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineSeries}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  interval="preserveStartEnd"
                  className="fill-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  tickFormatter={v => `${v}%`}
                  className="fill-muted-foreground"
                  width={45}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload?.length) {
                      return (
                        <div className="bg-card border border-border rounded p-2 text-xs">
                          <p>{payload[0].payload.date}</p>
                          <p className="text-accent font-mono">{Number(payload[0].value).toFixed(2)}%</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--accent))"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              {ko ? '데이터 없음' : 'No data'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
