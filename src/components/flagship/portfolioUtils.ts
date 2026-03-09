import { differenceInDays, format, eachDayOfInterval, parseISO } from 'date-fns';
import { BASE_DATE, GroupId, PortfolioItem, GroupData, GROUP_META, DEFAULT_ASSUMPTIONS } from './portfolioTypes';
import type { PortfolioItemRow } from './portfolioTypes';

// ── Mapping ──
export function mapRowToItem(row: PortfolioItemRow): PortfolioItem {
  return {
    id: row.id,
    groupId: row.group_id as GroupId,
    name: row.name,
    ticker: row.ticker ?? undefined,
    assetType: row.asset_type as PortfolioItem['assetType'],
    currency: row.currency as 'KRW' | 'USD',
    weight: Number(row.recommended_weight),
    currentPrice: row.current_price != null ? Number(row.current_price) : undefined,
    basePrice: row.base_price != null ? Number(row.base_price) : undefined,
    targetAnnualReturn: row.target_annual_return != null ? Number(row.target_annual_return) : undefined,
    notes: row.notes ?? undefined,
  };
}

// ── Return calculations ──
export function calcStockReturn(basePrice: number, currentPrice: number): number {
  if (!basePrice || basePrice === 0) return 0;
  return (currentPrice / basePrice) - 1;
}

export function calcBondAccrual(targetAnnualReturn: number, today: Date = new Date()): number {
  const days = differenceInDays(today, parseISO(BASE_DATE));
  return targetAnnualReturn * Math.max(days, 0) / 365;
}

export function calcItemReturn(item: PortfolioItem): number {
  if (item.assetType === 'bond' && item.targetAnnualReturn != null) {
    return calcBondAccrual(item.targetAnnualReturn);
  }
  if (item.basePrice && item.currentPrice) {
    return calcStockReturn(item.basePrice, item.currentPrice);
  }
  return 0;
}

// ── Group-level aggregation ──
export function buildGroups(items: PortfolioItem[]): GroupData[] {
  const groupIds: GroupId[] = ['shares', 'bonds', 'others'];
  return groupIds.map(gId => {
    const gItems = items.filter(i => i.groupId === gId);
    const totalWeight = gItems.reduce((s, i) => s + i.weight, 0);
    const performance = totalWeight > 0
      ? gItems.reduce((s, i) => s + (i.weight / totalWeight) * calcItemReturn(i), 0)
      : 0;
    return {
      id: gId,
      ...GROUP_META[gId],
      items: gItems,
      totalWeight,
      performance,
    };
  }).filter(g => g.items.length > 0 || g.id !== 'cash');
}

// ── Blended portfolio return time series (for line chart) ──
export function buildReturnSeries(
  items: PortfolioItem[],
  groupWeights: Record<GroupId, number>,
): { date: string; value: number }[] {
  const today = new Date();
  const base = parseISO(BASE_DATE);
  if (today <= base) return [];

  const days = eachDayOfInterval({ start: base, end: today });
  // sample every 3 days for performance
  const sampled = days.filter((_, i) => i % 3 === 0 || i === days.length - 1);

  const totalGroupWeight = Object.values(groupWeights).reduce((s, w) => s + w, 0);
  if (totalGroupWeight === 0) return [];

  return sampled.map(d => {
    let blended = 0;
    const groups = buildGroups(items);
    for (const g of groups) {
      const gw = (groupWeights[g.id] || 0) / totalGroupWeight;
      if (gw === 0 || g.items.length === 0) continue;
      // Group return on this date
      const gReturn = g.items.reduce((s, item) => {
        const itemW = item.weight / g.totalWeight;
        let ret = 0;
        if (item.assetType === 'bond' && item.targetAnnualReturn != null) {
          const daysSince = differenceInDays(d, base);
          ret = item.targetAnnualReturn * Math.max(daysSince, 0) / 365;
        } else if (item.basePrice && item.currentPrice) {
          // linear interpolation for stocks
          const totalDays = differenceInDays(today, base);
          const elapsed = differenceInDays(d, base);
          const totalReturn = calcStockReturn(item.basePrice, item.currentPrice);
          ret = totalDays > 0 ? totalReturn * (elapsed / totalDays) : 0;
        }
        return s + itemW * ret;
      }, 0);
      blended += gw * gReturn;
    }
    return { date: format(d, 'MM/dd'), value: +(blended * 100).toFixed(2) };
  });
}

