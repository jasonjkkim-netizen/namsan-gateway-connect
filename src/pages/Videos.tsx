import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Play, ExternalLink, TrendingUp, LayoutDashboard, Package, FileText, PlayCircle, BookOpen, Newspaper } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Video {
  id: string;
  title_en: string;
  title_ko: string;
  youtube_url: string;
  thumbnail_url: string | null;
  category: string;
  description_en: string | null;
  description_ko: string | null;
}

function getYoutubeThumbnail(url: string): string {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  const videoId = match && match[2].length === 11 ? match[2] : null;
  return videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : '';
}

function getYoutubeEmbedUrl(url: string): string {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  const videoId = match && match[2].length === 11 ? match[2] : null;
  return videoId ? `https://www.youtube.com/embed/${videoId}` : '';
}

export default function Videos() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);

  const sections = [
    { path: '/market-data', label: t('marketData'), icon: TrendingUp },
    { path: '/news', label: language === 'ko' ? '뉴스' : 'News', icon: Newspaper },
    { path: '/dashboard', label: t('dashboard'), icon: LayoutDashboard },
    { path: '/products', label: t('products'), icon: Package },
    { path: '/research', label: t('research'), icon: FileText },
    { path: '/blog', label: language === 'ko' ? '블로그' : 'Blog', icon: BookOpen },
    { path: '/videos', label: t('videos'), icon: PlayCircle, active: true },
  ];

  useEffect(() => {
    async function fetchVideos() {
      const { data } = await supabase
        .from('videos')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (data) setVideos(data as Video[]);
      setLoading(false);
    }

    fetchVideos();
  }, []);

  const categories = [
    { value: 'all', label: t('all') },
    { value: 'market_commentary', label: t('marketCommentary') },
    { value: 'product_explanation', label: t('productExplanation') },
    { value: 'educational', label: t('educational') },
  ];

  const filteredVideos = filter === 'all' 
    ? videos 
    : videos.filter(v => v.category === filter);

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'market_commentary': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'product_explanation': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'educational': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getCategoryKey = (category: string): string => {
    switch (category) {
      case 'market_commentary': return 'marketCommentary';
      case 'product_explanation': return 'productExplanation';
      case 'educational': return 'educational';
      default: return category;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl font-serif font-semibold text-foreground">{t('videoLibrary')}</h1>
          <p className="mt-1 text-muted-foreground">
            {language === 'ko' ? '투자 교육 및 시장 인사이트 영상' : 'Investment education and market insights videos'}
          </p>
        </div>

        {/* Section Navigation Buttons */}
        <div className="mb-8 animate-fade-in" style={{ animationDelay: '50ms' }}>
          <p className="text-sm text-muted-foreground mb-3">
            {language === 'ko' ? '섹션으로 이동' : 'Navigate to section'}
          </p>
          <div className="flex flex-wrap gap-3">
            {sections.map((section) => (
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

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2 mb-8 animate-fade-in" style={{ animationDelay: '100ms' }}>
          {categories.map((cat) => (
            <Button
              key={cat.value}
              variant={filter === cat.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(cat.value)}
              className={filter === cat.value ? '' : 'hover:bg-muted'}
            >
              {cat.label}
            </Button>
          ))}
        </div>

        {/* Video Modal */}
        {selectedVideo && (
          <div 
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedVideo(null)}
          >
            <div 
              className="bg-card rounded-lg overflow-hidden max-w-4xl w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="aspect-video">
                <iframe
                  src={getYoutubeEmbedUrl(selectedVideo.youtube_url)}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <div className="p-4">
                <h3 className="text-lg font-serif font-semibold">
                  {language === 'ko' ? selectedVideo.title_ko : selectedVideo.title_en}
                </h3>
                <p className="text-sm text-muted-foreground mt-2">
                  {language === 'ko' ? selectedVideo.description_ko : selectedVideo.description_en}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card-elevated overflow-hidden">
                <Skeleton className="aspect-video w-full" />
                <div className="p-4">
                  <Skeleton className="h-5 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            ))
          ) : filteredVideos.length === 0 ? (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              {t('noData')}
            </div>
          ) : (
            filteredVideos.map((video, index) => (
              <div 
                key={video.id} 
                className="card-elevated overflow-hidden group animate-fade-in cursor-pointer hover:shadow-lg transition-all duration-300"
                style={{ animationDelay: `${index * 50}ms` }}
                onClick={() => setSelectedVideo(video)}
              >
                <div className="relative aspect-video overflow-hidden">
                  <img 
                    src={video.thumbnail_url || getYoutubeThumbnail(video.youtube_url)}
                    alt={language === 'ko' ? video.title_ko : video.title_en}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/placeholder.svg';
                    }}
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="rounded-full bg-accent p-4 shadow-gold animate-pulse-gold">
                      <Play className="h-8 w-8 text-accent-foreground fill-current" />
                    </div>
                  </div>
                </div>
                
                <div className="p-4">
                  <Badge className={`${getCategoryColor(video.category)} mb-2`}>
                    {t(getCategoryKey(video.category))}
                  </Badge>
                  
                  <h3 className="font-serif font-semibold mb-2 line-clamp-2">
                    {language === 'ko' ? video.title_ko : video.title_en}
                  </h3>
                  
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {language === 'ko' ? video.description_ko : video.description_en}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
