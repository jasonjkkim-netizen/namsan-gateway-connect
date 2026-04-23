import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
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
  Landmark, LineChart, Layers, Clock, Target, Shield, FileText, Download, Eye, Printer, Users, Coins
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ConsultationButton } from '@/components/ConsultationButton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Link } from 'react-router-dom';
import { ProductFlagshipChart } from '@/components/flagship/ProductFlagshipChart';
import { ProductPrintSummary } from '@/components/products/ProductPrintSummary';
import { ProductInlineInvestmentForm } from '@/components/products/ProductInlineInvestmentForm';

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
  const [searchParams] = useSearchParams();
  const { language, formatCurrency, formatPercent, formatDate } = useLanguage();
  const [product, setProduct] = useState<Product | null>(null);
  const [documents, setDocuments] = useState<ProductDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState('');
  const [imageZoom, setImageZoom] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isFlagshipProduct, setIsFlagshipProduct] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const { profile, isAdmin } = useAuth();
  const isWebmaster = profile?.sales_role === 'webmaster';
  const canSeeCommissions = isAdmin || isWebmaster;

  const [investments, setInvestments] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [investorProfiles, setInvestorProfiles] = useState<Record<string, string>>({});
  const [commLoading, setCommLoading] = useState(false);
  const [usdKrwRate, setUsdKrwRate] = useState(1350);

  const salesTab = searchParams.get('salesTab') || 'pipeline';
  const fromSalesDashboard = searchParams.get('from') === 'sales-dashboard';
  const productSection = searchParams.get('productSection') || 'summary';
  const productInvestment = searchParams.get('productInvestment');
  const productAccordionDefaults = searchParams.get('productSection')
    ? [productSection]
    : ['summary', 'investors'];

  const buildMemberDetailLink = (userId: string, tab: string, investmentId?: string) => {
    const params = new URLSearchParams({
      from: 'product-detail',
      productId: id || '',
      productSection: 'investors',
      tab,
    });

    if (investmentId) params.set('productInvestment', investmentId);
    if (fromSalesDashboard) {
      params.set('productSource', 'sales-dashboard');
      params.set('productSalesTab', salesTab);
    }

    return `/members/${userId}?${params.toString()}`;
  };

  const handleBack = () => {
    if (fromSalesDashboard) {
      navigate(`/sales-dashboard?tab=${encodeURIComponent(salesTab)}`);
      return;
    }

    navigate('/products');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoomLevel(prev => Math.min(Math.max(prev + (e.deltaY > 0 ? -0.1 : 0.1), 0.5), 5));
  };

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
      
      const prod = data as Product;
      setProduct(prod);

      // Check if this is a flagship portfolio FUND product (only funds show charts)
      const isFlagship = (prod.type === 'fund' && (prod.name_ko.includes('포트폴리오') || prod.name_en.includes('Portfolio')));
      if (!isFlagship && prod.type === 'fund') {
        const { count } = await supabase
          .from('flagship_portfolio_items')
          .select('id', { count: 'exact', head: true })
          .eq('product_id', id);
        setIsFlagshipProduct((count || 0) > 0);
      } else {
        setIsFlagshipProduct(isFlagship);
      }
      
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

  // Fetch commissions & investors for admin/webmaster
  useEffect(() => {
    if (!id || !canSeeCommissions) return;
    async function fetchCommData() {
      setCommLoading(true);
      const [invRes, fxRes] = await Promise.all([
        supabase.from('client_investments').select('id, user_id, investment_amount, invested_currency, start_date, status').eq('product_id', id),
        supabase.from('market_indices').select('current_value').eq('symbol', 'USDKRW=X').maybeSingle(),
      ]);
      if (fxRes.data?.current_value) setUsdKrwRate(Number(fxRes.data.current_value));
      const invData = invRes.data || [];
      setInvestments(invData);

      // Fetch commissions server-side filtered by investment IDs
      const invIds = invData.map((i: any) => i.id);
      let relevantComm: any[] = [];
      if (invIds.length > 0) {
        const { data } = await supabase
          .from('commission_distributions')
          .select('*')
          .in('investment_id', invIds)
          .order('created_at', { ascending: false });
        relevantComm = data || [];
      }
      setCommissions(relevantComm);

      // Fetch profile names for investors & commission recipients
      const userIds = new Set<string>();
      invData.forEach((i: any) => userIds.add(i.user_id));
      relevantComm.forEach((c: any) => { userIds.add(c.to_user_id); if (c.from_user_id) userIds.add(c.from_user_id); });
      if (userIds.size > 0) {
        const { data: profs } = await supabase.from('profiles').select('user_id, full_name, full_name_ko').in('user_id', Array.from(userIds));
        const map: Record<string, string> = {};
        (profs || []).forEach((p: any) => { map[p.user_id] = p.full_name_ko || p.full_name; });
        setInvestorProfiles(map);
      }
      setCommLoading(false);
    }
    fetchCommData();
  }, [id, canSeeCommissions]);

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
        {/* Back Button & Print */}
        <div className="flex items-center justify-between mb-6">
          <Button 
            variant="ghost" 
            onClick={handleBack}
            className="-ml-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {language === 'ko' ? '상품 목록으로' : 'Back to Products'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="gap-2"
          >
            <Printer className="h-4 w-4" />
            {language === 'ko' ? '요약 인쇄' : 'Print Summary'}
          </Button>
        </div>

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
          <p className="text-sm text-muted-foreground whitespace-pre-line">
            {language === 'ko' ? product.description_ko : product.description_en}
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-2 md:gap-4 mb-8" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(0, 1fr))' }}>
          {(product.fixed_return_percent || product.target_return) && (
            <Card className="card-elevated animate-fade-in" style={{ animationDelay: '100ms' }}>
              <CardHeader className="pb-1 pt-2 md:pt-3 px-2 md:px-3">
                <CardTitle className="text-[10px] md:text-xs font-medium text-muted-foreground flex items-center gap-1 whitespace-nowrap">
                  <TrendingUp className="h-3 w-3 md:h-3.5 md:w-3.5 text-accent" />
                  {language === 'ko' ? '년 수익률' : 'Annual Return'}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2 md:px-3 pb-2 md:pb-3">
                <p className="text-sm md:text-xl font-bold text-accent whitespace-nowrap">
                  {language === 'ko'
                    ? `년 ${(product.fixed_return_percent || product.target_return)?.toFixed(2)}%`
                    : `${(product.fixed_return_percent || product.target_return)?.toFixed(2)}% p.a.`}
                </p>
                <p className="text-[9px] md:text-xs text-muted-foreground mt-0.5">
                  {language === 'ko' ? '세전 수익률' : 'Before Tax'}
                </p>
              </CardContent>
            </Card>
          )}

          {product.maturity_date && (
            <Card className="card-elevated animate-fade-in" style={{ animationDelay: '130ms' }}>
              <CardHeader className="pb-1 pt-2 md:pt-3 px-2 md:px-3">
                <CardTitle className="text-[10px] md:text-xs font-medium text-muted-foreground flex items-center gap-1 whitespace-nowrap">
                  <Clock className="h-3 w-3 md:h-3.5 md:w-3.5 text-accent" />
                  {language === 'ko' ? '상품 만기일' : 'Maturity'}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2 md:px-3 pb-2 md:pb-3">
                <p className="text-sm md:text-xl font-bold whitespace-nowrap">{formatDate(product.maturity_date)}</p>
                <p className="text-[9px] md:text-xs text-muted-foreground mt-0.5">
                  {language === 'ko' ? '만기 예정' : 'Expected maturity'}
                </p>
              </CardContent>
            </Card>
          )}

          {product.fundraising_amount && (
            <Card className="card-elevated animate-fade-in" style={{ animationDelay: '150ms' }}>
              <CardHeader className="pb-1 pt-2 md:pt-3 px-2 md:px-3">
                <CardTitle className="text-[10px] md:text-xs font-medium text-muted-foreground flex items-center gap-1 whitespace-nowrap">
                  <DollarSign className="h-3 w-3 md:h-3.5 md:w-3.5 text-accent" />
                  {language === 'ko' ? '모집 금액' : 'Fundraising'}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2 md:px-3 pb-2 md:pb-3">
                <p className="text-sm md:text-xl font-bold whitespace-nowrap">{formatCurrency(product.fundraising_amount, product.default_currency || undefined)}</p>
                <p className="text-[9px] md:text-xs text-muted-foreground mt-0.5">
                  {language === 'ko' ? '총 모집 목표' : 'Total target'}
                </p>
              </CardContent>
            </Card>
          )}

          {product.minimum_investment && (
            <Card className="card-elevated animate-fade-in" style={{ animationDelay: '200ms' }}>
              <CardHeader className="pb-1 pt-2 md:pt-3 px-2 md:px-3">
                <CardTitle className="text-[10px] md:text-xs font-medium text-muted-foreground whitespace-nowrap">
                  {language === 'ko' ? '최소 투자금' : 'Min. Investment'}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2 md:px-3 pb-2 md:pb-3">
                <p className="text-sm md:text-xl font-bold whitespace-nowrap">{formatCurrency(product.minimum_investment, product.default_currency || undefined)}</p>
                <p className="text-[9px] md:text-xs text-muted-foreground mt-0.5">
                  {language === 'ko' ? '최소 가능 금액' : 'Minimum amount'}
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
              <CardTitle className="flex items-center gap-2 text-base md:text-xl">
                <Target className="h-4 w-4 md:h-5 md:w-5 text-accent" />
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
              {product.maturity_date && (
                <div className="flex justify-between py-2.5 border-b border-border">
                  <span className="text-muted-foreground">{language === 'ko' ? '상품 만기일' : 'Maturity Date'}</span>
                  <span className="font-medium">{formatDate(product.maturity_date)}</span>
                </div>
              )}
              {product.fixed_return_percent != null && (
                <div className="flex justify-between py-2.5 border-b border-border">
                  <span className="text-muted-foreground">{language === 'ko' ? '단순 수익률' : 'Simple Return'}</span>
                  <div className="text-right">
                    <span className="font-medium text-accent">
                      {language === 'ko' ? `년 ${product.fixed_return_percent}%` : `${product.fixed_return_percent}% p.a.`}
                    </span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {language === 'ko' ? '분기별 지급 · 다음 지급일 3월 31일' : 'Quarterly · Next payment Mar 31'}
                    </p>
                  </div>
                </div>
              )}
              {product.target_return_percent != null && (
                <div className="flex justify-between py-2.5 border-b border-border">
                  <span className="text-muted-foreground">{language === 'ko' ? '최대 수익률' : 'Maximum Return'}</span>
                  <span className="font-medium text-accent">
                    {language === 'ko' ? `년 ${product.target_return_percent}%` : `${product.target_return_percent}% p.a.`}
                  </span>
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
              {product.募集_deadline && (
                <div className="flex justify-between py-2.5">
                  <span className="text-muted-foreground">{language === 'ko' ? '모집 마감일' : 'Subscription Deadline'}</span>
                  <span className="font-medium">{formatDate(product.募集_deadline)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Product Image / Flagship Chart */}
          <div className="animate-fade-in" style={{ animationDelay: '450ms' }}>
            {isFlagshipProduct ? (
              <div className="h-full rounded-xl border border-border p-4 bg-muted/10">
                <ProductFlagshipChart />
              </div>
            ) : product.image_url ? (
              <div
                className="overflow-hidden rounded-xl border border-border h-full cursor-zoom-in"
                onClick={() => setImageZoom(true)}
              >
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

        {/* Image Zoom Dialog */}
        {product.image_url && (
          <Dialog open={imageZoom} onOpenChange={(open) => { setImageZoom(open); if (!open) setZoomLevel(1); }}>
            <DialogContent className="max-w-4xl w-[95vw] p-2">
              <DialogHeader>
                <DialogTitle className="text-sm">{language === 'ko' ? product.name_ko : product.name_en}</DialogTitle>
              </DialogHeader>
              <div
                className="overflow-auto max-h-[80vh] flex items-center justify-center cursor-grab"
                onWheel={handleWheel}
              >
                <img
                  src={product.image_url}
                  alt={language === 'ko' ? product.name_ko : product.name_en}
                  className="rounded-lg transition-transform duration-150"
                  style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
                />
              </div>
              <p className="text-xs text-center text-muted-foreground">
                {language === 'ko' ? '마우스 휠로 확대/축소' : 'Scroll to zoom in/out'} ({Math.round(zoomLevel * 100)}%)
              </p>
            </DialogContent>
          </Dialog>
        )}

        {/* Investment Notes */}
        <div className="mb-8">
          <Card className="card-elevated animate-fade-in" style={{ animationDelay: '500ms' }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base md:text-xl">
                <Shield className="h-4 w-4 md:h-5 md:w-5 text-accent" />
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
              className="px-6 py-3 h-auto text-sm md:px-12 md:py-6 md:text-lg"
              productName={language === 'ko' ? product.name_ko : product.name_en}
            />
            <p className="text-sm text-muted-foreground mt-3">
              {language === 'ko' 
                ? '전문 상담원이 투자에 대해 안내해 드립니다'
                : 'Our specialists will guide you through the investment process'}
            </p>
          </div>
        )}

        {/* Admin / Webmaster Commission & Investor Section */}
        {canSeeCommissions && product && (
          <div className="space-y-6 animate-fade-in" style={{ animationDelay: '700ms' }}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Coins className="h-5 w-5 text-primary" />
                  {language === 'ko' ? '커미션 & 투자자 현황' : 'Commissions & Investors'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {commLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : (
                  <>
                    <Accordion type="multiple" className="w-full" defaultValue={productAccordionDefaults}>
                      <AccordionItem value="summary">
                        <AccordionTrigger className="py-3 text-sm font-semibold hover:no-underline">
                          <span className="flex items-center gap-2">
                            <Coins className="h-4 w-4" />
                            {language === 'ko' ? '커미션 요약' : 'Commission Summary'}
                          </span>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            <div className="rounded-lg border p-4">
                              <p className="text-xs text-muted-foreground">{language === 'ko' ? '총 투자 건수' : 'Total Investments'}</p>
                              <p className="text-2xl font-bold">{investments.length}</p>
                            </div>
                            <div className="rounded-lg border p-4">
                              <p className="text-xs text-muted-foreground">{language === 'ko' ? '총 선취 커미션' : 'Total Upfront'}</p>
                              <p className="text-2xl font-bold text-success">
                                ₩{commissions.reduce((s, c) => {
                                  const amt = Number(c.upfront_amount) || 0;
                                  return s + ((c.currency || 'USD') === 'USD' ? amt * usdKrwRate : amt);
                                }, 0).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                              </p>
                            </div>
                            <div className="rounded-lg border p-4">
                              <p className="text-xs text-muted-foreground">{language === 'ko' ? '총 성과 커미션' : 'Total Performance'}</p>
                              <p className="text-2xl font-bold text-success">
                                ₩{commissions.reduce((s, c) => {
                                  const amt = Number(c.performance_amount) || 0;
                                  return s + ((c.currency || 'USD') === 'USD' ? amt * usdKrwRate : amt);
                                }, 0).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                              </p>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="investors">
                        <AccordionTrigger className="py-3 text-sm font-semibold hover:no-underline">
                          <span className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            {language === 'ko' ? '투자자 & 커미션 현황' : 'Investors & Commissions'}
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-3">
                          <div>
                            <ProductInlineInvestmentForm
                              productId={product.id}
                              productNameEn={product.name_en}
                              productNameKo={product.name_ko}
                              defaultCurrency={product.default_currency || product.currency || 'USD'}
                              minInvestmentAmount={product.min_investment_amount}
                              onCreated={() => {
                                (async () => {
                                  setCommLoading(true);
                                  const [invRes, fxRes] = await Promise.all([
                                    supabase.from('client_investments').select('id, user_id, investment_amount, invested_currency, start_date, status').eq('product_id', id!),
                                    supabase.from('market_indices').select('current_value').eq('symbol', 'USDKRW=X').maybeSingle(),
                                  ]);
                                  if (fxRes.data?.current_value) setUsdKrwRate(Number(fxRes.data.current_value));
                                  const invData = invRes.data || [];
                                  setInvestments(invData);
                                  const invIds = invData.map((i: any) => i.id);
                                  let relevantComm: any[] = [];
                                  if (invIds.length > 0) {
                                    const { data } = await supabase.from('commission_distributions').select('*').in('investment_id', invIds).order('layer', { ascending: true });
                                    relevantComm = data || [];
                                  }
                                  setCommissions(relevantComm);
                                  const userIds = new Set<string>();
                                  invData.forEach((i: any) => userIds.add(i.user_id));
                                  relevantComm.forEach((c: any) => { userIds.add(c.to_user_id); if (c.from_user_id) userIds.add(c.from_user_id); });
                                  if (userIds.size > 0) {
                                    const { data: profs } = await supabase.from('profiles').select('user_id, full_name, full_name_ko').in('user_id', Array.from(userIds));
                                    const map: Record<string, string> = {};
                                    (profs || []).forEach((p: any) => { map[p.user_id] = p.full_name_ko || p.full_name; });
                                    setInvestorProfiles(map);
                                  }
                                  setCommLoading(false);
                                })();
                              }}
                            />
                          </div>

                          {investments.length === 0 ? (
                            <p className="py-4 text-center text-sm text-muted-foreground">
                              {language === 'ko' ? '투자 내역 없음' : 'No investments'}
                            </p>
                          ) : (
                            <>
                              <div className="hidden items-center rounded-md border border-border bg-muted/30 px-3 py-2 text-[11px] font-medium text-muted-foreground sm:grid sm:grid-cols-[minmax(0,1.7fr)_auto_auto_auto] sm:gap-x-3">
                                <span>{language === 'ko' ? '이름' : 'Name'}</span>
                                <span>{language === 'ko' ? '금액' : 'Amount'}</span>
                                <span>{language === 'ko' ? '투자일' : 'Start Date'}</span>
                                <span>{language === 'ko' ? '상태' : 'Status'}</span>
                              </div>
                              <Accordion type="multiple" className="w-full" defaultValue={productInvestment ? [productInvestment] : undefined}>
                              {investments.map((inv) => {
                                const invCommissions = commissions
                                  .filter((c) => c.investment_id === inv.id)
                                  .sort((a, b) => (a.layer || 0) - (b.layer || 0));
                                const chainNames = invCommissions.map((c) => investorProfiles[c.to_user_id] || c.to_user_id.slice(0, 8));
                                const investorName = investorProfiles[inv.user_id] || inv.user_id.slice(0, 8);

                                return (
                                  <AccordionItem key={inv.id} value={inv.id} className="rounded-lg border px-3">
                                    <AccordionTrigger className="min-h-12 py-3 hover:no-underline">
                                      <div className="grid w-full gap-y-2 pr-3 text-left sm:grid-cols-[minmax(0,1.7fr)_auto_auto_auto] sm:items-center sm:gap-x-3 sm:gap-y-0">
                                        <div className="flex min-w-0 items-center gap-2">
                                          <Link
                                            to={buildMemberDetailLink(inv.user_id, 'investments', inv.id)}
                                            className="inline-flex min-h-8 min-w-0 items-center truncate text-sm font-semibold text-primary hover:underline"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            {investorName}
                                          </Link>
                                          <Badge variant={inv.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">{inv.status}</Badge>
                                        </div>
                                        <span className="text-xs font-medium text-foreground whitespace-nowrap">{formatCurrency(Number(inv.investment_amount))} {inv.invested_currency || 'USD'}</span>
                                        <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(inv.start_date)}</span>
                                        <span className="text-xs text-muted-foreground sm:hidden">{language === 'ko' ? '상태' : 'Status'}: {inv.status}</span>
                                      </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="space-y-2 pb-4">
                                      {invCommissions.length > 0 ? (
                                        <div className="ml-1 space-y-1 border-l-2 border-primary/20 pl-2">
                                          <p className="text-[11px] text-muted-foreground">
                                            {language === 'ko' ? '커미션 체인' : 'Commission chain'}:{' '}
                                            <span className="font-medium text-foreground">{investorName}</span>
                                            {chainNames.length > 0 && (
                                              <>
                                                {' → '}
                                                {chainNames.map((name, idx) => (
                                                  <span key={idx}>
                                                    <span className="font-medium text-foreground">{name}</span>
                                                    {idx < chainNames.length - 1 && ' → '}
                                                  </span>
                                                ))}
                                              </>
                                            )}
                                          </p>

                                          <Table className="table-fixed">
                                            <TableHeader>
                                              <TableRow>
                                                <TableHead className="h-7 w-[34%] min-w-[150px] text-[11px]">{language === 'ko' ? '수취인' : 'Recipient'}</TableHead>
                                                <TableHead className="h-7 w-[18%] whitespace-nowrap text-[11px]">{language === 'ko' ? '선취' : 'Upfront'}</TableHead>
                                                <TableHead className="h-7 w-[18%] whitespace-nowrap text-[11px]">{language === 'ko' ? '성과' : 'Perf.'}</TableHead>
                                                <TableHead className="h-7 w-[12%] whitespace-nowrap text-[11px]">{language === 'ko' ? '요율' : 'Rate'}</TableHead>
                                                <TableHead className="h-7 w-[18%] whitespace-nowrap text-[11px]">{language === 'ko' ? '상태' : 'Status'}</TableHead>
                                              </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                              {invCommissions.map((c) => (
                                                <TableRow key={c.id}>
                                                  <TableCell className="py-1 text-xs">
                                                    <Link
                                                      to={buildMemberDetailLink(c.to_user_id, 'commissions', inv.id)}
                                                      className="inline-flex min-h-8 max-w-full items-center truncate text-primary hover:underline"
                                                    >
                                                      {investorProfiles[c.to_user_id] || c.to_user_id.slice(0, 8)}
                                                    </Link>
                                                  </TableCell>
                                                  <TableCell className="py-1 text-xs whitespace-nowrap text-success">{formatCurrency(Number(c.upfront_amount) || 0)}</TableCell>
                                                  <TableCell className="py-1 text-xs whitespace-nowrap text-success">{formatCurrency(Number(c.performance_amount) || 0)}</TableCell>
                                                  <TableCell className="py-1 text-xs whitespace-nowrap">{c.rate_used != null ? `${c.rate_used}%` : '—'}</TableCell>
                                                  <TableCell className="py-1 whitespace-nowrap">
                                                    <Badge variant={c.status === 'available' ? 'default' : 'secondary'} className="text-[10px]">{c.status}</Badge>
                                                  </TableCell>
                                                </TableRow>
                                              ))}
                                            </TableBody>
                                          </Table>
                                        </div>
                                      ) : (
                                        <p className="py-2 text-xs text-muted-foreground">
                                          {language === 'ko' ? '등록된 커미션 내역이 없습니다.' : 'No commission records.'}
                                        </p>
                                      )}
                                    </AccordionContent>
                                  </AccordionItem>
                                );
                              })}
                            </Accordion>
                            </>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </>
                )}
              </CardContent>
            </Card>
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

      {/* Print Summary (hidden, shown only during print) */}
      {product && <ProductPrintSummary ref={printRef} product={product} />}
    </div>
  );
}
