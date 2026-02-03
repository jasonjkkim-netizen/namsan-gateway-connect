import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ExcelUpload } from './ExcelUpload';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Edit, Search, Upload, Trash2 } from 'lucide-react';

interface Investment {
  id: string;
  user_id: string;
  product_name_en: string;
  product_name_ko: string;
  investment_amount: number;
  current_value: number;
  start_date: string;
  maturity_date: string | null;
  expected_return: number | null;
  status: string | null;
}

interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
}

export function AdminInvestments() {
  const { language, formatCurrency, formatDate, formatPercent } = useLanguage();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
  const [parsedData, setParsedData] = useState<Record<string, any>[]>([]);

  const [formData, setFormData] = useState({
    user_id: '',
    product_name_en: '',
    product_name_ko: '',
    investment_amount: '',
    current_value: '',
    start_date: '',
    maturity_date: '',
    expected_return: '',
    status: 'active',
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const [investmentsRes, profilesRes] = await Promise.all([
      supabase.from('client_investments').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, user_id, email, full_name'),
    ]);

    if (investmentsRes.data) setInvestments(investmentsRes.data as Investment[]);
    if (profilesRes.data) setProfiles(profilesRes.data as Profile[]);
    setLoading(false);
  }

  const handleEdit = (investment: Investment) => {
    setEditingInvestment(investment);
    setFormData({
      user_id: investment.user_id,
      product_name_en: investment.product_name_en,
      product_name_ko: investment.product_name_ko,
      investment_amount: String(investment.investment_amount),
      current_value: String(investment.current_value),
      start_date: investment.start_date,
      maturity_date: investment.maturity_date || '',
      expected_return: investment.expected_return ? String(investment.expected_return) : '',
      status: investment.status || 'active',
    });
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingInvestment(null);
    setFormData({
      user_id: '',
      product_name_en: '',
      product_name_ko: '',
      investment_amount: '',
      current_value: '',
      start_date: new Date().toISOString().split('T')[0],
      maturity_date: '',
      expected_return: '',
      status: 'active',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const payload = {
      user_id: formData.user_id,
      product_name_en: formData.product_name_en,
      product_name_ko: formData.product_name_ko,
      investment_amount: parseFloat(formData.investment_amount),
      current_value: parseFloat(formData.current_value),
      start_date: formData.start_date,
      maturity_date: formData.maturity_date || null,
      expected_return: formData.expected_return ? parseFloat(formData.expected_return) : null,
      status: formData.status,
    };

    let error;
    if (editingInvestment) {
      ({ error } = await supabase.from('client_investments').update(payload).eq('id', editingInvestment.id));
    } else {
      ({ error } = await supabase.from('client_investments').insert(payload));
    }

    if (error) {
      toast.error(language === 'ko' ? '저장 실패' : 'Save failed');
      console.error(error);
    } else {
      toast.success(language === 'ko' ? '저장 완료' : 'Saved successfully');
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

    const formattedData = parsedData.map((row) => ({
      user_id: row.user_id,
      product_name_en: row.product_name_en,
      product_name_ko: row.product_name_ko,
      investment_amount: parseFloat(row.investment_amount),
      current_value: parseFloat(row.current_value),
      start_date: row.start_date,
      maturity_date: row.maturity_date || null,
      expected_return: row.expected_return ? parseFloat(row.expected_return) : null,
      status: row.status || 'active',
    }));

    const { error } = await supabase.from('client_investments').insert(formattedData);

    if (error) {
      toast.error(language === 'ko' ? '일괄 업로드 실패' : 'Bulk import failed');
      console.error(error);
    } else {
      toast.success(language === 'ko' ? `${formattedData.length}건 업로드 완료` : `${formattedData.length} records imported`);
      setUploadDialogOpen(false);
      setParsedData([]);
      fetchData();
    }
  };

  const getClientName = (userId: string) => {
    const profile = profiles.find((p) => p.user_id === userId);
    return profile ? `${profile.full_name} (${profile.email})` : userId;
  };

  const filteredInvestments = investments.filter(
    (inv) =>
      inv.product_name_en.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.product_name_ko.includes(searchTerm) ||
      getClientName(inv.user_id).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const expectedColumns = [
    'user_id',
    'product_name_en',
    'product_name_ko',
    'investment_amount',
    'current_value',
    'start_date',
  ];

  return (
    <div className="card-elevated">
      <div className="p-6 border-b border-border flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-xl font-serif font-semibold">
          {language === 'ko' ? '투자 관리' : 'Investment Management'}
        </h2>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={language === 'ko' ? '검색...' : 'Search...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
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
              <TableHead>{language === 'ko' ? '상품명' : 'Product'}</TableHead>
              <TableHead>{language === 'ko' ? '투자금액' : 'Amount'}</TableHead>
              <TableHead>{language === 'ko' ? '현재가치' : 'Current Value'}</TableHead>
              <TableHead>{language === 'ko' ? '시작일' : 'Start Date'}</TableHead>
              <TableHead>{language === 'ko' ? '상태' : 'Status'}</TableHead>
              <TableHead>{language === 'ko' ? '작업' : 'Actions'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-24" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : filteredInvestments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  {language === 'ko' ? '데이터가 없습니다' : 'No data found'}
                </TableCell>
              </TableRow>
            ) : (
              filteredInvestments.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium max-w-[200px] truncate">
                    {getClientName(inv.user_id)}
                  </TableCell>
                  <TableCell>
                    {language === 'ko' ? inv.product_name_ko : inv.product_name_en}
                  </TableCell>
                  <TableCell>{formatCurrency(inv.investment_amount)}</TableCell>
                  <TableCell>{formatCurrency(inv.current_value)}</TableCell>
                  <TableCell>{formatDate(inv.start_date)}</TableCell>
                  <TableCell>{inv.status}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(inv)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(inv.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
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
                      {p.full_name} ({p.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{language === 'ko' ? '투자금액' : 'Amount'}</Label>
                <Input type="number" value={formData.investment_amount} onChange={(e) => setFormData({ ...formData, investment_amount: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{language === 'ko' ? '현재가치' : 'Current Value'}</Label>
                <Input type="number" value={formData.current_value} onChange={(e) => setFormData({ ...formData, current_value: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{language === 'ko' ? '시작일' : 'Start Date'}</Label>
                <Input type="date" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{language === 'ko' ? '만기일' : 'Maturity Date'}</Label>
                <Input type="date" value={formData.maturity_date} onChange={(e) => setFormData({ ...formData, maturity_date: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{language === 'ko' ? '예상수익률 (%)' : 'Expected Return (%)'}</Label>
                <Input type="number" step="0.1" value={formData.expected_return} onChange={(e) => setFormData({ ...formData, expected_return: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{language === 'ko' ? '상태' : 'Status'}</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{language === 'ko' ? '활성' : 'Active'}</SelectItem>
                    <SelectItem value="matured">{language === 'ko' ? '만기' : 'Matured'}</SelectItem>
                    <SelectItem value="pending">{language === 'ko' ? '대기' : 'Pending'}</SelectItem>
                    <SelectItem value="closed">{language === 'ko' ? '종료' : 'Closed'}</SelectItem>
                  </SelectContent>
                </Select>
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
            <DialogTitle>
              {language === 'ko' ? '엑셀 일괄 업로드' : 'Excel Bulk Upload'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <ExcelUpload
              onDataParsed={setParsedData}
              expectedColumns={expectedColumns}
              templateName="investments_template"
            />
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
