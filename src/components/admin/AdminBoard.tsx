import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { CheckCircle, Clock, Lock, Globe, Send, Trash2, MessageSquare } from 'lucide-react';

interface BoardPost {
  id: string;
  user_id: string;
  category: string;
  title: string;
  content: string;
  is_public: boolean;
  is_resolved: boolean;
  created_at: string;
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
  { value: 'product', ko: '상품 문의', en: 'Product' },
  { value: 'market', ko: '시장 문의', en: 'Market' },
  { value: 'blog', ko: '블로그 문의', en: 'Blog' },
  { value: 'website', ko: '웹사이트 문의', en: 'Website' },
  { value: 'other', ko: '기타 문의', en: 'Other' },
];

export function AdminBoard() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [posts, setPosts] = useState<BoardPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedPost, setSelectedPost] = useState<BoardPost | null>(null);
  const [comments, setComments] = useState<BoardComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyIsPublic, setReplyIsPublic] = useState(true);
  const [replySaving, setReplySaving] = useState(false);

  useEffect(() => { fetchPosts(); }, []);

  async function fetchPosts() {
    setLoading(true);
    const { data } = await supabase
      .from('board_posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) {
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
        author_name: profileMap.get(p.user_id) || 'Unknown',
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
        author_name: profileMap.get(c.user_id) || 'Unknown',
      })));
    }
    setCommentsLoading(false);
  }

  async function handleReply() {
    if (replySaving || !user || !selectedPost || !replyText.trim()) return;
    setReplySaving(true);
    try {
      const { error } = await supabase.from('board_comments').insert({
        post_id: selectedPost.id,
        user_id: user.id,
        content: replyText.trim(),
        is_admin_reply: true,
        is_public: replyIsPublic,
      });
      if (error) throw error;
      setReplyText('');
      setReplyIsPublic(true);
      fetchComments(selectedPost.id);
      toast.success(language === 'ko' ? '답변이 등록되었습니다' : 'Reply posted');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setReplySaving(false);
    }
  }

  async function toggleResolved(post: BoardPost) {
    const { error } = await supabase
      .from('board_posts')
      .update({ is_resolved: !post.is_resolved })
      .eq('id', post.id);
    if (!error) {
      fetchPosts();
      if (selectedPost?.id === post.id) {
        setSelectedPost({ ...post, is_resolved: !post.is_resolved });
      }
    }
  }

  async function handleDeletePost(id: string) {
    if (!confirm(language === 'ko' ? '이 게시글을 삭제하시겠습니까?' : 'Delete this post?')) return;
    const { error } = await supabase.from('board_posts').delete().eq('id', id);
    if (!error) {
      toast.success(language === 'ko' ? '삭제되었습니다' : 'Deleted');
      if (selectedPost?.id === id) setSelectedPost(null);
      fetchPosts();
    }
  }

  async function handleDeleteComment(id: string) {
    const { error } = await supabase.from('board_comments').delete().eq('id', id);
    if (!error && selectedPost) fetchComments(selectedPost.id);
  }

  const getCategoryLabel = (value: string) => {
    const cat = CATEGORIES.find(c => c.value === value);
    return cat ? (language === 'ko' ? cat.ko : cat.en) : value;
  };

  let filteredPosts = filter === 'all' ? posts : posts.filter(p => p.category === filter);
  if (statusFilter === 'resolved') filteredPosts = filteredPosts.filter(p => p.is_resolved);
  if (statusFilter === 'pending') filteredPosts = filteredPosts.filter(p => !p.is_resolved);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder={language === 'ko' ? '분류' : 'Category'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{language === 'ko' ? '전체' : 'All'}</SelectItem>
            {CATEGORIES.map(c => (
              <SelectItem key={c.value} value={c.value}>
                {language === 'ko' ? c.ko : c.en}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{language === 'ko' ? '전체 상태' : 'All Status'}</SelectItem>
            <SelectItem value="pending">{language === 'ko' ? '미답변' : 'Pending'}</SelectItem>
            <SelectItem value="resolved">{language === 'ko' ? '답변완료' : 'Resolved'}</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="outline" className="self-center">
          {filteredPosts.length} {language === 'ko' ? '건' : 'posts'}
        </Badge>
      </div>

      {selectedPost ? (
        <div>
          <Button variant="outline" size="sm" onClick={() => setSelectedPost(null)} className="mb-4">
            ← {language === 'ko' ? '목록으로' : 'Back'}
          </Button>

          <Card className="mb-4">
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{getCategoryLabel(selectedPost.category)}</Badge>
                {!selectedPost.is_public && <Badge variant="outline"><Lock className="h-3 w-3 mr-1" />{language === 'ko' ? '비공개' : 'Private'}</Badge>}
                <Badge
                  className={`cursor-pointer ${selectedPost.is_resolved ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}
                  onClick={() => toggleResolved(selectedPost)}
                >
                  {selectedPost.is_resolved ? <><CheckCircle className="h-3 w-3 mr-1" />{language === 'ko' ? '답변완료' : 'Resolved'}</> : <><Clock className="h-3 w-3 mr-1" />{language === 'ko' ? '미답변' : 'Pending'}</>}
                </Badge>
                <Button variant="destructive" size="sm" className="ml-auto" onClick={() => handleDeletePost(selectedPost.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <h3 className="text-lg font-semibold">{selectedPost.title}</h3>
              <p className="text-sm text-muted-foreground">{selectedPost.author_name} · {format(new Date(selectedPost.created_at), 'yyyy-MM-dd HH:mm')}</p>
              <p className="whitespace-pre-wrap text-sm">{selectedPost.content}</p>
            </CardContent>
          </Card>

          {/* Comments */}
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <MessageSquare className="h-4 w-4" /> {language === 'ko' ? '댓글' : 'Comments'} ({comments.length})
          </h4>
          {commentsLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            <div className="space-y-2 mb-4">
              {comments.map(c => (
                <Card key={c.id} className={c.is_admin_reply ? 'border-primary/30 bg-primary/5' : ''}>
                  <CardContent className="p-3 flex justify-between items-start gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">{c.author_name}</span>
                        {c.is_admin_reply && <Badge className="text-[10px] px-1 py-0">{language === 'ko' ? '관리자' : 'Admin'}</Badge>}
                        {!c.is_public && <Lock className="h-3 w-3 text-muted-foreground" />}
                        <span className="text-xs text-muted-foreground">{format(new Date(c.created_at), 'yyyy-MM-dd HH:mm')}</span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{c.content}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteComment(c.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Admin reply */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <Label className="font-semibold">{language === 'ko' ? '관리자 답변' : 'Admin Reply'}</Label>
              <Textarea value={replyText} onChange={e => setReplyText(e.target.value)} rows={3} maxLength={2000} />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch checked={replyIsPublic} onCheckedChange={setReplyIsPublic} />
                  <Label className="text-sm flex items-center gap-1">
                    {replyIsPublic ? <Globe className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                    {replyIsPublic ? (language === 'ko' ? '공개' : 'Public') : (language === 'ko' ? '비공개' : 'Private')}
                  </Label>
                </div>
                <Button onClick={handleReply} disabled={replySaving || !replyText.trim()} size="sm">
                  <Send className="h-3.5 w-3.5 mr-1" />
                  {replySaving ? '...' : (language === 'ko' ? '답변 등록' : 'Reply')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-2">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)
          ) : filteredPosts.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">{language === 'ko' ? '게시글이 없습니다' : 'No posts'}</p>
          ) : (
            filteredPosts.map(post => (
              <Card key={post.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setSelectedPost(post); fetchComments(post.id); }}>
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className="text-[10px]">{getCategoryLabel(post.category)}</Badge>
                      {!post.is_public && <Lock className="h-3 w-3 text-muted-foreground" />}
                      {post.is_resolved ? (
                        <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <Clock className="h-3.5 w-3.5 text-amber-500" />
                      )}
                    </div>
                    <p className="text-sm font-medium truncate">{post.title}</p>
                    <p className="text-xs text-muted-foreground">{post.author_name} · {format(new Date(post.created_at), 'MM-dd HH:mm')}</p>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
