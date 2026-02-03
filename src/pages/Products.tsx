import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, Calendar, DollarSign, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

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
  status: string;
}

export default function Products() {
  const { t, language, formatCurrency, formatPercent, formatDate } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProducts() {
      const { data } = await supabase
        .from('investment_products')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (data) setProducts(data as Product[]);
      setLoading(false);
    }

    fetchProducts();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-success text-success-foreground';
      case 'closed': return 'bg-muted text-muted-foreground';
      case 'coming_soon': return 'bg-accent text-accent-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'bond': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'equity': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'fund': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'real_estate': return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
      case 'alternative': return 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl font-serif font-semibold text-foreground">{t('newProducts')}</h1>
          <p className="mt-1 text-muted-foreground">
            {language === 'ko' ? '현재 모집 중인 투자 상품을 확인하세요' : 'Explore our currently available investment products'}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card-elevated p-6">
                <Skeleton className="h-6 w-3/4 mb-4" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3 mb-6" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))
          ) : products.length === 0 ? (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              {t('noData')}
            </div>
          ) : (
            products.map((product, index) => (
              <div 
                key={product.id} 
                className="card-elevated p-6 flex flex-col animate-fade-in hover:shadow-lg transition-all duration-300"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex gap-2">
                    <Badge className={getTypeColor(product.type)}>
                      {t(product.type)}
                    </Badge>
                    <Badge className={getStatusColor(product.status)}>
                      {t(product.status)}
                    </Badge>
                  </div>
                </div>

                <h3 className="text-lg font-serif font-semibold mb-2">
                  {language === 'ko' ? product.name_ko : product.name_en}
                </h3>
                
                <p className="text-sm text-muted-foreground mb-6 flex-grow">
                  {language === 'ko' ? product.description_ko : product.description_en}
                </p>

                <div className="space-y-3 mb-6">
                  {product.target_return && (
                    <div className="flex items-center gap-3 text-sm">
                      <TrendingUp className="h-4 w-4 text-accent" />
                      <span className="text-muted-foreground">{t('targetReturn')}:</span>
                      <span className="font-medium text-accent">{formatPercent(product.target_return)}</span>
                    </div>
                  )}
                  
                  {product.minimum_investment && (
                    <div className="flex items-center gap-3 text-sm">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{t('minimumInvestment')}:</span>
                      <span className="font-medium">{formatCurrency(product.minimum_investment)}</span>
                    </div>
                  )}

                  {product.募集_deadline && (
                    <div className="flex items-center gap-3 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{t('deadline')}:</span>
                      <span className="font-medium">{formatDate(product.募集_deadline)}</span>
                    </div>
                  )}
                </div>

                <Button className="w-full btn-gold group">
                  {t('learnMore')}
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
