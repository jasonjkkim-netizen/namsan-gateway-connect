import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { MessageCircle, Mail, Phone } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ConsultationButtonProps {
  variant?: 'default' | 'gold' | 'outline';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
  productName?: string;
}

const WHATSAPP_NUMBER = '85294448661';
const EMAIL = 'jason.kim@namsan-partners.com';

export function ConsultationButton({ 
  variant = 'gold', 
  size = 'default',
  className = '',
  productName,
}: ConsultationButtonProps) {
  const { language } = useLanguage();

  const whatsappMessage = productName
    ? language === 'ko'
      ? `안녕하세요, ${productName} 상품에 대해 투자 상담을 요청드립니다.`
      : `Hello, I would like to request a consultation regarding ${productName}.`
    : language === 'ko'
      ? '안녕하세요, 투자 상담을 요청드립니다.'
      : 'Hello, I would like to request an investment consultation.';

  const emailSubject = productName
    ? language === 'ko'
      ? `[투자 상담 요청] ${productName}`
      : `[Consultation Request] ${productName}`
    : language === 'ko'
      ? '[투자 상담 요청]'
      : '[Consultation Request]';

  const emailBody = productName
    ? language === 'ko'
      ? `안녕하세요,\n\n${productName} 상품에 대해 투자 상담을 요청드립니다.\n\n감사합니다.`
      : `Hello,\n\nI would like to request a consultation regarding ${productName}.\n\nThank you.`
    : language === 'ko'
      ? '안녕하세요,\n\n투자 상담을 요청드립니다.\n\n감사합니다.'
      : 'Hello,\n\nI would like to request an investment consultation.\n\nThank you.';

  const handleWhatsApp = () => {
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappMessage)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleEmail = () => {
    const url = `mailto:${EMAIL}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
    window.location.href = url;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          <Phone className="h-4 w-4 mr-1.5" />
          {language === 'ko' ? '투자 상담' : 'Consultation'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={handleWhatsApp} className="cursor-pointer gap-3 py-3">
          <MessageCircle className="h-4 w-4 text-[#25D366]" />
          <div>
            <p className="font-medium">WhatsApp</p>
            <p className="text-xs text-muted-foreground">+852 9444 8661</p>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleEmail} className="cursor-pointer gap-3 py-3">
          <Mail className="h-4 w-4 text-accent" />
          <div>
            <p className="font-medium">{language === 'ko' ? '이메일' : 'Email'}</p>
            <p className="text-xs text-muted-foreground">{EMAIL}</p>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
