import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { TrendingUp, LayoutDashboard, Package, FileText, PlayCircle, BookOpen, Newspaper, MessageSquare, Plus, Send, Lock, Globe, CheckCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface BoardPost {
  id: string;
  user_id: string;
  category: string;
  title: string;
  content: string;
  is_public: boolean;
  is_resolved: boolean;
  created_at: string;
  updated_at: string;
  author_name?: string;
}

interface BoardComment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  is_admin_reply: boolean;
  is_public: boolean;
  created_at: string;
  author_name?: string;
}

const CATEGORIES = [
  { value: 'product', ko: '상품 문의', en: 'Product Inquiry' },
  { value: 'market', ko: '시장 문의', en: 'Market Inquiry' },
  { value: 'blog', ko: '블로그 문의', en: 'Blog Inquiry' },
  { value: 'website', ko: '웹사이트 문의', en: 'Website Inquiry' },
  { value: 'other', ko: '기타 문의', en: 'Other' },
];

export default function Board() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [posts, setPosts] = useState<BoardPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedPost, setSelectedPost] = useState<BoardPost | null>(null);
  const [comments, setComments] = useState<BoardComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);

  // New post form
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState('other');
  const [newIsPublic, setNewIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);

  // New comment
  const [commentText, setCommentText] = useState('');
  const [commentIsPublic, setCommentIsPublic] = useState(true);
  const [commentSaving, setCommentSaving] = useState(false);

  const [isAdmin, setIsAdmin] = useState(false);

  const sections = [
    { path: '/market-data', label: language === 'ko' ? '시장 데이터' : 'Market Data', icon: TrendingUp },
    { path: '/news', label: language === 'ko' ? '뉴스' : 'News', icon: Newspaper },
    { path: '/dashboard', label: language === 'ko' ? '대시보드' : 'Dashboard', icon: LayoutDashboard },
    { path: '/products', label: language === 'ko' ? '상품' : 'Products', icon: Package },
    { path: '/research', label: language === 'ko' ? '리서치' : 'Research', icon: FileText },
    { path: '/blog', label: language === 'ko' ? '블로그' : 'Blog', icon: BookOpen },
    { path: '/videos', label: language === 'ko' ? '영상' : 'Videos', icon: PlayCircle },
    { path: '/board', label: language === 'ko' ? '고객의 소리' : 'Voice', icon: MessageSquare, active: true },
  ];

  useEffect(() => {
    if (!user) return;
    checkAdmin();
    fetchPosts();
  }, [user]);

  async function checkAdmin() {
    if (!user) return;
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();
    setIsAdmin(!!data);
  }

  async function fetchPosts() {
    setLoading(true);
    const { data, error } = await supabase
      .from('board_posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) {
      // Fetch author names
      const userIds = [...new Set(data.map((p: any) => p.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, full_name_ko')
        .in('user_id', userIds);

      const profileMap = new Map(
        (profiles || []).map((p: any) => [p.user_id, p.full_name_ko || p.full_name])
      );

      setPosts(data.map((p: any) => ({
        ...p,
        author_name: profileMap.get(p.user_id) || (language === 'ko' ? '알 수 없음' : 'Unknown'),
      })));
    }
    setLoading(false);
  }

  async function fetchComments(postId: string) {
    setCommentsLoading(true);
    const { data } = await supabase
      .from('board_comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (data) {
      const userIds = [...new Set(data.map((c: any) => c.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, full_name_ko')
        .in('user_id', userIds);

      const profileMap = new Map(
        (profiles || []).map((p: any) => [p.user_id, p.full_name_ko || p.full_name])
      );

      setComments(data.map((c: any) => ({
        ...c,
        author_name: profileMap.get(c.user_id) || (language === 'ko' ? '알 수 없음' : 'Unknown'),
      })));
    }
    setCommentsLoading(false);
  }

  async function handleCreatePost() {
    if (saving || !user) return;
    if (!newTitle.trim() || !newContent.trim()) {
      toast.error(language === 'ko' ? '제목과 내용을 입력해주세요' : 'Title and content are required');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('board_posts').insert({
        user_id: user.id,
        title: newTitle.trim(),
        content: newContent.trim(),
        category: newCategory,
        is_public: newIsPublic,
      });
      if (error) throw error;
      toast.success(language === 'ko' ? '게시글이 등록되었습니다' : 'Post created');
      setDialogOpen(false);
      setNewTitle('');
      setNewContent('');
      setNewCategory('other');
      setNewIsPublic(true);
      fetchPosts();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddComment() {
    if (commentSaving || !user || !selectedPost) return;
    if (!commentText.trim()) return;
    setCommentSaving(true);
    try {
      const { error } = await supabase.from('board_comments').insert({
        post_id: selectedPost.id,
        user_id: user.id,
        content: commentText.trim(),
        is_admin_reply: isAdmin,
        is_public: commentIsPublic,
      });
      if (error) throw error;
      setCommentText('');
      setCommentIsPublic(true);
      fetchComments(selectedPost.id);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCommentSaving(false);
    }
  }

  function openPost(post: BoardPost) {
    setSelectedPost(post);
    fetchComments(post.id);
  }

  const getCategoryLabel = (value: string) => {
    const cat = CATEGORIES.find(c => c.value === value);
    return cat ? (language === 'ko' ? cat.ko : cat.en) : value;
  };

  const getCategoryColor = (value: string) => {
    switch (value) {
      case 'product': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'market': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'blog': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'website': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const filteredPosts = filter === 'all' ? posts : posts.filter(p => p.category === filter);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8 px-3 sm:px-4">
        <div className="mb-8 animate-fade-in">
          <h1 className="text-2xl sm:text-3xl font-serif font-semibold text-foreground">
            {language === 'ko' ? '고객의 소리' : 'Voice of Customer'}
          </h1>
          <p className="mt-1 text-sm sm:text-base text-muted-foreground">
            {language === 'ko' ? '문의사항이나 의견을 자유롭게 남겨주세요' : 'Feel free to leave your inquiries or feedback'}
          </p>
        </div>

        {/* Section Navigation */}
        <div className="mb-8 animate-fade-in" style={{ animationDelay: '50ms' }}>
          <p className="text-sm text-muted-foreground mb-3">
            {language === 'ko' ? '섹션으로 이동' : 'Navigate to section'}
          </p>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            {sections.map((section) => (
              <Button
                key={section.path}
                variant={section.active ? "default" : "outline"}
                size="sm"
                onClick={() => !section.active && navigate(section.path)}
                className={`flex items-center gap-1.5 ${section.active ? 'pointer-events-none' : ''}`}
              >
                <section.icon className="h-3.5 w-3.5" />
                {section.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Controls row */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              {language === 'ko' ? '전체' : 'All'}
            </Button>
            {CATEGORIES.map((cat) => (
              <Button
                key={cat.value}
                variant={filter === cat.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter(cat.value)}
              >
                {language === 'ko' ? cat.ko : cat.en}
              </Button>
            ))}
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                {language === 'ko' ? '새 글 작성' : 'New Post'}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{language === 'ko' ? '새 글 작성' : 'Create New Post'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>{language === 'ko' ? '분류' : 'Category'}</Label>
                  <Select value={newCategory} onValueChange={setNewCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => (
                        <SelectItem key={c.value} value={c.value}>
                          {language === 'ko' ? c.ko : c.en}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{language === 'ko' ? '제목' : 'Title'}</Label>
                  <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} maxLength={200} />
                </div>
                <div>
                  <Label>{language === 'ko' ? '내용' : 'Content'}</Label>
                  <Textarea value={newContent} onChange={e => setNewContent(e.target.value)} rows={5} maxLength={5000} />
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={newIsPublic} onCheckedChange={setNewIsPublic} />
                  <Label className="flex items-center gap-1.5">
                    {newIsPublic ? <Globe className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                    {newIsPublic
                      ? (language === 'ko' ? '공개' : 'Public')
                      : (language === 'ko' ? '비공개 (관리자만 열람)' : 'Private (Admin only)')
                    }
                  </Label>
                </div>
                <Button onClick={handleCreatePost} disabled={saving} className="w-full">
                  {saving ? (language === 'ko' ? '등록 중...' : 'Submitting...') : (language === 'ko' ? '등록' : 'Submit')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Post detail view */}
        {selectedPost ? (
          <div className="animate-fade-in">
            <Button variant="outline" size="sm" onClick={() => setSelectedPost(null)} className="mb-4">
              ← {language === 'ko' ? '목록으로' : 'Back to list'}
            </Button>

            <Card className="mb-6">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <Badge className={getCategoryColor(selectedPost.category)}>
                    {getCategoryLabel(selectedPost.category)}
                  </Badge>
                  {!selectedPost.is_public && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Lock className="h-3 w-3" /> {language === 'ko' ? '비공개' : 'Private'}
                    </Badge>
                  )}
                  {selectedPost.is_resolved && (
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" /> {language === 'ko' ? '답변완료' : 'Resolved'}
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-lg sm:text-xl">{selectedPost.title}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {selectedPost.author_name} · {format(new Date(selectedPost.created_at), 'yyyy-MM-dd HH:mm')}
                </p>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm sm:text-base">{selectedPost.content}</p>
              </CardContent>
            </Card>

            {/* Comments */}
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              {language === 'ko' ? '댓글' : 'Comments'} ({comments.length})
            </h3>

            {commentsLoading ? (
              <div className="space-y-3">
                {[1, 2].map(i => <Skeleton key={i} className="h-20 w-full" />)}
              </div>
            ) : (
              <div className="space-y-3 mb-6">
                {comments.map(c => (
                  <Card key={c.id} className={c.is_admin_reply ? 'border-primary/30 bg-primary/5' : ''}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium">{c.author_name}</span>
                        {c.is_admin_reply && (
                          <Badge variant="default" className="text-[10px] px-1.5 py-0">
                            {language === 'ko' ? '관리자' : 'Admin'}
                          </Badge>
                        )}
                        {!c.is_public && (
                          <Lock className="h-3 w-3 text-muted-foreground" />
                        )}
                        <span className="text-xs text-muted-foreground ml-auto">
                          {format(new Date(c.created_at), 'yyyy-MM-dd HH:mm')}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{c.content}</p>
                    </CardContent>
                  </Card>
                ))}
                {comments.length === 0 && (
                  <p className="text-muted-foreground text-sm text-center py-6">
                    {language === 'ko' ? '아직 댓글이 없습니다' : 'No comments yet'}
                  </p>
                )}
              </div>
            )}

            {/* Add comment */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <Textarea
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  placeholder={language === 'ko' ? '댓글을 입력해주세요...' : 'Write a comment...'}
                  rows={3}
                  maxLength={2000}
                />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch checked={commentIsPublic} onCheckedChange={setCommentIsPublic} />
                    <Label className="text-sm flex items-center gap-1">
                      {commentIsPublic ? <Globe className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                      {commentIsPublic ? (language === 'ko' ? '공개' : 'Public') : (language === 'ko' ? '비공개' : 'Private')}
                    </Label>
                  </div>
                  <Button onClick={handleAddComment} disabled={commentSaving || !commentText.trim()} size="sm" className="flex items-center gap-2">
                    <Send className="h-3.5 w-3.5" />
                    {commentSaving ? (language === 'ko' ? '등록 중...' : 'Posting...') : (language === 'ko' ? '댓글 등록' : 'Post')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          /* Post list */
          <div className="space-y-3">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)
            ) : filteredPosts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {language === 'ko' ? '게시글이 없습니다' : 'No posts yet'}
              </div>
            ) : (
              filteredPosts.map((post, index) => (
                <Card
                  key={post.id}
                  className="cursor-pointer hover:shadow-md transition-shadow animate-fade-in"
                  style={{ animationDelay: `${index * 30}ms` }}
                  onClick={() => openPost(post)}
                >
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <Badge className={`${getCategoryColor(post.category)} text-[10px]`}>
                        {getCategoryLabel(post.category)}
                      </Badge>
                      {!post.is_public && (
                        <Lock className="h-3 w-3 text-muted-foreground" />
                      )}
                      {post.is_resolved ? (
                        <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <Clock className="h-3.5 w-3.5 text-amber-500" />
                      )}
                    </div>
                    <h3 className="font-medium text-sm sm:text-base line-clamp-1">{post.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {post.author_name} · {format(new Date(post.created_at), 'yyyy-MM-dd HH:mm')}
                    </p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
