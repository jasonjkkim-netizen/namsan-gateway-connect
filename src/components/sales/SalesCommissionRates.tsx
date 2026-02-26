import { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import { toast } from 'sonner';
import { Settings, Save, RotateCcw, ChevronDown } from 'lucide-react';

interface Product {
  id: string;
  name_en: string;
  name_ko: string;
  upfront_commission_percent: number | null;
  performance_fee_percent: number | null;
}

interface CommissionRate {
  id: string;
  product_id: string;
  sales_role: string;
  sales_level: number;
  upfront_rate: number;
  performance_rate: number;
  is_override: boolean | null;
  override_user_id: string | null;
  set_by: string | null;
}

interface DownlineMember {
  user_id: string;
  full_name: string;
  sales_role: string;
  sales_level: number;
  depth: number;
}

interface SalesCommissionRatesProps {
  downline: DownlineMember[];
}

const ROLE_LABELS: Record<string, Record<string, string>> = {
  ko: {
    webmaster: '웹마스터',
    district_manager: '총괄관리',
    deputy_district_manager: '부총괄관리',
    principal_agent: '수석 에이전트',
    agent: '에이전트',
  },
  en: {
    webmaster: 'Webmaster',
    district_manager: 'General Manager',
    deputy_district_manager: 'Deputy GM',
    principal_agent: 'Principal Agent',
    agent: 'Agent',
  },
};

const SALES_ROLES_ORDERED = [
  'webmaster',
  'district_manager',
  'deputy_district_manager',
  'principal_agent',
  'agent',
] as const;

const ROLE_LEVELS: Record<string, number> = {
  webmaster: 0,
  district_manager: 1,
  deputy_district_manager: 2,
  principal_agent: 3,
  agent: 4,
  client: 5,
};

// Default splits when no rates are configured
const DEFAULT_SPLITS: Record<string, number> = {
  webmaster: 0.00,
  district_manager: 0.40,
  deputy_district_manager: 0.25,
  principal_agent: 0.20,
  agent: 0.15,
};

export function SalesCommissionRates({ downline }: SalesCommissionRatesProps) {
  const { language } = useLanguage();
  const { user, profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [rates, setRates] = useState<CommissionRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Edited values: key = `${productId}_${role}_${userId || 'default'}`, value = { upfront, performance }
  const [editedRates, setEditedRates] = useState<Record<string, { upfront: string; performance: string }>>({});
  const [selectedProductId, setSelectedProductId] = useState<string>('all');

  const userSalesRole = (profile as any)?.sales_role;
  const userLevel = ROLE_LEVELS[userSalesRole] ?? 99;

  // Roles this user can edit (own level and below)
  const editableRoles = SALES_ROLES_ORDERED.filter(
    (r) => ROLE_LEVELS[r] >= userLevel
  );

  // Downline members who are sales (not clients)
  const salesDownline = useMemo(
    () => downline.filter((m) => m.sales_role && m.sales_role !== 'client'),
    [downline]
  );

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const [productsRes, ratesRes] = await Promise.all([
      supabase
        .from('investment_products')
        .select('id, name_en, name_ko, upfront_commission_percent, performance_fee_percent')
        .eq('is_active', true)
        .order('name_en'),
      supabase
        .from('commission_rates')
        .select('*')
        .order('sales_level', { ascending: true }),
    ]);
    if (productsRes.data) setProducts(productsRes.data as Product[]);
    if (ratesRes.data) setRates(ratesRes.data as CommissionRate[]);
    setLoading(false);
  }

  // Get the effective rate for a role on a product
  const getEffectiveRate = (productId: string, role: string, userId?: string) => {
    // Check user-specific override first
    if (userId) {
      const override = rates.find(
        (r) =>
          r.product_id === productId &&
          r.is_override &&
          r.override_user_id === userId
      );
      if (override) {
        return {
          upfront: Number(override.upfront_rate),
          performance: Number(override.performance_rate),
          source: 'override' as const,
          id: override.id,
        };
      }
    }

    // Check product-level role rate
    const roleRate = rates.find(
      (r) =>
        r.product_id === productId &&
        !r.is_override &&
        r.sales_role === role
    );
    if (roleRate) {
      return {
        upfront: Number(roleRate.upfront_rate),
        performance: Number(roleRate.performance_rate),
        source: 'product' as const,
        id: roleRate.id,
      };
    }

    // Fall back to default calculation from product
    // If ANY manual (non-override) rates exist for this product, roles without manual rates get 0
    const hasManualRatesForProduct = rates.some(
      (r) => r.product_id === productId && !r.is_override
    );
    if (hasManualRatesForProduct) {
      return { upfront: 0, performance: 0, source: 'default' as const, id: null };
    }

    const product = products.find((p) => p.id === productId);
    if (product?.upfront_commission_percent) {
      const totalUpfront = Number(product.upfront_commission_percent);
      const totalPerf = Number(product.performance_fee_percent) || 0;
      const split = DEFAULT_SPLITS[role] || 0;
      return {
        upfront: Math.round(totalUpfront * split * 100) / 100,
        performance: Math.round(totalPerf * split * 100) / 100,
        source: 'default' as const,
        id: null,
      };
    }

    return { upfront: 0, performance: 0, source: 'default' as const, id: null };
  };

  // Get the current display value for a role (edited or effective)
  const getCurrentRateValue = (productId: string, role: string, field: 'upfront' | 'performance', excludeEdited?: Record<string, { upfront: string; performance: string }>): number => {
    const key = `${productId}_${role}_default`;
    const edited = (excludeEdited || editedRates)[key];
    if (edited && edited[field] !== '') {
      const val = parseFloat(edited[field]);
      if (!isNaN(val)) return val;
    }
    const effective = getEffectiveRate(productId, role);
    return field === 'upfront' ? effective.upfront : effective.performance;
  };

  // Waterfall: when a role's rate changes, auto-distribute remaining to roles below
  const handleRateChange = (
    key: string,
    field: 'upfront' | 'performance',
    value: string
  ) => {
    const [productId, role, targetUserId] = key.split('_');

    // For individual overrides, just set normally
    if (targetUserId && targetUserId !== 'default') {
      setEditedRates((prev) => ({
        ...prev,
        [key]: {
          ...prev[key] || { upfront: '', performance: '' },
          [field]: value,
        },
      }));
      return;
    }

    // Waterfall logic for role-level defaults
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    const totalAvailable = field === 'upfront'
      ? Number(product.upfront_commission_percent) || 0
      : Number(product.performance_fee_percent) || 0;

    const changedRoleIdx = SALES_ROLES_ORDERED.indexOf(role as typeof SALES_ROLES_ORDERED[number]);
    const changedValue = parseFloat(value) || 0;

    // Start with current edited rates, apply the new change
    const newEdited: Record<string, { upfront: string; performance: string }> = { ...editedRates };
    newEdited[key] = {
      ...newEdited[key] || { upfront: '', performance: '' },
      [field]: value,
    };

    // Calculate sum of roles ABOVE the changed role (using current values)
    let sumAbove = 0;
    for (let i = 0; i < changedRoleIdx; i++) {
      sumAbove += getCurrentRateValue(productId, SALES_ROLES_ORDERED[i], field, newEdited);
    }

    const consumed = sumAbove + changedValue;

    if (consumed <= totalAvailable) {
      // Normal downward waterfall: distribute remaining to next role below, rest get 0
      const remaining = Math.max(0, totalAvailable - consumed);
      for (let i = changedRoleIdx + 1; i < SALES_ROLES_ORDERED.length; i++) {
        const r = SALES_ROLES_ORDERED[i];
        const rKey = `${productId}_${r}_default`;
        if (i === changedRoleIdx + 1) {
          newEdited[rKey] = {
            ...newEdited[rKey] || { upfront: '', performance: '' },
            [field]: remaining.toFixed(2),
          };
        } else {
          newEdited[rKey] = {
            ...newEdited[rKey] || { upfront: '', performance: '' },
            [field]: '0',
          };
        }
      }
    } else {
      // Upward waterfall: changed role exceeds budget with roles above
      // Zero out roles above, give remaining to the role directly above changed role
      const remaining = Math.max(0, totalAvailable - changedValue);
      for (let i = 0; i < changedRoleIdx; i++) {
        const r = SALES_ROLES_ORDERED[i];
        const rKey = `${productId}_${r}_default`;
        if (i === changedRoleIdx - 1) {
          // Role directly above gets remaining
          newEdited[rKey] = {
            ...newEdited[rKey] || { upfront: '', performance: '' },
            [field]: remaining.toFixed(2),
          };
        } else {
          newEdited[rKey] = {
            ...newEdited[rKey] || { upfront: '', performance: '' },
            [field]: '0',
          };
        }
      }
      // Zero out roles below
      for (let i = changedRoleIdx + 1; i < SALES_ROLES_ORDERED.length; i++) {
        const r = SALES_ROLES_ORDERED[i];
        const rKey = `${productId}_${r}_default`;
        newEdited[rKey] = {
          ...newEdited[rKey] || { upfront: '', performance: '' },
          [field]: '0',
        };
      }
    }

    setEditedRates(newEdited);
  };

  // Recalculate commissions for all investments linked to given product IDs
  const recalculateCommissions = async (productIds: string[]) => {
    if (productIds.length === 0) return;

    // Fetch investments for affected products
    const { data: investments } = await supabase
      .from('client_investments')
      .select('id')
      .in('product_id', productIds);

    if (!investments || investments.length === 0) return;

    const toastId = toast.loading(
      language === 'ko'
        ? `${investments.length}건 커미션 재계산 중...`
        : `Recalculating ${investments.length} commissions...`
    );

    let successCount = 0;
    let failCount = 0;

    for (const inv of investments) {
      try {
        const { error } = await supabase.functions.invoke('calculate-commissions', {
          body: { investment_id: inv.id },
        });
        if (error) {
          failCount++;
          console.error('Recalc failed for', inv.id, error);
        } else {
          successCount++;
        }
      } catch (e) {
        failCount++;
        console.error('Recalc error for', inv.id, e);
      }
    }

    toast.dismiss(toastId);
    if (failCount === 0) {
      toast.success(
        language === 'ko'
          ? `${successCount}건 커미션이 재계산되었습니다`
          : `${successCount} commissions recalculated`
      );
    } else {
      toast.warning(
        language === 'ko'
          ? `${successCount}건 성공, ${failCount}건 실패`
          : `${successCount} succeeded, ${failCount} failed`
      );
    }
  };

  const saveRates = async () => {
    if (!user) return;
    setSaving(true);

    try {
      const operations: PromiseLike<any>[] = [];

      for (const [key, values] of Object.entries(editedRates)) {
        const [productId, role, targetUserId] = key.split('_');
        const upfront = parseFloat(values.upfront);
        const performance = parseFloat(values.performance);

        if (isNaN(upfront) && isNaN(performance)) continue;

        const isUserOverride = targetUserId && targetUserId !== 'default';

        if (isUserOverride) {
          // User-specific override
          const existing = rates.find(
            (r) =>
              r.product_id === productId &&
              r.is_override &&
              r.override_user_id === targetUserId
          );

          if (existing) {
            operations.push(
              supabase
                .from('commission_rates')
                .update({
                  upfront_rate: isNaN(upfront) ? existing.upfront_rate : upfront,
                  performance_rate: isNaN(performance) ? existing.performance_rate : performance,
                  set_by: user.id,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', existing.id)
                .then()
            );
          } else {
            const effectiveRate = getEffectiveRate(productId, role);
            operations.push(
              supabase.from('commission_rates').insert({
                product_id: productId,
                sales_role: role,
                sales_level: ROLE_LEVELS[role] || 0,
                upfront_rate: isNaN(upfront) ? effectiveRate.upfront : upfront,
                performance_rate: isNaN(performance) ? effectiveRate.performance : performance,
                is_override: true,
                override_user_id: targetUserId,
                set_by: user.id,
              }).then()
            );
          }
        } else {
          // Role-level default rate
          const existing = rates.find(
            (r) =>
              r.product_id === productId &&
              !r.is_override &&
              r.sales_role === role
          );

          if (existing) {
            operations.push(
              supabase
                .from('commission_rates')
                .update({
                  upfront_rate: isNaN(upfront) ? existing.upfront_rate : upfront,
                  performance_rate: isNaN(performance) ? existing.performance_rate : performance,
                  set_by: user.id,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', existing.id)
                .then()
            );
          } else {
            operations.push(
              supabase.from('commission_rates').insert({
                product_id: productId,
                sales_role: role,
                sales_level: ROLE_LEVELS[role] || 0,
                upfront_rate: isNaN(upfront) ? 0 : upfront,
                performance_rate: isNaN(performance) ? 0 : performance,
                is_override: false,
                set_by: user.id,
              }).then()
            );
          }
        }
      }

      const results = await Promise.all(operations);
      const errors = results.filter((r) => r.error);
      if (errors.length > 0) {
        console.error('Rate save errors:', errors);
        toast.error(language === 'ko' ? '일부 요율 저장 실패' : 'Some rates failed to save');
      } else {
        toast.success(language === 'ko' ? '커미션 요율이 저장되었습니다' : 'Commission rates saved');
        
        // Collect affected info before clearing
        const affectedProductIds = [
          ...new Set(Object.keys(editedRates).map((k) => k.split('_')[0])),
        ];
        const affectedRoles = [
          ...new Set(Object.keys(editedRates).map((k) => k.split('_')[1])),
        ];
        
        setEditedRates({});
        await fetchData();

        // Recalculate commissions for affected products
        await recalculateCommissions(affectedProductIds);

        // Notify all upper-level supervisors
        try {
          const affectedProducts = products
            .filter((p) => affectedProductIds.includes(p.id))
            .map((p) => ({ en: p.name_en, ko: p.name_ko }));

          await supabase.functions.invoke('notify-sales', {
            body: {
              type: 'commission_rate_changed',
              user_id: user.id,
              changed_by_name: profile?.full_name || user.email,
              product_names: affectedProducts,
              affected_roles: affectedRoles,
            },
          });
        } catch (notifyErr) {
          console.error('Rate change notification failed (non-blocking):', notifyErr);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error(language === 'ko' ? '저장 실패' : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // Products to display
  const displayProducts = selectedProductId === 'all'
    ? products
    : products.filter((p) => p.id === selectedProductId);

  // Calculate total commission for a product (sum of all role rates)
  const getProductTotalRate = (productId: string) => {
    let totalUpfront = 0;
    let totalPerformance = 0;
    for (const role of SALES_ROLES_ORDERED) {
      const rate = getEffectiveRate(productId, role);
      totalUpfront += rate.upfront;
      totalPerformance += rate.performance;
    }
    return { totalUpfront, totalPerformance };
  };

  // Grand total across all products
  const grandTotal = useMemo(() => {
    let upfront = 0;
    let performance = 0;
    for (const product of products) {
      const t = getProductTotalRate(product.id);
      upfront += t.totalUpfront;
      performance += t.totalPerformance;
    }
    return { upfront, performance };
  }, [products, rates]);

  const hasEdits = Object.keys(editedRates).length > 0;

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-base font-semibold">
            {language === 'ko' ? '커미션 요율 설정' : 'Commission Rate Settings'}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedProductId} onValueChange={setSelectedProductId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {language === 'ko' ? '전체 상품' : 'All Products'}
              </SelectItem>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {language === 'ko' ? p.name_ko : p.name_en}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasEdits && (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditedRates({})}
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                {language === 'ko' ? '초기화' : 'Reset'}
              </Button>
              <Button size="sm" onClick={saveRates} disabled={saving}>
                <Save className="h-4 w-4 mr-1" />
                {saving
                  ? (language === 'ko' ? '저장중...' : 'Saving...')
                  : (language === 'ko' ? '저장' : 'Save')}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Grand Total Summary */}
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            {language === 'ko' ? '총 수수료 합계' : 'Total Commission Rate'}
          </span>
          <div className="flex items-center gap-4">
            <span className="text-sm">
              {language === 'ko' ? '선취' : 'Upfront'}:{' '}
              <strong>{grandTotal.upfront.toFixed(2)}%</strong>
            </span>
            <span className="text-sm">
              {language === 'ko' ? '성과' : 'Perf'}:{' '}
              <strong>{grandTotal.performance.toFixed(2)}%</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Per-product rate tables */}
      {displayProducts.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {language === 'ko' ? '활성 상품이 없습니다' : 'No active products'}
        </div>
      ) : (
        <Accordion type="multiple" defaultValue={displayProducts.map((p) => p.id)}>
          {displayProducts.map((product) => {
            const productTotal = getProductTotalRate(product.id);
            return (
              <AccordionItem key={product.id} value={product.id} className="border rounded-lg mb-3">
                <AccordionTrigger className="px-4 hover:no-underline">
                  <div className="flex items-center justify-between w-full mr-2">
                    <span className="font-medium">
                      {language === 'ko' ? product.name_ko : product.name_en}
                    </span>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span>
                        {language === 'ko' ? '선취' : 'Up'}: {productTotal.totalUpfront.toFixed(2)}%
                      </span>
                      <span>
                        {language === 'ko' ? '성과' : 'Perf'}: {productTotal.totalPerformance.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  {/* Product total info */}
                  {(() => {
                    const totalUpfront = Number(product.upfront_commission_percent) || 0;
                    const totalPerf = Number(product.performance_fee_percent) || 0;
                    
                    // Calculate each role's current value (with edits applied)
                    const roleValues = SALES_ROLES_ORDERED.map((role) => {
                      const key = `${product.id}_${role}_default`;
                      const edited = editedRates[key];
                      const effective = getEffectiveRate(product.id, role);
                      const upfront = edited?.upfront !== undefined && edited.upfront !== '' 
                        ? parseFloat(edited.upfront) || 0 
                        : effective.upfront;
                      const perf = edited?.performance !== undefined && edited.performance !== '' 
                        ? parseFloat(edited.performance) || 0 
                        : effective.performance;
                      return { role, upfront, perf };
                    });

                    // Running remaining for each row
                    let remainingUpfront = totalUpfront;
                    let remainingPerf = totalPerf;
                    const rowsWithRemaining = roleValues.map((rv) => {
                      remainingUpfront -= rv.upfront;
                      remainingPerf -= rv.perf;
                      return {
                        ...rv,
                        remainingUpfront: Math.max(0, parseFloat(remainingUpfront.toFixed(2))),
                        remainingPerf: Math.max(0, parseFloat(remainingPerf.toFixed(2))),
                      };
                    });

                    const allocatedUpfront = roleValues.reduce((s, r) => s + r.upfront, 0);
                    const allocatedPerf = roleValues.reduce((s, r) => s + r.perf, 0);
                    const overflowUpfront = allocatedUpfront > totalUpfront;
                    const overflowPerf = allocatedPerf > totalPerf;

                    return (
                      <>
                        {/* Product total banner */}
                        <div className="flex items-center gap-4 mb-3 p-2.5 rounded-md bg-primary/5 border border-primary/20">
                          <span className="text-xs font-semibold text-primary">
                            {language === 'ko' ? '상품 총 커미션' : 'Product Total Commission'}
                          </span>
                          <span className="text-xs">
                            {language === 'ko' ? '선취' : 'Upfront'}: <strong>{totalUpfront.toFixed(2)}%</strong>
                          </span>
                          <span className="text-xs">
                            {language === 'ko' ? '성과' : 'Perf'}: <strong>{totalPerf.toFixed(2)}%</strong>
                          </span>
                        </div>

                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[160px]">
                                {language === 'ko' ? '역할' : 'Role'}
                              </TableHead>
                              <TableHead className="w-[110px]">
                                {language === 'ko' ? '선취 수수료(%)' : 'Upfront (%)'}
                              </TableHead>
                              <TableHead className="w-[110px]">
                                {language === 'ko' ? '성과 수수료(%)' : 'Performance (%)'}
                              </TableHead>
                              <TableHead className="w-[130px]">
                                {language === 'ko' ? '잔여 (선취/성과)' : 'Remaining'}
                              </TableHead>
                              <TableHead>
                                {language === 'ko' ? '출처' : 'Source'}
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {SALES_ROLES_ORDERED.map((role, idx) => {
                              const effective = getEffectiveRate(product.id, role);
                              const key = `${product.id}_${role}_default`;
                              const edited = editedRates[key];
                              const canEdit = editableRoles.includes(role);
                              const displayUpfront = edited?.upfront ?? effective.upfront.toString();
                              const displayPerf = edited?.performance ?? effective.performance.toString();
                              const rowData = rowsWithRemaining[idx];

                              return (
                                <TableRow key={role}>
                                  <TableCell>
                                    <Badge variant="outline" className="text-xs">
                                      {ROLE_LABELS[language]?.[role] || role}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    {canEdit ? (
                                      <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        max="100"
                                        value={displayUpfront}
                                        onChange={(e) =>
                                          handleRateChange(key, 'upfront', e.target.value)
                                        }
                                        className="w-20 h-8 text-sm"
                                      />
                                    ) : (
                                      <span className="text-sm">{effective.upfront.toFixed(2)}%</span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {canEdit ? (
                                      <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        max="100"
                                        value={displayPerf}
                                        onChange={(e) =>
                                          handleRateChange(key, 'performance', e.target.value)
                                        }
                                        className="w-20 h-8 text-sm"
                                      />
                                    ) : (
                                      <span className="text-sm">{effective.performance.toFixed(2)}%</span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <span className={`text-xs font-mono ${rowData.remainingUpfront === 0 && rowData.remainingPerf === 0 ? 'text-muted-foreground' : 'text-accent'}`}>
                                      {rowData.remainingUpfront.toFixed(2)} / {rowData.remainingPerf.toFixed(2)}
                                    </span>
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant={
                                        effective.source === 'product'
                                          ? 'default'
                                          : effective.source === 'override'
                                          ? 'secondary'
                                          : 'outline'
                                      }
                                      className="text-xs"
                                    >
                                      {effective.source === 'product'
                                        ? (language === 'ko' ? '수동설정' : 'Custom')
                                        : effective.source === 'override'
                                        ? (language === 'ko' ? '개인설정' : 'Override')
                                        : (language === 'ko' ? '기본값' : 'Default')}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                            {/* Allocated Total row */}
                            <TableRow className="bg-muted/30 font-semibold border-t-2">
                              <TableCell>
                                {language === 'ko' ? '배분 합계' : 'Allocated'}
                              </TableCell>
                              <TableCell className={`text-sm ${overflowUpfront ? 'text-destructive' : ''}`}>
                                {allocatedUpfront.toFixed(2)}%
                                {overflowUpfront && <span className="text-xs ml-1">⚠</span>}
                              </TableCell>
                              <TableCell className={`text-sm ${overflowPerf ? 'text-destructive' : ''}`}>
                                {allocatedPerf.toFixed(2)}%
                                {overflowPerf && <span className="text-xs ml-1">⚠</span>}
                              </TableCell>
                              <TableCell />
                              <TableCell />
                            </TableRow>
                            {/* Product Total row */}
                            <TableRow className="bg-primary/5 font-semibold">
                              <TableCell>
                                {language === 'ko' ? '총 커미션' : 'Total Commission'}
                              </TableCell>
                              <TableCell className="text-sm text-primary">
                                {totalUpfront.toFixed(2)}%
                              </TableCell>
                              <TableCell className="text-sm text-primary">
                                {totalPerf.toFixed(2)}%
                              </TableCell>
                              <TableCell>
                                <span className={`text-xs font-mono ${(totalUpfront - allocatedUpfront < 0 || totalPerf - allocatedPerf < 0) ? 'text-destructive' : 'text-muted-foreground'}`}>
                                  {Math.max(0, totalUpfront - allocatedUpfront).toFixed(2)} / {Math.max(0, totalPerf - allocatedPerf).toFixed(2)}
                                </span>
                              </TableCell>
                              <TableCell />
                            </TableRow>
                          </TableBody>
                        </Table>
                      </>
                    );
                  })()}

                  {/* Per-member overrides */}
                  {salesDownline.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        {language === 'ko' ? '개인별 수수료 조정' : 'Individual Rate Overrides'}
                      </p>
                      <div className="space-y-1">
                        {salesDownline
                          .filter((m) => editableRoles.includes(m.sales_role as typeof SALES_ROLES_ORDERED[number]))
                          .map((member) => {
                            const effective = getEffectiveRate(
                              product.id,
                              member.sales_role,
                              member.user_id
                            );
                            const key = `${product.id}_${member.sales_role}_${member.user_id}`;
                            const edited = editedRates[key];
                            const displayUpfront =
                              edited?.upfront ?? effective.upfront.toString();
                            const displayPerf =
                              edited?.performance ?? effective.performance.toString();

                            return (
                              <div
                                key={member.user_id}
                                className="flex items-center gap-3 py-2 px-3 rounded-md hover:bg-muted/20"
                              >
                                <span className="text-sm min-w-[120px] truncate">
                                  {member.full_name}
                                </span>
                                <Badge variant="outline" className="text-xs shrink-0">
                                  {ROLE_LABELS[language]?.[member.sales_role] || member.sales_role}
                                </Badge>
                                <div className="flex items-center gap-2 ml-auto">
                                  <span className="text-xs text-muted-foreground">
                                    {language === 'ko' ? '선취' : 'Up'}
                                  </span>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max="100"
                                    value={displayUpfront}
                                    onChange={(e) =>
                                      handleRateChange(key, 'upfront', e.target.value)
                                    }
                                    className="w-20 h-7 text-xs"
                                  />
                                  <span className="text-xs text-muted-foreground">
                                    {language === 'ko' ? '성과' : 'Perf'}
                                  </span>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max="100"
                                    value={displayPerf}
                                    onChange={(e) =>
                                      handleRateChange(key, 'performance', e.target.value)
                                    }
                                    className="w-20 h-7 text-xs"
                                  />
                                  {effective.source === 'override' && (
                                    <Badge variant="secondary" className="text-xs">
                                      {language === 'ko' ? '조정됨' : 'Custom'}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
}
