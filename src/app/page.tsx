import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import styles from './page.module.css'

export default async function LandingPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('onboarded')
      .eq('id', user.id)
      .maybeSingle()

    redirect(profile?.onboarded === false ? '/onboarding' : '/platform/dashboard')
  }

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <span className={styles.logo}>PIOS</span>
          <div className={styles.navLinks}>
            <a href="#platform" className={styles.navLink}>Platform</a>
            <Link href="/research" className={styles.navLink}>Research</Link>
            <a href="#pricing" className={styles.navLink}>Pricing</a>
          </div>
          <Link href="/auth/signup" className={styles.navCta}>
            Request Access
          </Link>
        </div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroTag}>Personal Intelligence Operating System</div>
          <h1 className={styles.heroHeadline}>
            The intelligence layer<br />
            for those who <em>lead.</em>
          </h1>
          <p className={styles.heroSub}>
            One AI that holds the full weight of your professional life - decisions,
            stakeholders, board intelligence, and strategic frameworks - calibrated to
            you, always on.
          </p>
          <div className={styles.statGrid}>
            <div className={styles.statBox}>
              <span className={styles.statNum}>60%</span>
              <span className={styles.statLabel}>of executives experience measurable judgement impairment after sustained decision load</span>
              <span className={styles.statCite}>University of Cambridge, 2023</span>
            </div>
            <div className={styles.statBox}>
              <span className={styles.statNum}>36%</span>
              <span className={styles.statLabel}>of a founder's week consumed by administrative work that should not require the founder</span>
              <span className={styles.statCite}>Agility PR, 2025</span>
            </div>
            <div className={styles.statBox}>
              <span className={styles.statNum}>1,200</span>
              <span className={styles.statLabel}>context switches per day for senior professionals managing multi-domain responsibilities</span>
              <span className={styles.statCite}>Harvard Business Review, 2022</span>
            </div>
          </div>
          <Link href="/auth/signup" className={styles.heroCta}>
            Choose your path →
          </Link>
        </div>
      </section>

      <section className={styles.bandDark} id="platform">
        <div className={styles.bandInner}>
          <span className={styles.bandLabel}>EXECUTIVE — The leader who runs at full capacity</span>
          <div className={styles.bandHero}>
            <span className={styles.bandStat}>60%</span>
            <span className={styles.bandStatLabel}>of executives experience measurably impaired judgement</span>
          </div>
          <p className={styles.bandCopy}>
            60% of executives experience measurably impaired judgement after sustained decision-making.
            36% of a founder&apos;s week is lost to admin. Your decisions compound. Your time does not.
            PIOS consolidates email, decisions, stakeholder intelligence, board communications,
            and strategic frameworks into one layer.
          </p>
          <p className={styles.bandCite}>University of Cambridge 2023 · Agility PR 2025</p>
          <p className={styles.bandModules}>EOSA™ · Decisions · Stakeholders · Board Pack · Chief of Staff · Email Intelligence · Morning Brief</p>
        </div>
      </section>

      <section className={styles.bandLight}>
        <div className={styles.bandInner}>
          <span className={styles.bandLabel}>PRO — The professional doing everything at once</span>
          <div className={styles.bandHero}>
            <span className={styles.bandStat}>£52</span>
            <span className={styles.bandStatLabel}>spent monthly across fragmented AI tools</span>
          </div>
          <p className={styles.bandCopy}>
            Professionals spend £52/mo across 4 fragmented AI tools — and lose 4 hours every week
            reorienting between them. You are running a practice, completing a doctorate, and managing
            a business simultaneously. No tool was built for this. PIOS was.
          </p>
          <p className={styles.bandCite}>SubChoice 2026 · Harvard Business Review, 2022</p>
          <p className={styles.bandModules}>Email Intelligence · Consulting Frameworks · Financials · CPD · Academic Suite</p>
        </div>
      </section>

      <section className={styles.bandDark}>
        <div className={styles.bandInner}>
          <span className={styles.bandLabel}>RESEARCHER — The academic who cannot afford to stop</span>
          <div className={styles.bandHero}>
            <span className={styles.bandStat}>43%</span>
            <span className={styles.bandStatLabel}>of doctoral students never complete their degree</span>
          </div>
          <p className={styles.bandCopy}>
            43% of doctoral students never complete. University removed the structure school provided.
            PIOS gives it back — thesis tracking, literature intelligence, supervision prep, and a
            morning brief that knows your submission deadline as clearly as it knows your board meeting.
          </p>
          <p className={styles.bandCite}>Council of Graduate Schools · Frontiers in Psychology, 2022</p>
          <p className={styles.bandModules}>Thesis Tracker · Literature Agent · Supervision Prep · Viva Prep · Academic Brief · Wellness</p>
        </div>
      </section>

      <section className={styles.modules}>
        <div className={styles.modulesInner}>
          <h2 className={styles.sectionTitle}>The platform</h2>
          <div className={styles.moduleGrid}>
            {[
              { name: 'NemoClaw™ Coaching', desc: '5 modes, calibrated to your CV. Strategic, operational, academic, reflective, and crisis coaching from one adaptive engine.' },
              { name: 'Morning Brief', desc: 'AI daily intelligence synthesised from your live data. Calendar, deadlines, email signals, and strategic priorities in one view.' },
              { name: 'Email Intelligence', desc: '6-category classification with draft generation. Urgent, action, FYI, delegate, defer, archive — processed in seconds.' },
              { name: 'EOSA™ Frameworks', desc: '13 proprietary NemoClaw frameworks for strategy, due diligence, stakeholder mapping, and executive operating architecture.' },
              { name: 'Academic Suite', desc: 'Viva prep, literature agent, supervisor meeting prep, and thesis progress tracking for postgraduate researchers.' },
              { name: 'Chief of Staff', desc: 'Weekly strategic review with workstream RAG. Cross-domain awareness across every active project and commitment.' },
            ].map((module) => (
              <div key={module.name} className={styles.moduleCard}>
                <h3 className={styles.moduleTitle}>{module.name}</h3>
                <p className={styles.moduleDesc}>{module.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.researchStrip}>
        <div className={styles.researchInner}>
          <h2 className={styles.researchHeadline}>Built on evidence, not hype.</h2>
          <p className={styles.researchSub}>24 peer-reviewed studies. Three user groups. One platform.</p>
          <Link href="/research" className={styles.researchLink}>Read the research foundation</Link>
        </div>
      </section>

      <section className={styles.pricing} id="pricing">
        <div className={styles.pricingInner}>
          <h2 className={styles.sectionTitle}>Pricing</h2>
          <div className={styles.pricingGrid}>
            {[
              {
                tier: 'Starter', price: '£12', period: '/mo', billed: '£144/yr',
                tagline: 'The structure university never gave you.',
                desc: 'Undergraduate and postgraduate students',
                features: ['Daily Brief + Tasks', 'Academic Suite (Thesis, Literature, Viva)', 'Coaching + Wellness', '1 email account'],
                plan: 'starter',
              },
              {
                tier: 'Pro', price: '£28', period: '/mo', billed: '£336/yr', featured: true,
                tagline: 'One system for everything you do at once.',
                desc: 'Professionals, consultants, solo founders',
                features: ['Everything in Starter', 'Email Intelligence + multi-inbox', 'Consulting Frameworks + CPD', 'Financials + Expenses', 'Calendar + AI pre-briefs'],
                plan: 'pro',
              },
              {
                tier: 'Executive', price: '£36', period: '/mo', billed: '£432/yr',
                tagline: 'Run the business. Build the legacy.',
                desc: 'CEOs, founders, directors, senior executives',
                features: ['Everything in Pro', 'EOSA™ + Decisions', 'Stakeholders + Board Pack', 'Chief of Staff module', 'Time Sovereignty audit'],
                plan: 'executive',
              },
            ].map((plan) => (
              <div key={plan.tier} className={`${styles.priceCard} ${plan.featured ? styles.priceCardFeatured : ''}`}>
                <h3 className={styles.priceTier}>{plan.tier}</h3>
                <div className={styles.priceAmount}>
                  {plan.price}<span className={styles.pricePeriod}>{plan.period}</span>
                </div>
                <p className={styles.priceTagline}>{plan.tagline}</p>
                <p className={styles.priceDesc}>{plan.desc}</p>
                <ul className={styles.priceFeatures}>
                  {plan.features.map((feature) => <li key={feature}>{feature}</li>)}
                </ul>
                <Link href={`/auth/signup?plan=${plan.plan}`} className={styles.priceCta}>
                  Start free trial
                </Link>
                <p className={styles.priceBilled}>Billed {plan.billed}</p>
              </div>
            ))}

            <div className={styles.priceCard}>
              <h3 className={styles.priceTier}>Enterprise</h3>
              <div className={styles.priceAmount}>From £36<span className={styles.pricePeriod}>/seat/mo</span></div>
              <p className={styles.priceTagline}>Deploy PIOS across your organisation.</p>
              <p className={styles.priceDesc}>Corporations, universities, white-label partners</p>
              <ul className={styles.priceFeatures}>
                <li>All modules + admin dashboard</li>
                <li>Team management + custom onboarding</li>
                <li>Data isolation + DPA included</li>
                <li>White-label option</li>
              </ul>
              <a href="mailto:info@veritasiq.io" className={styles.priceCta}>Request a proposal</a>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.finalCta}>
        <div className={styles.finalCtaInner}>
          <h2 className={styles.finalCtaHeadline}>The cognitive overhead stops here.</h2>
          <Link href="/auth/signup" className={styles.finalCtaBtn}>Request access</Link>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerLinks}>
            <Link href="/research" className={styles.footerLink}>Research</Link>
            <Link href="/privacy" className={styles.footerLink}>Privacy</Link>
            <Link href="/terms" className={styles.footerLink}>Terms</Link>
          </div>
          <p className={styles.footerCopy}>VeritasIQ Technologies Ltd · info@veritasiq.io</p>
        </div>
      </footer>
    </div>
  )
}
