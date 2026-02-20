import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Package } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Product {
  id: string;
  name_en: string;
  name_ko: string;
  type: string;
  target_return: number | null;
  minimum_investment: number | null;
  募集_deadline: string | null;
  status: string | null;
  currency: string | null;
}

const TYPE_LABELS: Record<string, { ko: string; en: string }> = {
  bond: { ko: '채권', en: 'Bond' },
  equity: { ko: '주식', en: 'Equity' },
  fund: { ko: '펀드', en: 'Fund' },
  real_estate: { ko: '부동산', en: 'Real Estate' },
  alternative: { ko: '대체투자', en: 'Alternative' },
};

const TYPE_COLORS: Record<string, string> = {
  bond: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  equity: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  fund: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  real_estate: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  alternative: 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200',
};

const CURRENCY_LABELS: Record<string, string> = {
  KRW: '₩ KRW',
  USD: '$ USD',
  EUR: '€ EUR',
  JPY: '¥ JPY',
};

interface ProductShowcaseSectionProps {
  language: string;
}

export function ProductShowcaseSection({ language }: ProductShowcaseSectionProps) {
  const navigate = useNavigate();
  const { formatCurrency, formatPercent, formatDate } = useLanguage();

  const { data: products, isLoading } = useQuery({
    queryKey: ['product-showcase'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('investment_products')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Product[];
    },
  });

  const getStatusLabel = (status: string | null) => {
    const labels: Record<string, { ko: string; en: string }> = {
      open: { ko: '모집중', en: 'Open' },
      closed: { ko: '마감', en: 'Closed' },
      coming_soon: { ko: '출시예정', en: 'Coming Soon' },
    };
    return language === 'ko' ? labels[status || '']?.ko || status : labels[status || '']?.en || status;
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'open': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'coming_soon': return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const calculateTerm = (deadline: string | null) => {
    if (!deadline) return '-';
    const now = new Date();
    const end = new Date(deadline);
    const diffMs = end.getTime() - now.getTime();
    if (diffMs <= 0) return language === 'ko' ? '마감' : 'Closed';
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays <= 30) return `${diffDays}${language === 'ko' ? '일' : 'd'}`;
    const diffMonths = Math.round(diffDays / 30);
    return `${diffMonths}${language === 'ko' ? '개월' : 'mo'}`;
  };

  return (
    <div className="mb-8 animate-fade-in" style={{ animationDelay: '100ms' }}>
      <div className="flex items-center gap-2 mb-3">
        <Package className="h-5 w-5 text-accent" />
        <h2 className="font-serif font-medium text-sm">
          {language === 'ko' ? '신규 투자 상품' : 'New Investment Products'}
        </h2>
      </div>

      <div className="card-elevated overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-sm font-medium">{language === 'ko' ? '상품명' : 'Product'}</TableHead>
                <TableHead className="text-sm font-medium">{language === 'ko' ? '종류' : 'Type'}</TableHead>
                <TableHead className="text-sm font-medium">{language === 'ko' ? '통화' : 'Currency'}</TableHead>
                <TableHead className="text-sm font-medium text-center">{language === 'ko' ? '기간' : 'Period'}</TableHead>
                <TableHead className="text-sm font-medium text-right">{language === 'ko' ? '목표 수익률 (년)' : 'Target Return (yr)'}</TableHead>
                <TableHead className="text-sm font-medium text-right">{language === 'ko' ? '최소 금액 (원)' : 'Min. Amount'}</TableHead>
                <TableHead className="text-sm font-medium text-center">{language === 'ko' ? '상태' : 'Status'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-20" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : !products || products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-sm">
                    {language === 'ko' ? '등록된 상품이 없습니다' : 'No products available'}
                  </TableCell>
                </TableRow>
              ) : (
                products.map((product) => (
                  <TableRow
                    key={product.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => navigate(`/products/${product.id}`)}
                  >
                    <TableCell className="text-sm font-medium">
                      {language === 'ko' ? product.name_ko : product.name_en}
                    </TableCell>
                    <TableCell className="text-sm">
                      <Badge className={TYPE_COLORS[product.type] || 'bg-muted text-muted-foreground'} variant="secondary">
                        {language === 'ko'
                          ? TYPE_LABELS[product.type]?.ko || product.type
                          : TYPE_LABELS[product.type]?.en || product.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {CURRENCY_LABELS[product.currency || 'KRW'] || product.currency || 'KRW'}
                    </TableCell>
                    <TableCell className="text-sm text-center">
                      {calculateTerm(product.募集_deadline)}
                    </TableCell>
                    <TableCell className="text-sm text-right font-semibold text-accent">
                      {product.target_return ? formatPercent(product.target_return) : '-'}
                    </TableCell>
                    <TableCell className="text-sm text-right">
                      {product.minimum_investment ? formatCurrency(product.minimum_investment) : '-'}
                    </TableCell>
                    <TableCell className="text-sm text-center">
                      <Badge className={getStatusColor(product.status)} variant="secondary">
                        {getStatusLabel(product.status)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
