import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { videoSchema, validateFormData } from '@/lib/admin-validation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Edit, Search, Trash2 } from 'lucide-react';

interface Video {
  id: string;
  title_en: string;
  title_ko: string;
  category: string;
  description_en: string | null;
  description_ko: string | null;
  youtube_url: string;
  thumbnail_url: string | null;
  is_active: boolean | null;
}

export function AdminVideos() {
  const { language } = useLanguage();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);

  const [formData, setFormData] = useState({
    title_en: '',
    title_ko: '',
    category: 'market_commentary',
    description_en: '',
    description_ko: '',
    youtube_url: '',
    thumbnail_url: '',
    is_active: true,
  });

  useEffect(() => {
    fetchVideos();
  }, []);

  async function fetchVideos() {
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error(language === 'ko' ? '비디오 조회 실패' : 'Failed to fetch videos');
    } else {
      setVideos(data as Video[]);
    }
    setLoading(false);
  }

  const handleEdit = (video: Video) => {
    setEditingVideo(video);
    setFormData({
      title_en: video.title_en,
      title_ko: video.title_ko,
      category: video.category,
      description_en: video.description_en || '',
      description_ko: video.description_ko || '',
      youtube_url: video.youtube_url,
      thumbnail_url: video.thumbnail_url || '',
      is_active: video.is_active ?? true,
    });
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingVideo(null);
    setFormData({
      title_en: '',
      title_ko: '',
      category: 'market_commentary',
      description_en: '',
      description_ko: '',
      youtube_url: '',
      thumbnail_url: '',
      is_active: true,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    // Validate form data
    const validationResult = validateFormData(videoSchema, {
      title_en: formData.title_en,
      title_ko: formData.title_ko,
      category: formData.category as 'market_commentary' | 'product_explanation' | 'educational',
      description_en: formData.description_en || null,
      description_ko: formData.description_ko || null,
      youtube_url: formData.youtube_url,
      thumbnail_url: formData.thumbnail_url || null,
      is_active: formData.is_active,
    }, language);

    if (!validationResult.success) {
      toast.error(validationResult.error);
      return;
    }

    const payload = {
      title_en: validationResult.data.title_en!,
      title_ko: validationResult.data.title_ko!,
      category: validationResult.data.category!,
      description_en: validationResult.data.description_en ?? null,
      description_ko: validationResult.data.description_ko ?? null,
      youtube_url: validationResult.data.youtube_url!,
      thumbnail_url: validationResult.data.thumbnail_url ?? null,
      is_active: validationResult.data.is_active!,
    };

    let error;
    if (editingVideo) {
      ({ error } = await supabase.from('videos').update(payload).eq('id', editingVideo.id));
    } else {
      ({ error } = await supabase.from('videos').insert(payload));
    }

    if (error) {
      toast.error(language === 'ko' ? '저장 실패' : 'Save failed');
      console.error(error);
    } else {
      toast.success(language === 'ko' ? '저장 완료' : 'Saved successfully');
      setDialogOpen(false);
      fetchVideos();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(language === 'ko' ? '삭제하시겠습니까?' : 'Are you sure?')) return;

    const { error } = await supabase.from('videos').delete().eq('id', id);

    if (error) {
      toast.error(language === 'ko' ? '삭제 실패' : 'Delete failed');
    } else {
      toast.success(language === 'ko' ? '삭제 완료' : 'Deleted');
      fetchVideos();
    }
  };

  const filteredVideos = videos.filter(
    (v) =>
      v.title_en.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.title_ko.includes(searchTerm)
  );

  return (
    <div className="card-elevated">
      <div className="p-6 border-b border-border flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-xl font-serif font-semibold">
          {language === 'ko' ? '비디오 관리' : 'Video Management'}
        </h2>
        <div className="flex items-center gap-4">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={language === 'ko' ? '검색...' : 'Search...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={handleAdd} className="btn-gold">
            <Plus className="h-4 w-4 mr-2" />
            {language === 'ko' ? '추가' : 'Add'}
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{language === 'ko' ? '제목' : 'Title'}</TableHead>
              <TableHead>{language === 'ko' ? '카테고리' : 'Category'}</TableHead>
              <TableHead>{language === 'ko' ? 'YouTube URL' : 'YouTube URL'}</TableHead>
              <TableHead>{language === 'ko' ? '활성' : 'Active'}</TableHead>
              <TableHead>{language === 'ko' ? '작업' : 'Actions'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-24" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : filteredVideos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  {language === 'ko' ? '데이터가 없습니다' : 'No data found'}
                </TableCell>
              </TableRow>
            ) : (
              filteredVideos.map((video) => (
                <TableRow key={video.id}>
                  <TableCell className="font-medium">
                    {language === 'ko' ? video.title_ko : video.title_en}
                  </TableCell>
                  <TableCell>{video.category}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{video.youtube_url}</TableCell>
                  <TableCell>{video.is_active ? '✓' : '✗'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(video)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(video.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingVideo
                ? (language === 'ko' ? '비디오 수정' : 'Edit Video')
                : (language === 'ko' ? '비디오 추가' : 'Add Video')}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{language === 'ko' ? '제목 (영문)' : 'Title (EN)'}</Label>
                <Input value={formData.title_en} onChange={(e) => setFormData({ ...formData, title_en: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{language === 'ko' ? '제목 (한글)' : 'Title (KO)'}</Label>
                <Input value={formData.title_ko} onChange={(e) => setFormData({ ...formData, title_ko: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{language === 'ko' ? '카테고리' : 'Category'}</Label>
              <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="market_commentary">{language === 'ko' ? '시장 논평' : 'Market Commentary'}</SelectItem>
                  <SelectItem value="product_explanation">{language === 'ko' ? '상품 설명' : 'Product Explanation'}</SelectItem>
                  <SelectItem value="educational">{language === 'ko' ? '교육' : 'Educational'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{language === 'ko' ? '설명 (영문)' : 'Description (EN)'}</Label>
              <Textarea value={formData.description_en} onChange={(e) => setFormData({ ...formData, description_en: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{language === 'ko' ? '설명 (한글)' : 'Description (KO)'}</Label>
              <Textarea value={formData.description_ko} onChange={(e) => setFormData({ ...formData, description_ko: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{language === 'ko' ? 'YouTube URL' : 'YouTube URL'}</Label>
              <Input value={formData.youtube_url} onChange={(e) => setFormData({ ...formData, youtube_url: e.target.value })} placeholder="https://www.youtube.com/watch?v=..." />
            </div>
            <div className="space-y-2">
              <Label>{language === 'ko' ? '썸네일 URL (선택)' : 'Thumbnail URL (optional)'}</Label>
              <Input value={formData.thumbnail_url} onChange={(e) => setFormData({ ...formData, thumbnail_url: e.target.value })} placeholder="https://..." />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label>{language === 'ko' ? '활성화' : 'Active'}</Label>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                {language === 'ko' ? '취소' : 'Cancel'}
              </Button>
              <Button onClick={handleSave} className="btn-gold">
                {language === 'ko' ? '저장' : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
