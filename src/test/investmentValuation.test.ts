import { describe, expect, it } from 'vitest';
import { computeInvestmentValuation } from '@/lib/investment-valuation';

describe('computeInvestmentValuation', () => {
  it('adds accrued interest to current value and return for active fixed-income investments', () => {
    const result = computeInvestmentValuation({
      investmentAmount: 100000,
      currentValue: 98500,
      startDate: '2026-01-01',
      annualRatePercent: 12,
      asOfDate: new Date(2026, 3, 1),
    });

    expect(result.accruedInterest).toBeCloseTo(2958.9, 1);
    expect(result.displayCurrentValue).toBeCloseTo(101458.9, 1);
    expect(result.displayReturnPercent).toBeCloseTo(1.4589, 2);
  });

  it('caps accrued interest at maturity date', () => {
    const result = computeInvestmentValuation({
      investmentAmount: 100000,
      currentValue: 100000,
      startDate: '2026-01-01',
      investmentMaturityDate: '2026-02-01',
      annualRatePercent: 12,
      asOfDate: new Date(2026, 3, 1),
    });

    expect(result.accruedInterest).toBeCloseTo(1019.18, 1);
    expect(result.displayCurrentValue).toBeCloseTo(101019.18, 1);
  });
});