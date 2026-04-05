import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import s from './landing.module.css'
import { PricingSection } from './PricingSection'

export default async function Home() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Landing page is always public — authenticated users see it too
  // They get a "Go to dashboard" CTA instead of "Start free trial"
  const isLoggedIn = !!user

  /* ------------------------------------------------------------------ */
  /*  Landing page — unauthenticated visitors                           */
  /* ------------------------------------------------------------------ */
  return (
    <div className={s.page}>

      {/* ── 1. Sticky nav ──────────────────────────────────────────── */}
      <nav className={s.nav}>
        <div className={s.navInner}>
          <Link href="/" className={s.logo}>PIOS</Link>
          <div className={s.navLinks}>
            <a href="#features" className={s.navLink}>Features</a>
            <Link href="/research" className={s.navLink}>Research</Link>
            <a href="#pricing" className={s.navLink}>Pricing</a>
          </div>
          <Link href={isLoggedIn ? "/platform/dashboard" : "/auth/signup"} className={s.navCta}>
            {isLoggedIn ? 'Go to dashboard' : 'Start free trial'}
          </Link>
        </div>
      </nav>

      {/* ── 2. Hero ────────────────────────────────────────────────── */}
      <section className={s.hero}>
        <div className={s.heroInner}>
          <h1 className={s.heroHeadline}>PIOS: Your mind, amplified.</h1>
          <p className={s.heroSubtitle}>
            The AI operating system that thinks across every domain of your
            life&nbsp;&mdash; academic, professional, personal&nbsp;&mdash; so
            you can focus on what matters.
          </p>

          <div className={s.statGrid}>
            <div className={s.statBox}>
              <span className={s.statNumber}>72%</span>
              <span className={s.statLabel}>of students underestimate task duration</span>
              <span className={s.statCite}>Frontiers in Psychology, 2022</span>
            </div>
            <div className={s.statBox}>
              <span className={s.statNumber}>1,200</span>
              <span className={s.statLabel}>app switches per day for knowledge workers</span>
              <span className={s.statCite}>Harvard Business Review, 2022</span>
            </div>
            <div className={s.statBox}>
              <span className={s.statNumber}>43%</span>
              <span className={s.statLabel}>of doctoral students never complete</span>
              <span className={s.statCite}>Council of Graduate Schools</span>
            </div>
            <div className={s.statBox}>
              <span className={s.statNumber}>60%</span>
              <span className={s.statLabel}>of executives report impaired judgement</span>
              <span className={s.statCite}>University of Cambridge, 2023</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. Personas ──────────────────────────────────────────── */}

      {/* Starter */}
      <section className={s.bandLight}>
        <div className={s.bandInner}>
          <span className={s.bandLabel}>STARTER — The student building their future</span>
          <div className={s.bandHero}>
            <span className={s.bandStat}>72%</span>
            <span className={s.bandStatLabel}>of students underestimate how long tasks take</span>
          </div>
          <p className={s.bandCopy}>
            72% of students underestimate how long tasks take — and 43% of
            doctoral students never finish their degree. University removed the
            structure school provided. PIOS gives it back — deadline
            intelligence, thesis tracking, supervision prep, and a morning brief
            that knows your exam schedule.
          </p>
          <p style={{ fontSize: 11, color: 'var(--pios-dim)', marginTop: 8 }}>
            Frontiers in Psychology, 2022; Council of Graduate Schools
          </p>
          <p className={s.bandBridge}>
            Modules: Daily Brief, Tasks, Academic Suite (Thesis, Literature, Viva), Coaching, Wellness
          </p>
        </div>
      </section>

      {/* Pro */}
      <section className={s.bandDark}>
        <div className={s.bandInner}>
          <span className={s.bandLabel}>PRO — The professional doing everything at once</span>
          <div className={s.bandHero}>
            <span className={s.bandStat}>&pound;52</span>
            <span className={s.bandStatLabel}>spent monthly across 4 fragmented AI tools</span>
          </div>
          <p className={s.bandCopy}>
            Professionals spend &pound;52/mo across 4 fragmented AI tools
            &mdash; and lose 4 hours every week just reorienting between them.
            You are running a practice, completing a doctorate, and managing a
            business &mdash; simultaneously. No tool was built for this. PIOS was.
          </p>
          <p style={{ fontSize: 11, color: 'var(--pios-dim)', marginTop: 8 }}>
            SubChoice, 2026 &middot; Harvard Business Review, 2022 (converted from USD)
          </p>
          <p className={s.bandBridge}>
            Modules: Daily Brief, Email Intelligence, Tasks, Coaching, Consulting, Financials, Academic Suite
          </p>
        </div>
      </section>

      {/* Executive */}
      <section className={s.bandLight}>
        <div className={s.bandInner}>
          <span className={s.bandLabel}>EXECUTIVE — The leader who runs at full capacity</span>
          <div className={s.bandHero}>
            <span className={s.bandStat}>60%</span>
            <span className={s.bandStatLabel}>of executives experience impaired judgement</span>
          </div>
          <p className={s.bandCopy}>
            60% of executives experience measurably impaired judgement after
            sustained decision-making. 36% of a founder&apos;s week is lost to
            admin. Your decisions compound. Your time does not. PIOS
            consolidates email, decisions, stakeholder intelligence, board
            communications, and strategic frameworks into one layer.
          </p>
          <p style={{ fontSize: 11, color: 'var(--pios-dim)', marginTop: 8 }}>
            University of Cambridge 2023; Agility PR 2025
          </p>
          <p className={s.bandBridge}>
            Modules: Daily Brief, Email Intelligence, Decisions, Stakeholders, EOSA, Board Pack, Chief of Staff, Financials
          </p>
        </div>
      </section>

      {/* Enterprise */}
      <section className={s.bandDark}>
        <div className={s.bandInner}>
          <span className={s.bandLabel}>ENTERPRISE — The organisation that takes intelligence seriously</span>
          <div className={s.bandHero}>
            <span className={s.bandStat}>80%</span>
            <span className={s.bandStatLabel}>of corporate workers use unapproved AI tools</span>
          </div>
          <p className={s.bandCopy}>
            80% of corporate workers already use unapproved AI tools. The
            average shadow AI data breach costs &pound;3.3 million. PIOS gives your
            organisation a sanctioned personal intelligence layer — with data
            isolation, IT-approvable security architecture, and a white-label
            option that carries your brand.
          </p>
          <p style={{ fontSize: 11, color: 'var(--pios-dim)', marginTop: 8 }}>
            UpGuard 2025; IBM Cost of Data Breach Report 2024
          </p>
          <p className={s.bandBridge}>
            Modules: All modules, admin dashboard, team management, custom onboarding, DPA included
          </p>
        </div>
      </section>

      {/* ── 4. Modules grid ────────────────────────────────────────── */}
      <section className={s.modules} id="features">
        <div className={s.modulesInner}>
          <h2 className={s.sectionTitle}>The platform</h2>
          <div className={s.moduleGrid}>
            <div className={s.moduleCard}>
              <h3 className={s.moduleTitle}>NemoClaw Coaching</h3>
              <p className={s.moduleDesc}>
                5 modes, calibrated to your CV. Strategic, operational, academic,
                reflective, and crisis coaching from one adaptive engine.
              </p>
            </div>
            <div className={s.moduleCard}>
              <h3 className={s.moduleTitle}>Morning Brief</h3>
              <p className={s.moduleDesc}>
                AI daily intelligence synthesised from your live data. Calendar,
                deadlines, email signals, and strategic priorities in one view.
              </p>
            </div>
            <div className={s.moduleCard}>
              <h3 className={s.moduleTitle}>Email Triage</h3>
              <p className={s.moduleDesc}>
                6-category classification with draft generation. Urgent, action,
                FYI, delegate, defer, archive&nbsp;&mdash; processed in seconds.
              </p>
            </div>
            <div className={s.moduleCard}>
              <h3 className={s.moduleTitle}>Consulting Frameworks</h3>
              <p className={s.moduleDesc}>
                15 proprietary NemoClaw frameworks for strategy, due diligence,
                market entry, stakeholder mapping, and more.
              </p>
            </div>
            <div className={s.moduleCard}>
              <h3 className={s.moduleTitle}>Academic Suite</h3>
              <p className={s.moduleDesc}>
                Viva prep, literature agent, supervisor meeting prep, and thesis
                progress tracking for postgraduate researchers.
              </p>
            </div>
            <div className={s.moduleCard}>
              <h3 className={s.moduleTitle}>Chief of Staff</h3>
              <p className={s.moduleDesc}>
                Weekly strategic review with workstream RAG. Cross-domain
                awareness across every active project and commitment.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. How it works ────────────────────────────────────────── */}
      <section className={s.principles}>
        <div className={s.principlesInner}>
          <h2 className={s.sectionTitleLight}>How it works</h2>
          <div className={s.principleGrid}>
            <div className={s.principleCard}>
              <h3 className={s.principleTitle}>Calibrated to you</h3>
              <p className={s.principleDesc}>
                CV upload and NemoClaw builds your intelligence profile. Every
                response is grounded in your actual context, skills, and goals.
              </p>
            </div>
            <div className={s.principleCard}>
              <h3 className={s.principleTitle}>Cross-domain awareness</h3>
              <p className={s.principleDesc}>
                One AI that knows all your contexts simultaneously. Academic
                deadlines inform professional scheduling. Personal commitments
                shape workload recommendations.
              </p>
            </div>
            <div className={s.principleCard}>
              <h3 className={s.principleTitle}>Human-in-the-loop</h3>
              <p className={s.principleDesc}>
                AI drafts, you decide. Nothing sends without your approval.
                Every recommendation is transparent and overridable.
              </p>
            </div>
            <div className={s.principleCard}>
              <h3 className={s.principleTitle}>Evidence-based</h3>
              <p className={s.principleDesc}>
                Every feature grounded in published research. No dark patterns,
                no engagement tricks, no manufactured urgency.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. Research strip ──────────────────────────────────────── */}
      <section className={s.researchStrip}>
        <div className={s.researchInner}>
          <h2 className={s.researchHeadline}>Built on evidence, not hype.</h2>
          <p className={s.researchSub}>
            24 peer-reviewed studies. Three user groups. One platform.
          </p>
          <Link href="/research" className={s.researchLink}>
            Read the research foundation
          </Link>
        </div>
      </section>

      {/* ── 7. Pricing (client component with annual/monthly toggle) ── */}
      <PricingSection />

      {/* ── 8. CTA ─────────────────────────────────────────────────── */}
      <section className={s.cta}>
        <div className={s.ctaInner}>
          <h2 className={s.ctaHeadline}>The cognitive overhead stops here.</h2>
          <Link href="/auth/signup" className={s.ctaButton}>
            Start your free trial
          </Link>
        </div>
      </section>

      {/* ── 9. Footer ──────────────────────────────────────────────── */}
      <footer className={s.footer}>
        <div className={s.footerInner}>
          <div className={s.footerLinks}>
            <Link href="/research" className={s.footerLink}>Research</Link>
            <Link href="/privacy" className={s.footerLink}>Privacy</Link>
            <Link href="/terms" className={s.footerLink}>Terms</Link>
          </div>
          <p className={s.footerCopy}>VeritasIQ Technologies Ltd</p>
        </div>
      </footer>

    </div>
  )
}
