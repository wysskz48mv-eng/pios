'use client'

import { useState } from 'react'
import Link from 'next/link'
import s from './landing.module.css'

const PLANS = [
  {
    name: 'Spark',
    monthly: 16,
    annual: 16,
    credits: '2,000 AI credits',
    tagline: 'The structure university never gave you.',
    who: 'Undergraduate and postgraduate students',
    features: [
      'Daily Brief + Tasks',
      'Academic Suite (Thesis, Literature, Viva)',
      'Coaching + Wellness',
      '1 email account connected',
    ],
    cta: 'Start free trial',
    href: '/auth/signup?plan=spark',
    featured: false,
  },
  {
    name: 'Pro',
    monthly: 35,
    annual: 28,
    credits: '5,000 AI credits',
    tagline: 'One system for everything you do at once.',
    who: 'Professionals, consultants, solo founders',
    features: [
      'Everything in Starter',
      'Email Intelligence + multi-inbox',
      'Consulting Frameworks + CPD',
      'Financials + Expenses',
      'Calendar integration + AI pre-briefs',
    ],
    cta: 'Start free trial',
    href: '/auth/signup?plan=pro',
    featured: true,
  },
  {
    name: 'Executive',
    monthly: 65,
    annual: 65,
    credits: '10,000 AI credits',
    tagline: 'Run the business. Build the legacy.',
    who: 'CEOs, founders, directors, senior executives',
    features: [
      'Everything in Pro',
      'Executive OS (EOSA™) + Decisions',
      'Stakeholder CRM + Board Pack',
      'Chief of Staff module',
      'Time Sovereignty audit',
    ],
    cta: 'Start free trial',
    href: '/auth/signup?plan=executive',
    featured: false,
  },
  {
    name: 'Enterprise',
    monthly: null,
    annual: null,
    credits: 'Unlimited',
    tagline: 'Deploy PIOS across your organisation.',
    who: 'Corporations, universities, white-label partners',
    features: [
      'All modules + admin dashboard',
      'Team management + custom onboarding',
      'Data isolation + DPA included',
      'White-label option',
      'Dedicated account manager',
    ],
    cta: 'Request a proposal',
    href: 'mailto:hello@veritasiq.io',
    featured: false,
  },
]

export function PricingSection() {
  const [annual, setAnnual] = useState(true)

  return (
    <section className={s.pricing} id="pricing">
      <div className={s.pricingInner}>
        <h2 className={s.sectionTitle}>Pricing</h2>

        {/* Annual/Monthly toggle */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 8, marginBottom: 32,
        }}>
          <button
            onClick={() => setAnnual(false)}
            style={{
              padding: '7px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500,
              cursor: 'pointer', transition: 'all 0.15s',
              background: !annual ? 'var(--ai-subtle)' : 'transparent',
              border: `1px solid ${!annual ? 'rgba(99,73,255,0.3)' : 'var(--pios-border)'}`,
              color: !annual ? 'var(--ai2)' : 'var(--pios-muted)',
            }}
          >
            Monthly
          </button>
          <button
            onClick={() => setAnnual(true)}
            style={{
              padding: '7px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500,
              cursor: 'pointer', transition: 'all 0.15s',
              background: annual ? 'var(--ai-subtle)' : 'transparent',
              border: `1px solid ${annual ? 'rgba(99,73,255,0.3)' : 'var(--pios-border)'}`,
              color: annual ? 'var(--ai2)' : 'var(--pios-muted)',
            }}
          >
            Annual
            <span style={{
              marginLeft: 6, fontSize: 10, fontWeight: 700,
              padding: '2px 6px', borderRadius: 4,
              background: 'rgba(16,185,129,0.12)', color: '#10b981',
            }}>20% off</span>
          </button>
        </div>

        <div className={s.pricingGrid}>
          {PLANS.map(plan => (
            <div key={plan.name} className={plan.featured ? `${s.priceCard} ${s.priceCardFeatured}` : s.priceCard}>
              <h3 className={s.priceTier}>{plan.name}</h3>
              {plan.monthly !== null ? (
                <div className={s.priceAmount}>
                  &pound;{annual ? plan.annual : plan.monthly}
                  <span className={s.pricePeriod}>/mo</span>
                  {annual && (
                    <span style={{
                      marginLeft: 8, fontSize: 11, fontWeight: 600,
                      padding: '2px 7px', borderRadius: 5,
                      background: 'rgba(16,185,129,0.1)', color: '#10b981',
                      verticalAlign: 'middle',
                    }}>20% saved</span>
                  )}
                </div>
              ) : (
                <div className={s.priceAmount}>
                  From &pound;55<span className={s.pricePeriod}>/seat/mo</span>
                </div>
              )}
              <p className={s.priceCredits}>{plan.credits}</p>
              <p style={{ fontSize: 13, color: 'var(--pios-sub)', margin: '0 0 4px', fontStyle: 'italic' }}>
                {plan.tagline}
              </p>
              <p className={s.priceDesc}>{plan.who}</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 16px' }}>
                {plan.features.map(f => (
                  <li key={f} style={{
                    fontSize: 12.5, color: 'var(--pios-sub)', padding: '3px 0',
                    display: 'flex', alignItems: 'flex-start', gap: 6,
                  }}>
                    <span style={{ color: '#10b981', fontSize: 11, marginTop: 2 }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              {plan.href.startsWith('mailto:') ? (
                <a href={plan.href} className={s.priceCta}>{plan.cta}</a>
              ) : (
                <Link href={plan.href} className={s.priceCta}>{plan.cta}</Link>
              )}
              {annual && plan.annual !== null && (
                <p style={{ fontSize: 10.5, color: 'var(--pios-dim)', textAlign: 'center', marginTop: 8 }}>
                  Billed &pound;{plan.annual * 12}/yr
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
