import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

export const PLANS = {
  starter: {
    name: 'Starter',
    price: 9,
    priceId: process.env.STRIPE_PRICE_STUDENT!,
    maxUsers: 1,
    maxInvestigations: null,
    credits: 2000,
    description: 'Academic lifecycle, CPD tracking, research tools',
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
    name: 'Pro',
    price: 19,
    priceId: process.env.STRIPE_PRICE_PRO!,
    maxUsers: 1,
    maxInvestigations: null,
    credits: 5000,
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
    name: 'Executive',
    price: 24,
    priceId: process.env.STRIPE_PRICE_PROFESSIONAL!,
    maxUsers: 1,
    maxInvestigations: null,
    credits: 10000,
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
  team: {
    name: 'Team',
    price: 0, // custom — contact sales
    priceId: process.env.STRIPE_PRICE_TEAM ?? '',
    maxUsers: null,
    maxInvestigations: null,
    credits: -1, // unlimited
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
} as const

export type PlanKey = keyof typeof PLANS
