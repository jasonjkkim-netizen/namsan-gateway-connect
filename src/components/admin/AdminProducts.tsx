import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { productSchema, validateFormData } from '@/lib/admin-validation';
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
import { Plus, Edit, Search, Trash2, Upload, X, Image } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ProductDocuments } from './ProductDocuments';

interface Product {
  id: string;
  name_en: string;
  name_ko: string;
  type: string;
  description_en: string | null;
  description_ko: string | null;
  target_return: number | null;
  minimum_investment: number | null;
  募集_deadline: string | null;
  maturity_date: string | null;
  status: string | null;
  is_active: boolean | null;
  currency: string | null;
  // New commission fields
  target_return_percent: number | null;
  fixed_return_percent: number | null;
  management_fee_percent: number | null;
  performance_fee_percent: number | null;
  upfront_commission_percent: number | null;
  min_investment_amount: number | null;
  fundraising_amount: number | null;
  default_currency: string | null;
  image_url: string | null;
}

interface CommissionRate {
  id: string;
  product_id: string;
  sales_role: string;
  sales_level: number;
  upfront_rate: number;
  performance_rate: number;
  min_rate: number;
  max_rate: number;
}

const PRODUCT_STATUSES = [
  { value: 'draft', labelEn: 'Draft', labelKo: '초안' },
  { value: 'pending', labelEn: 'Pending', labelKo: '검토중' },
  { value: 'open', labelEn: 'Live / Open', labelKo: '모집중' },
  { value: 'closed', labelEn: 'Closed', labelKo: '마감' },
  { value: 'coming_soon', labelEn: 'Coming Soon', labelKo: '예정' },
  { value: 'archived', labelEn: 'Archived', labelKo: '보관' },
];

const STATUS_COLORS: Record<string, string> = {
  draft: 'outline',
  pending: 'secondary',
  open: 'default',
  closed: 'secondary',
  coming_soon: 'outline',
  archived: 'secondary',
};

const SALES_ROLES = [
  { value: 'district_manager', labelEn: 'General Manager', labelKo: '총괄관리' },
  { value: 'principal_agent', labelEn: 'Principal Agent', labelKo: '수석 에이전트' },
  { value: 'agent', labelEn: 'Agent', labelKo: '에이전트' },
];

