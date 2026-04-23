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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Pencil, Check, X, Loader2, Trash2, AlertTriangle } from 'lucide-react';
import { computeInvestmentValuationDetails, type InvestmentValuationAudit } from '@/lib/investment-valuation';
import { ValuationFormulaBlock } from '@/components/investments/ValuationFormulaBlock';

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
  product_maturity_date?: string | null;
  annual_rate_percent?: number | null;
  display_current_value?: number;
  display_return_percent?: number;
  valuation_warning?: string | null;
  accrued_interest?: number;
  computed_mark_to_market?: number;
  valuation_audit?: InvestmentValuationAudit;
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
  const [deleting, setDeleting] = useState(false);

  const [currentValue, setCurrentValue] = useState(String(inv.current_value ?? 0));
  const [status, setStatus] = useState(inv.status || 'active');
  const [maturityDate, setMaturityDate] = useState(inv.maturity_date || '');
  const [realizedReturn, setRealizedReturn] = useState(
    String(inv.realized_return_amount ?? 0),
  );

  const valuation = computeInvestmentValuationDetails({
    investmentAmount: inv.investment_amount,
    currentValue: inv.current_value,
    startDate: inv.start_date,
    investmentMaturityDate: inv.maturity_date,
    productMaturityDate: inv.product_maturity_date,
    annualRatePercent: inv.annual_rate_percent,
    status: inv.status,
  });
  const displayCurrentValue = inv.display_current_value ?? valuation.displayCurrentValue;
  const ret = inv.display_return_percent ?? valuation.displayReturnPercent;
  const accruedInterest = inv.accrued_interest ?? valuation.accruedInterest;
  const computedMarkToMarket = inv.computed_mark_to_market ?? valuation.displayCurrentValue;
  const valuationAudit = inv.valuation_audit ?? valuation.audit;

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

  const softDelete = async () => {
    setDeleting(true);
    try {
      const { error: commissionError } = await supabase
        .from('commission_distributions')
        .delete()
        .eq('investment_id', inv.id);

      if (commissionError) {
        console.error('Failed to delete commission distributions:', commissionError);
        toast.error(language === 'ko' ? '연결된 커미션 삭제 실패' : 'Failed to delete linked commissions');
        return;
      }

      const { error: distributionError } = await supabase
        .from('distributions')
        .delete()
        .eq('investment_id', inv.id);

      if (distributionError) {
        console.error('Failed to delete related distributions:', distributionError);
        toast.error(language === 'ko' ? '연결된 분배 내역 삭제 실패' : 'Failed to delete linked distributions');
        return;
      }

      const { error } = await supabase
        .from('client_investments')
        .delete()
        .eq('id', inv.id);

      if (error) {
        console.error('Delete investment error:', error);
        toast.error(language === 'ko' ? '삭제 실패' : 'Delete failed');
      } else {
        toast.success(language === 'ko' ? '투자 삭제 완료' : 'Investment deleted');
        onChanged();
      }
    } catch (e) {
      console.error('Delete investment exception:', e);
      toast.error(language === 'ko' ? '삭제 실패' : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  if (!editing) {
    return (
      <TableRow>
        <TableCell className="font-medium">
          {language === 'ko' ? inv.product_name_ko : inv.product_name_en}
          {inv.valuation_warning && (
            <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-600">
              <AlertTriangle className="h-3 w-3" />
              <span>{inv.valuation_warning}</span>
            </div>
          )}
          <ValuationFormulaBlock
            compact
            className="mt-2"
            audit={valuationAudit}
            accruedInterest={accruedInterest}
            computedMarkToMarket={computedMarkToMarket}
            currency={inv.invested_currency}
          />
        </TableCell>
        <TableCell className="text-right">{formatCurrency(inv.investment_amount)}</TableCell>
        <TableCell className="text-right">{formatCurrency(displayCurrentValue, inv.invested_currency || undefined)}</TableCell>
        <TableCell className={`text-right hidden sm:table-cell ${ret >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
          {ret >= 0 ? '+' : ''}{ret.toFixed(1)}%
        </TableCell>
        <TableCell className="hidden md:table-cell">{formatDate(inv.start_date)}</TableCell>
        <TableCell>
          <Badge variant="outline" className="text-[10px]">{inv.status || '—'}</Badge>
        </TableCell>
        <TableCell className="text-right">
          {canEdit && (
            <div className="flex items-center justify-end gap-0.5">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2"
                onClick={() => setEditing(true)}
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive" disabled={deleting}>
                    {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {language === 'ko' ? '투자 삭제' : 'Delete Investment'}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {language === 'ko'
                        ? '이 투자 건과 관련된 모든 커미션 분배 내역이 함께 삭제됩니다. 계속하시겠습니까?'
                        : 'This will delete the investment and all related commission distributions. Continue?'}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{language === 'ko' ? '취소' : 'Cancel'}</AlertDialogCancel>
                    <AlertDialogAction onClick={softDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      {language === 'ko' ? '삭제' : 'Delete'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
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
