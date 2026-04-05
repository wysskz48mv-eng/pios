import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import s from './landing.module.css'

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

      {/* ── 3. Pain bands ──────────────────────────────────────────── */}

      {/* Band 1 — Undergraduate */}
      <section className={s.bandLight}>
        <div className={s.bandInner}>
          <span className={s.bandLabel}>UNDERGRADUATE</span>
          <div className={s.bandHero}>
            <span className={s.bandStat}>75%</span>
            <span className={s.bandStatLabel}>feel overwhelmed by academic workload</span>
          </div>
          <blockquote className={s.bandQuote}>
            &ldquo;I always think I have more time than I do, then everything
            piles up.&rdquo;
          </blockquote>
          <p className={s.bandCopy}>
            Research shows 72% of students systematically underestimate how long
            tasks will take. Combine that with tool fragmentation across LMS
            platforms, note-taking apps, and calendar tools, and the cognitive
            load becomes unsustainable. 55% of undergraduates now work part-time
            alongside their studies, compressing an already-strained schedule
            further.
          </p>
          <p className={s.bandBridge}>
            PIOS gives undergraduates the self-regulation scaffolding that
            university assumes but never teaches.
          </p>
        </div>
      </section>

      {/* Band 2 — Postgraduate */}
      <section className={s.bandDark}>
        <div className={s.bandInner}>
          <span className={s.bandLabel}>POSTGRADUATE</span>
          <div className={s.bandHero}>
            <span className={s.bandStat}>43%</span>
            <span className={s.bandStatLabel}>never complete their doctoral programme</span>
          </div>
          <blockquote className={s.bandQuote}>
            &ldquo;I feel like I&rsquo;m failing at everything&nbsp;&mdash;
            work, the doctorate, and being a parent&nbsp;&mdash; all at
            once.&rdquo;
          </blockquote>
          <p className={s.bandCopy}>
            Doctoral attrition is driven by role conflict, administrative
            fragmentation, and isolation. Postgraduates juggle supervisory
            meetings, ethics applications, teaching duties, and literature
            management across disconnected tools. 34% of those who withdraw cite
            personal problems arising from the inability to manage competing
            demands.
          </p>
          <p className={s.bandBridge}>
            PIOS replaces the cognitive overhead of managing deadlines,
            supervisory prep, and thesis progress across fragmented tools.
          </p>
        </div>
      </section>

      {/* Band 3 — Executive */}
      <section className={s.bandLight}>
        <div className={s.bandInner}>
          <span className={s.bandLabel}>EXECUTIVE</span>
          <div className={s.bandHero}>
            <span className={s.bandStat}>1,200</span>
            <span className={s.bandStatLabel}>app switches per day</span>
          </div>
          <blockquote className={s.bandQuote}>
            &ldquo;I spend more time switching between tools than actually
            thinking.&rdquo;
          </blockquote>
          <p className={s.bandCopy}>
            Knowledge workers lose 40% of productive time to context switching
            and tool fragmentation. The average executive spends four hours per
            week simply reorienting after interruptions. Decision fatigue
            compounds across the day, degrading the quality of strategic
            judgement precisely when it matters most.
          </p>
          <p className={s.bandBridge}>
            PIOS consolidates tasks, email triage, proposals, and strategic
            frameworks into one AI layer.
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

      {/* ── 5. Research strip ──────────────────────────────────────── */}
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

      {/* ── 6. Pricing ─────────────────────────────────────────────── */}
      <section className={s.pricing} id="pricing">
        <div className={s.pricingInner}>
          <h2 className={s.sectionTitle}>Pricing</h2>
          <div className={s.pricingGrid}>

            <div className={s.priceCard}>
              <h3 className={s.priceTier}>Starter</h3>
              <div className={s.priceAmount}>&pound;9<span className={s.pricePeriod}>/mo</span></div>
              <p className={s.priceCredits}>2,000 AI credits</p>
              <p className={s.priceDesc}>
                For students and early-career professionals managing deadlines,
                modules, and part-time work.
              </p>
              <Link href="/auth/signup" className={s.priceCta}>Start free trial</Link>
            </div>

            <div className={s.priceCard}>
              <h3 className={s.priceTier}>Pro</h3>
              <div className={s.priceAmount}>&pound;19<span className={s.pricePeriod}>/mo</span></div>
              <p className={s.priceCredits}>5,000 AI credits</p>
              <p className={s.priceDesc}>
                For postgraduates and independent professionals.
              </p>
              <Link href="/auth/signup" className={s.priceCta}>Start free trial</Link>
            </div>

            <div className={`${s.priceCard} ${s.priceCardFeatured}`}>
              <h3 className={s.priceTier}>Executive</h3>
              <div className={s.priceAmount}>&pound;24<span className={s.pricePeriod}>/mo</span></div>
              <p className={s.priceCredits}>10,000 AI credits</p>
              <p className={s.priceDesc}>
                For executives, consultants, and multi-domain operators.
              </p>
              <Link href="/auth/signup" className={s.priceCta}>Start free trial</Link>
            </div>

            <div className={s.priceCard}>
              <h3 className={s.priceTier}>Team</h3>
              <div className={s.priceAmount}>Custom</div>
              <p className={s.priceCredits}>Unlimited</p>
              <p className={s.priceDesc}>
                For teams and newsrooms.
              </p>
              <Link href="/auth/signup" className={s.priceCta}>Start free trial</Link>
            </div>

          </div>
        </div>
      </section>

      {/* ── 7. How it works ────────────────────────────────────────── */}
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
