import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { TableCell, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Pencil, Check, X, Loader2 } from 'lucide-react';

export interface InvestmentRowData {
  id: string;
  product_name_en: string;
  product_name_ko: string;
  investment_amount: number;
  current_value: number;
  status: string | null;
  start_date: string;
  maturity_date: string | null;
  invested_currency: string | null;
  realized_return_amount?: number | null;
}

interface Props {
  inv: InvestmentRowData;
  canEdit: boolean;
  onChanged: () => void;
}

const STATUS_OPTIONS = ['active', 'matured', 'closed', 'cancelled'];

export function EditableInvestmentRow({ inv, canEdit, onChanged }: Props) {
  const { language, formatCurrency, formatDate } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [currentValue, setCurrentValue] = useState(String(inv.current_value ?? 0));
  const [status, setStatus] = useState(inv.status || 'active');
  const [maturityDate, setMaturityDate] = useState(inv.maturity_date || '');
  const [realizedReturn, setRealizedReturn] = useState(
    String(inv.realized_return_amount ?? 0),
  );

  const ret = inv.investment_amount > 0
    ? ((inv.current_value - inv.investment_amount) / inv.investment_amount) * 100
    : 0;

  const cancel = () => {
    setCurrentValue(String(inv.current_value ?? 0));
    setStatus(inv.status || 'active');
    setMaturityDate(inv.maturity_date || '');
    setRealizedReturn(String(inv.realized_return_amount ?? 0));
    setEditing(false);
  };

  const save = async () => {
    const cv = Number(currentValue);
    const rr = Number(realizedReturn);
    if (Number.isNaN(cv) || cv < 0) {
      toast.error(language === 'ko' ? '현재 가치가 올바르지 않습니다' : 'Invalid current value');
      return;
    }
    if (Number.isNaN(rr)) {
      toast.error(language === 'ko' ? '실현 수익 금액이 올바르지 않습니다' : 'Invalid realized return');
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('client_investments')
      .update({
        current_value: cv,
        status,
        maturity_date: maturityDate || null,
        realized_return_amount: rr,
      })
      .eq('id', inv.id);

    if (error) {
      console.error('Update investment error:', error);
      toast.error(language === 'ko' ? '저장 실패' : 'Failed to save');
      setSaving(false);
      return;
    }

    // Auto recalculate commissions (waterfall) — non-blocking on UI but awaited for refresh
    try {
      const { error: recalcErr } = await supabase.functions.invoke('calculate-commissions', {
        body: { investment_id: inv.id },
      });
      if (recalcErr) {
        console.warn('Recalc warning:', recalcErr);
        toast.warning(language === 'ko'
          ? '저장 완료, 커미션 재계산 실패'
          : 'Saved, but commission recalc failed');
      } else {
        toast.success(language === 'ko'
          ? '저장 및 커미션 재계산 완료'
          : 'Saved & commissions recalculated');
      }
    } catch (e) {
      console.warn('Recalc invoke error:', e);
      toast.warning(language === 'ko'
        ? '저장 완료, 커미션 재계산 실패'
        : 'Saved, but commission recalc failed');
    }

    setSaving(false);
    setEditing(false);
    onChanged();
  };

  if (!editing) {
    return (
      <TableRow>
        <TableCell className="font-medium">
          {language === 'ko' ? inv.product_name_ko : inv.product_name_en}
        </TableCell>
        <TableCell className="text-right">{formatCurrency(inv.investment_amount)}</TableCell>
        <TableCell className="text-right">{formatCurrency(inv.current_value)}</TableCell>
        <TableCell className={`text-right hidden sm:table-cell ${ret >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
          {ret >= 0 ? '+' : ''}{ret.toFixed(1)}%
        </TableCell>
        <TableCell className="hidden md:table-cell">{formatDate(inv.start_date)}</TableCell>
        <TableCell>
          <Badge variant="outline" className="text-[10px]">{inv.status || '—'}</Badge>
        </TableCell>
        <TableCell className="text-right">
          {canEdit && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2"
              onClick={() => setEditing(true)}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          )}
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow className="bg-muted/30">
      <TableCell className="font-medium">
        {language === 'ko' ? inv.product_name_ko : inv.product_name_en}
        <div className="text-[10px] text-muted-foreground mt-1">
          {language === 'ko' ? '실현 수익' : 'Realized'}:
          <Input
            type="number"
            step="0.01"
            value={realizedReturn}
            onChange={(e) => setRealizedReturn(e.target.value)}
            className="h-6 mt-1 text-xs"
          />
        </div>
      </TableCell>
      <TableCell className="text-right">{formatCurrency(inv.investment_amount)}</TableCell>
      <TableCell className="text-right">
        <Input
          type="number"
          step="0.01"
          value={currentValue}
          onChange={(e) => setCurrentValue(e.target.value)}
          className="h-7 text-xs text-right w-28 inline-block"
        />
      </TableCell>
      <TableCell className="text-right hidden sm:table-cell text-muted-foreground">—</TableCell>
      <TableCell className="hidden md:table-cell">
        <Input
          type="date"
          value={maturityDate}
          onChange={(e) => setMaturityDate(e.target.value)}
          className="h-7 text-xs w-36"
          placeholder={language === 'ko' ? '만기일' : 'Maturity'}
        />
      </TableCell>
      <TableCell>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-7 text-xs w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s} className="text-xs capitalize">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 text-emerald-600" />}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={cancel} disabled={saving}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
