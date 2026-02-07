import { useState, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Upload, FileSpreadsheet, X, CheckCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ExcelUploadProps {
  onDataParsed: (data: Record<string, any>[]) => void;
  expectedColumns: string[];
  templateName?: string;
}

export function ExcelUpload({ onDataParsed, expectedColumns, templateName }: ExcelUploadProps) {
  const { language } = useLanguage();
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parsedCount, setParsedCount] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ];

    if (!validTypes.includes(selectedFile.type) && !selectedFile.name.endsWith('.csv')) {
      toast.error(language === 'ko' ? '엑셀 또는 CSV 파일만 업로드 가능합니다' : 'Only Excel or CSV files are allowed');
      return;
    }

    setFile(selectedFile);
    setParsedCount(null);
  };

  const parseFile = async () => {
    if (!file) return;

    setParsing(true);
    try {
      // File size limit: 10MB
      if (file.size > 10 * 1024 * 1024) {
        toast.error(language === 'ko' ? '파일이 너무 큽니다 (최대 10MB)' : 'File too large (max 10MB)');
        setParsing(false);
        return;
      }

      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as Record<string, any>[];

      // Row count limit: 10,000 rows
      if (jsonData.length > 10000) {
        toast.error(language === 'ko' ? '너무 많은 행입니다 (최대 10,000행)' : 'Too many rows (max 10,000)');
        setParsing(false);
        return;
      }

      if (jsonData.length === 0) {
        toast.error(language === 'ko' ? '파일에 데이터가 없습니다' : 'No data found in file');
        setParsing(false);
        return;
      }

      // Check for expected columns
      const firstRow = jsonData[0];
      const fileColumns = Object.keys(firstRow);
      const missingColumns = expectedColumns.filter(col => !fileColumns.includes(col));

      if (missingColumns.length > 0) {
        toast.error(
          language === 'ko'
            ? `누락된 컬럼: ${missingColumns.join(', ')}`
            : `Missing columns: ${missingColumns.join(', ')}`
        );
        setParsing(false);
        return;
      }

      setParsedCount(jsonData.length);
      onDataParsed(jsonData);
      toast.success(
        language === 'ko'
          ? `${jsonData.length}개 행 파싱 완료`
          : `${jsonData.length} rows parsed successfully`
      );
    } catch (error) {
      console.error('Parse error:', error);
      toast.error(language === 'ko' ? '파일 파싱 중 오류 발생' : 'Error parsing file');
    } finally {
      setParsing(false);
    }
  };

  const downloadTemplate = () => {
    const worksheet = XLSX.utils.json_to_sheet([
      expectedColumns.reduce((acc, col) => ({ ...acc, [col]: '' }), {}),
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
    XLSX.writeFile(workbook, `${templateName || 'template'}.xlsx`);
  };

  const clearFile = () => {
    setFile(null);
    setParsedCount(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          onClick={downloadTemplate}
          className="flex items-center gap-2"
        >
          <FileSpreadsheet className="h-4 w-4" />
          {language === 'ko' ? '템플릿 다운로드' : 'Download Template'}
        </Button>
      </div>

      <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
        <Input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileChange}
          className="hidden"
          id="excel-upload"
        />
        
        {!file ? (
          <label
            htmlFor="excel-upload"
            className="cursor-pointer flex flex-col items-center gap-2"
          >
            <Upload className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {language === 'ko'
                ? '엑셀 파일을 선택하거나 드래그하세요'
                : 'Click to select or drag Excel file'}
            </p>
            <p className="text-xs text-muted-foreground">
              .xlsx, .xls, .csv
            </p>
          </label>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-8 w-8 text-accent" />
              <div className="text-left">
                <p className="font-medium text-foreground">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={clearFile}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {parsedCount !== null && (
              <div className="flex items-center gap-2 text-success">
                <CheckCircle className="h-5 w-5" />
                <span>
                  {language === 'ko'
                    ? `${parsedCount}개 행 준비 완료`
                    : `${parsedCount} rows ready`}
                </span>
              </div>
            )}

            {parsedCount === null && (
              <Button onClick={parseFile} disabled={parsing} className="btn-gold">
                {parsing
                  ? (language === 'ko' ? '파싱 중...' : 'Parsing...')
                  : (language === 'ko' ? '파일 파싱' : 'Parse File')}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
