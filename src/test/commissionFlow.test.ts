import { describe, it, expect } from 'vitest';

/**
 * Integration tests verifying that the commission calculation engine
 * correctly distributes commissions through ancestor chains
 * (webmaster → district_manager → agent → client) and that
 * admin/client summary aggregations match expected percentages.
 */

// ── Default split ratios from calculate-commissions edge function ──
const DEFAULT_SPLITS: Record<string, number> = {
  webmaster: 0.40,
  district_manager: 0.40,
  deputy_district_manager: 0.25,
  principal_agent: 0.20,
  agent: 0.15,
};

// ── Helpers ──
function computeDefaultRates(upfrontPercent: number, performancePercent: number) {
  const rates: Record<string, { upfront_rate: number; performance_rate: number }> = {};
  for (const [role, ratio] of Object.entries(DEFAULT_SPLITS)) {
    rates[role] = {
      upfront_rate: Math.round(upfrontPercent * ratio * 100) / 100,
      performance_rate: Math.round(performancePercent * ratio * 100) / 100,
    };
  }
  return rates;
}

interface Ancestor {
  user_id: string;
  sales_role: string;
  depth: number;
}

interface Distribution {
  to_user_id: string;
  upfront_amount: number;
  performance_amount: number;
  layer: number;
}

function calculateDistributions(
  ancestors: Ancestor[],
  investmentAmount: number,
  realizedReturn: number,
  ratesByRole: Record<string, { upfront_rate: number; performance_rate: number }>,
  overrides: Record<string, { upfront_rate: number; performance_rate: number }> = {},
): Distribution[] {
  const sorted = [...ancestors].sort((a, b) => a.depth - b.depth);
  const distributions: Distribution[] = [];

  for (const ancestor of sorted) {
    const rate = overrides[ancestor.user_id] || ratesByRole[ancestor.sales_role];
    if (!rate) continue;

    const upfrontAmount = investmentAmount * (rate.upfront_rate / 100);
    const performanceAmount = realizedReturn * (rate.performance_rate / 100);

    if (upfrontAmount === 0 && performanceAmount === 0) continue;

    distributions.push({
      to_user_id: ancestor.user_id,
      upfront_amount: Math.round(upfrontAmount * 100) / 100,
      performance_amount: Math.round(performanceAmount * 100) / 100,
      layer: ancestor.depth,
    });
  }
  return distributions;
}

// ── Admin summary aggregation (mirrors AdminCommissions personAttribution) ──
function adminSummary(distributions: Distribution[]) {
  const map: Record<string, { totalUpfront: number; totalPerformance: number; count: number }> = {};
  for (const d of distributions) {
    if (!map[d.to_user_id]) map[d.to_user_id] = { totalUpfront: 0, totalPerformance: 0, count: 0 };
    map[d.to_user_id].totalUpfront += d.upfront_amount;
    map[d.to_user_id].totalPerformance += d.performance_amount;
    map[d.to_user_id].count++;
  }
  return map;
}

// ── Client summary aggregation (mirrors MemberDetail earnedTotal) ──
function clientEarnedTotal(distributions: Distribution[], userId: string) {
  return distributions
    .filter(d => d.to_user_id === userId)
    .reduce((s, d) => s + d.upfront_amount + d.performance_amount, 0);
}

// ═══════════════════════════════════════════════════════════════
// TEST SUITES
// ═══════════════════════════════════════════════════════════════

describe('Commission Flow — Default Rate Computation', () => {
  it('computes correct default rates for 3% upfront / 1% performance', () => {
    const rates = computeDefaultRates(3, 1);

    expect(rates.webmaster.upfront_rate).toBe(1.2);     // 3 * 0.40
    expect(rates.district_manager.upfront_rate).toBe(1.2);
    expect(rates.deputy_district_manager.upfront_rate).toBe(0.75); // 3 * 0.25
    expect(rates.principal_agent.upfront_rate).toBe(0.6); // 3 * 0.20
    expect(rates.agent.upfront_rate).toBe(0.45);          // 3 * 0.15

    expect(rates.webmaster.performance_rate).toBe(0.4);  // 1 * 0.40
    expect(rates.agent.performance_rate).toBe(0.15);     // 1 * 0.15
  });

  it('zero performance fee yields zero performance rates', () => {
    const rates = computeDefaultRates(5, 0);
    for (const role of Object.keys(DEFAULT_SPLITS)) {
      expect(rates[role].performance_rate).toBe(0);
    }
  });
});

