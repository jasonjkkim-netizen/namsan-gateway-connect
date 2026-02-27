import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquareQuote } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export function CIOCommentary() {
  const { language } = useLanguage();
  const ko = language === 'ko';
  const [comment, setComment] = useState<{ content_ko: string; content_en: string; updated_at: string } | null>(null);

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('app_settings')
        .select('value, updated_at')
        .eq('key', 'cio_commentary')
        .maybeSingle();
      if (data?.value) {
        const val = data.value as any;
        setComment({
          content_ko: val.content_ko || '',
          content_en: val.content_en || '',
          updated_at: data.updated_at,
        });
      }
    }
    fetch();
  }, []);

  if (!comment || (!comment.content_ko && !comment.content_en)) return null;

  const content = ko ? comment.content_ko : comment.content_en;
  if (!content) return null;

  const date = new Date(comment.updated_at);
  const dateStr = ko
    ? `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`
    : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <Card className="border-accent/30 bg-accent/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-serif flex items-center gap-2">
          <MessageSquareQuote className="h-5 w-5 text-accent" />
          {ko ? 'CIO 코멘트' : 'CIO Commentary'}
        </CardTitle>
        <p className="text-[10px] text-muted-foreground">{dateStr}</p>
      </CardHeader>
      <CardContent>
        <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed italic
          [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2
          [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2
          [&_li]:my-0.5
          [&_blockquote]:border-l-4 [&_blockquote]:border-accent/50 [&_blockquote]:pl-4 [&_blockquote]:py-1 [&_blockquote]:my-2 [&_blockquote]:text-muted-foreground [&_blockquote]:not-italic">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      </CardContent>
    </Card>
  );
}
