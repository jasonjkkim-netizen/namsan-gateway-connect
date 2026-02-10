import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
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
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Image } from 'lucide-react';
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
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(defaultFormData);
  const [uploading, setUploading] = useState(false);

  async function fetchPosts() {
    const { data } = await supabase
      .from('blog_posts')
      .select('*')
      .order('published_at', { ascending: false });
    if (data) setPosts(data as BlogPost[]);
    setLoading(false);
  }

  useEffect(() => { fetchPosts(); }, []);

  function openNew() {
    setEditingId(null);
    setFormData(defaultFormData);
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
          {language === 'ko' ? '블로그 관리' : 'Blog Management'}
        </h2>
        <Button onClick={openNew} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          {language === 'ko' ? '새 글 작성' : 'New Post'}
        </Button>
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
                  <Button variant="ghost" size="sm" onClick={() => openEdit(post)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(post.id)}>
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

      {/* Edit/Create Dialog */}
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

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                {language === 'ko' ? '취소' : 'Cancel'}
              </Button>
              <Button onClick={handleSave}>
                {language === 'ko' ? '저장' : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