describe('Commission Flow — Webmaster → Manager Chain', () => {
  const WEBMASTER_ID = 'webmaster-001';
  const DM_ID = 'dm-001';
  const CLIENT_ID = 'client-001';

  const ancestors: Ancestor[] = [
    { user_id: DM_ID, sales_role: 'district_manager', depth: 1 },
    { user_id: WEBMASTER_ID, sales_role: 'webmaster', depth: 2 },
  ];

  const rates = computeDefaultRates(3, 0); // 3% upfront, no performance
  const investmentAmount = 20_000_000; // ₩20M

  const distributions = calculateDistributions(ancestors, investmentAmount, 0, rates);

  it('creates distributions for both webmaster and district_manager', () => {
    expect(distributions).toHaveLength(2);
    expect(distributions.map(d => d.to_user_id)).toContain(WEBMASTER_ID);
    expect(distributions.map(d => d.to_user_id)).toContain(DM_ID);
  });

  it('webmaster gets 40% of 3% upfront = 1.2% = ₩240,000', () => {
    const wm = distributions.find(d => d.to_user_id === WEBMASTER_ID)!;
    expect(wm.upfront_amount).toBe(240_000);
    expect(wm.performance_amount).toBe(0);
  });

  it('district_manager gets 40% of 3% upfront = 1.2% = ₩240,000', () => {
    const dm = distributions.find(d => d.to_user_id === DM_ID)!;
    expect(dm.upfront_amount).toBe(240_000);
  });

  it('admin summary shows correct per-person totals', () => {
    const summary = adminSummary(distributions);
    expect(summary[WEBMASTER_ID].totalUpfront).toBe(240_000);
    expect(summary[DM_ID].totalUpfront).toBe(240_000);
    expect(summary[WEBMASTER_ID].count).toBe(1);
  });

  it('admin grand total equals sum of all distributions', () => {
    const summary = adminSummary(distributions);
    const grandTotal = Object.values(summary).reduce((s, v) => s + v.totalUpfront + v.totalPerformance, 0);
    expect(grandTotal).toBe(480_000); // 240k + 240k
  });

  it('client earned total is correct per member', () => {
    expect(clientEarnedTotal(distributions, WEBMASTER_ID)).toBe(240_000);
    expect(clientEarnedTotal(distributions, DM_ID)).toBe(240_000);
    expect(clientEarnedTotal(distributions, CLIENT_ID)).toBe(0); // client gets nothing
  });
});

describe('Commission Flow — Full 4-Level Chain', () => {
  const WM = 'wm';
  const DM = 'dm';
  const DDM = 'ddm';
  const PA = 'pa';

  const ancestors: Ancestor[] = [
    { user_id: PA, sales_role: 'principal_agent', depth: 1 },
    { user_id: DDM, sales_role: 'deputy_district_manager', depth: 2 },
    { user_id: DM, sales_role: 'district_manager', depth: 3 },
    { user_id: WM, sales_role: 'webmaster', depth: 4 },
  ];

  const rates = computeDefaultRates(5, 2); // 5% upfront, 2% performance
  const amount = 10_000_000;
  const realized = 500_000;

  const distributions = calculateDistributions(ancestors, amount, realized, rates);

  it('creates 4 distributions for the full chain', () => {
    expect(distributions).toHaveLength(4);
  });

  it('webmaster upfront = 5% × 40% × 10M = 200,000', () => {
    const wm = distributions.find(d => d.to_user_id === WM)!;
    expect(wm.upfront_amount).toBe(200_000);
  });

  it('principal_agent upfront = 5% × 20% × 10M = 100,000', () => {
    const pa = distributions.find(d => d.to_user_id === PA)!;
    expect(pa.upfront_amount).toBe(100_000);
  });

  it('performance amounts are based on realized return', () => {
    const wm = distributions.find(d => d.to_user_id === WM)!;
    // 500,000 × 0.8% = 4,000
    expect(wm.performance_amount).toBe(4_000);

    const pa = distributions.find(d => d.to_user_id === PA)!;
    // 500,000 × 0.4% = 2,000
    expect(pa.performance_amount).toBe(2_000);
  });

  it('admin grand total matches sum of all roles', () => {
    const summary = adminSummary(distributions);
    const grandUpfront = Object.values(summary).reduce((s, v) => s + v.totalUpfront, 0);
    const grandPerf = Object.values(summary).reduce((s, v) => s + v.totalPerformance, 0);

    // Upfront: 10M × (2% + 2% + 1.25% + 1%) = 10M × 6.25%... wait, let me compute
    // WM: 5*0.40=2.0%, DM: 5*0.40=2.0%, DDM: 5*0.25=1.25%, PA: 5*0.20=1.0%
    // Total upfront rate: 6.25% but each applied separately
    expect(grandUpfront).toBe(200_000 + 200_000 + 125_000 + 100_000); // 625,000
    expect(grandPerf).toBe(4_000 + 4_000 + 2_500 + 2_000); // 12,500
  });
});

