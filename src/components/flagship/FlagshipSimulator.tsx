import { useState, useMemo, useRef } from 'react';
import { differenceInDays } from 'date-fns';
import { useLanguage } from '@/contexts/LanguageContext';
import { GroupId, GroupData, PortfolioItem, PRESETS, GROUP_META } from './portfolioTypes';
import { normalizeWeights, calcProjection, formatKRW, formatPct, calcExpectedGroupReturn } from './portfolioUtils';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Zap, Shield, TrendingUp } from 'lucide-react';

const PRESET_ICONS = { low: Shield, mid: Zap, high: TrendingUp };
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
  setGroupWeights: (w: Record<GroupId, number>) => void;
}

export function FlagshipSimulator({ items, groups, groupWeights, setGroupWeights }: Props) {
  const { language } = useLanguage();
  const ko = language === 'ko';
  const simulatorRef = useRef<HTMLDivElement>(null);

  const [investmentAmount, setInvestmentAmount] = useState(10_000_000);
  const [horizon, setHorizon] = useState<'eoy' | '12m'>('eoy');

  const daysToHorizon = useMemo(() => {
    const today = new Date();
    if (horizon === 'eoy') {
      const eoy = new Date(today.getFullYear(), 11, 31);
      return Math.max(differenceInDays(eoy, today), 1);
    }
    return 365;
  }, [horizon]);

  const projection = useMemo(
    () => calcProjection(investmentAmount, groupWeights, groups, daysToHorizon),
    [investmentAmount, groupWeights, groups, daysToHorizon],
  );

  const blendedExpectedReturn = useMemo(() => {
    const totalW = Object.values(groupWeights).reduce((s, v) => s + v, 0);
    if (totalW === 0) return 0;
    return groups.reduce((s, g) => s + ((groupWeights[g.id] || 0) / totalW) * calcExpectedGroupReturn(g), 0);
  }, [groupWeights, groups]);

  const handleWeightChange = (gId: GroupId, newVal: number) => {
    setGroupWeights(normalizeWeights(groupWeights, gId, newVal));
  };

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setGroupWeights({ ...preset.groupWeights });
    setTimeout(() => simulatorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const activeGroups: GroupId[] = ['shares', 'bonds', 'others'];

  return (
    <div className="space-y-8">
      {/* Investment Simulator */}
      <div className="bg-background rounded-lg border border-border p-6">
        <h3 className="text-lg font-serif font-semibold mb-6">
          {ko ? '투자 시뮬레이터' : 'Investment Simulator'}
        </h3>

        {/* Amount slider */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">
              {ko ? '투자금액' : 'Investment Amount'}
            </label>
            <span className="text-lg font-mono font-semibold text-accent">
              {formatKRW(investmentAmount)}
            </span>
          </div>
          <Slider
            value={[investmentAmount]}
            onValueChange={([v]) => setInvestmentAmount(v)}
            min={1_000_000}
            max={100_000_000}
            step={500_000}
            className="w-full"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>₩1,000,000</span>
            <span>₩100,000,000</span>
          </div>
        </div>

        {/* Horizon toggle */}
        <div className="flex gap-2 mb-6">
          <Button
            size="sm"
            variant={horizon === 'eoy' ? 'default' : 'outline'}
            onClick={() => setHorizon('eoy')}
            className="text-xs"
          >
            {ko ? '연말까지' : 'End of Year'}
          </Button>
          <Button
            size="sm"
            variant={horizon === '12m' ? 'default' : 'outline'}
            onClick={() => setHorizon('12m')}
            className="text-xs"
          >
            {ko ? '12개월' : '12 Months'}
          </Button>
        </div>

        {/* Weight sliders */}
        <div className="space-y-4 mb-6">
          <h4 className="text-sm font-medium">{ko ? '배분 조정' : 'Allocation Controls'}</h4>
          <p className="text-[11px] text-muted-foreground">
            {ko
              ? '하나의 비중을 변경하면 나머지가 자동으로 비례 조정되어 합계 100%를 유지합니다.'
              : 'Adjusting one weight auto-adjusts others proportionally to maintain 100% total.'}
          </p>
          {activeGroups.map(gId => {
            const meta = GROUP_META[gId];
            return (
              <div key={gId} className="flex items-center gap-4">
                <div className="w-28 text-xs font-medium flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: GROUP_COLORS[gId] }} />
                  {ko ? meta.nameKo : meta.nameEn}
                </div>
                <Slider
                  value={[groupWeights[gId] || 0]}
                  onValueChange={([v]) => handleWeightChange(gId, v)}
                  min={0}
                  max={100}
                  step={1}
                  className="flex-1"
                />
                <span className="w-14 text-right text-sm font-mono">
                  {(groupWeights[gId] || 0).toFixed(0)}%
                </span>
              </div>
            );
          })}
        </div>

        {/* Projection output */}
        <div className="grid sm:grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg">
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">{ko ? '예상 연 수익률' : 'Expected Annual Return'}</p>
            <p className="text-xl font-mono font-bold text-accent">{formatPct(blendedExpectedReturn)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">
              {ko ? `예상 수익 (${daysToHorizon}일)` : `Projected Profit (${daysToHorizon}d)`}
            </p>
            <p className="text-xl font-mono font-bold text-accent">{formatKRW(projection.profit)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">{ko ? '예상 총 가치' : 'Projected End Value'}</p>
            <p className="text-xl font-mono font-bold text-foreground">{formatKRW(projection.endValue)}</p>
          </div>
        </div>

        {/* Breakdown */}
        {projection.breakdown.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 font-medium">{ko ? '그룹' : 'Group'}</th>
                  <th className="text-right py-2 font-medium">{ko ? '배분액' : 'Allocated'}</th>
                  <th className="text-right py-2 font-medium">{ko ? '기대수익률' : 'Exp. Return'}</th>
                  <th className="text-right py-2 font-medium">{ko ? '예상수익' : 'Exp. Profit'}</th>
                </tr>
              </thead>
              <tbody>
                {projection.breakdown.filter(b => b.allocated > 0).map(b => (
                  <tr key={b.groupId} className="border-b border-border/50">
                    <td className="py-2 font-medium">
                      {ko ? GROUP_META[b.groupId].nameKo : GROUP_META[b.groupId].nameEn}
                    </td>
                    <td className="py-2 text-right font-mono">{formatKRW(b.allocated)}</td>
                    <td className="py-2 text-right font-mono">{formatPct(b.expectedReturn)}</td>
                    <td className="py-2 text-right font-mono text-accent">{formatKRW(b.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Preset Cards */}
      <div>
        <h3 className="text-lg font-serif font-semibold mb-4">
          {ko ? '추천 포트폴리오' : 'Recommended Portfolios'}
        </h3>
        <div className="grid sm:grid-cols-3 gap-4">
          {PRESETS.map(preset => {
            const Icon = PRESET_ICONS[preset.id];
            const presetProjection = calcProjection(investmentAmount, preset.groupWeights, groups, daysToHorizon);
            const presetReturn = groups.reduce((s, g) => {
              const totalW = Object.values(preset.groupWeights).reduce((a, b) => a + b, 0);
              return s + ((preset.groupWeights[g.id] || 0) / (totalW || 1)) * calcExpectedGroupReturn(g);
            }, 0);

            const miniPie = Object.entries(preset.groupWeights)
              .filter(([, v]) => v > 0)
              .map(([k, v]) => ({ name: k, value: v, color: GROUP_COLORS[k] || '#888' }));

            return (
              <Card key={preset.id} className="hover:border-accent/50 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-accent" />
                    <CardTitle className="text-base">
                      {ko ? preset.nameKo : preset.nameEn}
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs">
                    {ko ? preset.descKo : preset.descEn}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Mini pie */}
                  <div className="h-20">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={miniPie} cx="50%" cy="50%" innerRadius={20} outerRadius={35} dataKey="value" paddingAngle={2}>
                          {miniPie.map((d, i) => (
                            <Cell key={i} fill={d.color} strokeWidth={0} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{ko ? '기대수익률' : 'Exp. Return'}</span>
                    <span className="font-mono font-medium text-accent">{formatPct(presetReturn)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{ko ? '예상 총 가치' : 'End Value'}</span>
                    <span className="font-mono font-medium">{formatKRW(presetProjection.endValue)}</span>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs"
                    onClick={() => applyPreset(preset)}
                  >
                    {ko ? '적용하기' : 'Apply'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
