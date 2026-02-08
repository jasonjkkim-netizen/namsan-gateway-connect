import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/Header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminClients } from '@/components/admin/AdminClients';
import { AdminInvestments } from '@/components/admin/AdminInvestments';
import { AdminProducts } from '@/components/admin/AdminProducts';
import { AdminResearch } from '@/components/admin/AdminResearch';
import { AdminVideos } from '@/components/admin/AdminVideos';
import { AdminApprovals } from '@/components/admin/AdminApprovals';
import { AdminMarketOverview } from '@/components/admin/AdminMarketOverview';
import { supabase } from '@/integrations/supabase/client';
import { Users, Briefcase, Package, FileText, PlayCircle, UserCheck, TrendingUp } from 'lucide-react';

export default function Admin() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAdmin() {
      if (!user) {
        navigate('/login');
        return;
      }

      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (data) {
        setIsAdmin(true);
      } else {
        navigate('/dashboard');
      }
      setLoading(false);
    }

    checkAdmin();
  }, [user, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const tabs = [
    { id: 'approvals', label: language === 'ko' ? '가입 승인' : 'Approvals', icon: UserCheck },
    { id: 'clients', label: language === 'ko' ? '고객 관리' : 'Clients', icon: Users },
    { id: 'investments', label: language === 'ko' ? '투자 관리' : 'Investments', icon: Briefcase },
    { id: 'products', label: language === 'ko' ? '상품 관리' : 'Products', icon: Package },
    { id: 'research', label: language === 'ko' ? '리서치 관리' : 'Research', icon: FileText },
    { id: 'videos', label: language === 'ko' ? '비디오 관리' : 'Videos', icon: PlayCircle },
    { id: 'market', label: language === 'ko' ? '시장 개요' : 'Market', icon: TrendingUp },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl font-serif font-semibold text-foreground">
            {language === 'ko' ? '관리자 패널' : 'Admin Panel'}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {language === 'ko' ? '고객 데이터 및 콘텐츠를 관리하세요' : 'Manage client data and content'}
          </p>
        </div>

        <Tabs defaultValue="approvals" className="space-y-6">
          <TabsList className="grid w-full grid-cols-7 h-auto">
            {tabs.map(({ id, label, icon: Icon }) => (
              <TabsTrigger
                key={id}
                value={id}
                className="flex items-center gap-2 py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="approvals">
            <AdminApprovals />
          </TabsContent>

          <TabsContent value="clients">
            <AdminClients />
          </TabsContent>

          <TabsContent value="investments">
            <AdminInvestments />
          </TabsContent>

          <TabsContent value="products">
            <AdminProducts />
          </TabsContent>

          <TabsContent value="research">
            <AdminResearch />
          </TabsContent>

          <TabsContent value="videos">
            <AdminVideos />
          </TabsContent>

          <TabsContent value="market">
            <AdminMarketOverview />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
