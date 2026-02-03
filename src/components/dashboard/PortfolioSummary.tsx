import { useLanguage } from '@/contexts/LanguageContext';
import { TrendingUp, DollarSign, Percent } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface PortfolioSummaryProps {
  totalInvested: number;
  currentValue: number;
  totalReturn: number;
  loading: boolean;
}

export function PortfolioSummary({ totalInvested, currentValue, totalReturn, loading }: PortfolioSummaryProps) {
  const { t, formatCurrency, formatPercent } = useLanguage();

  const stats = [
    {
      label: t('totalInvested'),
      value: formatCurrency(totalInvested),
      icon: DollarSign,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      label: t('currentValue'),
      value: formatCurrency(currentValue),
      icon: TrendingUp,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      label: t('totalReturn'),
      value: formatPercent(totalReturn),
      icon: Percent,
      color: totalReturn >= 0 ? 'text-success' : 'text-destructive',
      bgColor: totalReturn >= 0 ? 'bg-success/10' : 'bg-destructive/10',
    },
  ];

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {stats.map((stat, index) => (
        <div 
          key={stat.label}
          className="card-elevated p-6 animate-fade-in"
          style={{ animationDelay: `${index * 100}ms` }}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="stat-label">{stat.label}</p>
              {loading ? (
                <Skeleton className="h-9 w-32 mt-2" />
              ) : (
                <p className="stat-value mt-2">{stat.value}</p>
              )}
            </div>
            <div className={`rounded-full p-3 ${stat.bgColor}`}>
              <stat.icon className={`h-6 w-6 ${stat.color}`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
