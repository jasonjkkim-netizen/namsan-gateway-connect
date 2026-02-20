import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Bell, ExternalLink } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface InterestNews {
  id: string;
  title_ko: string;
  title_en: string;
  content_ko: string;
  content_en: string;
  url: string;
  created_at: string;
}

interface Props {
  language: string;
}

export function InterestNewsSection({ language }: Props) {
  const { data: news, isLoading } = useQuery({
    queryKey: ['interest-news-latest'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('interest_news')
        .select('id, title_ko, title_en, content_ko, content_en, url, created_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data || []) as InterestNews[];
    },
  });

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
                <TableHead className="text-sm font-medium whitespace-nowrap">{language === 'ko' ? '날짜' : 'Date'}</TableHead>
                <TableHead className="text-sm font-medium whitespace-nowrap hidden sm:table-cell">{language === 'ko' ? '시간' : 'Time'}</TableHead>
                <TableHead className="text-sm font-medium">{language === 'ko' ? '제목' : 'Title'}</TableHead>
                <TableHead className="text-sm font-medium hidden md:table-cell">{language === 'ko' ? '본문' : 'Content'}</TableHead>
                <TableHead className="text-sm font-medium text-right whitespace-nowrap">{language === 'ko' ? '링크' : 'Link'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-8" /></TableCell>
                  </TableRow>
                ))
              ) : news && news.length > 0 ? (
                news.map((item) => {
                  const date = new Date(item.created_at);
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {date.toLocaleDateString(language === 'ko' ? 'ko-KR' : 'en-US', { month: '2-digit', day: '2-digit' })}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap hidden sm:table-cell">
                        {date.toLocaleTimeString(language === 'ko' ? 'ko-KR' : 'en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                      </TableCell>
                      <TableCell className="text-sm font-medium max-w-[150px] sm:max-w-[200px] truncate">
                        {language === 'ko' ? item.title_ko : (item.title_en || item.title_ko)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate hidden md:table-cell">
                        {language === 'ko' ? (item.content_ko || '-') : (item.content_en || item.content_ko || '-')}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.url ? (
                          <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-primary hover:underline">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : '-'}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-muted-foreground text-sm">
                    {language === 'ko' ? '최근 업데이트가 없습니다' : 'No recent updates'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
