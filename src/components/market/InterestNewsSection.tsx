import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Bell, ExternalLink } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface UpdateItem {
  id: string;
  type: 'news' | 'product' | 'research' | 'blog';
  title_ko: string;
  title_en: string;
  summary_ko?: string;
  summary_en?: string;
  url?: string;
  link?: string;
  created_at: string;
}

const TYPE_CONFIG: Record<string, { ko: string; en: string; color: string }> = {
  news: { ko: '뉴스', en: 'News', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  product: { ko: '상품', en: 'Product', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  research: { ko: '리서치', en: 'Research', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
  blog: { ko: '블로그', en: 'Blog', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' },
};

interface Props {
  language: string;
}

export function InterestNewsSection({ language }: Props) {
  const navigate = useNavigate();

  const { data: updates, isLoading } = useQuery({
    queryKey: ['recent-updates-aggregated'],
    queryFn: async () => {
      const [newsRes, productsRes, researchRes, blogRes] = await Promise.all([
        supabase
          .from('interest_news')
          .select('id, title_ko, title_en, content_ko, content_en, url, created_at')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('investment_products')
          .select('id, name_ko, name_en, description_ko, description_en, created_at')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('research_reports')
          .select('id, title_ko, title_en, summary_ko, summary_en, created_at')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('blog_posts')
          .select('id, title_ko, title_en, summary_ko, summary_en, created_at')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      const items: UpdateItem[] = [];

      (newsRes.data || []).forEach((n: any) => items.push({
        id: n.id, type: 'news',
        title_ko: n.title_ko, title_en: n.title_en,
        summary_ko: n.content_ko, summary_en: n.content_en,
        url: n.url, created_at: n.created_at,
      }));

      (productsRes.data || []).forEach((p: any) => items.push({
        id: p.id, type: 'product',
        title_ko: p.name_ko, title_en: p.name_en,
        summary_ko: p.description_ko, summary_en: p.description_en,
        link: `/products/${p.id}`, created_at: p.created_at,
      }));

      (researchRes.data || []).forEach((r: any) => items.push({
        id: r.id, type: 'research',
        title_ko: r.title_ko, title_en: r.title_en,
        summary_ko: r.summary_ko, summary_en: r.summary_en,
        link: '/research', created_at: r.created_at,
      }));

      (blogRes.data || []).forEach((b: any) => items.push({
        id: b.id, type: 'blog',
        title_ko: b.title_ko, title_en: b.title_en,
        summary_ko: b.summary_ko, summary_en: b.summary_en,
        link: '/blog', created_at: b.created_at,
      }));

      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return items.slice(0, 15);
    },
  });

  const handleRowClick = (item: UpdateItem) => {
    if (item.url) {
      window.open(item.url, '_blank', 'noopener,noreferrer');
    } else if (item.link) {
      navigate(item.link);
    }
  };

  return (
    <div className="mb-8 animate-fade-in" style={{ animationDelay: '150ms' }}>
      <div className="flex items-center gap-2 mb-3">
        <Bell className="h-5 w-5 text-accent" />
        <h2 className="font-serif font-medium text-sm">
          {language === 'ko' ? '최근 업데이트' : 'Recent Updates'}
        </h2>
      </div>

      <div className="card-elevated overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-medium whitespace-nowrap">{language === 'ko' ? '날짜' : 'Date'}</TableHead>
                <TableHead className="text-xs font-medium whitespace-nowrap">{language === 'ko' ? '구분' : 'Type'}</TableHead>
                <TableHead className="text-xs font-medium">{language === 'ko' ? '제목' : 'Title'}</TableHead>
                <TableHead className="text-xs font-medium hidden md:table-cell">{language === 'ko' ? '요약' : 'Summary'}</TableHead>
                <TableHead className="text-xs font-medium text-right whitespace-nowrap">{language === 'ko' ? '링크' : 'Link'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-8" /></TableCell>
                  </TableRow>
                ))
              ) : updates && updates.length > 0 ? (
                updates.map((item) => {
                  const date = new Date(item.created_at);
                  const config = TYPE_CONFIG[item.type];
                  const hasLink = !!(item.url || item.link);
                  const isToday = new Date().toDateString() === date.toDateString();
                  return (
                    <TableRow
                      key={`${item.type}-${item.id}`}
                      className={hasLink ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''}
                      onClick={() => hasLink && handleRowClick(item)}
                    >
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        <span className="flex items-center gap-1.5">
                          {date.toLocaleDateString(language === 'ko' ? 'ko-KR' : 'en-US', { month: '2-digit', day: '2-digit' })}
                          {isToday && (
                            <span className="inline-block text-[9px] font-bold text-red-600 dark:text-red-400 animate-pulse">
                              NEW
                            </span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${config.color}`}>
                          {language === 'ko' ? config.ko : config.en}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-medium max-w-[200px] truncate">
                        {language === 'ko' ? item.title_ko : (item.title_en || item.title_ko)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate hidden md:table-cell">
                        {language === 'ko'
                          ? (item.summary_ko || '-')
                          : (item.summary_en || item.summary_ko || '-')}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.url ? (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : item.link ? (
                          <span className="text-xs text-primary">→</span>
                        ) : '-'}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-muted-foreground text-xs">
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
