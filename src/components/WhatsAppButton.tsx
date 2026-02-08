import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WhatsAppButtonProps {
  phoneNumber: string;
  message?: string;
}

export function WhatsAppButton({ 
  phoneNumber, 
  message = 'Hello, I would like to inquire about your services.' 
}: WhatsAppButtonProps) {
  const handleClick = () => {
    // Remove any non-digit characters from phone number
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${cleanNumber}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <Button
      onClick={handleClick}
      className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-[#25D366] hover:bg-[#128C7E] shadow-lg transition-all duration-300 hover:scale-110"
      size="icon"
      aria-label="Chat on WhatsApp"
    >
      <MessageCircle className="h-7 w-7 text-white fill-white" />
    </Button>
  );
}
