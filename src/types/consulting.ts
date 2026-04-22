export type RiskCategory = 'operational' | 'financial' | 'compliance' | 'health_safety' | 'strategic'
export type RiskStatus = 'open' | 'mitigating' | 'mitigated' | 'accepted'
export type ProbabilityLevel = 'low' | 'medium' | 'high'
export type ImpactLevel = 'low' | 'medium' | 'high'

export type FMEngagementType = {
  id: string
  type_code: string
  type_number: number
  name: string
  description: string
  wave: number
  recommended_frameworks: Record<string, string[]>
  iso_standards: string[]
  regulatory_refs: string[]
  typical_duration_weeks: number | null
  complexity_level: 'low' | 'medium' | 'high' | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type FMRiskLibraryItem = {
  id: string
  risk_code: string
  category: RiskCategory
  title: string
  description: string
  typical_probability: ProbabilityLevel | null
  typical_impact: ImpactLevel | null
  recommended_mitigations: string[]
  iso_references: string[]
  engagement_types: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export type EngagementRisk = {
  id: string
  user_id: string
  engagement_id: string
  risk_library_id: string | null
  risk_library?: FMRiskLibraryItem | null
  custom_title: string | null
  custom_description: string | null
  probability: ProbabilityLevel
  impact: ImpactLevel
  risk_score: number
  mitigation_plan: string | null
  mitigation_status: RiskStatus
  owner_user_id: string | null
  identified_date: string
  target_closure_date: string | null
  actual_closure_date: string | null
  linked_email_ids: string[]
  evidence_document_ids: string[]
  notes: string | null
  created_at: string
  updated_at: string
}

export type FMOption = {
  id: string
  user_id: string
  engagement_id: string
  option_number: number
  title: string
  description: string
  pros: string[]
  cons: string[]
  estimated_cost_min: number | null
  estimated_cost_max: number | null
  cost_currency: string
  implementation_time_weeks: number | null
  risk_level: ProbabilityLevel | null
  is_recommended: boolean
  recommendation_reasoning: string | null
  linked_project_budget: number | null
  created_at: string
  updated_at: string
}

export type FMPrecedent = {
  id: string
  user_id: string
  title: string
  engagement_type: string
  industry_sector: string | null
  building_type: string | null
  project_scale: string | null
  anonymized_excerpt: string | null
  tags: string[]
  frameworks_used: string[]
  reusable_artifacts: Record<string, unknown>
  original_engagement_id: string | null
  created_from_engagement_at: string | null
  is_public: boolean
  created_at: string
  updated_at: string
  similarity_score?: number
}
