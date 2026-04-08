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
          <Link href="/" className={styles.logo}>PIOS</Link>
          <div className={styles.navLinks}>
            <a href="#platform" className={styles.navLink}>Platform</a>
            <Link href="/research" className={styles.navLink}>Research</Link>
            <a href="#pricing" className={styles.navLink}>Pricing</a>
          </div>
          <div className={styles.navActions}>
            <Link href="/auth/login" className={styles.navLink}>Sign in</Link>
            <Link href="/auth/signup" className={styles.navCta}>Request Access</Link>
          </div>
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
              <span className={styles.statLabel}>of a founder&apos;s week consumed by administrative work that should not require the founder</span>
              <span className={styles.statCite}>Agility PR, 2025</span>
            </div>
            <div className={styles.statBox}>
              <span className={styles.statNum}>1,200</span>
              <span className={styles.statLabel}>context switches per day for senior professionals managing multi-domain responsibilities</span>
              <span className={styles.statCite}>Harvard Business Review, 2022</span>
            </div>
          </div>
          <Link href="/auth/signup" className={styles.heroCta}>Choose your path →</Link>
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

          <p className={styles.pricingGroupLabel}>Individual</p>
          <div className={styles.pricingGrid}>
            <div className={styles.priceCard}>
              <h3 className={styles.priceTier}>Starter</h3>
              <div className={styles.priceAmount}>£12<span className={styles.pricePeriod}>/mo</span></div>
              <div className={styles.priceAnnual}>or £10/mo billed annually - £120/yr</div>
              <p className={styles.priceTagline}>The structure university never gave you.</p>
              <p className={styles.priceDesc}>Undergraduate and postgraduate students</p>
              <ul className={styles.priceFeatures}>
                <li>Daily Brief + Tasks</li>
                <li>Academic Suite (Thesis, Literature, Viva)</li>
                <li>Coaching + Wellness</li>
                <li>1 email account</li>
                <li>Up to 50 NemoClaw sessions/mo</li>
              </ul>
              <Link href="/auth/signup?plan=starter" className={styles.priceCta}>Start free trial</Link>
              <p className={styles.priceBilled}>Billed £120/yr - save £24</p>
            </div>

            <div className={`${styles.priceCard} ${styles.priceCardFeatured}`}>
              <div className={styles.featuredBadge}>Most popular</div>
              <h3 className={styles.priceTier}>Pro</h3>
              <div className={styles.priceAmount}>£28<span className={styles.pricePeriod}>/mo</span></div>
              <div className={styles.priceAnnual}>or £23/mo billed annually - £276/yr</div>
              <p className={styles.priceTagline}>One system for everything you do at once.</p>
              <p className={styles.priceDesc}>Professionals, consultants, solo founders</p>
              <ul className={styles.priceFeatures}>
                <li>Everything in Starter</li>
                <li>Email Intelligence + multi-inbox</li>
                <li>Consulting Frameworks (44 VIQ frameworks)</li>
                <li>CPD tracking + AI-generated courses</li>
                <li>Financials + Expenses</li>
                <li>Calendar + AI pre-briefs</li>
                <li>Up to 200 NemoClaw sessions/mo</li>
              </ul>
              <Link href="/auth/signup?plan=pro" className={styles.priceCta}>Start free trial</Link>
              <p className={styles.priceBilled}>Billed £276/yr - save £60</p>
            </div>

            <div className={styles.priceCard}>
              <h3 className={styles.priceTier}>Executive</h3>
              <div className={styles.priceAmount}>£36<span className={styles.pricePeriod}>/mo</span></div>
              <div className={styles.priceAnnual}>or £30/mo billed annually - £360/yr</div>
              <p className={styles.priceTagline}>Run the business. Build the legacy.</p>
              <p className={styles.priceDesc}>CEOs, founders, directors, senior executives</p>
              <ul className={styles.priceFeatures}>
                <li>Everything in Pro</li>
                <li>EOSA™ + Strategic Decisions</li>
                <li>Stakeholders + Board Pack</li>
                <li>Chief of Staff module</li>
                <li>Time Sovereignty audit</li>
                <li>Unlimited NemoClaw sessions</li>
              </ul>
              <Link href="/auth/signup?plan=executive" className={styles.priceCta}>Start free trial</Link>
              <p className={styles.priceBilled}>Billed £360/yr - save £72</p>
            </div>
          </div>

          <p className={styles.pricingGroupLabel}>Enterprise</p>
          <p className={styles.pricingGroupSub}>
            All enterprise plans include DPA, tenant data isolation, admin dashboard, and invite-based onboarding.
            White-label branding available on Growth and above at +£8/seat/mo.
          </p>
          <div className={styles.pricingGridEnterprise}>
            <div className={styles.priceCard}>
              <h3 className={styles.priceTier}>Enterprise Starter</h3>
              <div className={styles.priceAmount}>£45<span className={styles.pricePeriod}>/seat/mo</span></div>
              <div className={styles.priceAnnual}>or £38/seat/mo billed annually</div>
              <p className={styles.priceTagline}>AI-grade professional tools across your team.</p>
              <p className={styles.priceDesc}>5-24 seats · consultancies, professional services</p>
              <ul className={styles.priceFeatures}>
                <li>All Executive modules for every seat</li>
                <li>DPA included (GDPR / POPIA)</li>
                <li>Tenant data isolation</li>
                <li>Admin dashboard + seat management</li>
                <li>Invite-based onboarding</li>
                <li>Email IT disclosure + forward-only option</li>
                <li>Minimum 5 seats</li>
              </ul>
              <a className={styles.priceCta} href="mailto:info@veritasiq.io?subject=PIOS Enterprise Starter">Request a proposal</a>
            </div>

            <div className={`${styles.priceCard} ${styles.priceCardFeatured}`}>
              <div className={styles.featuredBadge}>Most common</div>
              <h3 className={styles.priceTier}>Enterprise Growth</h3>
              <div className={styles.priceAmount}>£40<span className={styles.pricePeriod}>/seat/mo</span></div>
              <div className={styles.priceAnnual}>or £33/seat/mo billed annually</div>
              <p className={styles.priceTagline}>Deploy PIOS at team scale with your branding.</p>
              <p className={styles.priceDesc}>25-99 seats · growing organisations</p>
              <ul className={styles.priceFeatures}>
                <li>Everything in Enterprise Starter</li>
                <li>White-label branding available (+£8/seat/mo)</li>
                <li>Custom domain (app.yourcompany.com)</li>
                <li>Dedicated onboarding session</li>
                <li>Priority support</li>
                <li>Module enable/disable per tenant</li>
                <li>Minimum 25 seats</li>
              </ul>
              <a className={styles.priceCta} href="mailto:info@veritasiq.io?subject=PIOS Enterprise Growth">Request a proposal</a>
            </div>

            <div className={styles.priceCard}>
              <h3 className={styles.priceTier}>Enterprise Scale</h3>
              <div className={styles.priceAmount}>£32<span className={styles.pricePeriod}>/seat/mo</span></div>
              <div className={styles.priceAnnual}>or £27/seat/mo billed annually</div>
              <p className={styles.priceTagline}>Enterprise-grade AI OS with SSO and contractual support options.</p>
              <p className={styles.priceDesc}>100-499 seats · large organisations</p>
              <ul className={styles.priceFeatures}>
                <li>Everything in Enterprise Growth</li>
                <li>SLA addendum by separate written agreement</li>
                <li>SSO (SAML / OIDC)</li>
                <li>Audit log export (CSV)</li>
                <li>Named account manager</li>
                <li>Quarterly business review</li>
                <li>Minimum 100 seats</li>
              </ul>
              <a className={styles.priceCta} href="mailto:info@veritasiq.io?subject=PIOS Enterprise Scale">Request a proposal</a>
            </div>

            <div className={styles.priceCard}>
              <h3 className={styles.priceTier}>Enterprise Custom</h3>
              <div className={styles.priceAmount}>Custom</div>
              <div className={styles.priceAnnual}>negotiated annually</div>
              <p className={styles.priceTagline}>Bespoke deployment for large organisations.</p>
              <p className={styles.priceDesc}>500+ seats · multi-year · on-premise option</p>
              <ul className={styles.priceFeatures}>
                <li>Everything in Enterprise Scale</li>
                <li>On-premise or private cloud option</li>
                <li>Custom AI credit allocation</li>
                <li>Bespoke module configuration</li>
                <li>Executive sponsor engagement</li>
                <li>Negotiated service terms</li>
                <li>Multi-year pricing</li>
              </ul>
              <a className={styles.priceCta} href="mailto:info@veritasiq.io?subject=PIOS Enterprise Custom">Book a call</a>
            </div>
          </div>

          <div className={styles.whitelabelNote}>
            <span className={styles.whitelabelBadge}>White-label</span>
            Remove all PIOS and VeritasIQ branding, set your own domain and logo.
            Available on Enterprise Growth and above at <strong>+£8/seat/mo</strong>.{' '}
            <a href="mailto:info@veritasiq.io?subject=PIOS White-label">Enquire →</a>
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
            <Link href="/cookies" className={styles.footerLink}>Cookies</Link>
          </div>
          <p className={styles.footerCopy}>VeritasIQ Technologies Ltd · info@veritasiq.io</p>
        </div>
      </footer>
    </div>
  )
}
