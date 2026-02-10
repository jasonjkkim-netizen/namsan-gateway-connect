import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  ArrowLeft, 
  TrendingUp, 
  Calendar, 
  DollarSign, 
  Briefcase, 
  Building2, 
  Landmark, 
  LineChart, 
  Layers,
  Clock,
  Target,
  Shield,
  FileText,
  Download
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ConsultationButton } from '@/components/ConsultationButton';

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
  created_at: string;
}

interface ProductDocument {
  id: string;
  name_ko: string;
  name_en: string;
  document_type: string;
  file_url: string;
  file_size: number | null;
}

const TYPE_CONFIG: Record<string, { icon: typeof Landmark; labelEn: string; labelKo: string; color: string }> = {
  bond: { icon: Landmark, labelEn: 'Bond', labelKo: '채권', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  equity: { icon: LineChart, labelEn: 'Equity', labelKo: '주식', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  fund: { icon: Briefcase, labelEn: 'Fund', labelKo: '펀드', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
  real_estate: { icon: Building2, labelEn: 'Real Estate', labelKo: '부동산', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' },
  alternative: { icon: Layers, labelEn: 'Alternative', labelKo: '대체투자', color: 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200' },
};

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { language, formatCurrency, formatPercent, formatDate } = useLanguage();
  const [product, setProduct] = useState<Product | null>(null);
  const [documents, setDocuments] = useState<ProductDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProduct() {
      if (!id) return;
      
      const { data, error } = await supabase
        .from('investment_products')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error || !data) {
        navigate('/products');
        return;
      }
      
      setProduct(data as Product);
      
      // Fetch documents
      const { data: docs } = await supabase
        .from('product_documents')
        .select('*')
        .eq('product_id', id)
        .order('display_order', { ascending: true });
      if (docs) setDocuments(docs as ProductDocument[]);
      
      setLoading(false);
    }

    fetchProduct();
  }, [id, navigate]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-success text-success-foreground';
      case 'closed': return 'bg-muted text-muted-foreground';
      case 'coming_soon': return 'bg-accent text-accent-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, { en: string; ko: string }> = {
      open: { en: 'Open', ko: '모집중' },
      closed: { en: 'Closed', ko: '마감' },
      coming_soon: { en: 'Coming Soon', ko: '출시예정' },
    };
    return language === 'ko' ? labels[status]?.ko || status : labels[status]?.en || status;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-8">
          <Skeleton className="h-8 w-32 mb-8" />
          <Skeleton className="h-12 w-2/3 mb-4" />
          <Skeleton className="h-6 w-1/3 mb-8" />
          <div className="grid gap-6 md:grid-cols-3">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        </main>
      </div>
    );
  }

  if (!product) return null;

  const typeConfig = TYPE_CONFIG[product.type] || TYPE_CONFIG.alternative;
  const TypeIcon = typeConfig.icon;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
        {/* Back Button */}
        <Button 
          variant="ghost" 
          onClick={() => navigate('/products')}
          className="mb-6 -ml-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {language === 'ko' ? '상품 목록으로' : 'Back to Products'}
        </Button>

        {/* Header Section */}
        <div className="mb-8 animate-fade-in">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <Badge className={typeConfig.color}>
              <TypeIcon className="mr-1 h-3 w-3" />
              {language === 'ko' ? typeConfig.labelKo : typeConfig.labelEn}
            </Badge>
            <Badge className={getStatusColor(product.status)}>
              {getStatusLabel(product.status)}
            </Badge>
          </div>
          
          <h1 className="text-3xl md:text-4xl font-serif font-semibold text-foreground mb-3">
            {language === 'ko' ? product.name_ko : product.name_en}
          </h1>
          
          <p className="text-lg text-muted-foreground max-w-3xl">
            {language === 'ko' ? product.description_ko : product.description_en}
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-6 md:grid-cols-3 mb-8">
          {product.target_return && (
            <Card className="card-elevated animate-fade-in" style={{ animationDelay: '100ms' }}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-accent" />
                  {language === 'ko' ? '목표 수익률' : 'Target Return'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-accent">
                  {formatPercent(product.target_return)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {language === 'ko' ? '연간 예상 수익률' : 'Expected annual return'}
                </p>
              </CardContent>
            </Card>
          )}

          {product.minimum_investment && (
            <Card className="card-elevated animate-fade-in" style={{ animationDelay: '200ms' }}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  {language === 'ko' ? '최소 투자금' : 'Minimum Investment'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  {formatCurrency(product.minimum_investment)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {language === 'ko' ? '최소 투자 가능 금액' : 'Minimum amount to invest'}
                </p>
              </CardContent>
            </Card>
          )}

          {product.募集_deadline && (
            <Card className="card-elevated animate-fade-in" style={{ animationDelay: '300ms' }}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {language === 'ko' ? '모집 마감일' : 'Deadline'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  {formatDate(product.募集_deadline)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {language === 'ko' ? '투자 신청 마감일' : 'Application deadline'}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Investment Details */}
        <div className="grid gap-6 md:grid-cols-2 mb-8">
          <Card className="card-elevated animate-fade-in" style={{ animationDelay: '400ms' }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-accent" />
                {language === 'ko' ? '투자 개요' : 'Investment Overview'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">
                  {language === 'ko' ? '상품 유형' : 'Product Type'}
                </span>
                <span className="font-medium">
                  {language === 'ko' ? typeConfig.labelKo : typeConfig.labelEn}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">
                  {language === 'ko' ? '상태' : 'Status'}
                </span>
                <span className="font-medium">{getStatusLabel(product.status)}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">
                  {language === 'ko' ? '등록일' : 'Listed Date'}
                </span>
                <span className="font-medium">{formatDate(product.created_at)}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="card-elevated animate-fade-in" style={{ animationDelay: '500ms' }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-accent" />
                {language === 'ko' ? '투자 안내' : 'Investment Notes'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <Clock className="h-4 w-4 mt-0.5 text-accent shrink-0" />
                  {language === 'ko' 
                    ? '투자 신청 후 영업일 기준 2-3일 내 담당자가 연락드립니다.'
                    : 'A representative will contact you within 2-3 business days after application.'}
                </li>
                <li className="flex items-start gap-2">
                  <Shield className="h-4 w-4 mt-0.5 text-accent shrink-0" />
                  {language === 'ko'
                    ? '투자 전 상품설명서를 반드시 확인하시기 바랍니다.'
                    : 'Please review the product prospectus before investing.'}
                </li>
                <li className="flex items-start gap-2">
                  <TrendingUp className="h-4 w-4 mt-0.5 text-accent shrink-0" />
                  {language === 'ko'
                    ? '과거 수익률이 미래 수익을 보장하지 않습니다.'
                    : 'Past performance does not guarantee future results.'}
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Product Documents */}
        {documents.length > 0 && (
          <Card className="card-elevated animate-fade-in mb-8" style={{ animationDelay: '550ms' }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-accent" />
                {language === 'ko' ? '상품 관련 문서' : 'Product Documents'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {documents.map(doc => {
                  const typeLabels: Record<string, { ko: string; en: string }> = {
                    proposal: { ko: '제안서', en: 'Proposal' },
                    contract: { ko: '계약서', en: 'Contract' },
                    prospectus: { ko: '투자설명서', en: 'Prospectus' },
                    report: { ko: '보고서', en: 'Report' },
                    other: { ko: '기타', en: 'Other' },
                  };
                  const typeLabel = language === 'ko'
                    ? typeLabels[doc.document_type]?.ko || doc.document_type
                    : typeLabels[doc.document_type]?.en || doc.document_type;

                  return (
                    <a
                      key={doc.id}
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="h-5 w-5 text-destructive shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                            {language === 'ko' ? doc.name_ko : doc.name_en}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {typeLabel}
                            {doc.file_size ? ` · ${doc.file_size < 1024 * 1024 ? `${(doc.file_size / 1024).toFixed(0)}KB` : `${(doc.file_size / (1024 * 1024)).toFixed(1)}MB`}` : ''}
                          </p>
                        </div>
                      </div>
                      <Download className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0" />
                    </a>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* CTA */}
        {product.status === 'open' && (
          <div className="text-center py-8 animate-fade-in" style={{ animationDelay: '600ms' }}>
            <ConsultationButton 
              variant="gold" 
              size="lg" 
              className="px-12 py-6 h-auto text-lg"
              productName={language === 'ko' ? product.name_ko : product.name_en}
            />
            <p className="text-sm text-muted-foreground mt-3">
              {language === 'ko' 
                ? '전문 상담원이 투자에 대해 안내해 드립니다'
                : 'Our specialists will guide you through the investment process'}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
