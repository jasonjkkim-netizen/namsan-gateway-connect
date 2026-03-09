import { forwardRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

interface Product {
  id: string;
  name_en: string;
  name_ko: string;
  type: string;
  description_en: string | null;
  description_ko: string | null;
  target_return: number | null;
  minimum_investment: number | null;
  募集_deadline: string | null;
  maturity_date: string | null;
  status: string;
  default_currency: string | null;
  fixed_return_percent: number | null;
  target_return_percent: number | null;
  management_fee_percent: number | null;
  performance_fee_percent: number | null;
  currency: string | null;
  min_investment_amount: number | null;
  fundraising_amount: number | null;
  image_url: string | null;
}

interface Props {
  product: Product;
}

const TYPE_LABELS: Record<string, { en: string; ko: string }> = {
  bond: { en: 'Bond', ko: '채권' },
  equity: { en: 'Equity', ko: '주식' },
  fund: { en: 'Fund', ko: '펀드' },
  real_estate: { en: 'Real Estate', ko: '부동산' },
  alternative: { en: 'Alternative', ko: '대체투자' },
};

const STATUS_LABELS: Record<string, { en: string; ko: string }> = {
  open: { en: 'Open', ko: '모집중' },
  closed: { en: 'Closed', ko: '마감' },
  coming_soon: { en: 'Coming Soon', ko: '출시예정' },
};

export const ProductPrintSummary = forwardRef<HTMLDivElement, Props>(({ product }, ref) => {
  const { language, formatCurrency, formatPercent, formatDate } = useLanguage();

  const typeLabel = TYPE_LABELS[product.type] || { en: product.type, ko: product.type };
  const statusLabel = STATUS_LABELS[product.status] || { en: product.status, ko: product.status };

  const rows: { label: string; value: string }[] = [];

  rows.push({
    label: language === 'ko' ? '상품 유형' : 'Product Type',
    value: language === 'ko' ? typeLabel.ko : typeLabel.en,
  });
  rows.push({
    label: language === 'ko' ? '상태' : 'Status',
    value: language === 'ko' ? statusLabel.ko : statusLabel.en,
  });
  rows.push({
    label: language === 'ko' ? '통화' : 'Currency',
    value: (product.default_currency || product.currency || 'USD').toUpperCase(),
  });
  if (product.target_return != null) {
    rows.push({
      label: language === 'ko' ? '목표 수익률' : 'Target Return',
      value: formatPercent(product.target_return),
    });
  }
  if (product.fixed_return_percent != null) {
    rows.push({
      label: language === 'ko' ? '확정 수익률' : 'Fixed Return',
      value: language === 'ko' ? `년 ${product.fixed_return_percent}%` : `${product.fixed_return_percent}% p.a.`,
    });
  }
  if (product.target_return_percent != null) {
    rows.push({
      label: language === 'ko' ? '목표 수익률' : 'Target Return %',
      value: formatPercent(product.target_return_percent),
    });
  }
  if (product.management_fee_percent != null) {
    rows.push({
      label: language === 'ko' ? '운용 보수' : 'Management Fee',
      value: formatPercent(product.management_fee_percent),
    });
  }
  if (product.performance_fee_percent != null) {
    rows.push({
      label: language === 'ko' ? '성과 보수' : 'Performance Fee',
      value: formatPercent(product.performance_fee_percent),
    });
  }
  if (product.fundraising_amount != null) {
    rows.push({
      label: language === 'ko' ? '모집 금액' : 'Fundraising Amount',
      value: formatCurrency(product.fundraising_amount, product.default_currency || undefined),
    });
  }
  if (product.minimum_investment != null) {
    rows.push({
      label: language === 'ko' ? '최소 투자 금액' : 'Minimum Investment',
      value: formatCurrency(product.minimum_investment, product.default_currency || undefined),
    });
  }
  if (product.min_investment_amount != null) {
    rows.push({
      label: language === 'ko' ? '최소 투자금' : 'Min Investment',
      value: formatCurrency(product.min_investment_amount, product.default_currency || undefined),
    });
  }
  if (product.maturity_date) {
    rows.push({
      label: language === 'ko' ? '만기일' : 'Maturity Date',
      value: formatDate(product.maturity_date),
    });
  }
  if (product.募集_deadline) {
    rows.push({
      label: language === 'ko' ? '모집 마감일' : 'Subscription Deadline',
      value: formatDate(product.募集_deadline),
    });
  }

  const today = new Date().toLocaleDateString(language === 'ko' ? 'ko-KR' : 'en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div ref={ref} className="hidden print:block print-summary" style={{ fontFamily: 'serif' }}>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .print-summary, .print-summary * { visibility: visible !important; }
          .print-summary {
            position: fixed !important;
            left: 0; top: 0;
            width: 100%;
            padding: 40px 60px;
            background: white !important;
            color: black !important;
            font-size: 12pt;
            line-height: 1.6;
          }
        }
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: '2px solid #1a1a1a', paddingBottom: '16px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: '20pt', fontWeight: 700, margin: 0, lineHeight: 1.3 }}>
              {language === 'ko' ? product.name_ko : product.name_en}
            </h1>
            {product.name_en && language === 'ko' && (
              <p style={{ fontSize: '11pt', color: '#666', margin: '4px 0 0' }}>{product.name_en}</p>
            )}
          </div>
          <div style={{ textAlign: 'right', fontSize: '9pt', color: '#888' }}>
            <p style={{ margin: 0 }}>NAMSAN PARTNERS</p>
            <p style={{ margin: '2px 0 0' }}>{today}</p>
          </div>
        </div>
      </div>

      {/* Description */}
      {(product.description_ko || product.description_en) && (
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '12pt', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px', color: '#444' }}>
            {language === 'ko' ? '상품 개요' : 'Product Overview'}
          </h2>
          <p style={{ fontSize: '11pt', color: '#333', whiteSpace: 'pre-line', lineHeight: 1.7 }}>
            {language === 'ko' ? product.description_ko : product.description_en}
          </p>
        </div>
      )}

      {/* Key Metrics Table */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '12pt', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px', color: '#444' }}>
          {language === 'ko' ? '투자 요약' : 'Investment Summary'}
        </h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #e5e5e5' }}>
                <td style={{ padding: '8px 12px 8px 0', fontSize: '10pt', color: '#666', width: '40%' }}>
                  {row.label}
                </td>
                <td style={{ padding: '8px 0', fontSize: '10pt', fontWeight: 600, textAlign: 'right' }}>
                  {row.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Disclaimer */}
      <div style={{ marginTop: '32px', paddingTop: '16px', borderTop: '1px solid #ccc' }}>
        <p style={{ fontSize: '8pt', color: '#999', lineHeight: 1.5 }}>
          {language === 'ko'
            ? '본 자료는 투자 참고용이며, 투자 권유를 목적으로 하지 않습니다. 투자 전 반드시 상품설명서를 확인하시기 바랍니다. 과거 수익률이 미래 수익을 보장하지 않습니다.'
            : 'This document is for informational purposes only and does not constitute investment advice. Please review the product prospectus before investing. Past performance does not guarantee future results.'}
        </p>
        <p style={{ fontSize: '8pt', color: '#bbb', marginTop: '8px' }}>
          © {new Date().getFullYear()} Namsan Partners. All rights reserved.
        </p>
      </div>
    </div>
  );
});

ProductPrintSummary.displayName = 'ProductPrintSummary';
