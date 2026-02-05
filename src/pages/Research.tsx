import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Download, Calendar, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { SummaryDialog } from '@/components/research/SummaryDialog';

interface Report {
  id: string;
  title_en: string;
  title_ko: string;
  category: string;
  summary_en: string | null;
  summary_ko: string | null;
  pdf_url: string | null;
  publication_date: string;
}

export default function Research() {
  const { t, language, formatDate } = useLanguage();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);

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
                    
                    <h3 className="text-lg font-serif font-semibold mb-2">
                      {language === 'ko' ? report.title_ko : report.title_en}
                    </h3>
                    
                    <p className="text-sm text-muted-foreground mb-3">
                      {language === 'ko' ? report.summary_ko : report.summary_en}
                    </p>
                    
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
