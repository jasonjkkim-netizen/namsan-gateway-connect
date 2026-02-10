import { useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface RichPasteEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  onImageUploaded?: (url: string) => void;
}

export function RichPasteEditor({ value, onChange, placeholder, rows = 6, onImageUploaded }: RichPasteEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const uploadImage = useCallback(async (file: File): Promise<string | null> => {
    try {
      const ext = file.name?.split('.').pop() || 'png';
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error } = await supabase.storage
        .from('viewpoint-images')
        .upload(fileName, file);

      if (error) {
        console.error('Upload error:', error);
        toast.error('이미지 업로드 실패');
        return null;
      }

      const { data: urlData } = supabase.storage
        .from('viewpoint-images')
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (err) {
      console.error('Upload error:', err);
      return null;
    }
  }, []);

  const handlePaste = useCallback(async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const clipboardData = e.clipboardData;
    
    // Check for pasted images
    const imageItems = Array.from(clipboardData.items).filter(item => item.type.startsWith('image/'));
    
    if (imageItems.length > 0) {
      e.preventDefault();
      
      for (const item of imageItems) {
        const file = item.getAsFile();
        if (!file) continue;

        toast.info('이미지 업로드 중...');
        const url = await uploadImage(file);
        if (url) {
          // Insert markdown image at cursor position
          const textarea = textareaRef.current;
          if (textarea) {
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const before = value.slice(0, start);
            const after = value.slice(end);
            const imageMarkdown = `\n![image](${url})\n`;
            onChange(before + imageMarkdown + after);
          } else {
            onChange(value + `\n![image](${url})\n`);
          }
          onImageUploaded?.(url);
          toast.success('이미지가 삽입되었습니다');
        }
      }
      return;
    }

    // Check for HTML content (formatted text from web pages, docs, etc.)
    const htmlContent = clipboardData.getData('text/html');
    if (htmlContent) {
      e.preventDefault();
      const markdown = htmlToMarkdown(htmlContent);
      
      const textarea = textareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const before = value.slice(0, start);
        const after = value.slice(end);
        onChange(before + markdown + after);
      } else {
        onChange(value + markdown);
      }
      return;
    }
    // Plain text paste is handled naturally by the textarea
  }, [value, onChange, uploadImage, onImageUploaded]);

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        onPaste={handlePaste}
        placeholder={placeholder}
        rows={rows}
        className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      />
      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
        <span>📋 텍스트/이미지 붙여넣기 지원</span>
        <span>•</span>
        <span>Markdown 지원</span>
      </div>
    </div>
  );
}

function htmlToMarkdown(html: string): string {
  // Simple HTML to Markdown conversion
  let text = html;

  // Remove style/script tags and their content
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

  // Headers
  text = text.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n');
  text = text.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n');
  text = text.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n');
  text = text.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n');

  // Bold and italic
  text = text.replace(/<(strong|b)[^>]*>(.*?)<\/(strong|b)>/gi, '**$2**');
  text = text.replace(/<(em|i)[^>]*>(.*?)<\/(em|i)>/gi, '*$2*');

  // Links
  text = text.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');

  // Images
  text = text.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)');
  text = text.replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, '![image]($1)');

  // List items
  text = text.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');

  // Line breaks and paragraphs
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<p[^>]*>/gi, '');

  // Remove remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&nbsp;/g, ' ');

  // Clean up extra whitespace
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.trim();

  return text;
}
