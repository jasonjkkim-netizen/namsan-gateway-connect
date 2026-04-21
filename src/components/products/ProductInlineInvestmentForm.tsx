import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Loader2, PlusCircle, X, Search } from 'lucide-react';

interface ClientOption {
  user_id: string;
  full_name: string;
  full_name_ko: string | null;
}

interface Props {
  productId: string;
  productNameEn: string;
  productNameKo: string;
  defaultCurrency: string;
  minInvestmentAmount: number | null;
  onCreated: () => void;
}

export function ProductInlineInvestmentForm({
  productId, productNameEn, productNameKo, defaultCurrency, minInvestmentAmount, onCreated,
}: Props) {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(defaultCurrency || 'USD');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open && clients.length === 0) fetchClients();
  }, [open]);

  async function fetchClients() {
    const { data } = await supabase
      .from('profiles')
      .select('user_id, full_name, full_name_ko')
      .eq('is_approved', true)
      .or('is_deleted.is.null,is_deleted.eq.false')
      .order('full_name_ko', { ascending: true, nullsFirst: false });
    setClients((data || []) as ClientOption[]);
  }

  const filteredClients = clients.filter((c) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      c.full_name.toLowerCase().includes(term) ||
      (c.full_name_ko || '').toLowerCase().includes(term)
    );
  });

  function reset() {
    setSelectedClientId('');
    setAmount('');
    setCurrency(defaultCurrency || 'USD');
    setStartDate(new Date().toISOString().split('T')[0]);
    setErrors({});
    setSearchTerm('');
  }

  async function handleSubmit() {
    if (!user) return;
    setErrors({});
    const fe: Record<string, string> = {};

    if (!selectedClientId) {
      fe.client = language === 'ko' ? '투자자를 선택하세요' : 'Select an investor';
    }
    const numAmount = Number(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      fe.amount = language === 'ko' ? '유효한 금액을 입력하세요' : 'Enter a valid amount';
    } else if (numAmount > 1_000_000_000) {
      fe.amount = language === 'ko' ? '금액이 너무 큽니다' : 'Amount too large';
    } else if (minInvestmentAmount && numAmount < minInvestmentAmount) {
      fe.amount = language === 'ko'
        ? `최소 투자금액: ${minInvestmentAmount.toLocaleString()}`
        : `Minimum: ${minInvestmentAmount.toLocaleString()}`;
    }
    if (!startDate) {
      fe.start_date = language === 'ko' ? '날짜를 선택하세요' : 'Select a date';
    }

    if (Object.keys(fe).length > 0) {
      setErrors(fe);
      return;
    }

    setSubmitting(true);
    try {
      const { data: inv, error: insertErr } = await supabase
        .from('client_investments')
        .insert({
          user_id: selectedClientId,
          product_id: productId,
          product_name_en: productNameEn,
          product_name_ko: productNameKo,
          investment_amount: numAmount,
          current_value: numAmount,
          start_date: startDate,
          invested_currency: currency,
          created_by: user.id,
          status: 'active',
        })
        .select('id')
        .single();

      if (insertErr) throw insertErr;

      if (inv?.id) {
        const { error: cErr } = await supabase.functions.invoke('calculate-commissions', {
          body: { investment_id: inv.id },
        });
        if (cErr) {
          console.error('calculate-commissions error:', cErr);
          toast.warning(language === 'ko'
            ? '투자 등록 완료, 커미션 자동 계산 실패'
            : 'Investment created, auto-commission failed');
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
      console.error('Product investment create error:', err);
      toast.error(err.message || (language === 'ko' ? '등록 실패' : 'Create failed'));
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)} className="h-7 text-xs">
        <PlusCircle className="h-3 w-3 mr-1" />
        {language === 'ko' ? '투자자 추가' : 'Add Investor'}
      </Button>
    );
  }

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
        {/* Client Selector */}
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">{language === 'ko' ? '투자자' : 'Investor'}</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={language === 'ko' ? '이름 검색...' : 'Search by name...'}
              className="h-9 text-xs pl-8"
            />
          </div>
          <Select value={selectedClientId} onValueChange={setSelectedClientId}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder={language === 'ko' ? '투자자 선택' : 'Select investor'} />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {filteredClients.map((c) => (
                <SelectItem key={c.user_id} value={c.user_id} className="text-xs">
                  {c.full_name_ko || c.full_name}
                  {c.full_name_ko && c.full_name !== c.full_name_ko && (
                    <span className="text-muted-foreground ml-1">({c.full_name})</span>
                  )}
                </SelectItem>
              ))}
              {filteredClients.length === 0 && (
                <div className="py-2 px-3 text-xs text-muted-foreground text-center">
                  {language === 'ko' ? '결과 없음' : 'No results'}
                </div>
              )}
            </SelectContent>
          </Select>
          {errors.client && <p className="text-xs text-destructive">{errors.client}</p>}
        </div>

        {/* Amount + Currency */}
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
          {minInvestmentAmount && (
            <p className="text-[10px] text-muted-foreground">
              {language === 'ko' ? '최소' : 'Min'}: {minInvestmentAmount.toLocaleString()} {currency}
            </p>
          )}
          {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
        </div>

        {/* Start Date */}
        <div className="space-y-1.5">
          <Label className="text-xs">{language === 'ko' ? '투자일' : 'Start Date'}</Label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-9 text-xs"
          />
          {errors.start_date && <p className="text-xs text-destructive">{errors.start_date}</p>}
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