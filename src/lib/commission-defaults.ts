export const COMMISSION_ROLES = [
  'district_manager',
  'deputy_district_manager',
  'principal_agent',
  'agent',
] as const;

export type CommissionRole = (typeof COMMISSION_ROLES)[number];
export type CommissionDirection = 'manager-first' | 'agent-first';

export type ProductCommissionConfig = {
  direction: CommissionDirection;
  ratios: Record<CommissionRole, number>;
};

export const DEFAULT_DIRECTION_PRESETS: Record<CommissionDirection, Record<CommissionRole, number>> = {
  'manager-first': {
    district_manager: 40,
    deputy_district_manager: 25,
    principal_agent: 20,
    agent: 15,
  },
  'agent-first': {
    district_manager: 15,
    deputy_district_manager: 20,
    principal_agent: 25,
    agent: 40,
  },
};

export const DEFAULT_COMMISSION_DIRECTION: CommissionDirection = 'agent-first';

export function sanitizeRatio(value: unknown) {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return Math.round(numeric * 100) / 100;
}

export function normalizeRatios(ratios: Partial<Record<CommissionRole, number>>) {
  const sanitized = COMMISSION_ROLES.reduce<Record<CommissionRole, number>>((acc, role) => {
    acc[role] = sanitizeRatio(ratios[role]);
    return acc;
  }, {} as Record<CommissionRole, number>);

  const total = COMMISSION_ROLES.reduce((sum, role) => sum + sanitized[role], 0);

  if (total <= 0) {
    return COMMISSION_ROLES.reduce<Record<CommissionRole, number>>((acc, role) => {
      acc[role] = 0;
      return acc;
    }, {} as Record<CommissionRole, number>);
  }

  return COMMISSION_ROLES.reduce<Record<CommissionRole, number>>((acc, role) => {
    acc[role] = sanitized[role] / total;
    return acc;
  }, {} as Record<CommissionRole, number>);
}

export function inferDirection(ratios: Partial<Record<CommissionRole, number>>): CommissionDirection {
  const agent = sanitizeRatio(ratios.agent);
  const manager = sanitizeRatio(ratios.district_manager);
  return agent >= manager ? 'agent-first' : 'manager-first';
}

export function getDirectionPreset(direction: CommissionDirection): ProductCommissionConfig {
  return {
    direction,
    ratios: { ...DEFAULT_DIRECTION_PRESETS[direction] },
  };
}

export function buildProductCommissionConfig(
  persisted?: Partial<ProductCommissionConfig> | null,
  derivedRatios?: Partial<Record<CommissionRole, number>>,
) {
  const fallbackDirection = inferDirection(derivedRatios || persisted?.ratios || DEFAULT_DIRECTION_PRESETS[DEFAULT_COMMISSION_DIRECTION]);
  const direction = persisted?.direction === 'manager-first' || persisted?.direction === 'agent-first'
    ? persisted.direction
    : fallbackDirection;

  const preset = getDirectionPreset(direction);

  return {
    direction,
    ratios: COMMISSION_ROLES.reduce<Record<CommissionRole, number>>((acc, role) => {
      const source = persisted?.ratios?.[role] ?? derivedRatios?.[role] ?? preset.ratios[role];
      acc[role] = sanitizeRatio(source);
      return acc;
    }, {} as Record<CommissionRole, number>),
  } satisfies ProductCommissionConfig;
}

export function deriveRatiosFromAbsoluteRates(
  upfrontRates: Partial<Record<CommissionRole, number>>,
  totalUpfrontRate: number,
) {
  if (!Number.isFinite(totalUpfrontRate) || totalUpfrontRate <= 0) {
    return undefined;
  }

  return COMMISSION_ROLES.reduce<Partial<Record<CommissionRole, number>>>((acc, role) => {
    const rate = sanitizeRatio(upfrontRates[role]);
    acc[role] = totalUpfrontRate > 0 ? Math.round((rate / totalUpfrontRate) * 10000) / 100 : 0;
    return acc;
  }, {});
}

export function computeCommissionPreview({
  totalUpfrontRate,
  totalPerformanceRate,
  investmentAmount,
  realizedReturnAmount,
  ratios,
}: {
  totalUpfrontRate: number;
  totalPerformanceRate: number;
  investmentAmount: number;
  realizedReturnAmount: number;
  ratios: Partial<Record<CommissionRole, number>>;
}) {
  const normalized = normalizeRatios(ratios);

  return COMMISSION_ROLES.map((role) => {
    const share = normalized[role];
    const upfrontRate = Math.round(totalUpfrontRate * share * 100) / 100;
    const performanceRate = Math.round(totalPerformanceRate * share * 100) / 100;
    const upfrontAmount = Math.round(investmentAmount * (upfrontRate / 100) * 100) / 100;
    const performanceAmount = Math.round(realizedReturnAmount * (performanceRate / 100) * 100) / 100;

    return {
      role,
      sharePercent: Math.round(share * 10000) / 100,
      upfrontRate,
      performanceRate,
      upfrontAmount,
      performanceAmount,
    };
  });
}