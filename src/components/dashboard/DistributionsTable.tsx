import { useLanguage } from '@/contexts/LanguageContext';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface Distribution {
  id: string;
  amount: number;
  type: string;
  distribution_date: string;
  description_en: string | null;
  description_ko: string | null;
}

interface DistributionsTableProps {
  distributions: Distribution[];
  loading: boolean;
}

export function DistributionsTable({ distributions, loading }: DistributionsTableProps) {
  const { t, language, formatCurrency, formatDate } = useLanguage();

  const getTypeVariant = (type: string) => {
    switch (type) {
      case 'dividend': return 'default';
      case 'interest': return 'secondary';
      case 'capital_gain': return 'outline';
      case 'return_of_capital': return 'secondary';
      default: return 'default';
    }
  };

  return (
    <div className="card-elevated overflow-hidden animate-fade-in" style={{ animationDelay: '300ms' }}>
      <div className="p-6 border-b border-border">
        <h2 className="text-xl font-serif font-semibold">{t('recentDistributions')}</h2>
      </div>
      
      <div className="overflow-x-auto">
        <table className="table-financial">
          <thead>
            <tr>
              <th>{t('date')}</th>
              <th>{t('type')}</th>
              <th>{t('amount')}</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 4 }).map((_, j) => (
                    <td key={j}><Skeleton className="h-5 w-24" /></td>
                  ))}
                </tr>
              ))
            ) : distributions.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-8 text-muted-foreground">
                  {t('noData')}
                </td>
              </tr>
            ) : (
              distributions.map((dist) => (
                <tr key={dist.id} className="hover:bg-muted/50 transition-colors">
                  <td>{formatDate(dist.distribution_date)}</td>
                  <td>
                    <Badge variant={getTypeVariant(dist.type)}>
                      {t(dist.type)}
                    </Badge>
                  </td>
                  <td className="font-medium text-success">+{formatCurrency(dist.amount)}</td>
                  <td className="text-muted-foreground">
                    {language === 'ko' ? dist.description_ko : dist.description_en || '-'}
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
