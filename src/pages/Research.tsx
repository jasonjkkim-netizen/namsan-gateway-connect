import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Download, Calendar, Sparkles, TrendingUp, LayoutDashboard, Package, PlayCircle, MessageSquare, BookOpen, Newspaper } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { SummaryDialog } from '@/components/research/SummaryDialog';


interface Report {
  id: string;
  title_en: string;
  title_ko: string;
  category: string;
  summary_en: string | null;
  summary_ko: string | null;
  admin_note: string | null;
  pdf_url: string | null;
  publication_date: string;
}

export default function Research() {
  const { t, language, formatDate } = useLanguage();
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);

  const sections = [
    { path: '/market-data', label: t('marketData'), icon: TrendingUp },
    { path: '/news', label: language === 'ko' ? '뉴스' : 'News', icon: Newspaper },
    { path: '/dashboard', label: t('dashboard'), icon: LayoutDashboard },
    { path: '/products', label: t('products'), icon: Package },
    { path: '/research', label: t('research'), icon: FileText, active: true },
    { path: '/blog', label: language === 'ko' ? '블로그' : 'Blog', icon: BookOpen },
    { path: '/videos', label: t('videos'), icon: PlayCircle },
  ];

  useEffect(() => {
    async function fetchReports() {
      const { data } = await supabase
        .from('research_reports')
        .select('*')
        .eq('is_active', true)
        .order('publication_date', { ascending: false });
      
      if (data) setReports(data as Report[]);
      setLoading(false);
    }

    fetchReports();
  }, []);

  const categories = [
    { value: 'all', label: t('all') },
    { value: 'market_update', label: t('marketUpdate') },
    { value: 'product_analysis', label: t('productAnalysis') },
    { value: 'economic_outlook', label: t('economicOutlook') },
  ];

  const filteredReports = filter === 'all' 
    ? reports 
    : reports.filter(r => r.category === filter);

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'market_update': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'product_analysis': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'economic_outlook': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getCategoryKey = (category: string): string => {
    switch (category) {
      case 'market_update': return 'marketUpdate';
      case 'product_analysis': return 'productAnalysis';
      case 'economic_outlook': return 'economicOutlook';
      default: return category;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl font-serif font-semibold text-foreground">{t('researchReports')}</h1>
          <p className="mt-1 text-muted-foreground">
            {language === 'ko' ? '최신 시장 분석 및 투자 인사이트' : 'Latest market analysis and investment insights'}
          </p>
        </div>

        {/* Section Navigation Buttons */}
        <div className="mb-8 animate-fade-in" style={{ animationDelay: '50ms' }}>
          <p className="text-sm text-muted-foreground mb-3">
            {language === 'ko' ? '섹션으로 이동' : 'Navigate to section'}
          </p>
          <div className="flex flex-wrap gap-3">
            {sections.map((section) => (
              <Button
                key={section.path}
                variant={section.active ? "default" : "outline"}
                onClick={() => !section.active && navigate(section.path)}
                className={`flex items-center gap-2 ${section.active ? 'pointer-events-none' : ''}`}
              >
                <section.icon className="h-4 w-4" />
                {section.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2 mb-8 animate-fade-in" style={{ animationDelay: '100ms' }}>
          {categories.map((cat) => (
            <Button
              key={cat.value}
              variant={filter === cat.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(cat.value)}
              className={filter === cat.value ? '' : 'hover:bg-muted'}
            >
              {cat.label}
            </Button>
          ))}
        </div>


        <div className="space-y-4">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card-elevated p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <Skeleton className="h-6 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-full mb-4" />
                    <Skeleton className="h-4 w-1/4" />
                  </div>
                  <Skeleton className="h-10 w-32" />
                </div>
              </div>
            ))
          ) : filteredReports.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {t('noData')}
            </div>
          ) : (
            filteredReports.map((report, index) => (
              <div 
                key={report.id} 
                className="card-elevated p-6 flex flex-col md:flex-row md:items-center gap-4 animate-fade-in hover:shadow-lg transition-all duration-300"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-start gap-4 flex-1">
                  <div className="rounded-lg bg-primary/10 p-3 hidden sm:block">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={getCategoryColor(report.category)}>
                        {t(getCategoryKey(report.category))}
                      </Badge>
                    </div>
                    
                    <h3 className="text-sm font-medium mb-2">
                      {language === 'ko' ? report.title_ko : report.title_en}
                    </h3>
                    
                    <p className="text-sm text-muted-foreground mb-3">
                      {language === 'ko' ? report.summary_ko : report.summary_en}
                    </p>

                    {report.admin_note && (
                      <div className="mb-3 p-3 rounded-md bg-primary/5 border border-primary/10">
                        <div className="flex items-center gap-1.5 mb-1">
                          <MessageSquare className="h-3.5 w-3.5 text-primary" />
                          <span className="text-xs font-medium text-primary">
                            {language === 'ko' ? '운용역 코멘트' : 'Manager Comment'}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{report.admin_note}</p>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>{formatDate(report.publication_date)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 md:self-center">
                  <Button 
                    variant="outline"
                    onClick={() => {
                      setSelectedReport(report);
                      setSummaryOpen(true);
                    }}
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    {language === 'ko' ? 'AI 분석' : 'AI Summary'}
                  </Button>
                  <Button 
                    variant="outline" 
                    disabled={!report.pdf_url}
                    onClick={async () => {
                      if (report.pdf_url) {
                        // If it's already a full URL (legacy), open directly; otherwise create signed URL
                        if (report.pdf_url.startsWith('http')) {
                          window.open(report.pdf_url, '_blank');
                        } else {
                          const { data, error } = await supabase.storage
                            .from('research-documents')
                            .createSignedUrl(report.pdf_url, 300);
                          if (data?.signedUrl) {
                            window.open(data.signedUrl, '_blank');
                          }
                        }
                      }
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {t('downloadPdf')}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <SummaryDialog 
          report={selectedReport} 
          open={summaryOpen} 
          onOpenChange={setSummaryOpen} 
        />
      </main>
    </div>
  );
}
