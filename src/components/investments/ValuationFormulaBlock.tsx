import { useLanguage } from '@/contexts/LanguageContext';
import type { InvestmentValuationAudit } from '@/lib/investment-valuation';
import { cn } from '@/lib/utils';

interface ValuationFormulaBlockProps {
  accruedInterest?: number | null;
  audit?: InvestmentValuationAudit;
  computedMarkToMarket?: number | null;
  currency?: string | null;
  compact?: boolean;
  className?: string;
}

export function ValuationFormulaBlock({
  accruedInterest = 0,
  audit,
  computedMarkToMarket = 0,
  currency,
  compact = false,
  className,
}: ValuationFormulaBlockProps) {
  const { language, formatCurrency } = useLanguage();

  if (!audit) return null;

  const principal = Number(audit.principal) || 0;
  const cleanValue = Number(audit.cleanValue) || 0;
  const annualRatePercent = Number(audit.annualRatePercent) || 0;
  const elapsedDays = Number(audit.elapsedDays) || 0;
  const accruedValue = Number(accruedInterest) || 0;
  const mtmValue = Number(computedMarkToMarket) || 0;

  return (
    <div className={cn('rounded border border-border bg-muted/30 p-2 text-[10px] leading-relaxed text-muted-foreground', className)}>
      <div className="space-y-1">
        <div className="font-medium text-foreground">
          {language === 'ko' ? 'Accrued Interest' : 'Accrued Interest'}
        </div>
        <div className="font-mono">원금 × 연수익률 × 경과일수 / 365</div>
        <div className="font-mono break-all">
          = {formatCurrency(principal, currency || undefined)} × {annualRatePercent.toFixed(2)}% × {elapsedDays} / 365
        </div>
        <div className="font-mono text-foreground">
          = {formatCurrency(accruedValue, currency || undefined)}
        </div>
        {!compact && (
          <div>
            {language === 'ko' ? '기간' : 'Period'}: {audit.startDate || '—'} → {audit.accrualEndDate || audit.asOfDate || '—'}
          </div>
        )}
      </div>

      <div className="mt-2 space-y-1 border-t border-border pt-2">
        <div className="font-medium text-foreground">
          {language === 'ko' ? 'Computed MTM' : 'Computed MTM'}
        </div>
        <div className="font-mono">
          {language === 'ko' ? '기준 current value + accrued interest' : 'Base current value + accrued interest'}
        </div>
        <div className="font-mono break-all">
          = {formatCurrency(cleanValue, currency || undefined)} + {formatCurrency(accruedValue, currency || undefined)}
        </div>
        <div className="font-mono text-foreground">
          = {formatCurrency(mtmValue, currency || undefined)}
        </div>
      </div>
    </div>
  );
}