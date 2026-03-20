import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

export const PLANS = {
  student: {
    name: 'Student',
    price: 9,
    priceId: process.env.STRIPE_PRICE_STUDENT!,
    credits: 2000,
    description: 'Academic lifecycle + calendar + personal tasks',
    features: [
      'Academic Lifecycle Manager',
      'AI Calendar (basic)',
      'Personal Tasks',
      '2,000 AI credits/mo',
      '50% off for .edu emails',
    ],
  },
  individual: {
    name: 'Individual',
    price: 19,
    priceId: process.env.STRIPE_PRICE_INDIVIDUAL!,
    credits: 5000,
    description: 'Full MVP — all three core modules',
    features: [
      'Everything in Student',
      'Autonomous Email Triage (Gmail)',
      'Personal Projects',
      'Expense Tracker',
      'PIOS AI Companion',
      '5,000 AI credits/mo',
    ],
  },
  professional: {
    name: 'Professional',
    price: 39,
    priceId: process.env.STRIPE_PRICE_PROFESSIONAL!,
    credits: 15000,
    description: 'Full platform + FM consulting engine',
    features: [
      'Everything in Individual',
      'FM Consulting Engine',
      'Business Operations Dashboard',
      '15,000 AI credits/mo',
      'Priority support',
      'Cross-domain clash detection',
    ],
  },
} as const

export type PlanKey = keyof typeof PLANS
