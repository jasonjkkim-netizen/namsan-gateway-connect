export const BASE_DATE = '2025-08-01';
export const BASE_DATE_LABEL_KO = '2025년 8월 1일';
export const BASE_DATE_LABEL_EN = 'Aug 1, 2025';

export type GroupId = 'shares' | 'bonds' | 'others' | 'cash';

export interface PortfolioItemRow {
  id: string;
  group_id: string;
  name: string;
  ticker: string | null;
  asset_type: string;
  currency: string;
  recommended_weight: number;
  target_annual_return: number | null;
  current_price: number | null;
  base_price: number | null;
  display_order: number;
  is_active: boolean;
  notes: string | null;
  rating: string | null;
  product_id: string | null;
}

export interface PortfolioItem {
  id: string;
  groupId: GroupId;
  name: string;
  ticker?: string;
  assetType: 'stock' | 'bond' | 'etf' | 'cash';
  currency: 'KRW' | 'USD';
  weight: number; // 0-100
  currentPrice?: number;
  basePrice?: number;
  targetAnnualReturn?: number;
  notes?: string;
}

export interface GroupData {
  id: GroupId;
  nameKo: string;
  nameEn: string;
  items: PortfolioItem[];
  totalWeight: number;
  performance: number;
}

export interface PortfolioScenario {
  id: 'low' | 'mid' | 'high';
  nameKo: string;
  nameEn: string;
  descKo: string;
  descEn: string;
  groupWeights: Record<GroupId, number>;
}

export const GROUP_META: Record<GroupId, { nameKo: string; nameEn: string }> = {
  shares: { nameKo: '주식 포트폴리오', nameEn: 'Share Portfolio' },
  bonds: { nameKo: '채권 포트폴리오', nameEn: 'Bond Portfolio' },
  others: { nameKo: '기타 자산', nameEn: 'Others' },
  cash: { nameKo: '현금', nameEn: 'Cash' },
};

export const DEFAULT_ASSUMPTIONS = {
  expectedReturnStocksAnnual: 0.10,
  expectedReturnOthersAnnual: 0.05,
  cashReturnAnnual: 0.00,
};

export interface PresetFeeStructure {
  managementFeeRate: number;   // annual management fee (e.g. 0.02 = 2%)
  performanceFeeRate: number;  // performance fee rate (e.g. 0.20 = 20%)
  performanceHurdle: number;   // hurdle rate (e.g. 0.07 = 7%)
}

export interface PortfolioScenario {
  id: 'low' | 'mid' | 'high';
  nameKo: string;
  nameEn: string;
  descKo: string;
  descEn: string;
  groupWeights: Record<GroupId, number>;
  targetReturn: number;        // target annual return (e.g. 0.07 = 7%)
  fees: PresetFeeStructure;
}

export const PRESETS: PortfolioScenario[] = [
  {
    id: 'low',
    nameKo: '안전형',
    nameEn: 'Low Risk',
    descKo: '채권 중심의 안전한 포트폴리오',
    descEn: 'Bond-focused stable portfolio',
    groupWeights: { shares: 30, bonds: 70, others: 0, cash: 0 },
    targetReturn: 0.07,
    fees: { managementFeeRate: 0.01, performanceFeeRate: 0.20, performanceHurdle: 0.07 },
  },
  {
    id: 'mid',
    nameKo: '균형형',
    nameEn: 'Balanced',
    descKo: '주식과 채권의 균형 잡힌 포트폴리오',
    descEn: 'Balanced stock and bond portfolio',
    groupWeights: { shares: 50, bonds: 50, others: 0, cash: 0 },
    targetReturn: 0.08,
    fees: { managementFeeRate: 0.015, performanceFeeRate: 0.20, performanceHurdle: 0.08 },
  },
  {
    id: 'high',
    nameKo: '성장형',
    nameEn: 'High Growth',
    descKo: '주식 중심의 공격적 포트폴리오',
    descEn: 'Stock-focused aggressive portfolio',
    groupWeights: { shares: 70, bonds: 30, others: 0, cash: 0 },
    targetReturn: 0.09,
    fees: { managementFeeRate: 0.02, performanceFeeRate: 0.20, performanceHurdle: 0.09 },
  },
];
