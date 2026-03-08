import { useState, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Brain, RefreshCw, AlertTriangle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { PortfolioItem, GroupData } from './portfolioTypes';

interface Props {
  items: PortfolioItem[];
  groups: GroupData[];
  onAnalysisChange?: (text: string) => void;
}

export function PortfolioAnalysis({ items, groups, onAnalysisChange }: Props) {
  const { language } = useLanguage();
  const { session } = useAuth();
  const ko = language === 'ko';
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    setAnalysis('');

    const portfolioData = items.map(item => ({
      name: item.name,
      group: item.groupId,
      type: item.assetType,
      ticker: item.ticker || null,
      currency: item.currency,
      weight: item.weight,
      basePrice: item.basePrice || null,
      currentPrice: item.currentPrice || null,
      targetAnnualReturn: item.targetAnnualReturn || null,
    }));

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-portfolio`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ portfolioData, language }),
        }
      );

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Error ${resp.status}`);
      }

      if (!resp.body) throw new Error('No response body');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              setAnalysis(fullText);
              onAnalysisChange?.(fullText);
            }
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [items, session, language]);

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base font-serif flex items-center gap-2">
            <Brain className="h-5 w-5 text-accent" />
            {ko ? 'AI 포트폴리오 분석' : 'AI Portfolio Analysis'}
          </CardTitle>
          <Button
            size="sm"
            variant={analysis ? 'outline' : 'default'}
            onClick={runAnalysis}
            disabled={loading || items.length === 0}
            className="gap-1.5 text-xs"
          >
            {loading ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Brain className="h-3.5 w-3.5" />
            )}
            {loading
              ? (ko ? '분석 중...' : 'Analyzing...')
              : analysis
                ? (ko ? '재분석' : 'Re-analyze')
                : (ko ? '분석 시작' : 'Run Analysis')}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">
          {ko
            ? 'AI가 현재 포트폴리오의 리스크/리턴을 종합 분석합니다.'
            : 'AI analyzes the overall risk/return profile of the current portfolio.'}
        </p>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3 mb-3">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {loading && !analysis && (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        )}

        {analysis && (
          <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed">
            <ReactMarkdown>{analysis}</ReactMarkdown>
          </div>
        )}

        {!loading && !analysis && !error && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <Brain className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p>{ko ? '분석 시작 버튼을 클릭하세요' : 'Click "Run Analysis" to begin'}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
