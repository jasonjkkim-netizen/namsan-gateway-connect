import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { ProductPopup } from "@/components/ProductPopup";
import { useAuthLanguageSync } from "@/hooks/useAuthLanguageSync";
import Home from "./pages/Home";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import ProductDetail from "./pages/ProductDetail";
import Research from "./pages/Research";
import Videos from "./pages/Videos";
import Blog from "./pages/Blog";
import MarketData from "./pages/MarketData";
import Admin from "./pages/Admin";
import PendingApproval from "./pages/PendingApproval";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// WhatsApp phone number for customer support (Hong Kong)
const WHATSAPP_PHONE = "85294448661";

// Component to sync language with auth state
function AuthLanguageSyncProvider({ children }: { children: React.ReactNode }) {
  useAuthLanguageSync();
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <AuthProvider>
        <AuthLanguageSyncProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/dashboard" element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                } />
                <Route path="/products" element={
                  <ProtectedRoute>
                    <Products />
                  </ProtectedRoute>
                } />
                <Route path="/products/:id" element={
                  <ProtectedRoute>
                    <ProductDetail />
                  </ProtectedRoute>
                } />
                <Route path="/research" element={
                  <ProtectedRoute>
                    <Research />
                  </ProtectedRoute>
                } />
                <Route path="/blog" element={<Blog />} />
                <Route path="/videos" element={
                  <ProtectedRoute>
                    <Videos />
                  </ProtectedRoute>
                } />
                <Route path="/market-data" element={<MarketData />} />
                <Route path="/pending-approval" element={
                  <ProtectedRoute requireApproval={false}>
                    <PendingApproval />
                  </ProtectedRoute>
                } />
                <Route path="/admin" element={
                  <ProtectedRoute>
                    <Admin />
                  </ProtectedRoute>
                } />
                <Route path="*" element={<NotFound />} />
              </Routes>
              <ProductPopup />
              <ChatWidget />
              <WhatsAppButton
                phoneNumber={WHATSAPP_PHONE} 
                message="안녕하세요, 남산 코리아에 문의드립니다."
              />
            </BrowserRouter>
          </TooltipProvider>
        </AuthLanguageSyncProvider>
      </AuthProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
