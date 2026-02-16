import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { researchSchema, validateFormData } from '@/lib/admin-validation';
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
import { Plus, Edit, Search, Trash2, Upload, FileText } from 'lucide-react';

interface ResearchReport {
  id: string;
  title_en: string;
  title_ko: string;
  category: string;
  summary_en: string | null;
  summary_ko: string | null;
  admin_note: string | null;
  pdf_url: string | null;
  publication_date: string;
  is_active: boolean | null;
}

export function AdminResearch() {
  const { language, formatDate } = useLanguage();
  const [reports, setReports] = useState<ResearchReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<ResearchReport | null>(null);

  const [formData, setFormData] = useState({
    title_en: '',
    title_ko: '',
    category: 'market_update',
    summary_en: '',
    summary_ko: '',
    admin_note: '',
    pdf_url: '',
    publication_date: new Date().toISOString().split('T')[0],
    is_active: true,
  });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchReports();
  }, []);

  async function fetchReports() {
    const { data, error } = await supabase
      .from('research_reports')
      .select('*')
      .order('publication_date', { ascending: false });

    if (error) {
      toast.error(language === 'ko' ? '리서치 조회 실패' : 'Failed to fetch research');
    } else {
      setReports(data as ResearchReport[]);
    }
    setLoading(false);
  }

  const handleEdit = (report: ResearchReport) => {
    setEditingReport(report);
    setFormData({
      title_en: report.title_en,
      title_ko: report.title_ko,
      category: report.category,
      summary_en: report.summary_en || '',
      summary_ko: report.summary_ko || '',
      admin_note: report.admin_note || '',
      pdf_url: report.pdf_url || '',
      publication_date: report.publication_date,
      is_active: report.is_active ?? true,
    });
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingReport(null);
    setFormData({
      title_en: '',
      title_ko: '',
      category: 'market_update',
      summary_en: '',
      summary_ko: '',
      admin_note: '',
      pdf_url: '',
      publication_date: new Date().toISOString().split('T')[0],
      is_active: true,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    // Validate form data
    const validationResult = validateFormData(researchSchema, {
      title_en: formData.title_en,
      title_ko: formData.title_ko,
      category: formData.category as 'market_update' | 'product_analysis' | 'economic_outlook',
      summary_en: formData.summary_en || null,
      summary_ko: formData.summary_ko || null,
      pdf_url: formData.pdf_url || null,
      publication_date: formData.publication_date,
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
      summary_en: validationResult.data.summary_en ?? null,
      summary_ko: validationResult.data.summary_ko ?? null,
      admin_note: formData.admin_note.trim() || null,
      pdf_url: validationResult.data.pdf_url ?? null,
      publication_date: validationResult.data.publication_date!,
      is_active: validationResult.data.is_active!,
    };

    let error;
    if (editingReport) {
      ({ error } = await supabase.from('research_reports').update(payload).eq('id', editingReport.id));
    } else {
      ({ error } = await supabase.from('research_reports').insert(payload));
    }

    if (error) {
      toast.error(language === 'ko' ? '저장 실패' : 'Save failed');
      console.error(error);
    } else {
      toast.success(language === 'ko' ? '저장 완료' : 'Saved successfully');
      setDialogOpen(false);
      fetchReports();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(language === 'ko' ? '삭제하시겠습니까?' : 'Are you sure?')) return;

    const { error } = await supabase.from('research_reports').delete().eq('id', id);

    if (error) {
      toast.error(language === 'ko' ? '삭제 실패' : 'Delete failed');
    } else {
      toast.success(language === 'ko' ? '삭제 완료' : 'Deleted');
      fetchReports();
    }
  };

  const filteredReports = reports.filter(
    (r) =>
      r.title_en.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.title_ko.includes(searchTerm)
  );

  return (
    <div className="card-elevated">
      <div className="p-6 border-b border-border flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-xl font-serif font-semibold">
          {language === 'ko' ? '리서치 관리' : 'Research Management'}
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
              <TableHead>{language === 'ko' ? '발행일' : 'Date'}</TableHead>
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
            ) : filteredReports.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  {language === 'ko' ? '데이터가 없습니다' : 'No data found'}
                </TableCell>
              </TableRow>
            ) : (
              filteredReports.map((report) => (
                <TableRow key={report.id}>
                  <TableCell className="font-medium">
                    {language === 'ko' ? report.title_ko : report.title_en}
                  </TableCell>
                  <TableCell>{report.category}</TableCell>
                  <TableCell>{formatDate(report.publication_date)}</TableCell>
                  <TableCell>{report.is_active ? '✓' : '✗'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(report)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(report.id)}>
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
              {editingReport
                ? (language === 'ko' ? '리서치 수정' : 'Edit Research')
                : (language === 'ko' ? '리서치 추가' : 'Add Research')}
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
                  <SelectItem value="market_update">{language === 'ko' ? '시장 업데이트' : 'Market Update'}</SelectItem>
                  <SelectItem value="product_analysis">{language === 'ko' ? '상품 분석' : 'Product Analysis'}</SelectItem>
                  <SelectItem value="economic_outlook">{language === 'ko' ? '경제 전망' : 'Economic Outlook'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{language === 'ko' ? '요약 (영문)' : 'Summary (EN)'}</Label>
              <Textarea value={formData.summary_en} onChange={(e) => setFormData({ ...formData, summary_en: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{language === 'ko' ? '요약 (한글)' : 'Summary (KO)'}</Label>
              <Textarea value={formData.summary_ko} onChange={(e) => setFormData({ ...formData, summary_ko: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{language === 'ko' ? '운용역 코멘트' : 'Manager Comment'}</Label>
              <Textarea
                value={formData.admin_note}
                onChange={(e) => setFormData({ ...formData, admin_note: e.target.value })}
                placeholder={language === 'ko' ? '리서치에 대한 코멘트를 작성하세요...' : 'Write a comment about this research...'}
                className="min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label>{language === 'ko' ? 'PDF 파일' : 'PDF File'}</Label>
              {formData.pdf_url && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <FileText className="h-4 w-4" />
                  <span className="truncate flex-1">{formData.pdf_url.split('/').pop()}</span>
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  type="file"
                  accept=".pdf"
                  disabled={uploading}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 20 * 1024 * 1024) {
                      toast.error(language === 'ko' ? '파일 크기는 20MB 이하여야 합니다' : 'File must be under 20MB');
                      return;
                    }
                    setUploading(true);
                    const ext = file.name.split('.').pop();
                    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
                    const { error: uploadError } = await supabase.storage
                      .from('research-documents')
                      .upload(fileName, file, { contentType: 'application/pdf' });
                    if (uploadError) {
                      toast.error(language === 'ko' ? '업로드 실패' : 'Upload failed');
                      console.error(uploadError);
                    } else {
                      const { data: urlData } = supabase.storage
                        .from('research-documents')
                        .getPublicUrl(fileName);
                      setFormData({ ...formData, pdf_url: urlData.publicUrl });
                      toast.success(language === 'ko' ? '업로드 완료' : 'Upload complete');
                    }
                    setUploading(false);
                  }}
                />
              </div>
              {uploading && <p className="text-xs text-muted-foreground">{language === 'ko' ? '업로드 중...' : 'Uploading...'}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{language === 'ko' ? '발행일' : 'Publication Date'}</Label>
                <Input type="date" value={formData.publication_date} onChange={(e) => setFormData({ ...formData, publication_date: e.target.value })} />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label>{language === 'ko' ? '활성화' : 'Active'}</Label>
              </div>
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
