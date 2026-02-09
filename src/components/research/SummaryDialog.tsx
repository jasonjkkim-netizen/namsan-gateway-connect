import { useState, useCallback } from 'react';
import { Bot, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLanguage } from '@/contexts/LanguageContext';
import ReactMarkdown from 'react-markdown';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Report {
  id: string;
  title_en: string;
  title_ko: string;
  category: string;
  summary_en: string | null;
  summary_ko: string | null;
}

interface SummaryDialogProps {
  report: Report | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SUMMARIZE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/summarize-report`;

export function SummaryDialog({ report, open, onOpenChange }: SummaryDialogProps) {
  const { language, t } = useLanguage();
  const [summary, setSummary] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const streamSummary = useCallback(async () => {
    if (!report) return;
    
    setIsLoading(true);
    setHasStarted(true);
    setSummary('');

    try {
      // Get user session for JWT authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error(language === 'ko' ? '로그인이 필요합니다' : 'Authentication required');
      }

      const resp = await fetch(SUMMARIZE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          title: language === 'ko' ? report.title_ko : report.title_en,
          summary: language === 'ko' ? report.summary_ko : report.summary_en,
          category: report.category,
          language,
        }),
      });

      if (!resp.ok) {
        const error = await resp.json().catch(() => ({ error: 'Request failed' }));
        if (resp.status === 401) {
          throw new Error(language === 'ko' ? '인증이 만료되었습니다. 다시 로그인해주세요.' : 'Session expired. Please log in again.');
        }
        if (resp.status === 429) {
          throw new Error(language === 'ko' ? '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' : 'Too many requests. Please try again later.');
        }
        if (resp.status === 402) {
          throw new Error(language === 'ko' ? '서비스 크레딧이 부족합니다.' : 'Service credits exhausted.');
        }
        throw new Error(error.error || 'Failed to get summary');
      }

      if (!resp.body) throw new Error('No response body');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let content = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              content += delta;
              setSummary(content);
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }
    } catch (error) {
      console.error('Summary error:', error);
      setSummary(
        language === 'ko'
          ? '요약을 생성하는 중 오류가 발생했습니다. 다시 시도해 주세요.'
          : 'An error occurred while generating the summary. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [report, language]);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setSummary('');
      setHasStarted(false);
    }
    onOpenChange(isOpen);
  };

  if (!report) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-serif">
            <Sparkles className="h-5 w-5 text-accent" />
            {language === 'ko' ? 'AI 리포트 분석' : 'AI Report Analysis'}
          </DialogTitle>
        </DialogHeader>

        <div className="mb-4 p-3 bg-muted/50 rounded-lg">
          <h4 className="font-medium text-sm">
            {language === 'ko' ? report.title_ko : report.title_en}
          </h4>
        </div>

        {!hasStarted ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="h-16 w-16 rounded-full bg-accent/10 flex items-center justify-center">
              <Bot className="h-8 w-8 text-accent" />
            </div>
            <p className="text-center text-muted-foreground text-sm max-w-xs">
              {language === 'ko'
                ? 'AI가 이 연구 보고서의 주요 인사이트를 분석하고 요약합니다.'
                : 'AI will analyze and summarize the key insights from this research report.'}
            </p>
            <Button onClick={streamSummary} className="btn-gold">
              <Sparkles className="h-4 w-4 mr-2" />
              {language === 'ko' ? '분석 시작' : 'Start Analysis'}
            </Button>
          </div>
        ) : (
          <ScrollArea className="flex-1 min-h-0 h-[400px]">
            <div className="prose prose-sm dark:prose-invert max-w-none px-1 pb-4">
              {isLoading && !summary ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 bg-accent rounded-full animate-bounce" />
                    <span className="h-2 w-2 bg-accent rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="h-2 w-2 bg-accent rounded-full animate-bounce [animation-delay:300ms]" />
                  </div>
                  <span className="text-sm">
                    {language === 'ko' ? '분석 중...' : 'Analyzing...'}
                  </span>
                </div>
              ) : (
                <ReactMarkdown>{summary}</ReactMarkdown>
              )}
            </div>
          </ScrollArea>
        )}

        {hasStarted && !isLoading && summary && (
          <div className="pt-4 border-t flex justify-between items-center">
            <p className="text-xs text-muted-foreground">
              {language === 'ko'
                ? 'AI 분석은 참고용이며, 투자 조언이 아닙니다.'
                : 'AI analysis is for reference only, not investment advice.'}
            </p>
            <Button variant="outline" size="sm" onClick={streamSummary}>
              {language === 'ko' ? '다시 분석' : 'Reanalyze'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
