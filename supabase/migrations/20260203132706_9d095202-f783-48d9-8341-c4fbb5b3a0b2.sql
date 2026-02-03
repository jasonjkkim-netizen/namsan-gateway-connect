-- Create profiles table for storing user profile data
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  full_name_ko TEXT,
  phone TEXT,
  preferred_language TEXT DEFAULT 'en' CHECK (preferred_language IN ('en', 'ko')),
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- Create investment products table
CREATE TABLE public.investment_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name_en TEXT NOT NULL,
  name_ko TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('bond', 'equity', 'fund', 'real_estate', 'alternative')),
  description_en TEXT,
  description_ko TEXT,
  target_return DECIMAL(5,2),
  minimum_investment DECIMAL(15,2),
  募集_deadline DATE,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed', 'coming_soon')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on investment_products
ALTER TABLE public.investment_products ENABLE ROW LEVEL SECURITY;

-- Products are viewable by authenticated users
CREATE POLICY "Authenticated users can view active products" ON public.investment_products
  FOR SELECT TO authenticated USING (is_active = true);

-- Create client investments table
CREATE TABLE public.client_investments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.investment_products(id) ON DELETE SET NULL,
  product_name_en TEXT NOT NULL,
  product_name_ko TEXT NOT NULL,
  investment_amount DECIMAL(15,2) NOT NULL,
  current_value DECIMAL(15,2) NOT NULL,
  start_date DATE NOT NULL,
  maturity_date DATE,
  expected_return DECIMAL(5,2),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'matured', 'pending', 'closed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on client_investments
ALTER TABLE public.client_investments ENABLE ROW LEVEL SECURITY;

-- Clients can only view their own investments
CREATE POLICY "Users can view their own investments" ON public.client_investments
  FOR SELECT USING (auth.uid() = user_id);

-- Create distributions table
CREATE TABLE public.distributions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  investment_id UUID REFERENCES public.client_investments(id) ON DELETE SET NULL,
  amount DECIMAL(15,2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('dividend', 'interest', 'capital_gain', 'return_of_capital')),
  distribution_date DATE NOT NULL,
  description_en TEXT,
  description_ko TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on distributions
ALTER TABLE public.distributions ENABLE ROW LEVEL SECURITY;

-- Clients can only view their own distributions
CREATE POLICY "Users can view their own distributions" ON public.distributions
  FOR SELECT USING (auth.uid() = user_id);

-- Create research reports table
CREATE TABLE public.research_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title_en TEXT NOT NULL,
  title_ko TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('market_update', 'product_analysis', 'economic_outlook')),
  summary_en TEXT,
  summary_ko TEXT,
  pdf_url TEXT,
  publication_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on research_reports
ALTER TABLE public.research_reports ENABLE ROW LEVEL SECURITY;

-- Research is viewable by authenticated users
CREATE POLICY "Authenticated users can view active research" ON public.research_reports
  FOR SELECT TO authenticated USING (is_active = true);

-- Create videos table
CREATE TABLE public.videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title_en TEXT NOT NULL,
  title_ko TEXT NOT NULL,
  youtube_url TEXT NOT NULL,
  thumbnail_url TEXT,
  category TEXT NOT NULL CHECK (category IN ('market_commentary', 'product_explanation', 'educational')),
  description_en TEXT,
  description_ko TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on videos
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

-- Videos are viewable by authenticated users
CREATE POLICY "Authenticated users can view active videos" ON public.videos
  FOR SELECT TO authenticated USING (is_active = true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_investment_products_updated_at
  BEFORE UPDATE ON public.investment_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_client_investments_updated_at
  BEFORE UPDATE ON public.client_investments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for auto-creating profiles on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert sample investment products
INSERT INTO public.investment_products (name_en, name_ko, type, description_en, description_ko, target_return, minimum_investment, status) VALUES
('Korea Corporate Bond Fund I', '한국 회사채 펀드 I', 'bond', 'High-grade Korean corporate bonds with stable returns', '안정적인 수익률의 우량 한국 회사채', 5.50, 100000000, 'open'),
('Seoul Real Estate Income Trust', '서울 부동산 수익신탁', 'real_estate', 'Premium office buildings in Seoul CBD', '서울 CBD 프리미엄 오피스 빌딩', 7.20, 500000000, 'open'),
('Asia Growth Equity Fund', '아시아 성장주 펀드', 'equity', 'Diversified equity portfolio across Asian markets', '아시아 시장 전반의 분산 주식 포트폴리오', 12.00, 50000000, 'open'),
('Korea Infrastructure Fund II', '한국 인프라 펀드 II', 'alternative', 'Long-term infrastructure investments in Korea', '한국 장기 인프라 투자', 6.80, 200000000, 'coming_soon');

-- Insert sample research reports
INSERT INTO public.research_reports (title_en, title_ko, category, summary_en, summary_ko, publication_date) VALUES
('Q1 2025 Market Outlook', '2025년 1분기 시장 전망', 'market_update', 'Analysis of key market trends and investment opportunities for Q1 2025', '2025년 1분기 주요 시장 트렌드 및 투자 기회 분석', '2025-01-15'),
('Korean Bond Market Analysis', '한국 채권 시장 분석', 'product_analysis', 'Deep dive into Korean corporate and government bond markets', '한국 회사채 및 국채 시장 심층 분석', '2025-01-20'),
('Global Economic Outlook 2025', '2025년 글로벌 경제 전망', 'economic_outlook', 'Comprehensive analysis of global economic trends', '글로벌 경제 동향 종합 분석', '2025-02-01');

-- Insert sample videos
INSERT INTO public.videos (title_en, title_ko, youtube_url, category, description_en, description_ko) VALUES
('January 2025 Market Commentary', '2025년 1월 시장 코멘터리', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'market_commentary', 'Monthly market review and outlook', '월간 시장 리뷰 및 전망'),
('Understanding Korean Bond Markets', '한국 채권 시장 이해하기', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'educational', 'Educational video on bond market fundamentals', '채권 시장 기초 교육 영상'),
('Seoul RE Trust Product Overview', '서울 부동산 신탁 상품 소개', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'product_explanation', 'Detailed overview of our flagship real estate product', '주력 부동산 상품 상세 소개');