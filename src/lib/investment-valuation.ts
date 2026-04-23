export interface InvestmentValuationInput {
  investmentAmount: number;
  currentValue: number;
  startDate: string;
  investmentMaturityDate?: string | null;
  productMaturityDate?: string | null;
  annualRatePercent?: number | null;
  status?: string | null;
  asOfDate?: Date;
}

export interface InvestmentValuationResult {
  accruedInterest: number;
  displayCurrentValue: number;
  displayReturnPercent: number;
}

export interface InvestmentValuationAudit {
  principal: number;
  cleanValue: number;
  annualRatePercent: number;
  status: string | null | undefined;
  startDate: string | null;
  investmentMaturityDate: string | null;
  productMaturityDate: string | null;
  effectiveMaturityDate: string | null;
  asOfDate: string;
  accrualEndDate: string;
  elapsedDays: number;
  isAccrualApplied: boolean;
}

export interface InvestmentValuationDetails extends InvestmentValuationResult {
  audit: InvestmentValuationAudit;
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

function formatYmd(date: Date | null): string | null {
  if (!date) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function computeInvestmentValuationDetails({
  investmentAmount,
  currentValue,
  startDate,
  investmentMaturityDate,
  productMaturityDate,
  annualRatePercent,
  status,
  asOfDate = new Date(),
}: InvestmentValuationInput): InvestmentValuationDetails {
  const principal = Number(investmentAmount) || 0;
  const cleanValue = Number(currentValue) || 0;
  const annualRate = Number(annualRatePercent) || 0;
  const normalizedAsOfDate = startOfDay(asOfDate);

  const baseResult: InvestmentValuationResult = {
    accruedInterest: 0,
    displayCurrentValue: cleanValue,
    displayReturnPercent: principal > 0 ? ((cleanValue - principal) / principal) * 100 : 0,
  };

  const start = parseYmd(startDate);
  const effectiveMaturity = parseYmd(investmentMaturityDate) ?? parseYmd(productMaturityDate);
  const accrualEnd = effectiveMaturity && effectiveMaturity < normalizedAsOfDate
    ? effectiveMaturity
    : normalizedAsOfDate;

  if (!start || principal <= 0 || annualRate <= 0 || status === 'closed' || status === 'cancelled') {
    return {
      ...baseResult,
      audit: {
        principal,
        cleanValue,
        annualRatePercent: annualRate,
        status,
        startDate: formatYmd(start),
        investmentMaturityDate: investmentMaturityDate ?? null,
        productMaturityDate: productMaturityDate ?? null,
        effectiveMaturityDate: formatYmd(effectiveMaturity),
        asOfDate: formatYmd(normalizedAsOfDate) || '',
        accrualEndDate: formatYmd(accrualEnd) || '',
        elapsedDays: 0,
        isAccrualApplied: false,
      },
    };
  }

  const elapsedDays = Math.max(diffDays(start, accrualEnd), 0);
  const accruedInterest = principal * (annualRate / 100) * (elapsedDays / 365);
  const displayCurrentValue = cleanValue + accruedInterest;

  return {
    accruedInterest,
    displayCurrentValue,
    displayReturnPercent: ((displayCurrentValue - principal) / principal) * 100,
    audit: {
      principal,
      cleanValue,
      annualRatePercent: annualRate,
      status,
      startDate: formatYmd(start),
      investmentMaturityDate: investmentMaturityDate ?? null,
      productMaturityDate: productMaturityDate ?? null,
      effectiveMaturityDate: formatYmd(effectiveMaturity),
      asOfDate: formatYmd(normalizedAsOfDate) || '',
      accrualEndDate: formatYmd(accrualEnd) || '',
      elapsedDays,
      isAccrualApplied: true,
    },
  };
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
  const { audit: _audit, ...result } = computeInvestmentValuationDetails({
    investmentAmount,
    currentValue,
    startDate,
    investmentMaturityDate,
    productMaturityDate,
    annualRatePercent,
    status,
    asOfDate,
  });

  return result;
}