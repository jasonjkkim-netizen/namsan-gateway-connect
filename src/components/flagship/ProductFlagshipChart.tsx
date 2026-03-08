import { useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePortfolioData } from './usePortfolioData';
import { buildGroups } from './portfolioUtils';
import { GroupId } from './portfolioTypes';
import { FlagshipCharts } from './FlagshipCharts';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Renders the Flagship pie chart (asset allocation only) for use on product detail pages.
 */
export function ProductFlagshipChart() {
  const { items, loading } = usePortfolioData();

  const groups = useMemo(() => buildGroups(items), [items]);

  const groupWeights = useMemo(() => {
    const w: Record<GroupId, number> = { shares: 0, bonds: 0, others: 0, cash: 0 };
    items.forEach(i => { w[i.groupId] = (w[i.groupId] || 0) + i.weight; });
    const total = Object.values(w).reduce((s, v) => s + v, 0);
    if (total > 0) {
      (Object.keys(w) as GroupId[]).forEach(k => { w[k] = Math.round(w[k] / total * 100 * 10) / 10; });
    }
    return w;
  }, [items]);

  if (loading) return <Skeleton className="h-64 w-full rounded-xl" />;
  if (items.length === 0) return null;

  return <FlagshipCharts items={items} groups={groups} groupWeights={groupWeights} />;
}
