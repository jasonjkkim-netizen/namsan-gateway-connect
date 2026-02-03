import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setLanguage(language === 'en' ? 'ko' : 'en')}
      className="flex items-center gap-2 text-sm font-medium hover:bg-primary/10"
    >
      <Globe className="h-4 w-4" />
      <span className="uppercase">{language === 'en' ? 'KR' : 'EN'}</span>
    </Button>
  );
}
