import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldAlert } from 'lucide-react';
import { canOpenFinance } from '@/features/finance/engine';
export function WebmasterRoute({children}:{children:React.ReactNode}) {
 const {user,profile,loading}=useAuth(); const {language}=useLanguage();
 if(loading)return <div className="min-h-screen grid place-items-center"><Loader2 role="status" aria-label="Loading" className="h-8 w-8 animate-spin text-primary"/></div>;
 if(!user)return <Navigate to="/login" replace/>;
 if(!canOpenFinance(user,profile?.sales_role))return <div className="min-h-screen flex flex-col items-center justify-center gap-4"><ShieldAlert className="h-10 w-10 text-destructive"/><h1 className="text-2xl">{language==='ko'?'접근 권한이 없습니다':'Access denied'}</h1><p>{language==='ko'?'현재 역할':'Your role'}: {profile?.sales_role||'none'}</p><Button asChild><a href="/dashboard">{language==='ko'?'대시보드로 돌아가기':'Back to dashboard'}</a></Button></div>;
 return <>{children}</>;
}
