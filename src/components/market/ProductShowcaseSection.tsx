import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Package } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
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
  maturity_date: string | null;
  status: string | null;
  currency: string | null;
  fundraising_amount: number | null;
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
  const [selectedCurrency, setSelectedCurrency] = useState<string>('all');

  const { data: products, isLoading } = useQuery({
    queryKey: ['product-showcase'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('investment_products')
        .select('id, name_ko, name_en, type, status, currency, default_currency, target_return, target_return_percent, fixed_return_percent, minimum_investment, min_investment_amount, fundraising_amount, maturity_date, issue_date, image_url, description_ko, description_en')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Product[];
    },
    staleTime: 5 * 60 * 1000,
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

  const filteredProducts = (products || []).filter(p =>
    selectedCurrency === 'all' ? true : (p.currency || 'KRW') === selectedCurrency
  );

  return (
    <div className="mb-8 animate-fade-in" style={{ animationDelay: '100ms' }}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-accent" />
          <h2 className="font-serif font-medium text-sm">
            {language === 'ko' ? '신규 투자 상품' : 'New Investment Products'}
          </h2>
        </div>
        <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
          <SelectTrigger className="w-28 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{language === 'ko' ? '전체' : 'All'}</SelectItem>
            <SelectItem value="KRW">₩ KRW</SelectItem>
            <SelectItem value="USD">$ USD</SelectItem>
            <SelectItem value="EUR">€ EUR</SelectItem>
            <SelectItem value="JPY">¥ JPY</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="card-elevated overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-medium whitespace-nowrap">{language === 'ko' ? '상품명' : 'Product'}</TableHead>
                <TableHead className="text-xs font-medium whitespace-nowrap">{language === 'ko' ? '종류' : 'Type'}</TableHead>
                <TableHead className="text-xs font-medium whitespace-nowrap">{language === 'ko' ? '통화' : 'Currency'}</TableHead>
                <TableHead className="text-xs font-medium whitespace-nowrap text-center">{language === 'ko' ? '투자만기일' : 'Maturity'}</TableHead>
                <TableHead className="text-xs font-medium whitespace-nowrap text-right">
                  <span>{language === 'ko' ? '년 수익률' : 'Annual Return'}</span>
                  <span className="block text-[9px] font-normal text-muted-foreground">{language === 'ko' ? '세전 수익률' : 'Before Tax'}</span>
                </TableHead>
                <TableHead className="text-xs font-medium whitespace-nowrap text-right">{language === 'ko' ? '모집 금액' : 'Fundraising'}</TableHead>
                <TableHead className="text-xs font-medium whitespace-nowrap text-right">{language === 'ko' ? '최소 금액' : 'Min. Amount'}</TableHead>
                <TableHead className="text-xs font-medium whitespace-nowrap text-center">{language === 'ko' ? '상태' : 'Status'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-20" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-xs">
                    {language === 'ko' ? '등록된 상품이 없습니다' : 'No products available'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredProducts.map((product) => (
                  <TableRow
                    key={product.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => navigate(`/products/${product.id}`)}
                  >
                    <TableCell className="text-xs font-medium whitespace-nowrap">
                      {language === 'ko' ? product.name_ko : product.name_en}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      <Badge className={TYPE_COLORS[product.type] || 'bg-muted text-muted-foreground'} variant="secondary">
                        {(language === 'ko' ? TYPE_LABELS[product.type]?.ko : TYPE_LABELS[product.type]?.en) || product.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {CURRENCY_LABELS[product.currency || 'KRW'] || product.currency || 'KRW'}
                    </TableCell>
                    <TableCell className="text-xs text-center whitespace-nowrap">
                      {product.maturity_date ? formatDate(product.maturity_date) : '-'}
                    </TableCell>
                    <TableCell className="text-xs text-right whitespace-nowrap">
                      {product.target_return != null ? (
                        <div>
                          <span className="font-semibold text-accent">{language === 'ko' ? `년 ${product.target_return}%` : `${product.target_return}% p.a.`}</span>
                          <span className="block text-[9px] text-muted-foreground">{language === 'ko' ? '세전' : 'pre-tax'}</span>
                        </div>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-xs text-right whitespace-nowrap">
                      {product.fundraising_amount != null ? product.fundraising_amount.toLocaleString() : '-'}
                    </TableCell>
                    <TableCell className="text-xs text-right whitespace-nowrap">
                      {product.minimum_investment != null ? product.minimum_investment.toLocaleString() : '-'}
                    </TableCell>
                    <TableCell className="text-xs text-center whitespace-nowrap">
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
