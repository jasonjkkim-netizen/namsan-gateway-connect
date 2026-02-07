import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Clock, LogOut, RefreshCw } from 'lucide-react';
import logo from '@/assets/logo.jpg';

export default function PendingApproval() {
  const { language } = useLanguage();
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-md text-center">
        <div className="flex justify-center mb-8">
          <img src={logo} alt="Namsan Korea" className="h-20 w-auto" />
        </div>
        
        <div className="card-elevated p-8">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-accent/10 rounded-full">
              <Clock className="h-12 w-12 text-accent" />
            </div>
          </div>
          
          <h1 className="text-2xl font-serif font-semibold text-foreground mb-4">
            {language === 'ko' ? '승인 대기 중' : 'Pending Approval'}
          </h1>
          
          <p className="text-muted-foreground mb-6 leading-relaxed">
            {language === 'ko'
              ? '회원가입이 완료되었습니다. 관리자의 승인을 기다리고 있습니다. 승인이 완료되면 서비스를 이용하실 수 있습니다.'
              : 'Your registration is complete. Please wait for administrator approval. You will be able to access the service once approved.'}
          </p>
          
          <div className="bg-secondary/50 rounded-lg p-4 mb-6">
            <p className="text-sm text-muted-foreground">
              {language === 'ko'
                ? '문의사항이 있으시면 info@namsankorea.com으로 연락해 주세요.'
                : 'If you have any questions, please contact info@namsankorea.com.'}
            </p>
          </div>
          
          <div className="flex flex-col gap-3">
            <Button onClick={handleRefresh} variant="outline" className="w-full">
              <RefreshCw className="h-4 w-4 mr-2" />
              {language === 'ko' ? '상태 새로고침' : 'Refresh Status'}
            </Button>
            <Button onClick={handleLogout} variant="ghost" className="w-full text-muted-foreground">
              <LogOut className="h-4 w-4 mr-2" />
              {language === 'ko' ? '로그아웃' : 'Logout'}
            </Button>
          </div>
        </div>
        
        <p className="mt-8 text-sm text-muted-foreground">
          © {new Date().getFullYear()} Namsan Korea. {language === 'ko' ? '모든 권리 보유.' : 'All rights reserved.'}
        </p>
      </div>
    </div>
  );
}
