interface InvestmentValuationInput {
  investmentAmount: number;
  currentValue: number;
  startDate: string;
  investmentMaturityDate?: string | null;
  productMaturityDate?: string | null;
  annualRatePercent?: number | null;
  status?: string | null;
  asOfDate?: Date;
}

interface InvestmentValuationResult {
  accruedInterest: number;
  displayCurrentValue: number;
  displayReturnPercent: number;
}

function parseYmd(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function diffDays(start: Date, end: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((startOfDay(end).getTime() - startOfDay(start).getTime()) / msPerDay);
}

export function computeInvestmentValuation({
  investmentAmount,
  currentValue,
  startDate,
  investmentMaturityDate,
  productMaturityDate,
  annualRatePercent,
  status,
  asOfDate = new Date(),
}: InvestmentValuationInput): InvestmentValuationResult {
  const principal = Number(investmentAmount) || 0;
  const cleanValue = Number(currentValue) || 0;
  const annualRate = Number(annualRatePercent) || 0;

  const baseResult = {
    accruedInterest: 0,
    displayCurrentValue: cleanValue,
    displayReturnPercent: principal > 0 ? ((cleanValue - principal) / principal) * 100 : 0,
  };

  const start = parseYmd(startDate);
  if (!start || principal <= 0 || annualRate <= 0 || status === 'closed' || status === 'cancelled') {
    return baseResult;
  }

  const maturity = parseYmd(investmentMaturityDate) ?? parseYmd(productMaturityDate);
  const accrualEnd = maturity && maturity < asOfDate ? maturity : asOfDate;
  const elapsedDays = Math.max(diffDays(start, accrualEnd), 0);
  const accruedInterest = principal * (annualRate / 100) * (elapsedDays / 365);
  const displayCurrentValue = cleanValue + accruedInterest;

  return {
    accruedInterest,
    displayCurrentValue,
    displayReturnPercent: ((displayCurrentValue - principal) / principal) * 100,
  };
}