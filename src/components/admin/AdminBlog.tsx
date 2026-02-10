import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Image, Send, Mail, Clock } from 'lucide-react';
import { RichPasteEditor } from './RichPasteEditor';

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
  created_at: string;
}

const defaultFormData = {
  title_ko: '',
  title_en: '',
  content_ko: '',
  content_en: '',
  summary_ko: '',
  summary_en: '',
  thumbnail_url: '',
  author: 'Namsan Capital',
  is_active: true,
  published_at: new Date().toISOString().split('T')[0],
};

export function AdminBlog() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(defaultFormData);
  const [uploading, setUploading] = useState(false);

  // Newsletter state
  const [newsletterDialogOpen, setNewsletterDialogOpen] = useState(false);
  const [newsletterSubject, setNewsletterSubject] = useState('');
  const [newsletterContent, setNewsletterContent] = useState('');
  const [sending, setSending] = useState(false);
  const [newsletters, setNewsletters] = useState<any[]>([]);
  const [selectedBlogPost, setSelectedBlogPost] = useState<BlogPost | null>(null);
  const [sendAsNewsletter, setSendAsNewsletter] = useState(false);

  async function fetchPosts() {
    const { data } = await supabase
      .from('blog_posts')
      .select('*')
      .order('published_at', { ascending: false });
    if (data) setPosts(data as BlogPost[]);
    setLoading(false);
  }

  async function fetchNewsletters() {
    const { data } = await supabase
      .from('newsletters')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setNewsletters(data);
  }

  useEffect(() => { fetchPosts(); fetchNewsletters(); }, []);

  function openNewsletterFromPost(post: BlogPost) {
    setSelectedBlogPost(post);
    setNewsletterSubject(language === 'ko' ? post.title_ko : post.title_en);
    setNewsletterContent(language === 'ko' ? post.content_ko : post.content_en);
    setNewsletterDialogOpen(true);
  }

  function openNewNewsletter() {
    setSelectedBlogPost(null);
    setNewsletterSubject('');
    setNewsletterContent('');
    setNewsletterDialogOpen(true);
  }

  async function handleSendNewsletter() {
    if (!newsletterSubject || !newsletterContent) {
      toast.error(language === 'ko' ? '제목과 내용을 입력해주세요' : 'Subject and content are required');
      return;
    }

    if (!confirm(language === 'ko' 
      ? '승인된 모든 고객에게 뉴스레터를 발송합니다. 계속하시겠습니까?' 
      : 'Send newsletter to all approved clients. Continue?')) {
      return;
    }

    setSending(true);

    try {
      // Create newsletter record first
      const { data: nlData, error: nlError } = await supabase
        .from('newsletters')
        .insert({
          subject_ko: newsletterSubject,
          subject_en: newsletterSubject,
          content_ko: newsletterContent,
          content_en: newsletterContent,
          blog_post_id: selectedBlogPost?.id || null,
          status: 'sending',
        })
        .select()
        .single();

      if (nlError) throw nlError;

      // Convert markdown content to simple HTML for email
      const htmlContent = newsletterContent
        .replace(/^### (.*$)/gm, '<h3>$1</h3>')
        .replace(/^## (.*$)/gm, '<h2>$1</h2>')
        .replace(/^# (.*$)/gm, '<h1>$1</h1>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/!\[.*?\]\((.*?)\)/g, '<img src="$1" style="max-width:100%;border-radius:8px;margin:12px 0" />')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:#2d4a7c">$1</a>')
        .replace(/\n\n/g, '</p><p style="margin:12px 0">')
        .replace(/\n/g, '<br/>');

      const { data, error } = await supabase.functions.invoke('send-newsletter', {
        body: {
          subject: newsletterSubject,
          htmlContent: `<p style="margin:12px 0">${htmlContent}</p>`,
          newsletterId: nlData.id,
        },
      });

      if (error) throw error;

      toast.success(
        language === 'ko' 
          ? `${data.sentCount}명에게 뉴스레터 발송 완료!` 
          : `Newsletter sent to ${data.sentCount} recipients!`
      );
      setNewsletterDialogOpen(false);
      fetchNewsletters();
    } catch (err: any) {
      console.error('Newsletter send error:', err);
      toast.error(language === 'ko' ? '뉴스레터 발송 실패' : 'Failed to send newsletter');
    } finally {
      setSending(false);
    }
  }


  function openNew() {
    setEditingId(null);
    setFormData(defaultFormData);
    setSendAsNewsletter(false);
    setDialogOpen(true);
  }

  function openEdit(post: BlogPost) {
    setEditingId(post.id);
    setFormData({
      title_ko: post.title_ko,
      title_en: post.title_en,
      content_ko: post.content_ko,
      content_en: post.content_en,
      summary_ko: post.summary_ko || '',
      summary_en: post.summary_en || '',
      thumbnail_url: post.thumbnail_url || '',
      author: post.author,
      is_active: post.is_active,
      published_at: post.published_at.split('T')[0],
    });
    setDialogOpen(true);
  }

  async function handleThumbnailUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `thumbnails/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('blog-images').upload(path, file);
    if (error) {
      toast.error(language === 'ko' ? '이미지 업로드 실패' : 'Image upload failed');
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from('blog-images').getPublicUrl(path);
    setFormData(prev => ({ ...prev, thumbnail_url: urlData.publicUrl }));
    setUploading(false);
    toast.success(language === 'ko' ? '이미지 업로드 완료' : 'Image uploaded');
  }

  async function handleSave() {
    if (!formData.title_ko && !formData.title_en) {
      toast.error(language === 'ko' ? '제목을 입력해주세요' : 'Title is required');
      return;
    }

    const payload = {
      title_ko: formData.title_ko,
      title_en: formData.title_en,
      content_ko: formData.content_ko,
      content_en: formData.content_en,
      summary_ko: formData.summary_ko || null,
      summary_en: formData.summary_en || null,
      thumbnail_url: formData.thumbnail_url || null,
      author: formData.author,
      is_active: formData.is_active,
      published_at: formData.published_at,
    };

    let error;
    if (editingId) {
      ({ error } = await supabase.from('blog_posts').update(payload).eq('id', editingId));
    } else {
      ({ error } = await supabase.from('blog_posts').insert(payload));
    }

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(language === 'ko' ? '저장 완료' : 'Saved');
    
    // Auto-send as newsletter if checked
    if (sendAsNewsletter && formData.is_active) {
      try {
        setSending(true);
        const content = formData.content_ko || formData.content_en;
        const subject = formData.title_ko || formData.title_en;
        
        const htmlContent = content
          .replace(/^### (.*$)/gm, '<h3>$1</h3>')
          .replace(/^## (.*$)/gm, '<h2>$1</h2>')
          .replace(/^# (.*$)/gm, '<h1>$1</h1>')
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>')
          .replace(/!\[.*?\]\((.*?)\)/g, '<img src="$1" style="max-width:100%;border-radius:8px;margin:12px 0" />')
          .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:#2d4a7c">$1</a>')
          .replace(/\n\n/g, '</p><p style="margin:12px 0">')
          .replace(/\n/g, '<br/>');

        // Create newsletter record
        const { data: nlData } = await supabase
          .from('newsletters')
          .insert({
            subject_ko: subject,
            subject_en: subject,
            content_ko: content,
            content_en: content,
            status: 'sending',
          })
          .select()
          .single();

        const { data, error: sendError } = await supabase.functions.invoke('send-newsletter', {
          body: {
            subject,
            htmlContent: `<p style="margin:12px 0">${htmlContent}</p>`,
            newsletterId: nlData?.id,
          },
        });

        if (sendError) throw sendError;
        toast.success(
          language === 'ko'
            ? `${data.sentCount}명에게 뉴스레터 자동 발송 완료!`
            : `Newsletter auto-sent to ${data.sentCount} recipients!`
        );
        fetchNewsletters();
      } catch (err) {
        console.error('Auto newsletter error:', err);
        toast.error(language === 'ko' ? '뉴스레터 자동 발송 실패' : 'Auto newsletter send failed');
      } finally {
        setSending(false);
      }
    }

    setDialogOpen(false);
    fetchPosts();
  }

  async function handleDelete(id: string) {
    if (!confirm(language === 'ko' ? '삭제하시겠습니까?' : 'Delete this post?')) return;
    const { error } = await supabase.from('blog_posts').delete().eq('id', id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(language === 'ko' ? '삭제 완료' : 'Deleted');
    fetchPosts();
  }

  if (loading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-serif font-semibold">
          {language === 'ko' ? '블로그 & 뉴스레터' : 'Blog & Newsletter'}
        </h2>
      </div>

      <Tabs defaultValue="posts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="posts" className="flex items-center gap-2">
            <Edit className="h-4 w-4" />
            {language === 'ko' ? '블로그 글' : 'Blog Posts'}
          </TabsTrigger>
          <TabsTrigger value="newsletters" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            {language === 'ko' ? '뉴스레터 발송 기록' : 'Newsletter History'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="posts">
          <div className="flex items-center justify-between mb-4">
            <div />
            <div className="flex gap-2">
              <Button variant="outline" onClick={openNewNewsletter} className="flex items-center gap-2">
                <Send className="h-4 w-4" />
                {language === 'ko' ? '뉴스레터 직접 작성' : 'Compose Newsletter'}
              </Button>
              <Button onClick={openNew} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                {language === 'ko' ? '새 글 작성' : 'New Post'}
              </Button>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === 'ko' ? '썸네일' : 'Thumb'}</TableHead>
                <TableHead>{language === 'ko' ? '제목' : 'Title'}</TableHead>
                <TableHead>{language === 'ko' ? '작성자' : 'Author'}</TableHead>
                <TableHead>{language === 'ko' ? '게시일' : 'Published'}</TableHead>
                <TableHead>{language === 'ko' ? '활성' : 'Active'}</TableHead>
                <TableHead>{language === 'ko' ? '작업' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.map(post => (
                <TableRow key={post.id}>
                  <TableCell>
                    {post.thumbnail_url ? (
                      <img src={post.thumbnail_url} alt="" className="h-10 w-14 object-cover rounded" />
                    ) : (
                      <div className="h-10 w-14 bg-muted rounded flex items-center justify-center">
                        <Image className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium max-w-[200px] truncate">
                    {language === 'ko' ? post.title_ko : post.title_en}
                  </TableCell>
                  <TableCell className="text-sm">{post.author}</TableCell>
                  <TableCell className="text-sm">{post.published_at.split('T')[0]}</TableCell>
                  <TableCell>
                    <Switch
                      checked={post.is_active}
                      onCheckedChange={async (checked) => {
                        await supabase.from('blog_posts').update({ is_active: checked }).eq('id', post.id);
                        fetchPosts();
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(post)} title={language === 'ko' ? '수정' : 'Edit'}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openNewsletterFromPost(post)} title={language === 'ko' ? '뉴스레터 발송' : 'Send as Newsletter'}>
                        <Send className="h-4 w-4 text-primary" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(post.id)} title={language === 'ko' ? '삭제' : 'Delete'}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {posts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    {language === 'ko' ? '블로그 글이 없습니다.' : 'No blog posts.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="newsletters">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === 'ko' ? '제목' : 'Subject'}</TableHead>
                <TableHead>{language === 'ko' ? '상태' : 'Status'}</TableHead>
                <TableHead>{language === 'ko' ? '수신자 수' : 'Recipients'}</TableHead>
                <TableHead>{language === 'ko' ? '발송일' : 'Sent At'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {newsletters.map(nl => (
                <TableRow key={nl.id}>
                  <TableCell className="font-medium">{nl.subject_ko || nl.subject_en}</TableCell>
                  <TableCell>
                    <Badge variant={nl.status === 'sent' ? 'default' : nl.status === 'sending' ? 'secondary' : 'outline'}>
                      {nl.status === 'sent' ? (language === 'ko' ? '발송완료' : 'Sent') 
                        : nl.status === 'sending' ? (language === 'ko' ? '발송중' : 'Sending')
                        : (language === 'ko' ? '초안' : 'Draft')}
                    </Badge>
                  </TableCell>
                  <TableCell>{nl.recipient_count || 0}{language === 'ko' ? '명' : ''}</TableCell>
                  <TableCell className="text-sm">
                    {nl.sent_at ? new Date(nl.sent_at).toLocaleString(language === 'ko' ? 'ko-KR' : 'en-US') : '-'}
                  </TableCell>
                </TableRow>
              ))}
              {newsletters.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    {language === 'ko' ? '발송 기록이 없습니다.' : 'No newsletters sent.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>

      {/* Edit/Create Blog Post Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">
              {editingId
                ? (language === 'ko' ? '블로그 수정' : 'Edit Post')
                : (language === 'ko' ? '새 블로그 작성' : 'New Post')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{language === 'ko' ? '제목 (한국어)' : 'Title (Korean)'}</Label>
                <Input
                  value={formData.title_ko}
                  onChange={(e) => setFormData(prev => ({ ...prev, title_ko: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>{language === 'ko' ? '제목 (영어)' : 'Title (English)'}</Label>
                <Input
                  value={formData.title_en}
                  onChange={(e) => setFormData(prev => ({ ...prev, title_en: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{language === 'ko' ? '요약 (한국어)' : 'Summary (Korean)'}</Label>
                <Textarea
                  rows={2}
                  value={formData.summary_ko}
                  onChange={(e) => setFormData(prev => ({ ...prev, summary_ko: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>{language === 'ko' ? '요약 (영어)' : 'Summary (English)'}</Label>
                <Textarea
                  rows={2}
                  value={formData.summary_en}
                  onChange={(e) => setFormData(prev => ({ ...prev, summary_en: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{language === 'ko' ? '본문 (한국어)' : 'Content (Korean)'}</Label>
              <RichPasteEditor
                value={formData.content_ko}
                onChange={(val) => setFormData(prev => ({ ...prev, content_ko: val }))}
                placeholder={language === 'ko' ? '내용을 입력하세요...' : 'Enter content...'}
              />
            </div>

            <div className="space-y-2">
              <Label>{language === 'ko' ? '본문 (영어)' : 'Content (English)'}</Label>
              <RichPasteEditor
                value={formData.content_en}
                onChange={(val) => setFormData(prev => ({ ...prev, content_en: val }))}
                placeholder={language === 'ko' ? '영문 내용을 입력하세요...' : 'Enter English content...'}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{language === 'ko' ? '썸네일 이미지' : 'Thumbnail Image'}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleThumbnailUpload}
                    disabled={uploading}
                  />
                </div>
                {formData.thumbnail_url && (
                  <img src={formData.thumbnail_url} alt="" className="h-20 w-auto rounded mt-1" />
                )}
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{language === 'ko' ? '작성자' : 'Author'}</Label>
                  <Input
                    value={formData.author}
                    onChange={(e) => setFormData(prev => ({ ...prev, author: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === 'ko' ? '게시일' : 'Publish Date'}</Label>
                  <Input
                    type="date"
                    value={formData.published_at}
                    onChange={(e) => setFormData(prev => ({ ...prev, published_at: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
              />
              <Label>{language === 'ko' ? '활성' : 'Active'}</Label>
            </div>

            <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <Switch
                checked={sendAsNewsletter}
                onCheckedChange={setSendAsNewsletter}
              />
              <div>
                <Label className="flex items-center gap-1.5 cursor-pointer">
                  <Mail className="h-4 w-4 text-primary" />
                  {language === 'ko' ? '저장 시 뉴스레터 자동 발송' : 'Auto-send as newsletter on save'}
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {language === 'ko' 
                    ? '승인된 모든 고객에게 이메일로 발송됩니다' 
                    : 'Will be emailed to all approved clients'}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                {language === 'ko' ? '취소' : 'Cancel'}
              </Button>
              <Button onClick={handleSave} disabled={sending} className="flex items-center gap-2">
                {sendAsNewsletter && <Send className="h-4 w-4" />}
                {sending 
                  ? (language === 'ko' ? '발송 중...' : 'Sending...') 
                  : sendAsNewsletter 
                    ? (language === 'ko' ? '저장 & 발송' : 'Save & Send')
                    : (language === 'ko' ? '저장' : 'Save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Newsletter Compose Dialog */}
      <Dialog open={newsletterDialogOpen} onOpenChange={setNewsletterDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif flex items-center gap-2">
              <Mail className="h-5 w-5" />
              {language === 'ko' ? '뉴스레터 발송' : 'Send Newsletter'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {selectedBlogPost && (
              <div className="p-3 bg-muted/50 rounded-lg text-sm">
                <span className="text-muted-foreground">
                  {language === 'ko' ? '블로그 글 기반: ' : 'Based on blog post: '}
                </span>
                <span className="font-medium">
                  {language === 'ko' ? selectedBlogPost.title_ko : selectedBlogPost.title_en}
                </span>
              </div>
            )}

            <div className="space-y-2">
              <Label>{language === 'ko' ? '이메일 제목' : 'Email Subject'}</Label>
              <Input
                value={newsletterSubject}
                onChange={(e) => setNewsletterSubject(e.target.value)}
                placeholder={language === 'ko' ? '뉴스레터 제목' : 'Newsletter subject'}
              />
            </div>

            <div className="space-y-2">
              <Label>{language === 'ko' ? '이메일 내용' : 'Email Content'}</Label>
              <RichPasteEditor
                value={newsletterContent}
                onChange={setNewsletterContent}
                rows={10}
                placeholder={language === 'ko' ? '뉴스레터 내용을 입력하세요...' : 'Enter newsletter content...'}
              />
            </div>

            <div className="p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground">
              <Clock className="h-3 w-3 inline mr-1" />
              {language === 'ko' 
                ? '승인된 모든 고객에게 이메일이 발송됩니다.' 
                : 'Email will be sent to all approved clients.'}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setNewsletterDialogOpen(false)}>
                {language === 'ko' ? '취소' : 'Cancel'}
              </Button>
              <Button onClick={handleSendNewsletter} disabled={sending} className="flex items-center gap-2">
                <Send className="h-4 w-4" />
                {sending 
                  ? (language === 'ko' ? '발송 중...' : 'Sending...') 
                  : (language === 'ko' ? '발송하기' : 'Send')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
