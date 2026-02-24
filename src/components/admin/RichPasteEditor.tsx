import { useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Paperclip } from 'lucide-react';

interface RichPasteEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  onImageUploaded?: (url: string) => void;
  allowFileUpload?: boolean;
}

export function RichPasteEditor({ value, onChange, placeholder, rows = 6, onImageUploaded, allowFileUpload = true }: RichPasteEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      toast.info(`파일 업로드 중: ${file.name}`);
      const ext = file.name?.split('.').pop() || 'bin';
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error } = await supabase.storage
        .from('viewpoint-images')
        .upload(fileName, file);

      if (error) {
        console.error('File upload error:', error);
        toast.error(`파일 업로드 실패: ${file.name}`);
        continue;
      }

      const { data: urlData } = supabase.storage
        .from('viewpoint-images')
        .getPublicUrl(fileName);

      const url = urlData.publicUrl;
      const isImage = file.type.startsWith('image/');
      const linkMarkdown = isImage
        ? `\n![${file.name}](${url})\n`
        : `\n[📎 ${file.name}](${url})\n`;

      const textarea = textareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const before = value.slice(0, start);
        const after = value.slice(end);
        onChange(before + linkMarkdown + after);
      } else {
        onChange(value + linkMarkdown);
      }
      onImageUploaded?.(url);
      toast.success(`파일이 삽입되었습니다: ${file.name}`);
    }

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [value, onChange, onImageUploaded]);

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
        {allowFileUpload && (
          <>
            <span>•</span>
            <label className="inline-flex items-center gap-1 cursor-pointer text-primary hover:underline">
              <Paperclip className="h-3 w-3" />
              <span>파일 첨부</span>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
          </>
        )}
      </div>
    </div>
  );
}

function htmlToMarkdown(html: string): string {
  let text = html;

  // Remove style/script tags and their content
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<!--[\s\S]*?-->/g, '');

  // Headers (handle multiline with [\s\S]*?)
  text = text.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n');
  text = text.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n');
  text = text.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n');
  text = text.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n');
  text = text.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '\n##### $1\n');
  text = text.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '\n###### $1\n');

  // Bold and italic
  text = text.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/(strong|b)>/gi, '**$2**');
  text = text.replace(/<(em|i)[^>]*>([\s\S]*?)<\/(em|i)>/gi, '*$2*');
  text = text.replace(/<u[^>]*>([\s\S]*?)<\/u>/gi, '$1');
  text = text.replace(/<s[^>]*>([\s\S]*?)<\/s>/gi, '~~$1~~');
  text = text.replace(/<del[^>]*>([\s\S]*?)<\/del>/gi, '~~$1~~');

  // Links
  text = text.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');

  // Images
  text = text.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)');
  text = text.replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, '![image]($1)');

  // Handle ordered lists: convert <ol><li> to numbered items
  text = text.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (match, inner) => {
    let counter = 0;
    return inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_: string, content: string) => {
      counter++;
      return `${counter}. ${content.trim()}\n`;
    }) + '\n';
  });

  // Handle unordered lists: convert <ul><li> to bullet items
  text = text.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (match: string, inner: string) => {
    return inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_: string, content: string) => {
      return `- ${content.trim()}\n`;
    }) + '\n';
  });

  // Remaining list items (standalone)
  text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');

  // Blockquote
  text = text.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, content) => {
    return content.trim().split('\n').map((line: string) => `> ${line}`).join('\n') + '\n';
  });

  // Code blocks
  text = text.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '\n```\n$1\n```\n');
  text = text.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');

  // Tables: basic conversion
  text = text.replace(/<tr[^>]*>([\s\S]*?)<\/tr>/gi, (_, row) => {
    const cells = row.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || [];
    return '| ' + cells.map((c: string) => c.replace(/<[^>]+>/g, '').trim()).join(' | ') + ' |\n';
  });

  // Horizontal rule
  text = text.replace(/<hr\s*\/?>/gi, '\n---\n');

  // Line breaks and paragraphs
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<p[^>]*>/gi, '');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<div[^>]*>/gi, '');

  // Remove remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)));
  text = text.replace(/&([a-z]+);/gi, (match) => {
    const el = document.createElement('span');
    el.innerHTML = match;
    return el.textContent || match;
  });

  // Clean up extra whitespace
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.replace(/[ \t]+$/gm, '');
  text = text.trim();

  return text;
}
