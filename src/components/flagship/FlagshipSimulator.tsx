import { useState, useMemo, useRef, useEffect } from 'react';
import { differenceInDays } from 'date-fns';
import { useLanguage } from '@/contexts/LanguageContext';
import { GroupId, GroupData, PortfolioItem, PRESETS, GROUP_META } from './portfolioTypes';
import { normalizeWeights, calcProjection, formatKRW, formatPct, calcExpectedGroupReturn } from './portfolioUtils';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Zap, Shield, TrendingUp, RotateCcw } from 'lucide-react';

const PRESET_ICONS = { low: Shield, mid: Zap, high: TrendingUp };
const GROUP_COLORS: Record<string, string> = {
  shares: 'hsl(var(--accent))',
  bonds: 'hsl(var(--primary))',
  others: 'hsl(var(--success, 142 71% 45%))',
  cash: 'hsl(var(--muted-foreground))',
};

// Fee reference: at 9% expected annual return → 2% fee (linear)
const FEE_REF_RETURN = 0.09;
const FEE_MAX_RATE = 0.02;

function calcAutoFeeRate(expectedReturn: number): number {
  return Math.min(FEE_MAX_RATE, Math.max(0, (expectedReturn / FEE_REF_RETURN) * FEE_MAX_RATE));
}

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
  const [feeOverride, setFeeOverride] = useState<number | null>(null);

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

  const autoFeeRate = useMemo(() => calcAutoFeeRate(blendedExpectedReturn), [blendedExpectedReturn]);
  const feeRate = feeOverride !== null ? feeOverride : autoFeeRate;

  // Sync auto-fee when expected return changes (if not manually overridden)
  useEffect(() => {
    if (feeOverride === null) return; // already on auto
    // do nothing if manually overridden
  }, [blendedExpectedReturn]);

  // Fee & net calculations
  const feeAmount = investmentAmount * feeRate * (daysToHorizon / 365);
  const netProfit = projection.profit - feeAmount;
  const netEndValue = investmentAmount + netProfit;

  const handleWeightChange = (gId: GroupId, newVal: number) => {
    setFeeOverride(null); // reset to auto when allocation changes
    setGroupWeights(normalizeWeights(groupWeights, gId, newVal));
  };

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setFeeOverride(null);
    setGroupWeights({ ...preset.groupWeights });
    setTimeout(() => simulatorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const activeGroups: GroupId[] = ['shares', 'bonds', 'others'];

  const beforeTaxLabel = ko ? '(수수료·세금 차감전)' : '(Before Fees & Tax)';

  return (
    <div className="space-y-8">
      {/* Investment Simulator */}
      <div ref={simulatorRef} className="bg-background rounded-lg border border-border p-6">
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

        {/* Fee Rate Slider */}
        <div className="mb-6 p-4 bg-muted/20 rounded-lg border border-border/60">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">
                {ko ? '연간 수수료율' : 'Annual Fee Rate'}
              </label>
              <Badge variant="outline" className="text-[10px] py-0 h-4">
                {ko ? '수익률 연동' : 'Return-linked'}
              </Badge>
              {feeOverride !== null && (
                <button
                  onClick={() => setFeeOverride(null)}
                  className="flex items-center gap-0.5 text-[10px] text-accent underline"
                >
                  <RotateCcw className="h-2.5 w-2.5" />
                  {ko ? '자동으로' : 'Auto'}
                </button>
              )}
            </div>
            <div className="text-right">
              <span className="text-base font-mono font-bold text-accent">{formatPct(feeRate)}</span>
              {feeOverride === null && (
                <span className="text-[10px] text-muted-foreground ml-1">
                  {ko ? '(자동)' : '(auto)'}
                </span>
              )}
            </div>
          </div>
          <Slider
            value={[feeRate * 100]}
            onValueChange={([v]) => setFeeOverride(v / 100)}
            min={0}
            max={2}
            step={0.05}
            className="w-full"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>0%</span>
            <span className="italic text-center">
              {ko ? '기대수익률 기반 자동 계산 · 최대 2%' : 'Auto-calculated from expected return · Max 2%'}
            </span>
            <span>2%</span>
          </div>
        </div>

        {/* Projection output */}
        <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
          {/* Expected return row */}
          <div className="text-center pb-3 border-b border-border/50">
            <p className="text-[11px] text-muted-foreground mb-0.5">
              {ko ? '예상 연 수익률' : 'Expected Annual Return'}
              <span className="ml-1.5 opacity-70 italic">{beforeTaxLabel}</span>
            </p>
            <p className="text-2xl font-mono font-bold text-accent">
              {ko ? `년 ${(blendedExpectedReturn * 100).toFixed(2)}%` : `${(blendedExpectedReturn * 100).toFixed(2)}% p.a.`}
            </p>
          </div>

          {/* Gross / Fee / Net */}
          <div className="grid grid-cols-3 gap-3 pt-1">
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground mb-0.5">
                {ko ? `총 수익 (${daysToHorizon}일)` : `Gross Profit (${daysToHorizon}d)`}
                <span className="block opacity-70 italic">{beforeTaxLabel}</span>
              </p>
              <p className="text-base font-mono font-semibold text-accent">{formatKRW(projection.profit)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground mb-0.5">
                {ko ? '수수료 (연환산)' : 'Management Fee'}
                <span className="block opacity-70">{formatPct(feeRate)} p.a.</span>
              </p>
              <p className="text-base font-mono font-semibold text-destructive">-{formatKRW(feeAmount)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground mb-0.5">
                {ko ? '순 수익' : 'Net Profit'}
                <span className="block opacity-70">{ko ? '(수수료 차감후)' : '(after fee)'}</span>
              </p>
              <p className="text-base font-mono font-semibold text-foreground">{formatKRW(netProfit)}</p>
            </div>
          </div>

          {/* Net end value */}
          <div className="text-center pt-3 border-t border-border/50">
            <p className="text-[10px] text-muted-foreground mb-0.5">
              {ko ? '예상 총 가치 (수수료 차감후)' : 'Projected End Value (after fees)'}
            </p>
            <p className="text-xl font-mono font-bold text-foreground">{formatKRW(netEndValue)}</p>
          </div>
        </div>

        {/* Breakdown */}
        {projection.breakdown.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <p className="text-[10px] text-muted-foreground italic mb-1.5">
              ※ {ko ? '아래 수익률은 수수료·세금 차감전 기준입니다.' : 'Returns below are before fees and taxes.'}
            </p>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 font-medium">{ko ? '그룹' : 'Group'}</th>
                  <th className="text-right py-2 font-medium">{ko ? '배분액' : 'Allocated'}</th>
                  <th className="text-right py-2 font-medium">{ko ? '기대수익률*' : 'Exp. Return*'}</th>
                  <th className="text-right py-2 font-medium">{ko ? '예상수익*' : 'Exp. Profit*'}</th>
                </tr>
              </thead>
              <tbody>
                {projection.breakdown.filter(b => b.allocated > 0).map(b => (
                  <tr key={b.groupId} className="border-b border-border/50">
                    <td className="py-2 font-medium">
                      {ko ? GROUP_META[b.groupId].nameKo : GROUP_META[b.groupId].nameEn}
                    </td>
                    <td className="py-2 text-right font-mono">{formatKRW(b.allocated)}</td>
                    <td className="py-2 text-right font-mono">
                      {ko ? `년 ${(b.expectedReturn * 100).toFixed(2)}%` : `${(b.expectedReturn * 100).toFixed(2)}% p.a.`}
                    </td>
                    <td className="py-2 text-right font-mono text-accent">{formatKRW(b.profit)}</td>
                  </tr>
                ))}
                {/* Fee row */}
                <tr className="border-b border-border/50 text-destructive">
                  <td className="py-2 font-medium">
                    {ko ? '수수료 (연간)' : 'Management Fee (annual)'}
                  </td>
                  <td className="py-2 text-right font-mono">—</td>
                  <td className="py-2 text-right font-mono">
                    {ko ? `-년 ${(feeRate * 100).toFixed(2)}%` : `-${(feeRate * 100).toFixed(2)}% p.a.`}
                  </td>
                  <td className="py-2 text-right font-mono">-{formatKRW(feeAmount)}</td>
                </tr>
                {/* Net row */}
                <tr className="font-semibold">
                  <td className="py-2">{ko ? '순 합계' : 'Net Total'}</td>
                  <td className="py-2 text-right font-mono">{formatKRW(investmentAmount)}</td>
                  <td className="py-2 text-right font-mono">
                    {ko ? `년 ${((blendedExpectedReturn - feeRate) * 100).toFixed(2)}%` : `${((blendedExpectedReturn - feeRate) * 100).toFixed(2)}% p.a.`}
                  </td>
                  <td className="py-2 text-right font-mono text-foreground">{formatKRW(netProfit)}</td>
                </tr>
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
            const presetFeeRate = calcAutoFeeRate(presetReturn);
            const presetFeeAmount = investmentAmount * presetFeeRate * (daysToHorizon / 365);
            const presetNetEndValue = presetProjection.endValue - presetFeeAmount;

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
                    <span className="text-muted-foreground">
                      {ko ? '기대수익률' : 'Exp. Return'}
                      <span className="block text-[10px] opacity-70 italic">{beforeTaxLabel}</span>
                    </span>
                    <span className="font-mono font-medium text-accent text-right">
                      {ko ? `년 ${(presetReturn * 100).toFixed(2)}%` : `${(presetReturn * 100).toFixed(2)}% p.a.`}
                    </span>
                  </div>

                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{ko ? '수수료율' : 'Fee Rate'}</span>
                    <span className="font-mono text-destructive">-{formatPct(presetFeeRate)}</span>
                  </div>

                  <div className="flex justify-between text-xs border-t border-border/50 pt-2">
                    <span className="text-muted-foreground">{ko ? '예상 총 가치 (수수료후)' : 'End Value (after fees)'}</span>
                    <span className="font-mono font-medium">{formatKRW(presetNetEndValue)}</span>
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
