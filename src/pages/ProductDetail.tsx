import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { 
  ArrowLeft, TrendingUp, Calendar, DollarSign, Briefcase, Building2, 
  Landmark, LineChart, Layers, Clock, Target, Shield, FileText, Download, Eye
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
  maturity_date: string | null;
  issue_date: string | null;
  status: string;
  created_at: string;
  image_url: string | null;
  default_currency: string | null;
  fixed_return_percent: number | null;
  target_return_percent: number | null;
  management_fee_percent: number | null;
  performance_fee_percent: number | null;
  currency: string | null;
  min_investment_amount: number | null;
  fundraising_amount: number | null;
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

const DOC_SECTIONS = [
  { type: 'termsheet', ko: '텀시트', en: 'Termsheet' },
  { type: 'proposal', ko: '제안서', en: 'Proposal' },
  { type: 'contract', ko: '계약서', en: 'Contract' },
  { type: 'prospectus', ko: '투자설명서', en: 'Prospectus' },
  { type: 'report', ko: '보고서', en: 'Report' },
  { type: 'other', ko: '기타', en: 'Other' },
];

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { language, formatCurrency, formatPercent, formatDate } = useLanguage();
  const [product, setProduct] = useState<Product | null>(null);
  const [documents, setDocuments] = useState<ProductDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState('');

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
      
      const { data: docs } = await supabase
        .from('product_documents')
        .select('*')
        .eq('product_id', id)
        .order('document_type', { ascending: true })
        .order('display_order', { ascending: true });
      if (docs) setDocuments(docs as ProductDocument[]);
      
      setLoading(false);
    }

    fetchProduct();
  }, [id, navigate]);

  async function getSignedUrl(doc: ProductDocument): Promise<string | null> {
    if (doc.file_url.startsWith('http')) return doc.file_url;
    const { data } = await supabase.storage
      .from('product-documents')
      .createSignedUrl(doc.file_url, 600);
    return data?.signedUrl || null;
  }

  async function handlePreview(doc: ProductDocument) {
    const url = await getSignedUrl(doc);
    if (url) {
      setPreviewUrl(url);
      setPreviewName(language === 'ko' ? doc.name_ko : doc.name_en);
    }
  }

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

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

  const groupedDocs = DOC_SECTIONS
    .map(section => ({
      ...section,
      docs: documents.filter(d => d.document_type === section.type),
    }))
    .filter(section => section.docs.length > 0);


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
            {documents.length > 0 && (
              <Badge variant="outline">
                <FileText className="mr-1 h-3 w-3" />
                {documents.length} {language === 'ko' ? '문서' : 'docs'}
              </Badge>
            )}
          </div>
          
          <h1 className="text-lg md:text-xl font-serif font-semibold text-foreground mb-2">
            {language === 'ko' ? product.name_ko : product.name_en}
          </h1>
          <p className="text-sm text-muted-foreground">
            {language === 'ko' ? product.description_ko : product.description_en}
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4 mb-8">
          {product.target_return && (
            <Card className="card-elevated animate-fade-in" style={{ animationDelay: '100ms' }}>
              <CardHeader className="pb-1 pt-3 px-3">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 whitespace-nowrap">
                  <TrendingUp className="h-3.5 w-3.5 text-accent" />
                  {language === 'ko' ? '목표 수익률' : 'Target Return'}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <p className="text-xl font-bold text-accent whitespace-nowrap">{formatPercent(product.target_return)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {language === 'ko' ? '연간 예상' : 'Annual expected'}
                </p>
              </CardContent>
            </Card>
          )}

          {product.fundraising_amount && (
            <Card className="card-elevated animate-fade-in" style={{ animationDelay: '150ms' }}>
              <CardHeader className="pb-1 pt-3 px-3">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 whitespace-nowrap">
                  <DollarSign className="h-3.5 w-3.5 text-accent" />
                  {language === 'ko' ? '모집 금액' : 'Fundraising'}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <p className="text-xl font-bold whitespace-nowrap">{formatCurrency(product.fundraising_amount, product.default_currency || undefined)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {language === 'ko' ? '총 모집 목표' : 'Total target'}
                </p>
              </CardContent>
            </Card>
          )}

          {product.minimum_investment && (
            <Card className="card-elevated animate-fade-in" style={{ animationDelay: '200ms' }}>
              <CardHeader className="pb-1 pt-3 px-3">
                <CardTitle className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                  {language === 'ko' ? '최소 투자금' : 'Min. Investment'}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <p className="text-xl font-bold whitespace-nowrap">{formatCurrency(product.minimum_investment, product.default_currency || undefined)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {language === 'ko' ? '최소 가능 금액' : 'Minimum amount'}
                </p>
              </CardContent>
            </Card>
          )}

          {product.募集_deadline && (
            <Card className="card-elevated animate-fade-in" style={{ animationDelay: '300ms' }}>
              <CardHeader className="pb-1 pt-3 px-3">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 whitespace-nowrap">
                  <Calendar className="h-3.5 w-3.5" />
                  {language === 'ko' ? '모집 마감일' : 'Deadline'}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <p className="text-xl font-bold whitespace-nowrap">{formatDate(product.募集_deadline)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {language === 'ko' ? '신청 마감' : 'Application deadline'}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Documents List */}
        {documents.length > 0 && (
          <div className="mb-8 animate-fade-in" style={{ animationDelay: '350ms' }}>
            <Card className="card-elevated">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <FileText className="h-4 w-4 text-accent" />
                  {language === 'ko' ? '상품 문서' : 'Documents'}
                  <span className="text-[11px] font-normal text-muted-foreground">({documents.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {groupedDocs.map(section => (
                  <div key={section.type}>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      {language === 'ko' ? section.ko : section.en}
                    </h4>
                    <div className="space-y-1.5">
                      {section.docs.map(doc => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between p-2.5 rounded-lg border border-border hover:bg-muted/50 transition-colors group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <FileText className="h-4 w-4 text-destructive shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate group-hover:text-primary transition-colors">
                                {language === 'ko' ? doc.name_ko : doc.name_en}
                              </p>
                              {doc.file_size && (
                                <p className="text-xs text-muted-foreground">{formatFileSize(doc.file_size)}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <Button variant="ghost" size="sm" onClick={() => handlePreview(doc)} title={language === 'ko' ? '미리보기' : 'Preview'}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm"
                              onClick={async () => {
                                const url = await getSignedUrl(doc);
                                if (url) window.open(url, '_blank');
                              }}
                              title={language === 'ko' ? '다운로드' : 'Download'}
                            >
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Investment Details */}
        <div className="grid gap-6 md:grid-cols-2 mb-8">
          <Card className="card-elevated animate-fade-in" style={{ animationDelay: '400ms' }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-accent" />
                {language === 'ko' ? '투자 개요' : 'Investment Overview'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              <div className="flex justify-between py-2.5 border-b border-border">
                <span className="text-muted-foreground">{language === 'ko' ? '상품 유형' : 'Product Type'}</span>
                <span className="font-medium">{language === 'ko' ? typeConfig.labelKo : typeConfig.labelEn}</span>
              </div>
              <div className="flex justify-between py-2.5 border-b border-border">
                <span className="text-muted-foreground">{language === 'ko' ? '상태' : 'Status'}</span>
                <span className="font-medium">{getStatusLabel(product.status)}</span>
              </div>
              <div className="flex justify-between py-2.5 border-b border-border">
                <span className="text-muted-foreground">{language === 'ko' ? '통화' : 'Currency'}</span>
                <span className="font-medium">{product.default_currency?.toUpperCase() || product.currency?.toUpperCase() || 'USD'}</span>
              </div>
              {product.fixed_return_percent != null && (
                <div className="flex justify-between py-2.5 border-b border-border">
                  <span className="text-muted-foreground">{language === 'ko' ? '확정 수익률' : 'Fixed Return'}</span>
                  <span className="font-medium text-accent">{formatPercent(product.fixed_return_percent)}</span>
                </div>
              )}
              {product.target_return_percent != null && (
                <div className="flex justify-between py-2.5 border-b border-border">
                  <span className="text-muted-foreground">{language === 'ko' ? '목표 수익률' : 'Target Return'}</span>
                  <span className="font-medium text-accent">{formatPercent(product.target_return_percent)}</span>
                </div>
              )}
              {product.management_fee_percent != null && (
                <div className="flex justify-between py-2.5 border-b border-border">
                  <span className="text-muted-foreground">{language === 'ko' ? '운용 보수' : 'Management Fee'}</span>
                  <span className="font-medium">{formatPercent(product.management_fee_percent)}</span>
                </div>
              )}
              {product.performance_fee_percent != null && (
                <div className="flex justify-between py-2.5 border-b border-border">
                  <span className="text-muted-foreground">{language === 'ko' ? '성과 보수' : 'Performance Fee'}</span>
                  <span className="font-medium">{formatPercent(product.performance_fee_percent)}</span>
                </div>
              )}
              {product.fundraising_amount != null && (
                <div className="flex justify-between py-2.5 border-b border-border">
                  <span className="text-muted-foreground">{language === 'ko' ? '모집 금액' : 'Fundraising Amount'}</span>
                  <span className="font-medium">{formatCurrency(product.fundraising_amount, product.default_currency || product.currency || undefined)}</span>
                </div>
              )}
              {product.min_investment_amount != null && (
                <div className="flex justify-between py-2.5 border-b border-border">
                  <span className="text-muted-foreground">{language === 'ko' ? '최소 투자금' : 'Min Investment'}</span>
                  <span className="font-medium">{formatCurrency(product.min_investment_amount, product.default_currency || product.currency || undefined)}</span>
                </div>
              )}
              {product.minimum_investment != null && (
                <div className="flex justify-between py-2.5 border-b border-border">
                  <span className="text-muted-foreground">{language === 'ko' ? '최소 투자 금액' : 'Minimum Investment'}</span>
                  <span className="font-medium">{formatCurrency(product.minimum_investment, product.default_currency || product.currency || undefined)}</span>
                </div>
              )}
              {product.maturity_date && (
                <div className="flex justify-between py-2.5 border-b border-border">
                  <span className="text-muted-foreground">{language === 'ko' ? '만기일' : 'Maturity Date'}</span>
                  <span className="font-medium">{formatDate(product.maturity_date)}</span>
                </div>
              )}
              <div className="flex justify-between py-2.5">
                <span className="text-muted-foreground">{language === 'ko' ? '발행일' : 'Issue Date'}</span>
                <span className="font-medium">{formatDate(product.issue_date || product.created_at)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Product Image */}
          <div className="animate-fade-in" style={{ animationDelay: '450ms' }}>
            {product.image_url ? (
              <div className="overflow-hidden rounded-xl border border-border h-full">
                <img
                  src={product.image_url}
                  alt={language === 'ko' ? product.name_ko : product.name_en}
                  className="w-full h-full object-contain bg-muted/20"
                />
              </div>
            ) : (
              <div className="h-full rounded-xl border border-border bg-muted/30 flex flex-col items-center justify-center text-muted-foreground/50 min-h-[200px]">
                <TypeIcon className="h-16 w-16 mb-3" />
                <span className="text-sm">{language === 'ko' ? typeConfig.labelKo : typeConfig.labelEn}</span>
              </div>
            )}
          </div>
        </div>

        {/* Investment Notes */}
        <div className="mb-8">
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

      {/* PDF Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={(open) => { if (!open) setPreviewUrl(null); }}>
        <DialogContent className="max-w-5xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-destructive" />
              {previewName}
            </DialogTitle>
          </DialogHeader>
          <div className="w-full h-[75vh]">
            {previewUrl && (
              <iframe
                src={previewUrl}
                className="w-full h-full rounded border border-border"
                title="PDF Preview"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

