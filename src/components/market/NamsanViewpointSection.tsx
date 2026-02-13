import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Eye } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Viewpoint {
  id: string;
  title_ko: string;
  title_en: string;
  content_ko: string;
  content_en: string;
  image_url: string | null;
  created_at: string;
}

interface NamsanViewpointSectionProps {
  language: string;
}

export function NamsanViewpointSection({ language }: NamsanViewpointSectionProps) {
  const [viewpoints, setViewpoints] = useState<Viewpoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('namsan_viewpoints')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true })
        .limit(1);
      if (data) setViewpoints(data as Viewpoint[]);
      setLoading(false);
    }
    fetch();
  }, []);

  if (loading) {
    return (
      <div className="mb-8 card-elevated overflow-hidden animate-fade-in">
        <div className="p-3 border-b border-border flex items-center gap-2">
          <Eye className="h-4 w-4 text-primary" />
          <h3 className="font-serif font-medium text-sm">
            {language === 'ko' ? '남산 뷰 포인트' : 'Namsan View Point'}
          </h3>
        </div>
        <div className="h-[100px] flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  if (viewpoints.length === 0) return null;

  return (
    <div className="mb-8 animate-fade-in">
      <div className="mb-4 flex items-center gap-2">
        <Eye className="h-5 w-5 text-primary" />
        <h3 className="font-serif font-semibold text-lg">
          {language === 'ko' ? '남산 뷰 포인트' : 'Namsan View Point'}
        </h3>
      </div>

      <div className="space-y-4">
        {viewpoints.map((vp) => (
          <div key={vp.id} className="card-elevated overflow-hidden">
            <div className="p-4">
              <h4 className="font-serif font-semibold text-base mb-3">
                {language === 'ko' ? vp.title_ko : vp.title_en}
              </h4>

              <div className={`flex gap-4 ${vp.image_url ? 'flex-col sm:flex-row' : ''}`}>
                {vp.image_url && (
                  <div className="flex-shrink-0 rounded-lg overflow-hidden sm:w-20 md:w-24">
                    <img
                      src={vp.image_url}
                      alt={language === 'ko' ? vp.title_ko : vp.title_en}
                      className="w-full h-auto max-h-16 sm:max-h-14 object-cover"
                      loading="lazy"
                    />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed [&_img]:max-w-[50%] [&_img]:h-auto [&_img]:rounded-md">
                    <ReactMarkdown>
                      {language === 'ko' ? vp.content_ko : vp.content_en}
                    </ReactMarkdown>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    {new Date(vp.created_at).toLocaleDateString(
                      language === 'ko' ? 'ko-KR' : 'en-US',
                      { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
