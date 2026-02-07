import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'en' | 'ko';

interface Translations {
  [key: string]: {
    en: string;
    ko: string;
  };
}

const translations: Translations = {
  // Navigation
  dashboard: { en: 'Dashboard', ko: '대시보드' },
  products: { en: 'Products', ko: '상품' },
  research: { en: 'Research', ko: '리서치' },
  videos: { en: 'Videos', ko: '영상' },
  marketData: { en: 'Market Data', ko: '시장 데이터' },
  logout: { en: 'Logout', ko: '로그아웃' },
  login: { en: 'Login', ko: '로그인' },
  
  // Auth
  email: { en: 'Email', ko: '이메일' },
  password: { en: 'Password', ko: '비밀번호' },
  signIn: { en: 'Sign In', ko: '로그인' },
  signUp: { en: 'Sign Up', ko: '회원가입' },
  forgotPassword: { en: 'Forgot Password?', ko: '비밀번호 찾기' },
  noAccount: { en: "Don't have an account?", ko: '계정이 없으신가요?' },
  hasAccount: { en: 'Already have an account?', ko: '이미 계정이 있으신가요?' },
  fullName: { en: 'Full Name', ko: '성명' },
  welcomeBack: { en: 'Welcome back', ko: '환영합니다' },
  clientPortal: { en: 'Client Portal', ko: '고객 포털' },
  
  // Dashboard
  portfolioSummary: { en: 'Portfolio Summary', ko: '포트폴리오 요약' },
  totalInvested: { en: 'Total Invested', ko: '총 투자금액' },
  currentValue: { en: 'Current Value', ko: '현재 가치' },
  totalReturn: { en: 'Total Return', ko: '총 수익률' },
  myInvestments: { en: 'My Investments', ko: '내 투자' },
  recentDistributions: { en: 'Recent Distributions', ko: '최근 배당' },
  
  // Table headers
  productName: { en: 'Product Name', ko: '상품명' },
  type: { en: 'Type', ko: '유형' },
  amount: { en: 'Amount', ko: '금액' },
  startDate: { en: 'Start Date', ko: '시작일' },
  maturityDate: { en: 'Maturity Date', ko: '만기일' },
  expectedReturn: { en: 'Expected Return', ko: '예상 수익률' },
  status: { en: 'Status', ko: '상태' },
  date: { en: 'Date', ko: '날짜' },
  
  // Product types
  bond: { en: 'Bond', ko: '채권' },
  equity: { en: 'Equity', ko: '주식' },
  fund: { en: 'Fund', ko: '펀드' },
  real_estate: { en: 'Real Estate', ko: '부동산' },
  alternative: { en: 'Alternative', ko: '대체투자' },
  
  // Status
  active: { en: 'Active', ko: '활성' },
  matured: { en: 'Matured', ko: '만기' },
  pending: { en: 'Pending', ko: '대기' },
  closed: { en: 'Closed', ko: '종료' },
  open: { en: 'Open', ko: '모집중' },
  coming_soon: { en: 'Coming Soon', ko: '출시 예정' },
  
  // Products
  newProducts: { en: 'New Products', ko: '신규 상품' },
  targetReturn: { en: 'Target Return', ko: '목표 수익률' },
  minimumInvestment: { en: 'Minimum Investment', ko: '최소 투자금액' },
  deadline: { en: '募集 Deadline', ko: '모집 마감일' },
  learnMore: { en: 'Learn More', ko: '자세히 보기' },
  
  // Research
  researchReports: { en: 'Research Reports', ko: '리서치 보고서' },
  marketUpdate: { en: 'Market Update', ko: '시장 업데이트' },
  productAnalysis: { en: 'Product Analysis', ko: '상품 분석' },
  economicOutlook: { en: 'Economic Outlook', ko: '경제 전망' },
  downloadPdf: { en: 'Download PDF', ko: 'PDF 다운로드' },
  all: { en: 'All', ko: '전체' },
  
  // Videos
  videoLibrary: { en: 'Video Library', ko: '영상 라이브러리' },
  marketCommentary: { en: 'Market Commentary', ko: '시장 코멘터리' },
  productExplanation: { en: 'Product Explanation', ko: '상품 설명' },
  educational: { en: 'Educational', ko: '교육' },
  watchNow: { en: 'Watch Now', ko: '지금 보기' },
  
  // Market Data
  marketDataTitle: { en: 'Market Data', ko: '시장 데이터' },
  kospiIndex: { en: 'KOSPI Index', ko: 'KOSPI 지수' },
  usdKrw: { en: 'USD/KRW', ko: '달러/원' },
  us10yTreasury: { en: 'US 10Y Treasury', ko: '미국 10년물 국채' },
  sp500: { en: 'S&P 500', ko: 'S&P 500' },
  
  // Distribution types
  dividend: { en: 'Dividend', ko: '배당금' },
  interest: { en: 'Interest', ko: '이자' },
  capital_gain: { en: 'Capital Gain', ko: '자본이득' },
  return_of_capital: { en: 'Return of Capital', ko: '원본반환' },
  
  // Dashboard extras
  assetAllocation: { en: 'Asset Allocation', ko: '자산 배분' },
  
  // General
  loading: { en: 'Loading...', ko: '로딩 중...' },
  noData: { en: 'No data available', ko: '데이터가 없습니다' },
  error: { en: 'An error occurred', ko: '오류가 발생했습니다' },
  currency: { en: 'KRW', ko: '원' },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  formatCurrency: (amount: number) => string;
  formatDate: (date: string) => string;
  formatPercent: (value: number) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('preferredLanguage');
    return (saved as Language) || 'ko';
  });

  useEffect(() => {
    localStorage.setItem('preferredLanguage', language);
  }, [language]);

  const t = (key: string): string => {
    const translation = translations[key];
    if (!translation) {
      console.warn(`Translation missing for key: ${key}`);
      return key;
    }
    return translation[language];
  };

  const formatCurrency = (amount: number): string => {
    if (language === 'ko') {
      return `₩${amount.toLocaleString('ko-KR')}`;
    }
    return `₩${amount.toLocaleString('en-US')}`;
  };

  const formatDate = (date: string): string => {
    const d = new Date(date);
    if (language === 'ko') {
      return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
    }
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatPercent = (value: number): string => {
    return `${value.toFixed(2)}%`;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, formatCurrency, formatDate, formatPercent }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
