import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Bell, TrendingUp, LayoutDashboard, Package, FileText, PlayCircle, BookOpen, ExternalLink, Newspaper } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format, subDays, isAfter } from 'date-fns';

interface InterestNews {
  id: string;
  title_ko: string;
  title_en: string;
  content_ko: string;
  content_en: string;
  url: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  display_order: number;
}

export default function News() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();

  const { data: news, isLoading } = useQuery({
    queryKey: ['interest-news-all'],
    queryFn: async () => {
      const oneWeekAgo = subDays(new Date(), 7).toISOString();
      const { data, error } = await supabase
        .from('interest_news')
        .select('*')
        .eq('is_active', true)
        .gte('created_at', oneWeekAgo)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as InterestNews[];
    },
  });

  const sections = [
    { path: '/market-data', label: t('marketData'), icon: TrendingUp },
    { path: '/news', label: language === 'ko' ? '뉴스' : 'News', icon: Newspaper, active: true },
    { path: '/dashboard', label: t('dashboard'), icon: LayoutDashboard },
    { path: '/products', label: t('products'), icon: Package },
    { path: '/research', label: t('research'), icon: FileText },
    { path: '/blog', label: language === 'ko' ? '블로그' : 'Blog', icon: BookOpen },
    { path: '/videos', label: t('videos'), icon: PlayCircle },
  ];

  // Group news by date
  const groupedByDate = (news || []).reduce<Record<string, InterestNews[]>>((acc, item) => {
    const dateKey = format(new Date(item.created_at), 'yyyy-MM-dd');
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(item);
    return acc;
  }, {});

  const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-8">
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl font-serif font-semibold text-foreground">
            {language === 'ko' ? '날짜별 주요 관심 뉴스' : 'Daily Key Interest News'}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {language === 'ko' ? '최근 1주일간 주요 관심 뉴스' : 'Key interest news from the past week'}
          </p>
        </div>

        {/* Section Navigation */}
        <div className="mb-8 animate-fade-in" style={{ animationDelay: '50ms' }}>
          <p className="text-sm text-muted-foreground mb-3">
            {language === 'ko' ? '섹션으로 이동' : 'Navigate to section'}
          </p>
          <div className="flex flex-wrap gap-3">
            {sections.map((section) => (
              <Button
                key={section.path}
                variant={section.active ? 'default' : 'outline'}
                onClick={() => !section.active && navigate(section.path)}
                className={`flex items-center gap-2 ${section.active ? 'pointer-events-none' : ''}`}
              >
                <section.icon className="h-4 w-4" />
                {section.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Date-grouped News */}
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card-elevated p-4">
                <Skeleton className="h-6 w-32 mb-3" />
                <Skeleton className="h-5 w-full mb-2" />
                <Skeleton className="h-5 w-3/4" />
              </div>
            ))}
          </div>
        ) : sortedDates.length > 0 ? (
          <div className="space-y-6 animate-fade-in" style={{ animationDelay: '100ms' }}>
            {sortedDates.map((dateKey) => (
              <div key={dateKey} className="card-elevated overflow-hidden">
                <div className="p-3 border-b border-border bg-muted/30 flex items-center gap-2">
                  <Bell className="h-4 w-4 text-primary" />
                  <h2 className="font-serif font-medium text-sm">
                    {format(new Date(dateKey), language === 'ko' ? 'yyyy년 M월 d일' : 'MMM d, yyyy')}
                  </h2>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {groupedByDate[dateKey].length}{language === 'ko' ? '건' : ' items'}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs font-medium w-[60px] whitespace-nowrap">
                          {language === 'ko' ? '시간' : 'Time'}
                        </TableHead>
                        <TableHead className="text-xs font-medium w-[180px] whitespace-nowrap">
                          {language === 'ko' ? '제목' : 'Title'}
                        </TableHead>
                        <TableHead className="text-xs font-medium">
                          {language === 'ko' ? '본문' : 'Content'}
                        </TableHead>
                        <TableHead className="text-xs font-medium text-right w-[50px] whitespace-nowrap">
                          {language === 'ko' ? '링크' : 'Link'}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupedByDate[dateKey].map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap align-top">
                            {format(new Date(item.created_at), 'HH:mm')}
                          </TableCell>
                          <TableCell className="text-xs font-medium align-top">
                            {language === 'ko' ? item.title_ko : item.title_en}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground align-top">
                            <div className="max-h-[120px] overflow-y-auto leading-relaxed">
                              {language === 'ko' ? item.content_ko : item.content_en}
                            </div>
                          </TableCell>
                          <TableCell className="text-right align-top">
                            {item.url && (
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center text-primary hover:underline"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card-elevated p-8 text-center text-muted-foreground text-sm">
            {language === 'ko' ? '최근 1주일간 등록된 뉴스가 없습니다' : 'No news from the past week'}
          </div>
        )}
      </main>
    </div>
  );
}
