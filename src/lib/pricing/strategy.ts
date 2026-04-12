export type PricingPlanId = 'spark' | 'pro' | 'executive' | 'enterprise'

export interface PricingPlan {
  id: PricingPlanId
  name: string
  monthlyGbp: number
  credits: number
  audience: string
}

export const ADOPTED_PRICING_PLANS: Record<PricingPlanId, PricingPlan> = {
  spark: {
    id: 'spark',
    name: 'Spark',
    monthlyGbp: 16,
    credits: 2_000,
    audience: 'Students and early-career professionals',
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    monthlyGbp: 35,
    credits: 10_000,
    audience: 'Consultants and solo practitioners',
  },
  executive: {
    id: 'executive',
    name: 'Executive',
    monthlyGbp: 65,
    credits: 50_000,
    audience: 'Founders, directors, C-suite',
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyGbp: 75,
    credits: 200_000,
    audience: 'Teams and organizations',
  },
}

const LEGACY_PLAN_ALIASES: Record<string, PricingPlanId> = {
  starter: 'spark',
  student: 'spark',
  spark: 'spark',
  individual: 'pro',
  pro: 'pro',
  professional: 'executive',
  executive: 'executive',
  team: 'enterprise',
  enterprise: 'enterprise',
}

export function resolvePricingPlanId(input: unknown): PricingPlanId {
  if (typeof input !== 'string' || !input.trim()) return 'executive'
  return LEGACY_PLAN_ALIASES[input.trim().toLowerCase()] ?? 'executive'
}
