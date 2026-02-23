import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

interface DownlineClient {
  user_id: string;
  full_name: string;
  sales_role: string;
}

interface Product {
  id: string;
  name_en: string;
  name_ko: string;
  type: string;
  default_currency: string | null;
  min_investment_amount: number | null;
}

const investmentSchema = z.object({
  client_id: z.string().uuid('Invalid client'),
  product_id: z.string().uuid('Invalid product'),
  amount: z.number().positive('Amount must be positive').max(1_000_000_000, 'Amount too large'),
  currency: z.string().min(1).max(10),
  start_date: z.string().min(1, 'Start date required'),
});

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  downline: DownlineClient[];
  onCreated: () => void;
}

export function CreateInvestmentDialog({ open, onOpenChange, downline, onCreated }: Props) {
  const { language } = useLanguage();
  const { user } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [clientId, setClientId] = useState('');
  const [productId, setProductId] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) fetchProducts();
  }, [open]);

  useEffect(() => {
    if (productId) {
      const p = products.find((pr) => pr.id === productId);
      if (p?.default_currency) setCurrency(p.default_currency);
    }
  }, [productId, products]);

  async function fetchProducts() {
    const { data } = await supabase
      .from('investment_products')
      .select('id, name_en, name_ko, type, default_currency, min_investment_amount')
      .eq('is_active', true)
      .order('name_en');
    setProducts((data || []) as Product[]);
  }

  async function handleSubmit() {
    if (!user) return;
    setErrors({});

    const parsed = investmentSchema.safeParse({
      client_id: clientId,
      product_id: productId,
      amount: Number(amount),
      currency,
      start_date: startDate,
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        fieldErrors[issue.path[0] as string] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }

    const product = products.find((p) => p.id === productId);
    if (!product) return;

    if (product.min_investment_amount && parsed.data.amount < product.min_investment_amount) {
      setErrors({ amount: language === 'ko' ? `최소 투자금액: ${product.min_investment_amount}` : `Minimum: ${product.min_investment_amount}` });
      return;
    }

    setSubmitting(true);
    try {
      const { data: inv, error: insertErr } = await supabase
        .from('client_investments')
        .insert({
          user_id: clientId,
          product_id: productId,
          product_name_en: product.name_en,
          product_name_ko: product.name_ko,
          investment_amount: parsed.data.amount,
          current_value: parsed.data.amount,
          start_date: startDate,
          invested_currency: currency,
          created_by: user.id,
          status: 'active',
        })
        .select('id')
        .single();

      if (insertErr) throw insertErr;

      // Auto-trigger commission calculation
      if (inv?.id) {
        const { error: commErr } = await supabase.functions.invoke('calculate-commissions', {
          body: { investment_id: inv.id },
        });
        if (commErr) {
          console.error('Commission calc error:', commErr);
          toast.warning(language === 'ko' ? '투자 생성 완료, 커미션 계산 실패' : 'Investment created, commission calculation failed');
        }
      }

      toast.success(language === 'ko' ? '투자가 생성되었습니다' : 'Investment created successfully');
      resetForm();
      onOpenChange(false);
      onCreated();
    } catch (err: any) {
      console.error('Create investment error:', err);
      toast.error(err.message || 'Failed to create investment');
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setClientId('');
    setProductId('');
    setAmount('');
    setCurrency('USD');
    setStartDate(new Date().toISOString().split('T')[0]);
    setErrors({});
  }

  const selectedProduct = products.find((p) => p.id === productId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif">
            {language === 'ko' ? '신규 투자 등록' : 'Create Investment'}
          </DialogTitle>
          <DialogDescription>
            {language === 'ko'
              ? '하위 고객의 투자를 등록하세요. 커미션이 자동 계산됩니다.'
              : 'Register an investment for your downline client. Commissions are calculated automatically.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Client Select */}
          <div className="space-y-1.5">
            <Label>{language === 'ko' ? '투자자 (고객)' : 'Client'}</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder={language === 'ko' ? '고객 선택' : 'Select client'} />
              </SelectTrigger>
              <SelectContent>
                {downline.map((d) => (
                  <SelectItem key={d.user_id} value={d.user_id}>
                    {d.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.client_id && <p className="text-xs text-destructive">{errors.client_id}</p>}
          </div>

          {/* Product Select */}
          <div className="space-y-1.5">
            <Label>{language === 'ko' ? '상품' : 'Product'}</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger>
                <SelectValue placeholder={language === 'ko' ? '상품 선택' : 'Select product'} />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {language === 'ko' ? p.name_ko : p.name_en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.product_id && <p className="text-xs text-destructive">{errors.product_id}</p>}
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label>{language === 'ko' ? '투자금액' : 'Investment Amount'}</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="flex-1"
              />
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="KRW">KRW</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {selectedProduct?.min_investment_amount && (
              <p className="text-xs text-muted-foreground">
                {language === 'ko' ? '최소:' : 'Min:'} {selectedProduct.min_investment_amount.toLocaleString()} {currency}
              </p>
            )}
            {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
          </div>

          {/* Start Date */}
          <div className="space-y-1.5">
            <Label>{language === 'ko' ? '투자 시작일' : 'Start Date'}</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            {errors.start_date && <p className="text-xs text-destructive">{errors.start_date}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {language === 'ko' ? '취소' : 'Cancel'}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {language === 'ko' ? '투자 등록' : 'Create Investment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
