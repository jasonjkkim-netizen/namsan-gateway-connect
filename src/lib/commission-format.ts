export type CommissionFormatLanguage = 'ko' | 'en';

const SYMBOL_MAP: Record<string, string> = {
  KRW: '₩',
  USD: '$',
  EUR: '€',
  JPY: '¥',
  HKD: 'HK$',
  GBP: '£',
  CNY: '¥',
};

export const formatCommissionAmount = (
  amount: number,
  language: CommissionFormatLanguage,
  currency?: string | null,
) => {
  const normalizedCurrency = currency?.toUpperCase() || 'KRW';
  const locale = language === 'ko' ? 'ko-KR' : 'en-US';
  const symbol = SYMBOL_MAP[normalizedCurrency] || `${normalizedCurrency} `;

  return `${symbol}${Number(amount || 0).toLocaleString(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
};