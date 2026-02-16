import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Upload, Trash2, FileText, Download } from 'lucide-react';

interface ProductDocument {
  id: string;
  product_id: string;
  name_ko: string;
  name_en: string;
  document_type: string;
  file_url: string;
  file_size: number | null;
  display_order: number;
  created_at: string;
}

interface ProductDocumentsProps {
  productId: string;
}

const DOC_TYPES = [
  { value: 'termsheet', ko: '텀시트', en: 'Termsheet' },
  { value: 'proposal', ko: '제안서', en: 'Proposal' },
  { value: 'contract', ko: '계약서', en: 'Contract' },
  { value: 'prospectus', ko: '투자설명서', en: 'Prospectus' },
  { value: 'report', ko: '보고서', en: 'Report' },
  { value: 'other', ko: '기타', en: 'Other' },
];

export function ProductDocuments({ productId }: ProductDocumentsProps) {
  const { language } = useLanguage();
  const [documents, setDocuments] = useState<ProductDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [nameKo, setNameKo] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [docType, setDocType] = useState('termsheet');

  async function fetchDocuments() {
    const { data } = await supabase
      .from('product_documents')
      .select('*')
      .eq('product_id', productId)
      .order('display_order', { ascending: true });
    if (data) setDocuments(data as ProductDocument[]);
    setLoading(false);
  }

  useEffect(() => {
    fetchDocuments();
  }, [productId]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.includes('pdf')) {
      toast.error(language === 'ko' ? 'PDF 파일만 업로드 가능합니다' : 'Only PDF files are allowed');
      return;
    }

    if (!nameKo && !nameEn) {
      toast.error(language === 'ko' ? '문서 이름을 입력해주세요' : 'Document name is required');
      return;
    }

    setUploading(true);
    try {
      const path = `${productId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('product-documents')
        .upload(path, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('product-documents')
        .getPublicUrl(path);

      const { error: insertError } = await supabase
        .from('product_documents')
        .insert({
          product_id: productId,
          name_ko: nameKo || nameEn,
          name_en: nameEn || nameKo,
          document_type: docType,
          file_url: urlData.publicUrl,
          file_size: file.size,
          display_order: documents.length,
        });

      if (insertError) throw insertError;

      toast.success(language === 'ko' ? '문서 업로드 완료' : 'Document uploaded');
      setNameKo('');
      setNameEn('');
      setDocType('termsheet');
      fetchDocuments();
    } catch (err: any) {
      console.error('Upload error:', err);
      toast.error(language === 'ko' ? '업로드 실패' : 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleDelete(doc: ProductDocument) {
    if (!confirm(language === 'ko' ? '문서를 삭제하시겠습니까?' : 'Delete this document?')) return;

    // Extract storage path from URL
    const urlParts = doc.file_url.split('/product-documents/');
    const storagePath = urlParts[1];

    if (storagePath) {
      await supabase.storage.from('product-documents').remove([storagePath]);
    }

    const { error } = await supabase
      .from('product_documents')
      .delete()
      .eq('id', doc.id);

    if (error) {
      toast.error(language === 'ko' ? '삭제 실패' : 'Delete failed');
    } else {
      toast.success(language === 'ko' ? '삭제 완료' : 'Deleted');
      fetchDocuments();
    }
  }

  const getDocTypeLabel = (type: string) => {
    const dt = DOC_TYPES.find(d => d.value === type);
    return language === 'ko' ? dt?.ko || type : dt?.en || type;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  return (
    <div className="space-y-4 border-t border-border pt-4 mt-4">
      <h4 className="font-medium text-sm flex items-center gap-2">
        <FileText className="h-4 w-4" />
        {language === 'ko' ? '상품 문서 관리' : 'Product Documents'}
      </h4>

      {/* Upload form */}
      <div className="grid gap-3 p-3 bg-muted/30 rounded-lg">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">{language === 'ko' ? '문서명 (한글)' : 'Name (KO)'}</Label>
            <Input
              value={nameKo}
              onChange={(e) => setNameKo(e.target.value)}
              placeholder={language === 'ko' ? '예: 투자 제안서' : 'e.g. Investment Proposal'}
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">{language === 'ko' ? '문서명 (영문)' : 'Name (EN)'}</Label>
            <Input
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              placeholder="e.g. Investment Proposal"
              className="h-8 text-sm"
            />
          </div>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Label className="text-xs">{language === 'ko' ? '문서 유형' : 'Type'}</Label>
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOC_TYPES.map(dt => (
                  <SelectItem key={dt.value} value={dt.value}>
                    {language === 'ko' ? dt.ko : dt.en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label
              htmlFor={`doc-upload-${productId}`}
              className={`inline-flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium cursor-pointer transition-colors ${
                uploading ? 'bg-muted text-muted-foreground pointer-events-none' : 'bg-primary text-primary-foreground hover:bg-primary/90'
              }`}
            >
              <Upload className="h-3.5 w-3.5" />
              {uploading
                ? (language === 'ko' ? '업로드중...' : 'Uploading...')
                : (language === 'ko' ? 'PDF 업로드' : 'Upload PDF')}
            </Label>
            <input
              id={`doc-upload-${productId}`}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
          </div>
        </div>
      </div>

      {/* Document list */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : documents.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {language === 'ko' ? '등록된 문서가 없습니다.' : 'No documents yet.'}
        </p>
      ) : (
        <div className="space-y-2">
          {documents.map(doc => (
            <div key={doc.id} className="flex items-center justify-between p-2 rounded border border-border bg-background">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-4 w-4 text-red-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {language === 'ko' ? doc.name_ko : doc.name_en}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {getDocTypeLabel(doc.document_type)}
                    {doc.file_size ? ` · ${formatFileSize(doc.file_size)}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="sm" title={language === 'ko' ? '다운로드' : 'Download'}>
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </a>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(doc)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
