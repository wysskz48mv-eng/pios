import Stripe from 'stripe'
import { ADOPTED_PRICING_PLANS } from '@/lib/pricing/strategy'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

function envFirst(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key]
    if (value && value.trim().length > 0) return value
  }
  return ''
}

export const PLANS = {
  spark: {
    name: ADOPTED_PRICING_PLANS.spark.name,
    price: ADOPTED_PRICING_PLANS.spark.monthlyGbp,
    priceId: envFirst('STRIPE_PRICE_SPARK', 'STRIPE_PRICE_STUDENT'),
    maxUsers: 1,
    maxInvestigations: null,
    credits: ADOPTED_PRICING_PLANS.spark.credits,
    description: 'Entry tier for students and early-career professionals',
    features: [
      'Academic Hub — thesis, chapters, milestones',
      'CPD Tracker — 12 bodies supported',
      'Supervisor session log + AI summaries',
      'Research Hub + literature AI',
      '2,000 AI credits/mo',
      '5 GB storage',
    ],
  },
  pro: {
    name: ADOPTED_PRICING_PLANS.pro.name,
    price: ADOPTED_PRICING_PLANS.pro.monthlyGbp,
    priceId: process.env.STRIPE_PRICE_PRO!,
    maxUsers: 1,
    maxInvestigations: null,
    credits: ADOPTED_PRICING_PLANS.pro.credits,
    description: 'For postgraduates and independent professionals',
    features: [
      'Everything in Starter',
      'Gmail Triage + Email AI',
      'Projects + Expenses',
      'PIOS AI Companion',
      'Coaching Engine (5 modes)',
      '5,000 AI credits/mo',
      '10 GB storage',
    ],
  },
  executive: {
    name: ADOPTED_PRICING_PLANS.executive.name,
    price: ADOPTED_PRICING_PLANS.executive.monthlyGbp,
    priceId: envFirst('STRIPE_PRICE_EXECUTIVE', 'STRIPE_PRICE_PROFESSIONAL'),
    maxUsers: 1,
    maxInvestigations: null,
    credits: ADOPTED_PRICING_PLANS.executive.credits,
    description: 'Full CEO/Founder OS — all 41 modules, 15 frameworks',
    features: [
      'Everything in Pro',
      'Command Centre + Daily AI Brief (7am)',
      'Payroll Engine (detect → remit → chase)',
      'Consulting Framework Engine (15 NemoClaw™ frameworks)',
      'Executive OS — OKRs, decisions, stakeholders',
      'IP Vault + Contract Register + Group P&L',
      'SE-MIL Knowledge Base',
      'File Intelligence + Email AI',
      '10,000 AI credits/mo',
      '20 GB storage',
      '3 guest collaborators',
    ],
  },
  enterprise: {
    name: ADOPTED_PRICING_PLANS.enterprise.name,
    price: ADOPTED_PRICING_PLANS.enterprise.monthlyGbp,
    priceId: envFirst('STRIPE_PRICE_ENTERPRISE', 'STRIPE_PRICE_TEAM'),
    maxUsers: null,
    maxInvestigations: null,
    credits: ADOPTED_PRICING_PLANS.enterprise.credits,
    description: 'Institution / team — shared workspaces, SSO, dept admin',
    features: [
      'Everything in Executive',
      'Shared research workspaces',
      'Department-level admin',
      'SSO / institutional login',
      'Team citation libraries',
      'Cohort dashboard (supervisors)',
      'Unlimited AI credits',
      'Dedicated support',
    ],
  },
  // Legacy aliases for backward-compatible links
  starter: {
    name: ADOPTED_PRICING_PLANS.spark.name,
    price: ADOPTED_PRICING_PLANS.spark.monthlyGbp,
    priceId: envFirst('STRIPE_PRICE_SPARK', 'STRIPE_PRICE_STUDENT'),
    maxUsers: 1,
    maxInvestigations: null,
    credits: ADOPTED_PRICING_PLANS.spark.credits,
    description: 'Legacy alias of Spark',
    features: ['Legacy alias'],
  },
  student: {
    name: ADOPTED_PRICING_PLANS.spark.name,
    price: ADOPTED_PRICING_PLANS.spark.monthlyGbp,
    priceId: envFirst('STRIPE_PRICE_SPARK', 'STRIPE_PRICE_STUDENT'),
    maxUsers: 1,
    maxInvestigations: null,
    credits: ADOPTED_PRICING_PLANS.spark.credits,
    description: 'Legacy alias of Spark',
    features: ['Legacy alias'],
  },
  professional: {
    name: ADOPTED_PRICING_PLANS.executive.name,
    price: ADOPTED_PRICING_PLANS.executive.monthlyGbp,
    priceId: envFirst('STRIPE_PRICE_EXECUTIVE', 'STRIPE_PRICE_PROFESSIONAL'),
    maxUsers: 1,
    maxInvestigations: null,
    credits: ADOPTED_PRICING_PLANS.executive.credits,
    description: 'Legacy alias of Executive',
    features: ['Legacy alias'],
  },
  individual: {
    name: ADOPTED_PRICING_PLANS.pro.name,
    price: ADOPTED_PRICING_PLANS.pro.monthlyGbp,
    priceId: process.env.STRIPE_PRICE_PRO!,
    maxUsers: 1,
    maxInvestigations: null,
    credits: ADOPTED_PRICING_PLANS.pro.credits,
    description: 'Legacy alias of Pro',
    features: ['Legacy alias'],
  },
  team: {
    name: ADOPTED_PRICING_PLANS.enterprise.name,
    price: ADOPTED_PRICING_PLANS.enterprise.monthlyGbp,
    priceId: envFirst('STRIPE_PRICE_ENTERPRISE', 'STRIPE_PRICE_TEAM'),
    maxUsers: null,
    maxInvestigations: null,
    credits: ADOPTED_PRICING_PLANS.enterprise.credits,
    description: 'Legacy alias of Enterprise',
    features: ['Legacy alias'],
  },
} as const

export type PlanKey = keyof typeof PLANS
