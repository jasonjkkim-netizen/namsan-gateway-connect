import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/Header';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, User, TrendingUp, LayoutDashboard, Package, FileText, PlayCircle, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  const { language, t } = useLanguage();
  const navigate = useNavigate();
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
    if (language === 'ko') {
      return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
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
            {language === 'ko' ? '남산 파트너스의 인사이트와 소식' : 'Insights and news from Namsan Partners'}
          </p>
        </div>

        {/* Section Navigation Buttons */}
        <div className="mb-8 animate-fade-in" style={{ animationDelay: '50ms' }}>
          <p className="text-sm text-muted-foreground mb-3">
            {language === 'ko' ? '섹션으로 이동' : 'Navigate to section'}
          </p>
          <div className="flex flex-wrap gap-3">
            {[
              { path: '/market-data', label: t('marketData'), icon: TrendingUp },
              { path: '/dashboard', label: t('dashboard'), icon: LayoutDashboard },
              { path: '/products', label: t('products'), icon: Package },
              { path: '/research', label: t('research'), icon: FileText },
              { path: '/blog', label: language === 'ko' ? '블로그' : 'Blog', icon: BookOpen, active: true },
              { path: '/videos', label: t('videos'), icon: PlayCircle },
            ].map((section) => (
              <Button
                key={section.path}
                variant={section.active ? "default" : "outline"}
                onClick={() => !section.active && navigate(section.path)}
                className={`flex items-center gap-2 ${section.active ? 'pointer-events-none' : ''}`}
              >
                <section.icon className="h-4 w-4" />
                {section.label}
              </Button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : posts && posts.length > 0 ? (
          <div className="card-elevated overflow-hidden animate-fade-in">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px] text-center">#</TableHead>
                  <TableHead>{language === 'ko' ? '제목' : 'Title'}</TableHead>
                  <TableHead className="hidden md:table-cell">{language === 'ko' ? '작성자' : 'Author'}</TableHead>
                  <TableHead>{language === 'ko' ? '게시일' : 'Published'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posts.map((post, i) => (
                  <TableRow
                    key={post.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setSelectedPost(post)}
                  >
                    <TableCell className="text-center text-muted-foreground text-sm font-medium">
                      {i + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {post.thumbnail_url && (
                          <img
                            src={post.thumbnail_url}
                            alt=""
                            className="h-8 w-12 object-cover rounded flex-shrink-0"
                          />
                        )}
                        <div className="min-w-0">
                          <div className="font-medium truncate">
                            {language === 'ko' ? post.title_ko : post.title_en}
                          </div>
                          {(language === 'ko' ? post.summary_ko : post.summary_en) && (
                            <div className="text-xs text-muted-foreground truncate">
                              {language === 'ko' ? post.summary_ko : post.summary_en}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {post.author}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(post.published_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
                className="w-full h-auto max-h-[150px] object-cover"
              />
            </div>
          )}
          {selectedPost && (
            <div className="prose prose-sm dark:prose-invert max-w-none [&_img]:max-w-[50%] [&_img]:h-auto [&_img]:rounded-md">
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