import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Newspaper, ExternalLink } from 'lucide-react';
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
  url: string;
  created_at: string;
}

interface InterestNewsSectionProps {
  language: string;
}

export function InterestNewsSection({ language }: InterestNewsSectionProps) {
  const { data: news, isLoading } = useQuery({
    queryKey: ['interest-news'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('interest_news')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return (data || []) as InterestNews[];
    },
  });

  return (
    <div className="mb-8 animate-fade-in" style={{ animationDelay: '150ms' }}>
      <div className="flex items-center gap-2 mb-3">
        <Newspaper className="h-5 w-5 text-accent" />
        <h2 className="text-lg font-semibold">
          {language === 'ko' ? '관심 뉴스' : 'Interest News'}
        </h2>
      </div>

      <div className="card-elevated overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-sm font-medium">{language === 'ko' ? '제목' : 'Title'}</TableHead>
                <TableHead className="text-sm font-medium text-right w-[80px]">{language === 'ko' ? '링크' : 'Link'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                  </TableRow>
                ))
              ) : !news || news.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center py-6 text-muted-foreground text-sm">
                    {language === 'ko' ? '등록된 뉴스가 없습니다' : 'No news available'}
                  </TableCell>
                </TableRow>
              ) : (
                news.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-sm font-medium">
                      {language === 'ko' ? item.title_ko : item.title_en}
                    </TableCell>
                    <TableCell className="text-right">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline text-sm"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
