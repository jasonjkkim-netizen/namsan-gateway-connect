import { useLanguage } from '@/contexts/LanguageContext';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Calendar, DollarSign, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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
  image_url: string | null;
  default_currency: string | null;
}

interface ProductPreviewDialogProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductPreviewDialog({ product, open, onOpenChange }: ProductPreviewDialogProps) {
  const { language, t, formatCurrency, formatPercent, formatDate } = useLanguage();
  const navigate = useNavigate();

  if (!product) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-success text-success-foreground';
      case 'closed': return 'bg-muted text-muted-foreground';
      case 'coming_soon': return 'bg-accent text-accent-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const typeLabels: Record<string, { en: string; ko: string }> = {
    bond: { en: 'Bond', ko: '채권' },
    equity: { en: 'Equity', ko: '주식' },
    fund: { en: 'Fund', ko: '펀드' },
    real_estate: { en: 'Real Estate', ko: '부동산' },
    alternative: { en: 'Alternative', ko: '대체투자' },
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Badge className={getStatusColor(product.status)}>{t(product.status)}</Badge>
            <Badge variant="outline">
              {language === 'ko' ? typeLabels[product.type]?.ko : typeLabels[product.type]?.en || product.type}
            </Badge>
          </div>
          <DialogTitle className="font-serif text-lg">
            {language === 'ko' ? product.name_ko : product.name_en}
          </DialogTitle>
        </DialogHeader>

        {product.description_en || product.description_ko ? (
          <p className="text-sm text-muted-foreground line-clamp-4 whitespace-pre-line">
            {language === 'ko' ? product.description_ko : product.description_en}
          </p>
        ) : null}

        <div className="space-y-3 py-2">
          {product.target_return != null && (
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <TrendingUp className="h-4 w-4 text-accent" />
                {t('targetReturn')}
              </span>
              <span className="font-semibold text-accent">{formatPercent(product.target_return)}</span>
            </div>
          )}
          {product.minimum_investment != null && (
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                {t('minimumInvestment')}
              </span>
              <span className="font-semibold">{formatCurrency(product.minimum_investment, product.default_currency || undefined)}</span>
            </div>
          )}
          {product.募集_deadline && (
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                {t('deadline')}
              </span>
              <span className="font-semibold">{formatDate(product.募集_deadline)}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            className="w-full btn-gold group"
            onClick={() => {
              onOpenChange(false);
              navigate(`/products/${product.id}`);
            }}
          >
            {language === 'ko' ? '상세 페이지로 이동' : 'View Full Details'}
            <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
