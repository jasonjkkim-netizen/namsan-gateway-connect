import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Newspaper, RefreshCw, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ReactMarkdown from 'react-markdown';

interface MarketNewsSectionProps {
  language: string;
}

export function MarketNewsSection({ language }: MarketNewsSectionProps) {
  const [content, setContent] = useState<string>('');
  const [citations, setCitations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchNews() {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('market-news');

      if (fnError) throw fnError;

      if (data?.success) {
        setContent(data.content);
        setCitations(data.citations || []);
      } else {
        throw new Error(data?.error || 'Failed to fetch news');
      }
    } catch (err) {
      console.error('Error fetching market news:', err);
      setError(
        language === 'ko'
          ? '시장 뉴스를 불러오는데 실패했습니다'
          : 'Failed to load market news'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchNews();
  }, []);

  return (
    <div className="mb-8 card-elevated overflow-hidden animate-fade-in">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Newspaper className="h-4 w-4 text-primary" />
          <h3 className="font-serif font-medium text-sm">
            {language === 'ko' ? '오늘 마감 주요 뉴스' : "Today's Market Closing News"}
          </h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchNews}
          disabled={loading}
          className="h-7 px-2"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-3 text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin" />
              <span className="text-sm">
                {language === 'ko' ? '시장 뉴스를 불러오는 중...' : 'Loading market news...'}
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
        ) : (
          <div className="space-y-4">
            <div className="prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>

            {citations.length > 0 && (
              <div className="pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2">
                  {language === 'ko' ? '출처' : 'Sources'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {citations.slice(0, 5).map((url, index) => {
                    let domain = '';
                    try {
                      domain = new URL(url).hostname.replace('www.', '');
                    } catch {
                      domain = url;
                    }
                    return (
                      <a
                        key={index}
                        href={url}
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
