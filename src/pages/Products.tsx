import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { TrendingUp, Calendar, DollarSign, ArrowRight, Lock, Briefcase, Building2, Landmark, LineChart, Layers } from 'lucide-react';
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

interface ProductAccess {
  product_id: string;
}

const PRODUCT_TYPES = [
  { key: 'bond', icon: Landmark, labelEn: 'Bonds', labelKo: '채권' },
  { key: 'equity', icon: LineChart, labelEn: 'Equity', labelKo: '주식' },
  { key: 'fund', icon: Briefcase, labelEn: 'Funds', labelKo: '펀드' },
  { key: 'real_estate', icon: Building2, labelEn: 'Real Estate', labelKo: '부동산' },
  { key: 'alternative', icon: Layers, labelEn: 'Alternative', labelKo: '대체투자' },
];

export default function Products() {
  const { t, language, formatCurrency, formatPercent, formatDate } = useLanguage();
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [accessibleProductIds, setAccessibleProductIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasAccessControl, setHasAccessControl] = useState(false);

  useEffect(() => {
    async function fetchProducts() {
      const { data: productsData } = await supabase
        .from('investment_products')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      const { data: accessData } = await supabase
        .from('client_product_access')
        .select('product_id');
      
      if (productsData) setProducts(productsData as Product[]);
      
      if (accessData && accessData.length > 0) {
        setAccessibleProductIds(accessData.map((a: ProductAccess) => a.product_id));
        setHasAccessControl(true);
      } else {
        setHasAccessControl(false);
      }
      
      setLoading(false);
    }

    fetchProducts();
  }, [user]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-success text-success-foreground';
      case 'closed': return 'bg-muted text-muted-foreground';
      case 'coming_soon': return 'bg-accent text-accent-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getProductsByType = (type: string) => {
    return products.filter(p => p.type === type);
  };

  const typesWithProducts = PRODUCT_TYPES.filter(
    type => getProductsByType(type.key).length > 0
  );

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

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card-elevated p-6">
                <Skeleton className="h-6 w-1/4 mb-4" />
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <Skeleton className="h-48" />
                  <Skeleton className="h-48" />
                </div>
              </div>
            ))}
          </div>
        ) : typesWithProducts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {t('noData')}
          </div>
        ) : (
          <Accordion 
            type="multiple" 
            defaultValue={typesWithProducts.map(t => t.key)}
            className="space-y-4"
          >
            {typesWithProducts.map((typeInfo) => {
              const TypeIcon = typeInfo.icon;
              const typeProducts = getProductsByType(typeInfo.key);
              
              return (
                <AccordionItem 
                  key={typeInfo.key} 
                  value={typeInfo.key}
                  className="card-elevated border-none"
                >
                  <AccordionTrigger className="px-6 py-4 hover:no-underline">
                    <div className="flex items-center gap-3">
                      <TypeIcon className="h-5 w-5 text-accent" />
                      <span className="text-lg font-serif font-semibold">
                        {language === 'ko' ? typeInfo.labelKo : typeInfo.labelEn}
                      </span>
                      <Badge variant="secondary" className="ml-2">
                        {typeProducts.length}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-6">
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                      {typeProducts.map((product, index) => {
                        const hasAccess = !hasAccessControl || accessibleProductIds.includes(product.id);
                        
                        return (
                          <div 
                            key={product.id} 
                            className={`bg-muted/30 rounded-lg p-5 flex flex-col animate-fade-in transition-all duration-300 ${
                              hasAccess ? 'hover:bg-muted/50' : 'opacity-60'
                            }`}
                            style={{ animationDelay: `${index * 50}ms` }}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <Badge className={getStatusColor(product.status)}>
                                {t(product.status)}
                              </Badge>
                              {!hasAccess && (
                                <Lock className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>

                            <h3 className="text-base font-serif font-semibold mb-2">
                              {language === 'ko' ? product.name_ko : product.name_en}
                            </h3>
                            
                            <p className="text-sm text-muted-foreground mb-4 flex-grow line-clamp-2">
                              {language === 'ko' ? product.description_ko : product.description_en}
                            </p>

                            <div className="space-y-2 mb-4 text-sm">
                              {product.target_return && (
                                <div className="flex items-center gap-2">
                                  <TrendingUp className="h-3.5 w-3.5 text-accent" />
                                  <span className="text-muted-foreground">{t('targetReturn')}:</span>
                                  <span className="font-medium text-accent">{formatPercent(product.target_return)}</span>
                                </div>
                              )}
                              
                              {product.minimum_investment && (
                                <div className="flex items-center gap-2">
                                  <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="text-muted-foreground">{t('minimumInvestment')}:</span>
                                  <span className="font-medium">{formatCurrency(product.minimum_investment)}</span>
                                </div>
                              )}

                              {product.募集_deadline && (
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="text-muted-foreground">{t('deadline')}:</span>
                                  <span className="font-medium">{formatDate(product.募集_deadline)}</span>
                                </div>
                              )}
                            </div>

                            {hasAccess ? (
                              <Button size="sm" className="w-full btn-gold group">
                                {t('learnMore')}
                                <ArrowRight className="ml-2 h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                              </Button>
                            ) : (
                              <Button size="sm" className="w-full" variant="outline" disabled>
                                <Lock className="mr-2 h-3.5 w-3.5" />
                                {language === 'ko' ? '접근 제한' : 'Restricted'}
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </main>
    </div>
  );
}