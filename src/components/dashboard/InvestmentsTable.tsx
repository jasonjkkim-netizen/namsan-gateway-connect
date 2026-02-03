import { useLanguage } from '@/contexts/LanguageContext';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface Investment {
  id: string;
  product_name_en: string;
  product_name_ko: string;
  investment_amount: number;
  current_value: number;
  start_date: string;
  maturity_date: string | null;
  expected_return: number | null;
  status: string;
}

interface InvestmentsTableProps {
  investments: Investment[];
  loading: boolean;
}

export function InvestmentsTable({ investments, loading }: InvestmentsTableProps) {
  const { t, language, formatCurrency, formatDate, formatPercent } = useLanguage();

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'matured': return 'secondary';
      case 'pending': return 'outline';
      case 'closed': return 'secondary';
      default: return 'default';
    }
  };

  return (
    <div className="card-elevated overflow-hidden animate-fade-in" style={{ animationDelay: '200ms' }}>
      <div className="p-6 border-b border-border">
        <h2 className="text-xl font-serif font-semibold">{t('myInvestments')}</h2>
      </div>
      
      <div className="overflow-x-auto">
        <table className="table-financial">
          <thead>
            <tr>
              <th>{t('productName')}</th>
              <th>{t('amount')}</th>
              <th>{t('currentValue')}</th>
              <th>{t('startDate')}</th>
              <th>{t('maturityDate')}</th>
              <th>{t('expectedReturn')}</th>
              <th>{t('status')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j}><Skeleton className="h-5 w-24" /></td>
                  ))}
                </tr>
              ))
            ) : investments.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-muted-foreground">
                  {t('noData')}
                </td>
              </tr>
            ) : (
              investments.map((investment) => (
                <tr key={investment.id} className="hover:bg-muted/50 transition-colors">
                  <td className="font-medium">
                    {language === 'ko' ? investment.product_name_ko : investment.product_name_en}
                  </td>
                  <td>{formatCurrency(investment.investment_amount)}</td>
                  <td className="font-medium">{formatCurrency(investment.current_value)}</td>
                  <td>{formatDate(investment.start_date)}</td>
                  <td>{investment.maturity_date ? formatDate(investment.maturity_date) : '-'}</td>
                  <td className="text-accent font-medium">
                    {investment.expected_return ? formatPercent(investment.expected_return) : '-'}
                  </td>
                  <td>
                    <Badge variant={getStatusVariant(investment.status)}>
                      {t(investment.status)}
                    </Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
