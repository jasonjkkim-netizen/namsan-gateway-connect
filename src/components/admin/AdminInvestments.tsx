import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ExcelUpload } from './ExcelUpload';
import { investmentSchema, validateFormData, validateBulkImportRow } from '@/lib/admin-validation';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Edit, Search, Upload, Trash2, Calculator } from 'lucide-react';

interface Investment {
  id: string;
  user_id: string;
  product_id: string | null;
  product_name_en: string;
  product_name_ko: string;
  investment_amount: number;
  current_value: number;
  start_date: string;
  maturity_date: string | null;
  expected_return: number | null;
  status: string | null;
  invested_currency: string | null;
  realized_return_amount: number | null;
  realized_return_percent: number | null;
  created_by: string | null;
  date_invested: string | null;
}

interface ProductOption {
  id: string;
  name_en: string;
  name_ko: string;
  default_currency: string | null;
}

interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  sales_role: string | null;
}

export function AdminInvestments() {
  const { language, formatCurrency, formatDate, formatPercent } = useLanguage();
  const { user } = useAuth();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
  const [parsedData, setParsedData] = useState<Record<string, any>[]>([]);
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);

  const [formData, setFormData] = useState({
    user_id: '',
    product_id: '',
    product_name_en: '',
    product_name_ko: '',
    investment_amount: '',
    current_value: '',
    start_date: '',
    maturity_date: '',
    expected_return: '',
    status: 'active',
    invested_currency: 'USD',
    realized_return_amount: '',
    realized_return_percent: '',
    date_invested: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const [investmentsRes, profilesRes, productsRes] = await Promise.all([
      supabase.from('client_investments').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, user_id, email, full_name, sales_role').or('is_deleted.is.null,is_deleted.eq.false').or('is_rejected.is.null,is_rejected.eq.false'),
      supabase.from('investment_products').select('id, name_en, name_ko, default_currency').eq('is_active', true).order('name_en'),
    ]);

    if (investmentsRes.data) setInvestments(investmentsRes.data as Investment[]);
    if (profilesRes.data) setProfiles(profilesRes.data as Profile[]);
    if (productsRes.data) setProductOptions(productsRes.data as ProductOption[]);
    setLoading(false);
  }

  const handleEdit = (investment: Investment) => {
    setEditingInvestment(investment);
    setFormData({
      user_id: investment.user_id,
      product_id: investment.product_id || '',
      product_name_en: investment.product_name_en,
      product_name_ko: investment.product_name_ko,
      investment_amount: String(investment.investment_amount),
      current_value: String(investment.current_value),
      start_date: investment.start_date,
      maturity_date: investment.maturity_date || '',
      expected_return: investment.expected_return ? String(investment.expected_return) : '',
      status: investment.status || 'active',
      invested_currency: investment.invested_currency || 'USD',
      realized_return_amount: investment.realized_return_amount ? String(investment.realized_return_amount) : '',
      realized_return_percent: investment.realized_return_percent ? String(investment.realized_return_percent) : '',
      date_invested: investment.date_invested || '',
    });
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingInvestment(null);
    setFormData({
      user_id: '', product_id: '', product_name_en: '', product_name_ko: '',
      investment_amount: '', current_value: '',
      start_date: new Date().toISOString().split('T')[0],
      maturity_date: '', expected_return: '', status: 'active',
      invested_currency: 'USD', realized_return_amount: '',
      realized_return_percent: '', date_invested: new Date().toISOString().split('T')[0],
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const investmentAmount = parseFloat(formData.investment_amount);
    const currentValue = parseFloat(formData.current_value);
    const expectedReturn = formData.expected_return ? parseFloat(formData.expected_return) : null;

    const validationResult = validateFormData(investmentSchema, {
      user_id: formData.user_id,
      product_name_en: formData.product_name_en,
      product_name_ko: formData.product_name_ko,
      investment_amount: isNaN(investmentAmount) ? -1 : investmentAmount,
      current_value: isNaN(currentValue) ? -1 : currentValue,
      start_date: formData.start_date,
      maturity_date: formData.maturity_date || null,
      expected_return: expectedReturn,
      status: formData.status as 'active' | 'matured' | 'pending' | 'closed',
    }, language);

    if (!validationResult.success) {
      toast.error(validationResult.error);
      return;
    }

    const parseNum = (v: string) => v ? parseFloat(v) || null : null;

    const payload = {
      user_id: validationResult.data.user_id!,
      product_id: formData.product_id || null,
      product_name_en: validationResult.data.product_name_en!,
      product_name_ko: validationResult.data.product_name_ko!,
      investment_amount: validationResult.data.investment_amount!,
      current_value: validationResult.data.current_value!,
      start_date: validationResult.data.start_date!,
      maturity_date: validationResult.data.maturity_date ?? null,
      expected_return: validationResult.data.expected_return ?? null,
      status: validationResult.data.status!,
      invested_currency: formData.invested_currency,
      realized_return_amount: parseNum(formData.realized_return_amount),
      realized_return_percent: parseNum(formData.realized_return_percent),
      date_invested: formData.date_invested || null,
      created_by: editingInvestment ? undefined : user?.id,
    };

    let error;
    let newInvestmentId: string | null = null;
    if (editingInvestment) {
      ({ error } = await supabase.from('client_investments').update(payload).eq('id', editingInvestment.id));
      newInvestmentId = editingInvestment.id;
    } else {
      const { data: inserted, error: insertErr } = await supabase.from('client_investments').insert(payload).select('id').single();
      error = insertErr;
      newInvestmentId = inserted?.id || null;
    }

    if (error) {
      toast.error(language === 'ko' ? '저장 실패' : 'Save failed');
      console.error(error);
    } else {
      toast.success(language === 'ko' ? '저장 완료' : 'Saved successfully');

      // Auto-trigger commission calculation if product_id is set
      if (newInvestmentId && formData.product_id) {
        try {
          const { data: commResult, error: commErr } = await supabase.functions.invoke('calculate-commissions', {
            body: { investment_id: newInvestmentId },
          });
          if (commErr) throw commErr;
          if (commResult?.distributions_created > 0) {
            toast.success(
              language === 'ko'
                ? `${commResult.distributions_created}건 커미션 자동 배분 완료`
                : `${commResult.distributions_created} commission distributions created`
            );
          }
        } catch (commErr) {
          console.error('Auto commission calc error:', commErr);
          toast.warning(language === 'ko' ? '커미션 자동 계산 실패' : 'Auto commission calculation failed');
        }
      }

      setDialogOpen(false);
      fetchData();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(language === 'ko' ? '삭제하시겠습니까?' : 'Are you sure?')) return;
    const { error } = await supabase.from('client_investments').delete().eq('id', id);
    if (error) {
      toast.error(language === 'ko' ? '삭제 실패' : 'Delete failed');
    } else {
      toast.success(language === 'ko' ? '삭제 완료' : 'Deleted');
      fetchData();
    }
  };

  const handleBulkImport = async () => {
    if (parsedData.length === 0) return;

    const validatedRows: any[] = [];
    for (let i = 0; i < parsedData.length; i++) {
      const row = parsedData[i];
      const investmentAmount = parseFloat(row.investment_amount);
      const currentValue = parseFloat(row.current_value);
      const expectedReturn = row.expected_return ? parseFloat(row.expected_return) : null;

      const validation = validateBulkImportRow(investmentSchema, {
        user_id: row.user_id,
        product_name_en: row.product_name_en,
        product_name_ko: row.product_name_ko,
        investment_amount: isNaN(investmentAmount) ? -1 : investmentAmount,
        current_value: isNaN(currentValue) ? -1 : currentValue,
        start_date: row.start_date,
        maturity_date: row.maturity_date || null,
        expected_return: expectedReturn,
        status: (row.status || 'active') as any,
      }, i);

      if (!validation.success) {
        toast.error(validation.error);
        return;
      }
      validatedRows.push({
        ...validation.data,
        maturity_date: validation.data.maturity_date ?? null,
        expected_return: validation.data.expected_return ?? null,
      });
    }

    const { error } = await supabase.from('client_investments').insert(validatedRows);
    if (error) {
      toast.error(language === 'ko' ? '일괄 업로드 실패' : 'Bulk import failed');
      console.error(error);
    } else {
      toast.success(language === 'ko' ? `${validatedRows.length}건 업로드 완료` : `${validatedRows.length} records imported`);
      setUploadDialogOpen(false);
      setParsedData([]);
      fetchData();
    }
  };

  const getClientName = (userId: string) => {
    const profile = profiles.find((p) => p.user_id === userId);
    return profile ? `${profile.full_name} (${profile.email})` : userId;
  };

  const getClientRole = (userId: string) => {
    const profile = profiles.find((p) => p.user_id === userId);
    return profile?.sales_role || null;
  };

  const filteredInvestments = investments.filter(
    (inv) =>
      inv.product_name_en.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.product_name_ko.includes(searchTerm) ||
      getClientName(inv.user_id).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const expectedColumns = ['user_id', 'product_name_en', 'product_name_ko', 'investment_amount', 'current_value', 'start_date'];

  const ROLE_LABELS: Record<string, string> = {
    district_manager: language === 'ko' ? 'DM' : 'DM',
    deputy_district_manager: language === 'ko' ? '부DM' : 'DDM',
    principal_agent: language === 'ko' ? 'PA' : 'PA',
    agent: language === 'ko' ? 'AG' : 'AG',
    client: language === 'ko' ? '고객' : 'Client',
  };

  return (
    <div className="card-elevated">
      <div className="p-6 border-b border-border flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-xl font-serif font-semibold">
          {language === 'ko' ? '투자 관리' : 'Investment Management'}
        </h2>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={language === 'ko' ? '검색...' : 'Search...'} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
          </div>
          <Button variant="outline" onClick={() => setUploadDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            {language === 'ko' ? '엑셀 업로드' : 'Excel Upload'}
          </Button>
          <Button onClick={handleAdd} className="btn-gold">
            <Plus className="h-4 w-4 mr-2" />
            {language === 'ko' ? '추가' : 'Add'}
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{language === 'ko' ? '고객' : 'Client'}</TableHead>
              <TableHead>{language === 'ko' ? '역할' : 'Role'}</TableHead>
              <TableHead>{language === 'ko' ? '상품명' : 'Product'}</TableHead>
              <TableHead>{language === 'ko' ? '투자금액' : 'Amount'}</TableHead>
              <TableHead>{language === 'ko' ? '현재가치' : 'Current'}</TableHead>
              <TableHead>{language === 'ko' ? '실현수익' : 'Realized'}</TableHead>
              <TableHead>{language === 'ko' ? '상태' : 'Status'}</TableHead>
              <TableHead>{language === 'ko' ? '작업' : 'Actions'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-5 w-24" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : filteredInvestments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  {language === 'ko' ? '데이터가 없습니다' : 'No data found'}
                </TableCell>
              </TableRow>
            ) : (
              filteredInvestments.map((inv) => {
                const role = getClientRole(inv.user_id);
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium max-w-[180px] truncate">
                      {getClientName(inv.user_id)}
                    </TableCell>
                    <TableCell>
                      {role ? (
                        <Badge variant="outline" className="text-xs">{ROLE_LABELS[role] || role}</Badge>
                      ) : '—'}
                    </TableCell>
                    <TableCell>{language === 'ko' ? inv.product_name_ko : inv.product_name_en}</TableCell>
                    <TableCell>{formatCurrency(inv.investment_amount)}</TableCell>
                    <TableCell>{formatCurrency(inv.current_value)}</TableCell>
                    <TableCell>
                      {inv.realized_return_amount ? (
                        <span className={Number(inv.realized_return_amount) >= 0 ? 'text-success font-medium' : 'text-destructive font-medium'}>
                          {Number(inv.realized_return_amount) >= 0 ? '+' : ''}{formatCurrency(Number(inv.realized_return_amount))}
                        </span>
                      ) : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={inv.status === 'active' ? 'default' : 'secondary'}>
                        {inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(inv)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        {inv.status === 'active' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            title={language === 'ko' ? '커미션 계산' : 'Calculate Commissions'}
                            onClick={async () => {
                              try {
                                const { data, error } = await supabase.functions.invoke('calculate-commissions', {
                                  body: { investment_id: inv.id },
                                });
                                if (error) throw error;
                                toast.success(
                                  language === 'ko'
                                    ? `${data.distributions_created}건 커미션 분배 완료`
                                    : `${data.distributions_created} commission distributions created`
                                );
                              } catch (err: any) {
                                toast.error(language === 'ko' ? '커미션 계산 실패' : 'Commission calculation failed');
                                console.error(err);
                              }
                            }}
                          >
                            <Calculator className="h-4 w-4 text-primary" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(inv.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingInvestment
                ? (language === 'ko' ? '투자 수정' : 'Edit Investment')
                : (language === 'ko' ? '투자 추가' : 'Add Investment')}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 pt-4">
            <div className="space-y-2">
              <Label>{language === 'ko' ? '고객' : 'Client'}</Label>
              <Select value={formData.user_id} onValueChange={(v) => setFormData({ ...formData, user_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder={language === 'ko' ? '고객 선택' : 'Select client'} />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.user_id} value={p.user_id}>
                      {p.full_name} ({p.email}) {p.sales_role ? `[${ROLE_LABELS[p.sales_role] || p.sales_role}]` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Product Selector */}
            <div className="space-y-2">
              <Label>{language === 'ko' ? '상품 선택' : 'Select Product'}</Label>
              <Select
                value={formData.product_id}
                onValueChange={(v) => {
                  const product = productOptions.find(p => p.id === v);
                  if (product) {
                    setFormData({
                      ...formData,
                      product_id: v,
                      product_name_en: product.name_en,
                      product_name_ko: product.name_ko,
                      invested_currency: product.default_currency || formData.invested_currency,
                    });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={language === 'ko' ? '상품 선택 (선택사항)' : 'Select product (optional)'} />
                </SelectTrigger>
                <SelectContent>
                  {productOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {language === 'ko' ? p.name_ko : p.name_en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {language === 'ko' ? '상품을 선택하면 커미션이 자동 배분됩니다' : 'Selecting a product enables automatic commission distribution'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{language === 'ko' ? '상품명 (영문)' : 'Product (EN)'}</Label>
                <Input value={formData.product_name_en} onChange={(e) => setFormData({ ...formData, product_name_en: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{language === 'ko' ? '상품명 (한글)' : 'Product (KO)'}</Label>
                <Input value={formData.product_name_ko} onChange={(e) => setFormData({ ...formData, product_name_ko: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{language === 'ko' ? '투자금액' : 'Amount'}</Label>
                <Input type="number" step="0.01" value={formData.investment_amount} onChange={(e) => setFormData({ ...formData, investment_amount: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{language === 'ko' ? '현재가치' : 'Current Value'}</Label>
                <Input type="number" step="0.01" value={formData.current_value} onChange={(e) => setFormData({ ...formData, current_value: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{language === 'ko' ? '통화' : 'Currency'}</Label>
                <Select value={formData.invested_currency} onValueChange={(v) => setFormData({ ...formData, invested_currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="KRW">KRW</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="JPY">JPY</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{language === 'ko' ? '시작일' : 'Start Date'}</Label>
                <Input type="date" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{language === 'ko' ? '투자일' : 'Date Invested'}</Label>
                <Input type="date" value={formData.date_invested} onChange={(e) => setFormData({ ...formData, date_invested: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{language === 'ko' ? '만기일' : 'Maturity Date'}</Label>
                <Input type="date" value={formData.maturity_date} onChange={(e) => setFormData({ ...formData, maturity_date: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{language === 'ko' ? '예상수익률 (%)' : 'Expected Return (%)'}</Label>
                <Input type="number" step="0.01" value={formData.expected_return} onChange={(e) => setFormData({ ...formData, expected_return: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{language === 'ko' ? '상태' : 'Status'}</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{language === 'ko' ? '활성' : 'Active'}</SelectItem>
                    <SelectItem value="matured">{language === 'ko' ? '만기' : 'Matured'}</SelectItem>
                    <SelectItem value="pending">{language === 'ko' ? '대기' : 'Pending'}</SelectItem>
                    <SelectItem value="closed">{language === 'ko' ? '종료' : 'Closed'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Realized Returns - Admin Only */}
            <div>
              <h3 className="font-serif font-semibold text-base mb-3">
                {language === 'ko' ? '실현 수익 (관리자 전용)' : 'Realized Returns (Admin Only)'}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{language === 'ko' ? '실현 수익금' : 'Realized Return Amount'}</Label>
                  <Input type="number" step="0.000001" value={formData.realized_return_amount} onChange={(e) => setFormData({ ...formData, realized_return_amount: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>{language === 'ko' ? '실현 수익률 (%)' : 'Realized Return (%)'}</Label>
                  <Input type="number" step="0.01" value={formData.realized_return_percent} onChange={(e) => setFormData({ ...formData, realized_return_percent: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                {language === 'ko' ? '취소' : 'Cancel'}
              </Button>
              <Button onClick={handleSave} className="btn-gold">
                {language === 'ko' ? '저장' : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Excel Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{language === 'ko' ? '엑셀 일괄 업로드' : 'Excel Bulk Upload'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <ExcelUpload onDataParsed={setParsedData} expectedColumns={expectedColumns} templateName="investments_template" />
            {parsedData.length > 0 && (
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => { setParsedData([]); setUploadDialogOpen(false); }}>
                  {language === 'ko' ? '취소' : 'Cancel'}
                </Button>
                <Button onClick={handleBulkImport} className="btn-gold">
                  {language === 'ko' ? `${parsedData.length}건 업로드` : `Import ${parsedData.length} records`}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
