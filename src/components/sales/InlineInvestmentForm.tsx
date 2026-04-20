import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { z } from 'zod';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, PlusCircle, X } from 'lucide-react';

interface Product {
  id: string;
  name_en: string;
  name_ko: string;
  type: string;
  default_currency: string | null;
  min_investment_amount: number | null;
}

interface Props {
  clientUserId: string;
  onCreated: () => void;
}

const schema = z.object({
  product_id: z.string().uuid(),
  amount: z.number().positive().max(1_000_000_000),
  currency: z.string().min(1).max(10),
  start_date: z.string().min(1),
});

export function InlineInvestmentForm({ clientUserId, onCreated }: Props) {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open && products.length === 0) fetchProducts();
  }, [open]);

  useEffect(() => {
    const p = products.find((x) => x.id === productId);
    if (p?.default_currency) setCurrency(p.default_currency);
  }, [productId, products]);

  async function fetchProducts() {
    const { data } = await supabase
      .from('investment_products')
      .select('id, name_en, name_ko, type, default_currency, min_investment_amount')
      .eq('is_active', true)
      .order('name_en');
    setProducts((data || []) as Product[]);
  }

  function reset() {
    setProductId('');
    setAmount('');
    setCurrency('USD');
    setStartDate(new Date().toISOString().split('T')[0]);
    setErrors({});
  }

  async function handleSubmit() {
    if (!user) return;
    setErrors({});

    const parsed = schema.safeParse({
      product_id: productId,
      amount: Number(amount),
      currency,
      start_date: startDate,
    });
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      parsed.error.issues.forEach((i) => { fe[i.path[0] as string] = i.message; });
      setErrors(fe);
      return;
    }

    const product = products.find((p) => p.id === productId)!;
    if (product.min_investment_amount && parsed.data.amount < product.min_investment_amount) {
      setErrors({
        amount: language === 'ko'
          ? `최소 투자금액: ${product.min_investment_amount.toLocaleString()}`
          : `Minimum: ${product.min_investment_amount.toLocaleString()}`,
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data: inv, error: insertErr } = await supabase
        .from('client_investments')
        .insert({
          user_id: clientUserId,
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

      // Auto-trigger commission distribution
      if (inv?.id) {
        const { error: cErr } = await supabase.functions.invoke('calculate-commissions', {
          body: { investment_id: inv.id },
        });
        if (cErr) {
          console.error('calculate-commissions error:', cErr);
          toast.warning(language === 'ko'
            ? '투자 등록 완료, 커미션 자동 계산 실패 (수동 조정 가능)'
            : 'Investment created, auto-commission failed (manual adjustment available)');
        } else {
          toast.success(language === 'ko'
            ? '투자 및 커미션 분배가 완료되었습니다'
            : 'Investment created and commissions distributed');
        }
      }

      reset();
      setOpen(false);
      onCreated();
    } catch (err: any) {
      console.error('Inline investment create error:', err);
      toast.error(err.message || (language === 'ko' ? '등록 실패' : 'Create failed'));
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)} className="h-7 text-xs">
        <PlusCircle className="h-3 w-3 mr-1" />
        {language === 'ko' ? '투자 등록' : 'Add Investment'}
      </Button>
    );
  }

  const selected = products.find((p) => p.id === productId);

  return (
    <Card className="p-3 sm:p-4 border-primary/30 bg-primary/5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">
          {language === 'ko' ? '신규 투자 등록' : 'New Investment'}
        </h3>
        <Button variant="ghost" size="icon" onClick={() => { reset(); setOpen(false); }} className="h-6 w-6">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">{language === 'ko' ? '상품' : 'Product'}</Label>
          <Select value={productId} onValueChange={setProductId}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder={language === 'ko' ? '상품 선택' : 'Select product'} />
            </SelectTrigger>
            <SelectContent>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-xs">
                  {language === 'ko' ? p.name_ko : p.name_en}
                  <span className="text-muted-foreground ml-2">({p.type})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.product_id && <p className="text-xs text-destructive">{errors.product_id}</p>}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">{language === 'ko' ? '투자금액' : 'Amount'}</Label>
          <div className="flex gap-2">
            <Input
              type="number" min="0" step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="h-9 text-xs flex-1"
            />
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="h-9 w-20 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="KRW">KRW</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {selected?.min_investment_amount && (
            <p className="text-[10px] text-muted-foreground">
              {language === 'ko' ? '최소' : 'Min'}: {selected.min_investment_amount.toLocaleString()} {currency}
            </p>
          )}
          {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">{language === 'ko' ? '시작일' : 'Start Date'}</Label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-9 text-xs"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-3">
        <Button variant="outline" size="sm" onClick={() => { reset(); setOpen(false); }} disabled={submitting} className="h-7 text-xs">
          {language === 'ko' ? '취소' : 'Cancel'}
        </Button>
        <Button size="sm" onClick={handleSubmit} disabled={submitting} className="h-7 text-xs">
          {submitting && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
          {language === 'ko' ? '등록 + 커미션 자동분배' : 'Create + Auto-distribute'}
        </Button>
      </div>
    </Card>
  );
}
