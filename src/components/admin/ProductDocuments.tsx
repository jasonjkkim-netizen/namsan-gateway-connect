import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
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
import { Upload, Trash2, FileText, Download, Eye, Loader2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

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
  const { user } = useAuth();
  const [documents, setDocuments] = useState<ProductDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [nameKo, setNameKo] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [docType, setDocType] = useState('termsheet');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function fetchDocuments() {
    const { data, error } = await supabase
      .from('product_documents')
      .select('*')
      .eq('product_id', productId)
      .order('document_type', { ascending: true })
      .order('display_order', { ascending: true });
    if (error) {
      console.error('Fetch documents error:', error);
    }
    if (data) setDocuments(data as ProductDocument[]);
    setLoading(false);
  }

  useEffect(() => {
    fetchDocuments();
  }, [productId]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Validate all files are PDF
    const fileArray = Array.from(files);
    const nonPdf = fileArray.find(f => !f.type.includes('pdf'));
    if (nonPdf) {
      toast.error(language === 'ko' ? 'PDF 파일만 업로드 가능합니다' : 'Only PDF files are allowed');
      return;
    }

    setUploading(true);
    let successCount = 0;

    try {
      for (const file of fileArray) {
        const baseName = file.name.replace(/\.pdf$/i, '');
        const docNameKo = nameKo || baseName;
        const docNameEn = nameEn || baseName;

        // Sanitize filename: replace non-ASCII and special chars with underscores
        const ext = file.name.split('.').pop() || 'pdf';
        const safeName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
        const path = `${productId}/${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from('product-documents')
          .upload(path, file);

        if (uploadError) {
          console.error('Storage upload error:', uploadError);
          toast.error(`${file.name}: ${uploadError.message}`);
          continue;
        }

        const { error: insertError } = await supabase
          .from('product_documents')
          .insert({
            product_id: productId,
            name_ko: fileArray.length > 1 ? baseName : docNameKo,
            name_en: fileArray.length > 1 ? baseName : docNameEn,
            document_type: docType,
            file_url: path,
            file_size: file.size,
            display_order: documents.length + successCount,
            uploaded_by: user?.id || null,
          });

        if (insertError) {
          console.error('DB insert error:', insertError);
          // Try to clean up the uploaded file
          await supabase.storage.from('product-documents').remove([path]);
          toast.error(`${file.name}: ${insertError.message}`);
          continue;
        }

        successCount++;
      }

      if (successCount > 0) {
        toast.success(
          language === 'ko'
            ? `${successCount}개 문서 업로드 완료`
            : `${successCount} document(s) uploaded`
        );
        setNameKo('');
        setNameEn('');
        setDocType('termsheet');
        fetchDocuments();
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      toast.error(language === 'ko' ? '업로드 실패' : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDelete(doc: ProductDocument) {
    if (!confirm(language === 'ko' ? '문서를 삭제하시겠습니까?' : 'Delete this document?')) return;

    // file_url stores the storage path directly (e.g. "productId/timestamp_filename.pdf")
    const storagePath = doc.file_url.startsWith('http')
      ? doc.file_url.split('/product-documents/').pop()
      : doc.file_url;

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

  async function getSignedUrl(doc: ProductDocument): Promise<string | null> {
    if (doc.file_url.startsWith('http')) return doc.file_url;
    const { data } = await supabase.storage
      .from('product-documents')
      .createSignedUrl(doc.file_url, 600);
    return data?.signedUrl || null;
  }

  async function handlePreview(doc: ProductDocument) {
    const url = await getSignedUrl(doc);
    if (url) {
      setPreviewUrl(url);
      setPreviewName(language === 'ko' ? doc.name_ko : doc.name_en);
    } else {
      toast.error(language === 'ko' ? '미리보기 실패' : 'Preview failed');
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

  // Group documents by type
  const groupedDocs = DOC_TYPES
    .map(dt => ({
      ...dt,
      docs: documents.filter(d => d.document_type === dt.value),
    }))
    .filter(g => g.docs.length > 0);

  return (
    <div className="space-y-4 border-t border-border pt-4 mt-4">
      <h4 className="font-medium text-sm flex items-center gap-2">
        <FileText className="h-4 w-4" />
        {language === 'ko' ? '상품 문서 관리' : 'Product Documents'}
        <span className="text-xs text-muted-foreground">({documents.length})</span>
      </h4>

      {/* Upload form */}
      <div className="grid gap-3 p-3 bg-muted/30 rounded-lg">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">{language === 'ko' ? '문서명 (한글)' : 'Name (KO)'}</Label>
            <Input
              value={nameKo}
              onChange={(e) => setNameKo(e.target.value)}
              placeholder={language === 'ko' ? '미입력시 파일명 사용' : 'Defaults to filename'}
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">{language === 'ko' ? '문서명 (영문)' : 'Name (EN)'}</Label>
            <Input
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              placeholder={language === 'ko' ? '미입력시 파일명 사용' : 'Defaults to filename'}
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
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              {uploading
                ? (language === 'ko' ? '업로드중...' : 'Uploading...')
                : (language === 'ko' ? 'PDF 업로드 (복수 가능)' : 'Upload PDFs')}
            </Label>
            <input
              id={`doc-upload-${productId}`}
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              multiple
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
          </div>
        </div>
      </div>

      {/* Document list grouped by type */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : documents.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {language === 'ko' ? '등록된 문서가 없습니다.' : 'No documents yet.'}
        </p>
      ) : (
        <div className="space-y-4">
          {groupedDocs.map(group => (
            <div key={group.value}>
              <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                {language === 'ko' ? group.ko : group.en} ({group.docs.length})
              </h5>
              <div className="space-y-1.5">
                {group.docs.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between p-2 rounded border border-border bg-background">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 text-destructive shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {language === 'ko' ? doc.name_ko : doc.name_en}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {doc.file_size ? formatFileSize(doc.file_size) : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="sm" title={language === 'ko' ? '미리보기' : 'Preview'}
                        onClick={() => handlePreview(doc)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" title={language === 'ko' ? '다운로드' : 'Download'}
                        onClick={async () => {
                          const url = await getSignedUrl(doc);
                          if (url) window.open(url, '_blank');
                        }}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(doc)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PDF Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={(open) => { if (!open) setPreviewUrl(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-destructive" />
              {previewName}
            </DialogTitle>
          </DialogHeader>
          <div className="w-full h-[70vh]">
            {previewUrl && (
              <iframe
                src={previewUrl}
                className="w-full h-full rounded border border-border"
                title="PDF Preview"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