export function AdminProducts() {
  const { language, formatCurrency, formatPercent, formatDate } = useLanguage();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [commissionRates, setCommissionRates] = useState<CommissionRate[]>([]);

  const [formData, setFormData] = useState({
    name_en: '',
    name_ko: '',
    type: 'fund',
    currency: 'KRW',
    description_en: '',
    description_ko: '',
    target_return: '',
    minimum_investment: '',
    募集_deadline: '',
    maturity_date: '',
    status: 'draft',
    is_active: true,
    // New commission fields
    target_return_percent: '',
    fixed_return_percent: '',
    management_fee_percent: '',
    performance_fee_percent: '',
    upfront_commission_percent: '',
    min_investment_amount: '',
    fundraising_amount: '',
    default_currency: 'USD',
    image_url: '',
  });
  const [imageUploading, setImageUploading] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    const { data, error } = await supabase
      .from('investment_products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error(language === 'ko' ? '상품 조회 실패' : 'Failed to fetch products');
    } else {
      setProducts(data as Product[]);
    }
    setLoading(false);
  }

  async function fetchCommissionRates(productId: string) {
    const { data } = await supabase
      .from('commission_rates')
      .select('*')
      .eq('product_id', productId)
      .eq('is_override', false)
      .order('sales_level', { ascending: true });
    setCommissionRates((data || []) as CommissionRate[]);
  }

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name_en: product.name_en,
      name_ko: product.name_ko,
      type: product.type,
      currency: product.currency || 'KRW',
      description_en: product.description_en || '',
      description_ko: product.description_ko || '',
      target_return: product.target_return ? String(product.target_return) : '',
      minimum_investment: product.minimum_investment ? String(product.minimum_investment) : '',
      募集_deadline: product.募集_deadline || '',
      maturity_date: product.maturity_date || '',
      status: product.status || 'draft',
      is_active: product.is_active ?? true,
      target_return_percent: product.target_return_percent ? String(product.target_return_percent) : '',
      fixed_return_percent: product.fixed_return_percent ? String(product.fixed_return_percent) : '',
      management_fee_percent: product.management_fee_percent ? String(product.management_fee_percent) : '',
      performance_fee_percent: product.performance_fee_percent ? String(product.performance_fee_percent) : '',
      upfront_commission_percent: product.upfront_commission_percent ? String(product.upfront_commission_percent) : '',
      min_investment_amount: product.min_investment_amount ? String(product.min_investment_amount) : '',
      fundraising_amount: product.fundraising_amount ? String(product.fundraising_amount) : '',
      default_currency: product.default_currency || 'USD',
      image_url: product.image_url || '',
    });
    fetchCommissionRates(product.id);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingProduct(null);
    setCommissionRates([]);
    setFormData({
      name_en: '', name_ko: '', type: 'fund', currency: 'KRW',
      description_en: '', description_ko: '', target_return: '',
      minimum_investment: '', 募集_deadline: '', maturity_date: '', status: 'draft', is_active: true,
      target_return_percent: '', fixed_return_percent: '',
      management_fee_percent: '', performance_fee_percent: '',
      upfront_commission_percent: '', min_investment_amount: '', fundraising_amount: '', default_currency: 'USD',
      image_url: '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const targetReturn = formData.target_return ? parseFloat(formData.target_return) : null;
    const minimumInvestment = formData.minimum_investment ? parseFloat(formData.minimum_investment) : null;

    const validationResult = validateFormData(productSchema, {
      name_en: formData.name_en,
      name_ko: formData.name_ko,
      type: formData.type as 'bond' | 'equity' | 'fund' | 'real_estate' | 'alternative',
      description_en: formData.description_en || null,
      description_ko: formData.description_ko || null,
      target_return: targetReturn !== null && isNaN(targetReturn) ? -1 : targetReturn,
      minimum_investment: minimumInvestment !== null && isNaN(minimumInvestment) ? -1 : minimumInvestment,
      募集_deadline: formData.募集_deadline || null,
      status: formData.status as any,
      is_active: formData.is_active,
    }, language);

    if (!validationResult.success) {
      toast.error(validationResult.error);
      return;
    }

    const parseNum = (v: string) => v ? parseFloat(v) || null : null;

    const payload = {
      name_en: validationResult.data.name_en || '',
      name_ko: validationResult.data.name_ko!,
      type: validationResult.data.type!,
      currency: formData.currency,
      description_en: validationResult.data.description_en ?? null,
      description_ko: validationResult.data.description_ko ?? null,
      target_return: validationResult.data.target_return ?? null,
      minimum_investment: validationResult.data.minimum_investment ?? null,
      募集_deadline: validationResult.data.募集_deadline ?? null,
      maturity_date: formData.maturity_date || null,
      status: validationResult.data.status!,
      is_active: validationResult.data.is_active!,
      // New fields
      target_return_percent: parseNum(formData.target_return_percent),
      fixed_return_percent: parseNum(formData.fixed_return_percent),
      management_fee_percent: parseNum(formData.management_fee_percent),
      performance_fee_percent: parseNum(formData.performance_fee_percent),
      upfront_commission_percent: parseNum(formData.upfront_commission_percent),
      min_investment_amount: parseNum(formData.min_investment_amount),
      fundraising_amount: parseNum(formData.fundraising_amount),
      default_currency: formData.default_currency,
      image_url: formData.image_url || null,
    };

    let error;
    if (editingProduct) {
      ({ error } = await supabase.from('investment_products').update(payload).eq('id', editingProduct.id));
    } else {
      ({ error } = await supabase.from('investment_products').insert(payload));
    }

    if (error) {
      toast.error(language === 'ko' ? '저장 실패' : 'Save failed');
      console.error(error);
    } else {
      toast.success(language === 'ko' ? '저장 완료' : 'Saved successfully');
      setDialogOpen(false);
      fetchProducts();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(language === 'ko' ? '삭제하시겠습니까?' : 'Are you sure?')) return;
    const { error } = await supabase.from('investment_products').delete().eq('id', id);
    if (error) {
      toast.error(language === 'ko' ? '삭제 실패' : 'Delete failed');
    } else {
      toast.success(language === 'ko' ? '삭제 완료' : 'Deleted');
      fetchProducts();
    }
  };

  const handleSaveCommissionRate = async (role: string, level: number, upfrontRate: string, performanceRate: string) => {
    if (!editingProduct) return;

    const existing = commissionRates.find(r => r.sales_role === role && r.sales_level === level);
    const payload = {
      product_id: editingProduct.id,
      sales_role: role,
      sales_level: level,
      upfront_rate: parseFloat(upfrontRate) || 0,
      performance_rate: parseFloat(performanceRate) || 0,
      is_override: false,
    };

    let error;
    if (existing) {
      ({ error } = await supabase.from('commission_rates').update(payload).eq('id', existing.id));
    } else {
      ({ error } = await supabase.from('commission_rates').insert(payload));
    }

    if (error) {
      toast.error(language === 'ko' ? '수수료율 저장 실패' : 'Failed to save commission rate');
      console.error(error);
    } else {
      toast.success(language === 'ko' ? '수수료율 저장 완료' : 'Commission rate saved');
      fetchCommissionRates(editingProduct.id);
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name_en.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.name_ko.includes(searchTerm)
  );

  return (
    <div className="card-elevated">
      <div className="p-6 border-b border-border flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-xl font-serif font-semibold">
          {language === 'ko' ? '상품 관리' : 'Product Management'}
        </h2>
        <div className="flex items-center gap-4">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={language === 'ko' ? '검색...' : 'Search...'} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
          </div>
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
              <TableHead>{language === 'ko' ? '상품명' : 'Name'}</TableHead>
              <TableHead>{language === 'ko' ? '유형' : 'Type'}</TableHead>
              <TableHead>{language === 'ko' ? '통화' : 'Currency'}</TableHead>
              <TableHead>{language === 'ko' ? '년 수익률' : 'Annual Return'}</TableHead>
              <TableHead>{language === 'ko' ? '선취수수료' : 'Upfront Comm.'}</TableHead>
              <TableHead>{language === 'ko' ? '상태' : 'Status'}</TableHead>
              <TableHead>{language === 'ko' ? '활성' : 'Active'}</TableHead>
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
            ) : filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  {language === 'ko' ? '데이터가 없습니다' : 'No data found'}
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">
                    <button
                      className="text-primary hover:underline text-left"
                      onClick={() => navigate(`/products/${product.id}`)}
                    >
                      {language === 'ko' ? product.name_ko : product.name_en}
                    </button>
                  </TableCell>
                  <TableCell>
                    {language === 'ko'
                      ? ({ bond: '채권', equity: '주식', fund: '펀드', real_estate: '부동산', alternative: '대안투자' }[product.type] || product.type)
                      : ({ bond: 'Bond', equity: 'Equity', fund: 'Fund', real_estate: 'Real Estate', alternative: 'Alternative' }[product.type] || product.type)}
                  </TableCell>
                  <TableCell>{product.default_currency || product.currency || 'KRW'}</TableCell>
                  <TableCell>
                    {product.fixed_return_percent
                      ? (language === 'ko' ? `년 ${product.fixed_return_percent}%` : `${product.fixed_return_percent}% p.a.`)
                      : product.target_return
                        ? (language === 'ko' ? `년 ${product.target_return}%` : `${product.target_return}% p.a.`)
                        : '-'}
                  </TableCell>
                  <TableCell>
                    {product.upfront_commission_percent ? `${product.upfront_commission_percent}%` : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_COLORS[product.status || 'draft'] as any}>
                      {PRODUCT_STATUSES.find(s => s.value === product.status)?.[language === 'ko' ? 'labelKo' : 'labelEn'] || product.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{product.is_active ? '✓' : '✗'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(product)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(product.id)}>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProduct
                ? (language === 'ko' ? '상품 수정' : 'Edit Product')
                : (language === 'ko' ? '상품 추가' : 'Add Product')}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 pt-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{language === 'ko' ? '상품명 (영문)' : 'Name (EN)'}</Label>
                <Input value={formData.name_en} onChange={(e) => setFormData({ ...formData, name_en: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{language === 'ko' ? '상품명 (한글)' : 'Name (KO)'}</Label>
                <Input value={formData.name_ko} onChange={(e) => setFormData({ ...formData, name_ko: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{language === 'ko' ? '유형' : 'Type'}</Label>
                <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bond">{language === 'ko' ? '채권' : 'Bond'}</SelectItem>
                    <SelectItem value="equity">{language === 'ko' ? '주식' : 'Equity'}</SelectItem>
                    <SelectItem value="fund">{language === 'ko' ? '펀드' : 'Fund'}</SelectItem>
                    <SelectItem value="real_estate">{language === 'ko' ? '부동산' : 'Real Estate'}</SelectItem>
                    <SelectItem value="alternative">{language === 'ko' ? '대안투자' : 'Alternative'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{language === 'ko' ? '통화' : 'Currency'}</Label>
                <Select value={formData.currency} onValueChange={(v) => setFormData({ ...formData, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="KRW">₩ KRW</SelectItem>
                    <SelectItem value="USD">$ USD</SelectItem>
                    <SelectItem value="EUR">€ EUR</SelectItem>
                    <SelectItem value="JPY">¥ JPY</SelectItem>
                    <SelectItem value="GBP">£ GBP</SelectItem>
                    <SelectItem value="CNY">¥ CNY</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{language === 'ko' ? '상태' : 'Status'}</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRODUCT_STATUSES.map(s => (
                      <SelectItem key={s.value} value={s.value}>
                        {language === 'ko' ? s.labelKo : s.labelEn}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{language === 'ko' ? '년 수익률 (%)' : 'Annual Return (%)'}</Label>
                <Input type="number" step="0.1" value={formData.target_return} onChange={(e) => {
                  const val = e.target.value;
                  setFormData({ ...formData, target_return: val, fixed_return_percent: val });
                }} />
                <p className="text-[9px] text-muted-foreground">{language === 'ko' ? '세전 수익률 · 단순 수익률과 연동' : 'Before tax · Synced with Simple Return'}</p>
              </div>
              <div className="space-y-2">
                <Label>{language === 'ko' ? '최소투자금' : 'Min Investment'}</Label>
                <Input type="number" value={formData.minimum_investment} onChange={(e) => setFormData({ ...formData, minimum_investment: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{language === 'ko' ? '설명 (영문)' : 'Description (EN)'}</Label>
              <Textarea value={formData.description_en} onChange={(e) => setFormData({ ...formData, description_en: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{language === 'ko' ? '설명 (한글)' : 'Description (KO)'}</Label>
              <Textarea value={formData.description_ko} onChange={(e) => setFormData({ ...formData, description_ko: e.target.value })} />
            </div>

            {/* Image Upload */}
            <div className="space-y-2">
              <Label>{language === 'ko' ? '상품 이미지' : 'Product Image'}</Label>
              {formData.image_url ? (
                <div className="relative inline-block">
                  <img src={formData.image_url} alt="Product" className="h-32 w-auto rounded-lg border border-border object-cover" />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full"
                    onClick={() => setFormData({ ...formData, image_url: '' })}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 px-4 py-2 border border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                    {imageUploading ? (
                      <span className="text-sm text-muted-foreground">{language === 'ko' ? '업로드 중...' : 'Uploading...'}</span>
                    ) : (
                      <>
                        <Image className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">{language === 'ko' ? '이미지 선택' : 'Select Image'}</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={imageUploading}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 5 * 1024 * 1024) {
                          toast.error(language === 'ko' ? '파일 크기는 5MB 이하여야 합니다' : 'File must be under 5MB');
                          return;
                        }
                        setImageUploading(true);
                        const ext = file.name.split('.').pop();
                        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
                        const { error } = await supabase.storage.from('product-images').upload(fileName, file);
                        if (error) {
                          toast.error(language === 'ko' ? '이미지 업로드 실패' : 'Image upload failed');
                          console.error(error);
                        } else {
                          const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(fileName);
                          setFormData(prev => ({ ...prev, image_url: urlData.publicUrl }));
                          toast.success(language === 'ko' ? '이미지 업로드 완료' : 'Image uploaded');
                        }
                        setImageUploading(false);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{language === 'ko' ? '모집마감일' : 'Deadline'}</Label>
                <Input type="date" value={formData.募集_deadline} onChange={(e) => setFormData({ ...formData, 募集_deadline: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{language === 'ko' ? '상품 만기일' : 'Maturity Date'}</Label>
                <Input type="date" value={formData.maturity_date} onChange={(e) => setFormData({ ...formData, maturity_date: e.target.value })} />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch checked={formData.is_active} onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })} />
                <Label>{language === 'ko' ? '활성화' : 'Active'}</Label>
              </div>
            </div>

            <Separator />

            {/* Commission & Fee Section */}
            <div>
              <h3 className="font-serif font-semibold text-lg mb-3">
                {language === 'ko' ? '수수료 및 커미션 설정' : 'Fee & Commission Settings'}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{language === 'ko' ? '최대 수익률 (%)' : 'Maximumm Return (%)'}</Label>
                  <Input type="number" step="0.01" value={formData.target_return_percent} onChange={(e) => setFormData({ ...formData, target_return_percent: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>{language === 'ko' ? '단순 수익률 (%)' : 'Simple Return (%)'}</Label>
                  <Input type="number" step="0.01" value={formData.fixed_return_percent} onChange={(e) => {
                    const val = e.target.value;
                    setFormData({ ...formData, fixed_return_percent: val, target_return: val });
                  }} />
                  <p className="text-[9px] text-muted-foreground">{language === 'ko' ? '년 수익률과 연동' : 'Synced with Annual Return'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="space-y-2">
                  <Label>{language === 'ko' ? '관리 수수료 (%)' : 'Management Fee (%)'}</Label>
                  <Input type="number" step="0.01" value={formData.management_fee_percent} onChange={(e) => setFormData({ ...formData, management_fee_percent: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>{language === 'ko' ? '성과 수수료 (%)' : 'Performance Fee (%)'}</Label>
                  <Input type="number" step="0.01" value={formData.performance_fee_percent} onChange={(e) => setFormData({ ...formData, performance_fee_percent: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-4">
                <div className="space-y-2">
                  <Label>{language === 'ko' ? '선취 커미션 (%)' : 'Upfront Commission (%)'}</Label>
                  <Input type="number" step="0.01" value={formData.upfront_commission_percent} onChange={(e) => setFormData({ ...formData, upfront_commission_percent: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>{language === 'ko' ? '최소 투자금' : 'Min Investment Amount'}</Label>
                  <Input type="number" step="0.01" value={formData.min_investment_amount} onChange={(e) => setFormData({ ...formData, min_investment_amount: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>{language === 'ko' ? '모집 금액' : 'Fundraising Amount'}</Label>
                  <Input type="number" step="0.01" value={formData.fundraising_amount} onChange={(e) => setFormData({ ...formData, fundraising_amount: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>{language === 'ko' ? '기본 통화' : 'Default Currency'}</Label>
                  <Select value={formData.default_currency} onValueChange={(v) => setFormData({ ...formData, default_currency: v })}>
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
            </div>

            {/* Commission Rates per Role - only when editing */}
            {editingProduct && (
              <>
                <Separator />
                <CommissionRatesEditor
                  productId={editingProduct.id}
                  rates={commissionRates}
                  language={language}
                  onSave={handleSaveCommissionRate}
                />
              </>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                {language === 'ko' ? '취소' : 'Cancel'}
              </Button>
              <Button onClick={handleSave} className="btn-gold">
                {language === 'ko' ? '저장' : 'Save'}
              </Button>
            </div>

            {editingProduct && <ProductDocuments productId={editingProduct.id} />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Sub-component for commission rates per role
function CommissionRatesEditor({
  productId,
  rates,
  language,
  onSave,
}: {
  productId: string;
  rates: CommissionRate[];
  language: string;
  onSave: (role: string, level: number, upfront: string, performance: string) => void;
}) {
  const [editingRate, setEditingRate] = useState<{ role: string; upfront: string; performance: string } | null>(null);

  return (
    <div>
      <h3 className="font-serif font-semibold text-lg mb-3">
        {language === 'ko' ? '역할별 기본 커미션율' : 'Default Commission Rates by Role'}
      </h3>
      <div className="border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{language === 'ko' ? '역할' : 'Role'}</TableHead>
              <TableHead>{language === 'ko' ? '선취율 (%)' : 'Upfront Rate (%)'}</TableHead>
              <TableHead>{language === 'ko' ? '성과율 (%)' : 'Performance Rate (%)'}</TableHead>
              <TableHead>{language === 'ko' ? '작업' : 'Actions'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SALES_ROLES.map((sr, idx) => {
              const existing = rates.find(r => r.sales_role === sr.value);
              const isEditing = editingRate?.role === sr.value;
              return (
                <TableRow key={sr.value}>
                  <TableCell className="font-medium">
                    {language === 'ko' ? sr.labelKo : sr.labelEn}
                  </TableCell>
                  <TableCell>
                    {isEditing ? (
                      <Input
                        type="number"
                        step="0.01"
                        className="w-24 h-8"
                        value={editingRate.upfront}
                        onChange={(e) => setEditingRate({ ...editingRate, upfront: e.target.value })}
                      />
                    ) : (
                      existing ? `${existing.upfront_rate}%` : '—'
                    )}
                  </TableCell>
                  <TableCell>
                    {isEditing ? (
                      <Input
                        type="number"
                        step="0.01"
                        className="w-24 h-8"
                        value={editingRate.performance}
                        onChange={(e) => setEditingRate({ ...editingRate, performance: e.target.value })}
                      />
                    ) : (
                      existing ? `${existing.performance_rate}%` : '—'
                    )}
                  </TableCell>
                  <TableCell>
                    {isEditing ? (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          className="h-7 btn-gold"
                          onClick={() => {
                            onSave(sr.value, idx + 1, editingRate.upfront, editingRate.performance);
                            setEditingRate(null);
                          }}
                        >
                          {language === 'ko' ? '저장' : 'Save'}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditingRate(null)}>
                          {language === 'ko' ? '취소' : 'Cancel'}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7"
                        onClick={() => setEditingRate({
                          role: sr.value,
                          upfront: existing ? String(existing.upfront_rate) : '0',
                          performance: existing ? String(existing.performance_rate) : '0',
                        })}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        {language === 'ko' ? '설정' : 'Set'}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
