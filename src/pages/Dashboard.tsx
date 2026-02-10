import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { PortfolioSummary } from '@/components/dashboard/PortfolioSummary';
import { InvestmentsTable } from '@/components/dashboard/InvestmentsTable';
import { DistributionsTable } from '@/components/dashboard/DistributionsTable';
import { AssetAllocationChart } from '@/components/dashboard/AssetAllocationChart';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, Package, FileText, PlayCircle, BookOpen } from 'lucide-react';

interface Investment {
  id: string;
  product_name_en: string;
  product_name_ko: string;
  investment_amount: number;
  current_value: number;
  start_date: string;
  maturity_date: string | null;
  expected_return: number | null;
  status: string;
}

interface Distribution {
  id: string;
  amount: number;
  type: string;
  distribution_date: string;
  description_en: string | null;
  description_ko: string | null;
}

export default function Dashboard() {
  const { t, language } = useLanguage();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [loading, setLoading] = useState(true);

  const sections = [
    { path: '/market-data', label: t('marketData'), icon: TrendingUp },
    { path: '/dashboard', label: t('dashboard'), icon: TrendingUp, active: true },
    { path: '/products', label: t('products'), icon: Package },
    { path: '/research', label: t('research'), icon: FileText },
    { path: '/blog', label: language === 'ko' ? '블로그' : 'Blog', icon: BookOpen },
    { path: '/videos', label: t('videos'), icon: PlayCircle },
  ];

  useEffect(() => {
    async function fetchData() {
      const [investmentsRes, distributionsRes] = await Promise.all([
        supabase.from('client_investments').select('*').order('start_date', { ascending: false }),
        supabase.from('distributions').select('*').order('distribution_date', { ascending: false }).limit(10),
      ]);

      if (investmentsRes.data) setInvestments(investmentsRes.data as Investment[]);
      if (distributionsRes.data) setDistributions(distributionsRes.data as Distribution[]);
      setLoading(false);
    }

    fetchData();
  }, []);

  const totalInvested = investments.reduce((sum, inv) => sum + Number(inv.investment_amount), 0);
  const currentValue = investments.reduce((sum, inv) => sum + Number(inv.current_value), 0);
  const totalReturn = totalInvested > 0 ? ((currentValue - totalInvested) / totalInvested) * 100 : 0;

  const displayName = language === 'ko' && profile?.full_name_ko 
    ? profile.full_name_ko 
    : profile?.full_name;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl font-serif font-semibold text-foreground">
            {t('welcomeBack')}, {displayName}
          </h1>
          <p className="mt-1 text-muted-foreground">{t('portfolioSummary')}</p>
        </div>

        {/* Section Navigation Buttons */}
        <div className="mb-8 animate-fade-in" style={{ animationDelay: '50ms' }}>
          <p className="text-sm text-muted-foreground mb-3">
            {language === 'ko' ? '섹션으로 이동' : 'Navigate to section'}
          </p>
          <div className="flex flex-wrap gap-3">
            {sections.map((section) => (
              <Button
                key={section.path}
                variant={section.active ? "default" : "outline"}
                onClick={() => !section.active && navigate(section.path)}
                className={`flex items-center gap-2 ${section.active ? 'pointer-events-none' : ''}`}
              >
                <section.icon className="h-4 w-4" />
                {section.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-8">
          <PortfolioSummary 
            totalInvested={totalInvested}
            currentValue={currentValue}
            totalReturn={totalReturn}
            loading={loading}
          />

          <div className="grid gap-8 lg:grid-cols-2">
            <AssetAllocationChart investments={investments} loading={loading} />
            <DistributionsTable distributions={distributions} loading={loading} />
          </div>

          <InvestmentsTable investments={investments} loading={loading} />
        </div>
      </main>
    </div>
  );
}