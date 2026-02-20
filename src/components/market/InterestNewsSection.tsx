import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Bell, ExternalLink, FileText } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface InterestNews {
  id: string;
  title_ko: string;
  title_en: string;
  content_ko: string;
  content_en: string;
  url: string;
  created_at: string;
}

interface ResearchReport {
  id: string;
  title_ko: string;
  title_en: string;
  pdf_url: string | null;
  publication_date: string;
  summary_ko: string | null;
  summary_en: string | null;
}

interface Props {
  language: string;
}

export function InterestNewsSection({ language }: Props) {
  const { data: news, isLoading: newsLoading } = useQuery({
    queryKey: ['interest-news-latest'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('interest_news')
        .select('id, title_ko, title_en, content_ko, content_en, url, created_at')
        .eq('is_active', true)
        .order('display_order', { ascending: true })
        .limit(1);
      if (error) throw error;
      return (data || []) as InterestNews[];
    },
  });

  const { data: research, isLoading: researchLoading } = useQuery({
    queryKey: ['research-latest'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('research_reports')
        .select('id, title_ko, title_en, pdf_url, publication_date, summary_ko, summary_en')
        .eq('is_active', true)
        .order('publication_date', { ascending: false })
        .limit(1);
      if (error) throw error;
      return (data || []) as ResearchReport[];
    },
  });

  const isLoading = newsLoading || researchLoading;

  return (
    <div className="mb-8 animate-fade-in" style={{ animationDelay: '150ms' }}>
      <div className="flex items-center gap-2 mb-3">
        <Bell className="h-5 w-5 text-accent" />
        <h2 className="text-lg font-semibold">
          {language === 'ko' ? '최근 업데이트' : 'Recent Updates'}
        </h2>
      </div>

      <div className="card-elevated overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-sm font-medium w-[90px]">{language === 'ko' ? '구분' : 'Type'}</TableHead>
                <TableHead className="text-sm font-medium w-[90px]">{language === 'ko' ? '날짜' : 'Date'}</TableHead>
                <TableHead className="text-sm font-medium">{language === 'ko' ? '제목' : 'Title'}</TableHead>
                <TableHead className="text-sm font-medium max-w-[300px]">{language === 'ko' ? '본문' : 'Summary'}</TableHead>
                <TableHead className="text-sm font-medium text-right w-[60px]">{language === 'ko' ? '링크' : 'Link'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-8" /></TableCell>
                  </TableRow>
                ))
              ) : (
                <>
                  {research && research.length > 0 && (
                    <TableRow>
                      <TableCell>
                        <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs inline-flex items-center gap-1 whitespace-nowrap">
                          <FileText className="h-3 w-3" />
                          {language === 'ko' ? '리서치' : 'Research'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(research[0].publication_date).toLocaleDateString(language === 'ko' ? 'ko-KR' : 'en-US', { month: 'short', day: 'numeric' })}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {language === 'ko' ? research[0].title_ko : research[0].title_en}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate">
                        {language === 'ko' ? (research[0].summary_ko || '-') : (research[0].summary_en || '-')}
                      </TableCell>
                      <TableCell className="text-right">
                        {research[0].pdf_url ? (
                          <a href={research[0].pdf_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-primary hover:underline">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : '-'}
                      </TableCell>
                    </TableRow>
                  )}
                  {news && news.length > 0 && (
                    <TableRow>
                      <TableCell>
                        <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-xs inline-flex items-center gap-1 whitespace-nowrap">
                          <ExternalLink className="h-3 w-3" />
                          {language === 'ko' ? '뉴스' : 'News'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(news[0].created_at).toLocaleDateString(language === 'ko' ? 'ko-KR' : 'en-US', { month: 'short', day: 'numeric' })}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {language === 'ko' ? news[0].title_ko : news[0].title_en}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate">
                        {language === 'ko' ? (news[0].content_ko || '-') : (news[0].content_en || '-')}
                      </TableCell>
                      <TableCell className="text-right">
                        {news[0].url ? (
                          <a href={news[0].url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-primary hover:underline">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : '-'}
                      </TableCell>
                    </TableRow>
                  )}
                  {(!research || research.length === 0) && (!news || news.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-6 text-muted-foreground text-sm">
                        {language === 'ko' ? '최근 업데이트가 없습니다' : 'No recent updates'}
                      </TableCell>
                    </TableRow>
                  )}
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
