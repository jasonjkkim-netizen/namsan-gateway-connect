import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown, ExternalLink } from 'lucide-react';

const SYNC_TABLES = [
  { key: 'products', labelKo: '상품', labelEn: 'Products' },
  { key: 'members', labelKo: '멤버', labelEn: 'Members' },
  { key: 'commissionRates', labelKo: '커미션 요율', labelEn: 'Commission Rates' },
  { key: 'investments', labelKo: '투자 내역', labelEn: 'Investments' },
  { key: 'distributions', labelKo: '커미션 분배', labelEn: 'Distributions' },
];

interface SyncResult {
  table: string;
  created: number;
  updated: number;
  errors: string[];
}

export default function AdminNotionSync() {
  const { language } = useLanguage();
  const [syncing, setSyncing] = useState(false);
  const [direction, setDirection] = useState('db_to_notion');
  const [selectedTables, setSelectedTables] = useState<string[]>(SYNC_TABLES.map(t => t.key));
  const [results, setResults] = useState<SyncResult[] | null>(null);

  const toggleTable = (key: string) => {
    setSelectedTables(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleSync = async () => {
    if (selectedTables.length === 0) {
      toast.error(language === 'ko' ? '동기화할 테이블을 선택해주세요' : 'Please select tables to sync');
      return;
    }

    setSyncing(true);
    setResults(null);

    try {
      const { data, error } = await supabase.functions.invoke('notion-sync', {
        body: { direction, tables: selectedTables },
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setResults(data.results);
      const totalCreated = data.results.reduce((s: number, r: SyncResult) => s + r.created, 0);
      const totalUpdated = data.results.reduce((s: number, r: SyncResult) => s + r.updated, 0);
      const totalErrors = data.results.reduce((s: number, r: SyncResult) => s + r.errors.length, 0);

      if (totalErrors > 0) {
        toast.warning(
          language === 'ko'
            ? `동기화 완료 (생성: ${totalCreated}, 업데이트: ${totalUpdated}, 오류: ${totalErrors})`
            : `Sync completed (Created: ${totalCreated}, Updated: ${totalUpdated}, Errors: ${totalErrors})`
        );
      } else {
        toast.success(
          language === 'ko'
            ? `동기화 완료! 생성: ${totalCreated}, 업데이트: ${totalUpdated}`
            : `Sync complete! Created: ${totalCreated}, Updated: ${totalUpdated}`
        );
      }
    } catch (err: any) {
      console.error('Notion sync error:', err);
      toast.error(err.message || (language === 'ko' ? '동기화 실패' : 'Sync failed'));
    } finally {
      setSyncing(false);
    }
  };

  const directionLabel = {
    db_to_notion: { ko: 'DB → Notion', en: 'DB → Notion', icon: ArrowUp },
    notion_to_db: { ko: 'Notion → DB', en: 'Notion → DB', icon: ArrowDown },
    both: { ko: '양방향', en: 'Both Directions', icon: ArrowUpDown },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          {language === 'ko' ? 'Notion 동기화' : 'Notion Sync'}
        </CardTitle>
        <CardDescription>
          {language === 'ko'
            ? '데이터베이스와 Notion 워크스페이스 간 데이터를 동기화합니다.'
            : 'Synchronize data between the database and Notion workspace.'}
          <a
            href="https://www.notion.so/33c8dbe731a9815e8ffbe30398f8d372"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 ml-2 text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            {language === 'ko' ? 'Notion 열기' : 'Open Notion'}
          </a>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Direction Selection */}
        <div className="space-y-2">
          <Label>{language === 'ko' ? '동기화 방향' : 'Sync Direction'}</Label>
          <Select value={direction} onValueChange={setDirection}>
            <SelectTrigger className="w-full max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="db_to_notion">
                <span className="flex items-center gap-2">
                  <ArrowUp className="h-4 w-4" />
                  DB → Notion
                </span>
              </SelectItem>
              <SelectItem value="notion_to_db">
                <span className="flex items-center gap-2">
                  <ArrowDown className="h-4 w-4" />
                  Notion → DB
                </span>
              </SelectItem>
              <SelectItem value="both">
                <span className="flex items-center gap-2">
                  <ArrowUpDown className="h-4 w-4" />
                  {language === 'ko' ? '양방향' : 'Both Directions'}
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table Selection */}
        <div className="space-y-2">
          <Label>{language === 'ko' ? '동기화 대상' : 'Tables to Sync'}</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {SYNC_TABLES.map(table => (
              <label
                key={table.key}
                className="flex items-center gap-2 p-2 border rounded-md cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <Checkbox
                  checked={selectedTables.includes(table.key)}
                  onCheckedChange={() => toggleTable(table.key)}
                />
                <span className="text-sm">{language === 'ko' ? table.labelKo : table.labelEn}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Sync Button */}
        <Button onClick={handleSync} disabled={syncing || selectedTables.length === 0} className="w-full sm:w-auto">
          {syncing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {language === 'ko' ? '동기화 중...' : 'Syncing...'}
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              {language === 'ko' ? '동기화 실행' : 'Run Sync'}
            </>
          )}
        </Button>

        {/* Results */}
        {results && (
          <div className="space-y-3">
            <Label>{language === 'ko' ? '동기화 결과' : 'Sync Results'}</Label>
            <div className="space-y-2">
              {results.map((r, i) => {
                const tableInfo = SYNC_TABLES.find(t => t.key === r.table);
                return (
                  <div key={i} className="flex items-center gap-3 p-3 border rounded-md">
                    <span className="font-medium text-sm min-w-[120px]">
                      {language === 'ko' ? tableInfo?.labelKo : tableInfo?.labelEn}
                    </span>
                    <Badge variant="secondary">
                      {language === 'ko' ? `생성 ${r.created}` : `Created ${r.created}`}
                    </Badge>
                    <Badge variant="outline">
                      {language === 'ko' ? `업데이트 ${r.updated}` : `Updated ${r.updated}`}
                    </Badge>
                    {r.errors.length > 0 && (
                      <Badge variant="destructive">
                        {language === 'ko' ? `오류 ${r.errors.length}` : `Errors ${r.errors.length}`}
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
            {results.some(r => r.errors.length > 0) && (
              <div className="mt-2 p-3 bg-destructive/10 rounded-md text-sm">
                <p className="font-medium text-destructive mb-1">
                  {language === 'ko' ? '오류 상세:' : 'Error Details:'}
                </p>
                {results.flatMap(r => r.errors).map((err, i) => (
                  <p key={i} className="text-destructive/80">• {err}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
