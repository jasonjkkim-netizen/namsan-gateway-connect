import { useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { usePortfolioData } from './usePortfolioData';
import { buildGroups } from './portfolioUtils';
import { GroupId, GROUP_META } from './portfolioTypes';

const GROUP_COLORS: Record<string, string> = {
  shares: 'hsl(var(--accent))',
  bonds: 'hsl(var(--primary))',
  others: 'hsl(var(--success, 142 71% 45%))',
  cash: 'hsl(var(--muted-foreground))',
};

interface MiniPieChartProps {
  /** Override group weights (e.g. from a preset scenario). If omitted, uses actual portfolio weights. */
  presetWeights?: Record<GroupId, number>;
}

export function MiniPieChart({ presetWeights }: MiniPieChartProps = {}) {
  const { language } = useLanguage();
  const ko = language === 'ko';
  const { items, loading } = usePortfolioData();

  const { groups, groupWeights } = useMemo(() => {
    const g = buildGroups(items);
    if (presetWeights) {
      return { groups: g, groupWeights: presetWeights };
    }
    const w: Record<GroupId, number> = { shares: 0, bonds: 0, others: 0, cash: 0 };
    items.forEach(i => { w[i.groupId] = (w[i.groupId] || 0) + i.weight; });
    const total = Object.values(w).reduce((s, v) => s + v, 0);
    if (total > 0) {
      (Object.keys(w) as GroupId[]).forEach(k => { w[k] = Math.round(w[k] / total * 100 * 10) / 10; });
    }
    return { groups: g, groupWeights: w };
  }, [items, presetWeights]);

  if (loading || items.length === 0) return null;

  // When using presetWeights, show all groups with weight > 0 using GROUP_META for names
  const pieData = presetWeights
    ? (Object.keys(presetWeights) as GroupId[])
        .filter(gId => (presetWeights[gId] || 0) > 0)
        .map(gId => ({
          name: ko ? GROUP_META[gId].nameKo : GROUP_META[gId].nameEn,
          value: presetWeights[gId],
          color: GROUP_COLORS[gId] || '#888',
        }))
    : groups
        .filter(g => (groupWeights[g.id] || 0) > 0)
        .map(g => ({
          name: ko ? g.nameKo : g.nameEn,
          value: groupWeights[g.id] || 0,
          color: GROUP_COLORS[g.id] || '#888',
        }));

  return (
    <div className="w-full h-52 flex flex-col items-center justify-center">
      <div className="flex-1 w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={30}
              outerRadius={72}
              paddingAngle={2}
              dataKey="value"
              label={({ value }) => `${value.toFixed(0)}%`}
              labelLine={false}
            >
              {pieData.map((entry, i) => (
                <Cell key={i} fill={entry.color} strokeWidth={0} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload?.length) {
                  const d = payload[0].payload;
                  return (
                    <div className="bg-card border border-border rounded p-1.5 text-[10px] shadow">
                      <p className="font-medium">{d.name}</p>
                      <p className="text-accent">{d.value.toFixed(1)}%</p>
                    </div>
                  );
                }
                return null;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap justify-center gap-2 shrink-0 pb-1">
        {pieData.map((d, i) => (
          <div key={i} className="flex items-center gap-1 text-[9px]">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="text-muted-foreground">{d.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
