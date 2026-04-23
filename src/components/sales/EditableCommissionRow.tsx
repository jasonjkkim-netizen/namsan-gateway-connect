import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TableCell, TableRow } from '@/components/ui/table';
import { MemberLink } from '@/components/MemberLink';
import { Pencil, Save, X, Loader2 } from 'lucide-react';
import { formatCommissionAmount } from '@/lib/commission-format';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface CommissionRow {
  id: string;
  investment_id: string;
  from_user_id: string | null;
  to_user_id: string;
  layer: number;
  upfront_amount: number | null;
  performance_amount: number | null;
  rate_used: number | null;
  currency: string | null;
  status: string;
  created_at: string;
}

interface Props {
  row: CommissionRow;
  viewerUserId: string;
  isAdmin: boolean;
  counterpartName: string;
  counterpartId: string | null;
  isEarned: boolean;
  onChanged: () => void;
}

export function EditableCommissionRow({
  row, viewerUserId, isAdmin, counterpartName, counterpartId, isEarned, onChanged,
}: Props) {
  const { language, formatCurrency, formatDate } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [upfront, setUpfront] = useState(String(row.upfront_amount ?? ''));
  const [performance, setPerformance] = useState(String(row.performance_amount ?? ''));
  const [status, setStatus] = useState(row.status);

  // Permission: admin = all rows; recipient = only own (to_user_id matches viewer)
  const canEdit = isAdmin || row.to_user_id === viewerUserId;

  async function handleSave() {
    const upfrontNum = upfront === '' ? null : Number(upfront);
    const perfNum = performance === '' ? null : Number(performance);
    if (upfrontNum !== null && (isNaN(upfrontNum) || upfrontNum < 0)) {
      toast.error(language === 'ko' ? '선취 금액이 유효하지 않습니다' : 'Invalid upfront amount');
      return;
    }
    if (perfNum !== null && (isNaN(perfNum) || perfNum < 0)) {
      toast.error(language === 'ko' ? '성과 금액이 유효하지 않습니다' : 'Invalid performance amount');
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from('commission_distributions')
      .update({
        upfront_amount: upfrontNum,
        performance_amount: perfNum,
        status,
      })
      .eq('id', row.id);
    setSaving(false);

    if (error) {
      console.error('Commission update error:', error);
      toast.error(language === 'ko' ? '커미션 수정 실패' : 'Failed to update commission');
    } else {
      toast.success(language === 'ko' ? '커미션이 수정되었습니다' : 'Commission updated');
      setEditing(false);
      onChanged();
    }
  }

  function cancel() {
    setUpfront(String(row.upfront_amount ?? ''));
    setPerformance(String(row.performance_amount ?? ''));
    setStatus(row.status);
    setEditing(false);
  }

  if (editing) {
    return (
      <TableRow className="bg-primary/5">
        <TableCell>
          <Badge variant={isEarned ? 'default' : 'outline'} className="text-[10px]">
            {isEarned ? (language === 'ko' ? '수령' : 'Earned') : (language === 'ko' ? '발생' : 'Source')}
          </Badge>
        </TableCell>
        <TableCell>
          <MemberLink userId={counterpartId} className="text-xs">{counterpartName}</MemberLink>
        </TableCell>
        <TableCell className="text-right">
          <Input
            type="number" step="0.01" min="0"
            value={upfront}
            onChange={(e) => setUpfront(e.target.value)}
            className="h-7 text-xs w-24 ml-auto"
          />
        </TableCell>
        <TableCell className="text-right">
          <Input
            type="number" step="0.01" min="0"
            value={performance}
            onChange={(e) => setPerformance(e.target.value)}
            className="h-7 text-xs w-24 ml-auto"
          />
        </TableCell>
        <TableCell className="hidden sm:table-cell">{row.layer}</TableCell>
        <TableCell>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-7 text-[10px] w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="available">available</SelectItem>
              <SelectItem value="pending">pending</SelectItem>
              <SelectItem value="paid">paid</SelectItem>
              <SelectItem value="cancelled">cancelled</SelectItem>
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell className="hidden md:table-cell whitespace-nowrap">
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            </Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={cancel} disabled={saving}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell>
        <Badge variant={isEarned ? 'default' : 'outline'} className="text-[10px]">
          {isEarned ? (language === 'ko' ? '수령' : 'Earned') : (language === 'ko' ? '발생' : 'Source')}
        </Badge>
      </TableCell>
      <TableCell>
        <MemberLink userId={counterpartId} className="text-xs">{counterpartName}</MemberLink>
      </TableCell>
      <TableCell className="text-right">
        {row.upfront_amount ? formatCommissionAmount(Number(row.upfront_amount), language, row.currency) : '—'}
      </TableCell>
      <TableCell className="text-right">
        {row.performance_amount ? formatCommissionAmount(Number(row.performance_amount), language, row.currency) : '—'}
      </TableCell>
      <TableCell className="hidden sm:table-cell">{row.layer}</TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Badge variant="outline" className="text-[10px] capitalize">{row.status}</Badge>
          {canEdit && (
            <Button
              size="icon" variant="ghost" className="h-5 w-5 opacity-60 hover:opacity-100"
              onClick={() => setEditing(true)}
              title={language === 'ko' ? '수정' : 'Edit'}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          )}
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell whitespace-nowrap">{formatDate(row.created_at)}</TableCell>
    </TableRow>
  );
}
