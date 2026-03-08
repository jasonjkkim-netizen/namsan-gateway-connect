import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface WhatsAppButtonProps {
  phoneNumber: string;
  message?: string;
}

export function WhatsAppButton({ 
  phoneNumber, 
  message = 'Hello, I would like to inquire about your services.' 
}: WhatsAppButtonProps) {
  const handleClick = () => {
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${cleanNumber}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          onClick={handleClick}
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-[#25D366] hover:bg-[#128C7E] shadow-lg transition-all duration-300 hover:scale-110 p-0"
          size="icon"
          aria-label="Chat on WhatsApp"
        >
          <svg viewBox="0 0 32 32" className="h-7 w-7 fill-white">
            <path d="M16.004 0h-.008C7.174 0 0 7.176 0 16c0 3.5 1.129 6.744 3.047 9.379L1.054 31.49l6.328-2.032C9.94 31.07 12.862 32 16.004 32 24.826 32 32 24.822 32 16S24.826 0 16.004 0zm9.332 22.584c-.39 1.098-1.932 2.01-3.17 2.276-.846.18-1.95.324-5.67-1.218-4.762-1.974-7.826-6.81-8.064-7.124-.23-.314-1.924-2.562-1.924-4.888 0-2.326 1.218-3.47 1.65-3.942.39-.428 1.026-.626 1.632-.626.198 0 .374.01.534.018.47.02.706.048 1.016.786.39.924 1.34 3.268 1.458 3.506.12.238.238.554.078.868-.15.322-.278.466-.516.738-.238.272-.464.48-.702.774-.216.258-.46.534-.194 1.004.266.462 1.182 1.948 2.538 3.156 1.744 1.552 3.212 2.034 3.668 2.258.39.192.856.154 1.132-.138.35-.37.782-.982 1.222-1.586.314-.43.71-.484 1.138-.314.434.162 2.746 1.294 3.216 1.53.47.238.784.354.898.552.114.198.114 1.148-.276 2.246z"/>
          </svg>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left" className="bg-[#25D366] text-white border-[#25D366] font-medium">
        WhatsApp
      </TooltipContent>
    </Tooltip>
  );
}
