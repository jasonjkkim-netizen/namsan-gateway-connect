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
import { format } from 'date-fns';

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
      const { data, error } = await supabase
        .from('interest_news')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
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

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-8">
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl font-serif font-semibold text-foreground">
            {language === 'ko' ? '관심 뉴스' : 'Interest News'}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {language === 'ko' ? '최신 관심 뉴스 및 업데이트' : 'Latest interest news and updates'}
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

        {/* News Table */}
        <div className="card-elevated overflow-hidden animate-fade-in" style={{ animationDelay: '100ms' }}>
          <div className="p-3 border-b border-border flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <h2 className="font-serif font-medium text-sm">
              {language === 'ko' ? '관심 뉴스' : 'Interest News'}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-sm font-medium w-[100px]">
                    {language === 'ko' ? '날짜' : 'Date'}
                  </TableHead>
                  <TableHead className="text-sm font-medium w-[70px]">
                    {language === 'ko' ? '시간' : 'Time'}
                  </TableHead>
                  <TableHead className="text-sm font-medium w-[200px]">
                    {language === 'ko' ? '제목' : 'Title'}
                  </TableHead>
                  <TableHead className="text-sm font-medium">
                    {language === 'ko' ? '본문' : 'Content'}
                  </TableHead>
                  <TableHead className="text-sm font-medium text-right w-[60px]">
                    {language === 'ko' ? '링크' : 'Link'}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-14" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-60" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-8" /></TableCell>
                    </TableRow>
                  ))
                ) : news && news.length > 0 ? (
                  news.map((item) => {
                    const date = new Date(item.created_at);
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {format(date, 'yyyy-MM-dd')}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {format(date, 'HH:mm')}
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {language === 'ko' ? item.title_ko : item.title_en}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground line-clamp-2 max-w-[400px]">
                          {language === 'ko' ? item.content_ko : item.content_en}
                        </TableCell>
                        <TableCell className="text-right">
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-primary hover:underline"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">
                      {language === 'ko' ? '등록된 뉴스가 없습니다' : 'No news available'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </main>
    </div>
  );
}
