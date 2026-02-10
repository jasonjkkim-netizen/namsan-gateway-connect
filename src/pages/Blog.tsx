import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/Header';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, User, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import ReactMarkdown from 'react-markdown';

interface BlogPost {
  id: string;
  title_ko: string;
  title_en: string;
  content_ko: string;
  content_en: string;
  summary_ko: string | null;
  summary_en: string | null;
  thumbnail_url: string | null;
  author: string;
  is_active: boolean;
  published_at: string;
}

export default function Blog() {
  const { language } = useLanguage();
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);

  const { data: posts, isLoading } = useQuery({
    queryKey: ['blog-posts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('is_active', true)
        .order('published_at', { ascending: false });
      if (error) throw error;
      return data as BlogPost[];
    },
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return language === 'ko'
      ? `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`
      : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl font-serif font-semibold text-foreground">
            {language === 'ko' ? '남산 블로그' : 'Namsan Blog'}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {language === 'ko' ? '남산 캐피탈의 인사이트와 소식' : 'Insights and news from Namsan Capital'}
          </p>
        </div>

        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card-elevated overflow-hidden">
                <Skeleton className="h-48 w-full" />
                <div className="p-4 space-y-3">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : posts && posts.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post, i) => (
              <div
                key={post.id}
                className="card-elevated overflow-hidden animate-fade-in cursor-pointer group hover:shadow-lg transition-all duration-300"
                style={{ animationDelay: `${i * 50}ms` }}
                onClick={() => setSelectedPost(post)}
              >
                {post.thumbnail_url && (
                  <div className="h-48 overflow-hidden">
                    <img
                      src={post.thumbnail_url}
                      alt={language === 'ko' ? post.title_ko : post.title_en}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                )}
                <div className="p-4">
                  <h3 className="font-serif font-semibold text-lg mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                    {language === 'ko' ? post.title_ko : post.title_en}
                  </h3>
                  {(language === 'ko' ? post.summary_ko : post.summary_en) && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-3">
                      {language === 'ko' ? post.summary_ko : post.summary_en}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(post.published_at)}
                    </div>
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {post.author}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-1 text-xs text-primary font-medium">
                    {language === 'ko' ? '자세히 보기' : 'Read more'}
                    <ArrowRight className="h-3 w-3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            {language === 'ko' ? '아직 블로그 글이 없습니다.' : 'No blog posts yet.'}
          </div>
        )}
      </main>

      {/* Blog Post Detail Dialog */}
      <Dialog open={!!selectedPost} onOpenChange={(open) => !open && setSelectedPost(null)}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-serif">
              {selectedPost && (language === 'ko' ? selectedPost.title_ko : selectedPost.title_en)}
            </DialogTitle>
            {selectedPost && (
              <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(selectedPost.published_at)}
                </span>
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {selectedPost.author}
                </span>
              </div>
            )}
          </DialogHeader>
          {selectedPost && selectedPost.thumbnail_url && (
            <div className="rounded-lg overflow-hidden my-2">
              <img
                src={selectedPost.thumbnail_url}
                alt=""
                className="w-full h-auto max-h-[300px] object-cover"
              />
            </div>
          )}
          {selectedPost && (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>
                {language === 'ko' ? selectedPost.content_ko : selectedPost.content_en}
              </ReactMarkdown>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
