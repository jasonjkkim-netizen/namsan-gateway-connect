import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { productSchema, validateFormData } from '@/lib/admin-validation';
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
import { Plus, Edit, Search, Trash2 } from 'lucide-react';

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
  status: string | null;
  is_active: boolean | null;
}

export function AdminProducts() {
  const { language, formatCurrency, formatPercent, formatDate } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [formData, setFormData] = useState({
    name_en: '',
    name_ko: '',
    type: 'fund',
    description_en: '',
    description_ko: '',
    target_return: '',
    minimum_investment: '',
    募集_deadline: '',
    status: 'open',
    is_active: true,
  });

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

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name_en: product.name_en,
      name_ko: product.name_ko,
      type: product.type,
      description_en: product.description_en || '',
      description_ko: product.description_ko || '',
      target_return: product.target_return ? String(product.target_return) : '',
      minimum_investment: product.minimum_investment ? String(product.minimum_investment) : '',
      募集_deadline: product.募集_deadline || '',
      status: product.status || 'open',
      is_active: product.is_active ?? true,
    });
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingProduct(null);
    setFormData({
      name_en: '',
      name_ko: '',
      type: 'fund',
      description_en: '',
      description_ko: '',
      target_return: '',
      minimum_investment: '',
      募集_deadline: '',
      status: 'open',
      is_active: true,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    // Parse numeric values
    const targetReturn = formData.target_return ? parseFloat(formData.target_return) : null;
    const minimumInvestment = formData.minimum_investment ? parseFloat(formData.minimum_investment) : null;

    // Validate form data
    const validationResult = validateFormData(productSchema, {
      name_en: formData.name_en,
      name_ko: formData.name_ko,
      type: formData.type as 'bond' | 'equity' | 'fund' | 'real_estate' | 'alternative',
      description_en: formData.description_en || null,
      description_ko: formData.description_ko || null,
      target_return: targetReturn !== null && isNaN(targetReturn) ? -1 : targetReturn,
      minimum_investment: minimumInvestment !== null && isNaN(minimumInvestment) ? -1 : minimumInvestment,
      募集_deadline: formData.募集_deadline || null,
      status: formData.status as 'open' | 'closed' | 'coming_soon',
      is_active: formData.is_active,
    }, language);

    if (!validationResult.success) {
      toast.error(validationResult.error);
      return;
    }

    const payload = {
      name_en: validationResult.data.name_en!,
      name_ko: validationResult.data.name_ko!,
      type: validationResult.data.type!,
      description_en: validationResult.data.description_en ?? null,
      description_ko: validationResult.data.description_ko ?? null,
      target_return: validationResult.data.target_return ?? null,
      minimum_investment: validationResult.data.minimum_investment ?? null,
      募集_deadline: validationResult.data.募集_deadline ?? null,
      status: validationResult.data.status!,
      is_active: validationResult.data.is_active!,
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
            <Input
              placeholder={language === 'ko' ? '검색...' : 'Search...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
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
              <TableHead>{language === 'ko' ? '목표수익률' : 'Target Return'}</TableHead>
              <TableHead>{language === 'ko' ? '최소투자금' : 'Min Investment'}</TableHead>
              <TableHead>{language === 'ko' ? '상태' : 'Status'}</TableHead>
              <TableHead>{language === 'ko' ? '활성' : 'Active'}</TableHead>
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
            ) : filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  {language === 'ko' ? '데이터가 없습니다' : 'No data found'}
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">
                    {language === 'ko' ? product.name_ko : product.name_en}
                  </TableCell>
                  <TableCell>{product.type}</TableCell>
                  <TableCell>
                    {product.target_return ? formatPercent(product.target_return) : '-'}
                  </TableCell>
                  <TableCell>
                    {product.minimum_investment ? formatCurrency(product.minimum_investment) : '-'}
                  </TableCell>
                  <TableCell>{product.status}</TableCell>
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProduct
                ? (language === 'ko' ? '상품 수정' : 'Edit Product')
                : (language === 'ko' ? '상품 추가' : 'Add Product')}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 pt-4">
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
            <div className="space-y-2">
              <Label>{language === 'ko' ? '유형' : 'Type'}</Label>
              <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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
              <Label>{language === 'ko' ? '설명 (영문)' : 'Description (EN)'}</Label>
              <Textarea value={formData.description_en} onChange={(e) => setFormData({ ...formData, description_en: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{language === 'ko' ? '설명 (한글)' : 'Description (KO)'}</Label>
              <Textarea value={formData.description_ko} onChange={(e) => setFormData({ ...formData, description_ko: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{language === 'ko' ? '목표수익률 (%)' : 'Target Return (%)'}</Label>
                <Input type="number" step="0.1" value={formData.target_return} onChange={(e) => setFormData({ ...formData, target_return: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{language === 'ko' ? '최소투자금' : 'Min Investment'}</Label>
                <Input type="number" value={formData.minimum_investment} onChange={(e) => setFormData({ ...formData, minimum_investment: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{language === 'ko' ? '모집마감일' : 'Deadline'}</Label>
                <Input type="date" value={formData.募集_deadline} onChange={(e) => setFormData({ ...formData, 募集_deadline: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{language === 'ko' ? '상태' : 'Status'}</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">{language === 'ko' ? '모집중' : 'Open'}</SelectItem>
                    <SelectItem value="closed">{language === 'ko' ? '마감' : 'Closed'}</SelectItem>
                    <SelectItem value="coming_soon">{language === 'ko' ? '예정' : 'Coming Soon'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label>{language === 'ko' ? '활성화' : 'Active'}</Label>
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
    </div>
  );
}