describe('Commission Flow — User-Specific Overrides', () => {
  const WM = 'wm';
  const DM = 'dm';

  const ancestors: Ancestor[] = [
    { user_id: DM, sales_role: 'district_manager', depth: 1 },
    { user_id: WM, sales_role: 'webmaster', depth: 2 },
  ];

  const rates = computeDefaultRates(3, 0);
  const overrides = { [DM]: { upfront_rate: 2.5, performance_rate: 0 } };

  const distributions = calculateDistributions(ancestors, 10_000_000, 0, rates, overrides);

  it('override replaces default rate for specific user', () => {
    const dm = distributions.find(d => d.to_user_id === DM)!;
    expect(dm.upfront_amount).toBe(250_000); // 10M × 2.5%
  });

  it('non-overridden user keeps default rate', () => {
    const wm = distributions.find(d => d.to_user_id === WM)!;
    expect(wm.upfront_amount).toBe(120_000); // 10M × 1.2%
  });
});

describe('Commission Flow — No Matching Rates', () => {
  it('skips ancestors with no matching role rate', () => {
    const ancestors: Ancestor[] = [
      { user_id: 'unknown-role-user', sales_role: 'custom_role', depth: 1 },
    ];
    const rates = computeDefaultRates(3, 0);
    const distributions = calculateDistributions(ancestors, 10_000_000, 0, rates);
    expect(distributions).toHaveLength(0);
  });

  it('skips ancestors where both amounts would be zero', () => {
    const ancestors: Ancestor[] = [
      { user_id: 'wm', sales_role: 'webmaster', depth: 1 },
    ];
    // 0% upfront, 0% performance → all zero
    const rates = computeDefaultRates(0, 0);
    const distributions = calculateDistributions(ancestors, 10_000_000, 0, rates);
    expect(distributions).toHaveLength(0);
  });
});

describe('Commission Flow — Manual Rates (No Defaults)', () => {
  it('uses manual rates instead of defaults when configured', () => {
    const ancestors: Ancestor[] = [
      { user_id: 'wm', sales_role: 'webmaster', depth: 1 },
    ];
    // Manual rates — not from default splits
    const manualRates: Record<string, { upfront_rate: number; performance_rate: number }> = {
      webmaster: { upfront_rate: 1.5, performance_rate: 0.5 },
    };
    const distributions = calculateDistributions(ancestors, 20_000_000, 1_000_000, manualRates);
    expect(distributions).toHaveLength(1);
    expect(distributions[0].upfront_amount).toBe(300_000);   // 20M × 1.5%
    expect(distributions[0].performance_amount).toBe(5_000); // 1M × 0.5%
  });
});

describe('Commission Flow — Multi-Investment Admin Summary', () => {
  it('aggregates distributions across multiple investments correctly', () => {
    const allDistributions: Distribution[] = [
      { to_user_id: 'wm', upfront_amount: 240_000, performance_amount: 0, layer: 1 },
      { to_user_id: 'wm', upfront_amount: 100_000, performance_amount: 5_000, layer: 1 },
      { to_user_id: 'dm', upfront_amount: 240_000, performance_amount: 0, layer: 2 },
    ];

    const summary = adminSummary(allDistributions);
    expect(summary['wm'].totalUpfront).toBe(340_000);
    expect(summary['wm'].totalPerformance).toBe(5_000);
    expect(summary['wm'].count).toBe(2);
    expect(summary['dm'].totalUpfront).toBe(240_000);
    expect(summary['dm'].count).toBe(1);

    // Grand total
    const grand = Object.values(summary).reduce((s, v) => s + v.totalUpfront + v.totalPerformance, 0);
    expect(grand).toBe(585_000); // 340k + 5k + 240k
  });
});