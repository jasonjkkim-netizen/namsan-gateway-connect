import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';

const PLACEHOLDER_URL = 'https://your-kis-app.replit.app';

export function AdminKISTrading() {
  const { language } = useLanguage();
  const [appUrl, setAppUrl] = useState(() => localStorage.getItem('kis_app_url') || PLACEHOLDER_URL);
  const [editing, setEditing] = useState(false);
  const [tempUrl, setTempUrl] = useState(appUrl);

  const handleSave = () => {
    setAppUrl(tempUrl);
    localStorage.setItem('kis_app_url', tempUrl);
    setEditing(false);
  };

  const isPlaceholder = appUrl === PLACEHOLDER_URL;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              {language === 'ko' ? '📈 KIS 통합 트레이딩' : '📈 KIS Trading Dashboard'}
            </CardTitle>
            <div className="flex items-center gap-2">
              {editing ? (
                <>
                  <Input
                    value={tempUrl}
                    onChange={(e) => setTempUrl(e.target.value)}
                    placeholder="https://your-app.replit.app"
                    className="w-80 h-8 text-sm"
                  />
                  <Button size="sm" onClick={handleSave}>
                    {language === 'ko' ? '저장' : 'Save'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                    {language === 'ko' ? '취소' : 'Cancel'}
                  </Button>
                </>
              ) : (
                <>
                  <span className="text-xs text-muted-foreground truncate max-w-[300px]">{appUrl}</span>
                  <Button size="sm" variant="outline" onClick={() => { setTempUrl(appUrl); setEditing(true); }}>
                    {language === 'ko' ? 'URL 변경' : 'Change URL'}
                  </Button>
                  {!isPlaceholder && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={appUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5 mr-1" />
                        {language === 'ko' ? '새 탭' : 'New Tab'}
                      </a>
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isPlaceholder ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
              <p className="text-lg font-medium">
                {language === 'ko' ? 'KIS 트레이딩 앱 URL을 설정해주세요' : 'Please set your KIS Trading app URL'}
              </p>
              <p className="text-sm">
                {language === 'ko' ? '오른쪽 상단의 "URL 변경" 버튼을 클릭하세요' : 'Click "Change URL" button above'}
              </p>
            </div>
          ) : (
            <iframe
              src={appUrl}
              className="w-full border-0 rounded-b-lg"
              style={{ height: 'calc(100vh - 280px)', minHeight: '500px' }}
              title="KIS Trading Dashboard"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
