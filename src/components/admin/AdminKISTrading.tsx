import { useLanguage } from '@/contexts/LanguageContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KISBalanceView } from './kis/KISBalanceView';
import { KISPriceLookup } from './kis/KISPriceLookup';

export function AdminKISTrading() {
  const { language } = useLanguage();

  return (
    <div className="space-y-4">
      <Tabs defaultValue="balance">
        <TabsList>
          <TabsTrigger value="balance">
            {language === 'ko' ? '💰 잔고 조회' : '💰 Balance'}
          </TabsTrigger>
          <TabsTrigger value="price">
            {language === 'ko' ? '📊 시세 조회' : '📊 Price'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="balance">
          <KISBalanceView />
        </TabsContent>

        <TabsContent value="price">
          <KISPriceLookup />
        </TabsContent>
      </Tabs>
    </div>
  );
}