// ── Projection ──
// Expected return uses target_annual_return if available, otherwise defaults
// This is a forward-looking assumption, NOT backward-looking actual performance
export function calcExpectedGroupReturn(group: GroupData): number {
  const totalW = group.totalWeight;
  if (totalW === 0) return 0;

  // For all asset types: prefer targetAnnualReturn if set
  const hasTargetReturns = group.items.some(i => i.targetAnnualReturn != null);
  
  if (hasTargetReturns) {
    // Weighted average of target annual returns
    return group.items.reduce((s, i) => {
      const w = i.weight / totalW;
      const target = i.targetAnnualReturn ?? getDefaultReturn(group.id, i.assetType);
      return s + w * target;
    }, 0);
  }

  // Fallback to default assumptions by group
  return getDefaultReturn(group.id);
}

function getDefaultReturn(groupId: string, assetType?: string): number {
  if (groupId === 'bonds' || assetType === 'bond') {
    return 0.065; // 6.5% default for bonds
  }
  if (groupId === 'shares') {
    return DEFAULT_ASSUMPTIONS.expectedReturnStocksAnnual; // 10%
  }
  if (groupId === 'others') {
    return DEFAULT_ASSUMPTIONS.expectedReturnOthersAnnual; // 5%
  }
  return DEFAULT_ASSUMPTIONS.cashReturnAnnual; // 0%
}

export function calcProjection(
  amount: number,
  groupWeights: Record<GroupId, number>,
  groups: GroupData[],
  daysToHorizon: number,
): { endValue: number; profit: number; breakdown: { groupId: GroupId; allocated: number; expectedReturn: number; profit: number }[] } {
  const totalW = Object.values(groupWeights).reduce((s, w) => s + w, 0);
  if (totalW === 0) return { endValue: amount, profit: 0, breakdown: [] };

  const breakdown = groups.map(g => {
    const w = (groupWeights[g.id] || 0) / totalW;
    const allocated = amount * w;
    const expectedReturn = calcExpectedGroupReturn(g);
    const profit = allocated * expectedReturn * (daysToHorizon / 365);
    return { groupId: g.id, allocated, expectedReturn, profit };
  });

  const totalProfit = breakdown.reduce((s, b) => s + b.profit, 0);
  return { endValue: amount + totalProfit, profit: totalProfit, breakdown };
}

// ── Weight normalization ──
export function normalizeWeights(
  weights: Record<GroupId, number>,
  changedKey: GroupId,
  newValue: number,
): Record<GroupId, number> {
  const result = { ...weights };
  result[changedKey] = Math.max(0, Math.min(100, newValue));

  const othersTotal = Object.entries(result)
    .filter(([k]) => k !== changedKey)
    .reduce((s, [, v]) => s + v, 0);

  const remaining = 100 - result[changedKey];
  const otherKeys = (Object.keys(result) as GroupId[]).filter(k => k !== changedKey);

  if (othersTotal === 0) {
    // distribute equally
    otherKeys.forEach(k => { result[k] = remaining / otherKeys.length; });
  } else {
    otherKeys.forEach(k => {
      result[k] = Math.round((result[k] / othersTotal) * remaining * 10) / 10;
    });
  }

  // fix rounding
  const sum = Object.values(result).reduce((s, v) => s + v, 0);
  if (Math.abs(sum - 100) > 0.01) {
    const firstOther = otherKeys[0];
    if (firstOther) result[firstOther] += 100 - sum;
  }

  return result;
}

export function formatKRW(value: number): string {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(value);
}

export function formatPct(value: number, decimals = 2): string {
  return `${(value * 100).toFixed(decimals)}%`;
}
