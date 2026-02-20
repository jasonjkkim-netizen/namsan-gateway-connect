import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Newspaper, RefreshCw, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StockNews {
  id: string;
  stock_name: string;
  stock_code: string | null;
  news_bullets: string[];
  citations: string[];
  fetched_at: string;
}

interface StockPickNewsSectionProps {
  language: string;
}

export function StockPickNewsSection({ language }: StockPickNewsSectionProps) {
  const [news, setNews] = useState<StockNews[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchNews() {
    setLoading(true);
    setError(null);
    try {
      const { data, error: dbErr } = await supabase
        .from('stock_pick_news')
        .select('*')
        .order('created_at', { ascending: true });

      if (dbErr) throw dbErr;

      const mapped = (data || []).map((d: any) => ({
        ...d,
        news_bullets: Array.isArray(d.news_bullets) ? d.news_bullets : [],
        citations: Array.isArray(d.citations) ? d.citations : [],
      }));
      setNews(mapped);
    } catch (err) {
      console.error('Error fetching stock news:', err);
      setError(language === 'ko' ? '종목 뉴스를 불러오는데 실패했습니다' : 'Failed to load stock news');
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const { error: fnErr } = await supabase.functions.invoke('stock-pick-news');
      if (fnErr) throw fnErr;
      await fetchNews();
    } catch (err) {
      console.error('Error refreshing stock news:', err);
      setError(language === 'ko' ? '뉴스 업데이트 실패' : 'Failed to refresh news');
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchNews();
  }, []);

  const allCitations = news.length > 0 ? news[0].citations : [];
  const fetchedAt = news.length > 0 ? news[0].fetched_at : null;

  return (
    <div className="mb-8 card-elevated overflow-hidden animate-fade-in">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Newspaper className="h-4 w-4 text-primary" />
          <h3 className="font-serif font-medium text-sm">
            {language === 'ko' ? '관심 종목 뉴스' : 'Stock Pick News'}
          </h3>
          {fetchedAt && (
            <span className="text-xs text-muted-foreground">
              ({new Date(fetchedAt).toLocaleString(language === 'ko' ? 'ko-KR' : 'en-US', {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
              })})
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={loading || refreshing}
          className="h-7 px-2"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-3 text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin" />
              <span className="text-sm">
                {language === 'ko' ? '종목 뉴스를 불러오는 중...' : 'Loading stock news...'}
              </span>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground mb-3">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchNews}>
              {language === 'ko' ? '다시 시도' : 'Retry'}
            </Button>
          </div>
        ) : news.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground mb-3">
              {language === 'ko' ? '종목 뉴스가 아직 없습니다' : 'No stock news yet'}
            </p>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
              {refreshing ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : null}
              {language === 'ko' ? '뉴스 가져오기' : 'Fetch News'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {news.map((item) => (
              <div key={item.id} className="space-y-1.5">
                <h4 className="font-semibold text-xs text-foreground flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                  {item.stock_name}
                  {item.stock_code && (
                    <span className="text-xs text-muted-foreground font-normal">({item.stock_code})</span>
                  )}
                </h4>
                <ul className="ml-4 space-y-1">
                  {item.news_bullets.map((bullet, idx) => (
                    <li key={idx} className="text-xs leading-relaxed text-muted-foreground flex gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {allCitations.length > 0 && (
              <div className="pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2">
                  {language === 'ko' ? '출처' : 'Sources'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {allCitations.slice(0, 5).map((url, index) => {
                    let domain = '';
                    try {
                      domain = new URL(url).hostname.replace('www.', '');
                    } catch {
                      domain = String(url);
                    }
                    return (
                      <a
                        key={index}
                        href={String(url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline bg-muted/50 px-2 py-1 rounded"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {domain}
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
