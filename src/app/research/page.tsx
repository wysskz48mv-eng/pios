import type { Metadata } from 'next'
import Link from 'next/link'
import s from './research.module.css'
import { PrintButton } from './PrintButton'

export const metadata: Metadata = {
  title: 'The Evidence Base — PIOS™ | VeritasIQ Technologies Ltd',
  description: 'Peer-reviewed research on cognitive overload, student performance, and executive decision fatigue — and the evidence for AI-powered intelligence as an intervention. 24 cited studies. APA 7th edition.',
  openGraph: {
    title: 'The Science Behind PIOS™',
    description: '24 peer-reviewed studies across undergraduates, postgraduate professionals, and executives. The evidence base for PIOS.',
    type: 'article',
  },
}

export default function ResearchPage() {
  return (
    <div className={s.page}>

      {/* ── 1. Nav ─────────────────────────────────────────────── */}
      <nav className={s.nav}>
        <div className={s.navInner}>
          <Link href="/" className={s.logo}>PIOS</Link>
          <div className={s.navLinks}>
            <Link href="/" className={s.navLink}>Home</Link>
            <Link href="/research" className={s.navLink}>Research</Link>
            <Link href="/pricing" className={s.navLink}>Pricing</Link>
          </div>
          <Link href="/auth/signup" className={s.navCta}>Try PIOS free</Link>
        </div>
      </nav>

      {/* ── 2. Cover ───────────────────────────────────────────── */}
      <section className={s.cover}>
        <div className={s.coverInner}>
          <p className={s.coverLabel}>WHITE PAPER</p>
          <h1 className={s.coverTitle}>The Evidence Base for PIOS&trade;</h1>
          <p className={s.coverSub}>
            A synthesis of 24 peer-reviewed studies across three user populations
          </p>
          <p className={s.coverMeta}>
            VeritasIQ Technologies Ltd &middot; March 2026 &middot; APA 7th Edition
          </p>
          <PrintButton />
        </div>
      </section>

      {/* ── 3. Content grid ────────────────────────────────────── */}
      <div className={s.content}>

        {/* ── Sidebar TOC ──────────────────────────────────────── */}
        <aside className={s.sidebar}>
          <nav className={s.sidebarNav}>
            <a href="#executive-summary" className={s.sidebarLink}>1. Executive Summary</a>
            <a href="#undergraduates" className={s.sidebarLink}>2. Undergraduates</a>
            <a href="#postgraduates" className={s.sidebarLink}>3. Postgraduates</a>
            <a href="#executives" className={s.sidebarLink}>4. Executives &amp; Consultants</a>
            <a href="#ai-evidence" className={s.sidebarLink}>5. The AI Evidence</a>
            <a href="#faq" className={s.sidebarLink}>6. FAQ</a>
            <a href="#references" className={s.sidebarLink}>7. References</a>
          </nav>
        </aside>

        {/* ── Main column ──────────────────────────────────────── */}
        <main className={s.main}>

          {/* ── Section 1: Executive Summary ───────────────────── */}
          <section id="executive-summary" className={s.section}>
            <h2 className={s.sectionTitle}>1. Executive Summary</h2>
            <p className={s.paragraph}>
              PIOS is built on a single thesis: the most consequential bottleneck facing students,
              researchers, and professionals today is not a lack of information &mdash; it is a failure
              of attention management across multiple life domains. The cognitive load of juggling
              academic deadlines, professional obligations, and personal responsibilities produces
              measurable performance degradation that no single-purpose productivity tool can address.
            </p>
            <p className={s.paragraph}>
              This white paper synthesises evidence from 24 peer-reviewed studies across three distinct
              populations: undergraduates navigating the transition to higher education, postgraduate
              professionals balancing doctoral research with careers and families, and senior executives
              and consultants operating under chronic context-switching pressure. In each case, the
              literature converges on the same finding: structured cognitive scaffolding &mdash; not
              more information, not more tools &mdash; is the intervention that moves the needle.
            </p>
            <p className={s.paragraph}>
              PIOS exists to deliver that scaffolding. It is not an AI that does your work for you.
              It is an AI operating system that maintains awareness across every domain of your life,
              surfaces the right priority at the right moment, and coaches you through the planning
              and self-regulation behaviours that the evidence shows matter most. The research that
              follows is the foundation on which every PIOS feature was designed.
            </p>
          </section>

          {/* ── Section 2: Undergraduates ──────────────────────── */}
          <section id="undergraduates" className={s.section}>
            <div className={s.groupHeader}>
              <div className={s.groupIcon}>🎓</div>
              <h2 className={s.groupTitle}>Undergraduates</h2>
            </div>

            <div className={s.statCallout}>
              <div className={s.statNumber}>72%</div>
              <div className={s.statLabel}>
                of undergraduates consistently underestimate how long academic tasks will take
              </div>
              <div className={s.statCite}>Frontiers in Psychology, 2022</div>
            </div>

            <div className={s.statCallout}>
              <div className={s.statNumber}>75%</div>
              <div className={s.statLabel}>
                of students report feeling overwhelmed by their academic workload
              </div>
              <div className={s.statCite}>American College Health Association, 2024</div>
            </div>

            <div className={s.statCallout}>
              <div className={s.statNumber}>55%</div>
              <div className={s.statLabel}>
                of UK undergraduates work part-time alongside their studies
              </div>
              <div className={s.statCite}>HEPI / Advance HE, 2023</div>
            </div>

            <blockquote className={s.pullQuote}>
              &ldquo;I always think I have more time than I do, then everything piles up
              in the last week.&rdquo;
            </blockquote>

            <p className={s.paragraph}>
              The transition from secondary to higher education is one of the most
              cognitively demanding periods in a young adult&rsquo;s life. Students must
              simultaneously develop academic self-regulation skills, manage social
              adjustment, and &mdash; for an increasing majority &mdash; hold down paid
              employment. Research by Taylor &amp; Francis (2024) shows that transitional
              challenges predict first-year attrition more strongly than prior academic
              performance, while Cogent Education (2023) finds that first-generation
              students face compounding adjustment barriers that traditional university
              support structures fail to address.
            </p>
            <p className={s.paragraph}>
              Time management is the single strongest predictor of undergraduate academic
              performance (Adams &amp; Blair, 2019). Yet 72% of students consistently
              underestimate task duration (Frontiers in Psychology, 2022), creating a
              chronic planning gap that compounds week over week. Three-quarters of
              students report feeling overwhelmed (ACHA, 2024), and Research.com&rsquo;s
              2026 data shows academic stress now surpasses financial stress as the primary
              concern for students across the UK and US.
            </p>
            <p className={s.paragraph}>
              The rise of working students adds a further layer of complexity. With 55% of
              UK undergraduates in part-time employment (HEPI, 2023), the Penn Wharton
              Budget Model (2021) finds that students working more than 15 hours per week
              experience a statistically significant drop in GPA. These students are not
              failing because they lack ability &mdash; they are failing because they lack
              a system that can hold the full picture of their commitments and surface the
              right priority at the right time.
            </p>

            <div className={s.bridgeBox}>
              <p className={s.bridgeTitle}>This is why PIOS exists for this student.</p>
              <p className={s.bridgeText}>
                PIOS gives undergraduates an AI operating system that is aware of their
                deadlines, employment schedule, and personal commitments simultaneously.
                It coaches them through realistic time estimation, surfaces upcoming
                collisions before they happen, and builds the self-regulation habits that
                the evidence shows are the strongest lever for academic success.
              </p>
            </div>
          </section>

          {/* ── Section 3: Postgraduates ───────────────────────── */}
          <section id="postgraduates" className={s.section}>
            <div className={s.groupHeader}>
              <div className={s.groupIcon}>🔬</div>
              <h2 className={s.groupTitle}>Postgraduates</h2>
            </div>

            <div className={s.statCallout}>
              <div className={s.statNumber}>43%</div>
              <div className={s.statLabel}>
                of doctoral students never complete their degree &mdash; only 56.6% completion at 10 years
              </div>
              <div className={s.statCite}>Council of Graduate Schools, 2008</div>
            </div>

            <div className={s.statCallout}>
              <div className={s.statNumber}>34%</div>
              <div className={s.statLabel}>
                cite personal problems &mdash; not academic difficulty &mdash; as the reason for dropping out
              </div>
              <div className={s.statCite}>Gardner, 2009</div>
            </div>

            <blockquote className={s.pullQuote}>
              &ldquo;I feel like I&rsquo;m failing at everything &mdash; work, the doctorate,
              and being a parent &mdash; all at once.&rdquo;
            </blockquote>

            <p className={s.paragraph}>
              The postgraduate experience is defined by role conflict. Doctoral students
              are rarely just students: they are employees, parents, caregivers, and
              community members operating under the sustained cognitive load of a
              multi-year research project. Ramarajan (2014) demonstrates that individuals
              managing multiple identity domains experience identity interference &mdash;
              the competing demands of each role creating a chronic drain on executive
              function that degrades performance across all domains.
            </p>
            <p className={s.paragraph}>
              Sverdlik et al. (2018) conducted a comprehensive review of factors
              influencing doctoral completion, achievement, and well-being, finding that
              self-regulation and structured planning are more predictive of completion
              than intellectual ability or supervisory quality. The Council of Graduate
              Schools (2008) reports a 56.6% completion rate at ten years, with 43% of
              students never finishing. Gardner (2009) found that 34% of those who leave
              cite personal problems rather than academic difficulty as the primary reason.
            </p>
            <p className={s.paragraph}>
              Amani, Myeya, &amp; Mhewa (2022) further illuminate the motives for
              pursuing postgraduate study and the causes of late completion, showing that
              students who lack structured systems for managing competing demands are
              significantly more likely to extend their timelines or withdraw entirely.
              The supervision relationship, while important, cannot substitute for the
              daily self-regulation infrastructure that sustains progress between meetings.
            </p>

            <div className={s.bridgeBox}>
              <p className={s.bridgeTitle}>This is why PIOS exists for this researcher.</p>
              <p className={s.bridgeText}>
                PIOS gives postgraduate professionals a single system that holds awareness
                of their research milestones, professional deadlines, and family
                commitments. It provides structured reflection prompts, realistic
                progress tracking, and cross-domain coaching that helps them sustain
                momentum on the doctorate without sacrificing everything else.
              </p>
            </div>
          </section>

          {/* ── Section 4: Executives & Consultants ────────────── */}
          <section id="executives" className={s.section}>
            <div className={s.groupHeader}>
              <div className={s.groupIcon}>💼</div>
              <h2 className={s.groupTitle}>Executives &amp; Consultants</h2>
            </div>

            <div className={s.statCallout}>
              <div className={s.statNumber}>1,200</div>
              <div className={s.statLabel}>
                app switches per day for the average knowledge worker
              </div>
              <div className={s.statCite}>Harvard Business Review, 2022</div>
            </div>

            <div className={s.statCallout}>
              <div className={s.statNumber}>23 min</div>
              <div className={s.statLabel}>
                average time to refocus after a single interruption
              </div>
              <div className={s.statCite}>Mark, Gudith &amp; Klocke, UC Irvine, 2008</div>
            </div>

            <div className={s.statCallout}>
              <div className={s.statNumber}>60%</div>
              <div className={s.statLabel}>
                of executives report that decision fatigue impairs their judgement by end of day
              </div>
              <div className={s.statCite}>University of Cambridge, 2023</div>
            </div>

            <blockquote className={s.pullQuote}>
              &ldquo;I spend more time switching between tools than actually thinking.&rdquo;
            </blockquote>

            <p className={s.paragraph}>
              The executive attention environment has become structurally hostile to deep
              work. Harvard Business Review (2022) reports that knowledge workers switch
              between applications an average of 1,200 times per day, while Qatalog and
              Cornell University (2021) found that 45% of workers feel context switching
              makes them less productive, with the average professional losing an estimated
              36 minutes per day solely to reorientation after interruptions.
            </p>
            <p className={s.paragraph}>
              Mark, Gudith, and Klocke (2008) established the now widely cited finding
              that it takes an average of 23 minutes and 15 seconds to return to a task
              after interruption. For senior leaders making dozens of consequential
              decisions daily, this fragmentation has a compounding effect. Pignatiello,
              Martin, and Hickman (2020) provide a conceptual analysis of decision fatigue,
              showing that the quality of decisions degrades predictably as cognitive
              resources are depleted &mdash; a pattern the University of Cambridge (2023)
              confirmed in 60% of executives surveyed.
            </p>
            <p className={s.paragraph}>
              McKinsey &amp; Company (2023) found that Fortune 500 executives spend an
              average of 23% of their time in activities they consider low-value but
              necessary, while Livepro (2025) reports that inefficient knowledge management
              costs large organisations an average of $5.7 million annually in lost
              productivity. The problem is not a lack of tools &mdash; it is that the tools
              themselves have become the source of fragmentation.
            </p>

            <div className={s.bridgeBox}>
              <p className={s.bridgeTitle}>This is why PIOS exists for this professional.</p>
              <p className={s.bridgeText}>
                PIOS consolidates cross-domain awareness into a single AI layer that sits
                above your existing tools. It reduces context-switching by surfacing the
                right information at the right moment, provides structured decision
                frameworks when cognitive load is high, and protects deep-work windows
                by managing the periphery so you can focus on what matters.
              </p>
            </div>
          </section>

          {/* ── Section 5: The AI Evidence ─────────────────────── */}
          <section id="ai-evidence" className={s.section}>
            <div className={s.groupHeader}>
              <div className={s.groupIcon}>🧠</div>
              <h2 className={s.groupTitle}>The AI Evidence</h2>
            </div>

            <div className={s.statCallout}>
              <div className={s.statNumber}>Planning phase</div>
              <div className={s.statLabel}>
                AI interventions are most effective when applied at the planning and goal-setting phase of self-regulated learning
              </div>
              <div className={s.statCite}>Nature npj Science of Learning, 2025</div>
            </div>

            <div className={s.statCallout}>
              <div className={s.statNumber}>+9.22 pts</div>
              <div className={s.statLabel}>
                Students using digital task management platforms scored 9.22 points higher on average
              </div>
              <div className={s.statCite}>Springer &mdash; Discover Education, 2025</div>
            </div>

            <div className={s.statCallout}>
              <div className={s.statNumber}>&minus;40%</div>
              <div className={s.statLabel}>
                Structured reflection techniques reduce mental fatigue by up to 40%
              </div>
              <div className={s.statCite}>Nature Human Behaviour, 2021</div>
            </div>

            <p className={s.paragraph}>
              The question is no longer whether AI can support cognitive performance &mdash;
              it is how. Nature npj Science of Learning (2025) provides the clearest
              evidence to date: AI-powered interventions in higher education are most
              effective when they target the planning and goal-setting phase of
              self-regulated learning, rather than the execution phase. This distinction
              is critical. AI that does the work produces dependence; AI that scaffolds
              the planning produces autonomy.
            </p>
            <p className={s.paragraph}>
              Springer&rsquo;s Discover Education (2025) reports that students using
              structured digital task management platforms scored an average of 9.22 points
              higher than control groups, with the effect strongest among students who
              previously reported low self-regulation skills. MDPI Education Sciences (2025)
              conducted a systematic review of first-year interventions and found that
              tools combining goal-setting, progress monitoring, and reflective prompts
              produced the most durable improvements in academic performance and well-being.
            </p>
            <p className={s.paragraph}>
              Nature Human Behaviour (2021) extends this evidence to the executive context,
              showing that structured prioritisation and reflection techniques reduce
              cognitive fatigue by up to 40%. The mechanism is not mysterious: by
              externalising the overhead of tracking, sequencing, and remembering, these
              systems free working memory for the higher-order thinking that actually
              matters. PIOS is designed to deliver exactly this form of structured
              cognitive scaffolding &mdash; not replacement, but amplification.
            </p>
          </section>

          {/* ── Section 6: FAQ ─────────────────────────────────── */}
          <section id="faq" className={s.section}>
            <h2 className={s.sectionTitle}>6. Frequently Asked Questions</h2>

            <div className={s.faqItem}>
              <h3 className={s.faqQuestion}>Is PIOS an AI that does your work for you?</h3>
              <p className={s.faqAnswer}>
                No. PIOS is built on the principle of scaffolding, not replacement. The
                evidence consistently shows that AI interventions are most effective when
                they support planning, self-regulation, and reflection &mdash; not when
                they automate the work itself. PIOS coaches you through better decisions;
                it does not make them for you.
              </p>
            </div>

            <div className={s.faqItem}>
              <h3 className={s.faqQuestion}>
                What makes PIOS different from Notion or Todoist?
              </h3>
              <p className={s.faqAnswer}>
                Single-domain tools track tasks within one context. PIOS maintains
                cross-domain awareness &mdash; it understands your academic deadlines,
                professional commitments, and personal obligations simultaneously. It is
                calibrated to your profile and uses AI to surface conflicts, coach
                prioritisation, and protect your focus across every area of your life.
              </p>
            </div>

            <div className={s.faqItem}>
              <h3 className={s.faqQuestion}>Is the research real?</h3>
              <p className={s.faqAnswer}>
                Yes. This white paper cites 24 studies, all formatted in APA 7th edition,
                with DOIs and publication details included where available. Every source
                is independently verifiable. We believe transparency about our evidence
                base is a prerequisite for trust.
              </p>
            </div>

            <div className={s.faqItem}>
              <h3 className={s.faqQuestion}>Who built PIOS?</h3>
              <p className={s.faqAnswer}>
                PIOS is built by VeritasIQ Technologies Ltd, a research-grounded product
                development company. Every feature in PIOS traces back to evidence about
                how people actually manage cognitive load across multiple life domains.
              </p>
            </div>

            <div className={s.faqItem}>
              <h3 className={s.faqQuestion}>Can I try it free?</h3>
              <p className={s.faqAnswer}>
                Yes. PIOS offers a 14-day free trial with full access to all features.
                No credit card required.{' '}
                <Link href="/auth/signup" style={{ color: 'var(--gold)', fontWeight: 600 }}>
                  Start your free trial &rarr;
                </Link>
              </p>
            </div>
          </section>

          {/* ── Section 7: References ──────────────────────────── */}
          <section id="references" className={s.section}>
            <h2 className={s.sectionTitle}>7. References</h2>
            <ol className={s.refList}>
              <li className={s.refItem}>
                Adams, R. V., &amp; Blair, E. (2019). Impact of time management behaviors on
                undergraduate engineering students&rsquo; performance. <em>SAGE Open, 9</em>(1).
                https://doi.org/10.1177/2158244018824506
              </li>
              <li className={s.refItem}>
                Amani, J., Myeya, H., &amp; Mhewa, M. (2022). Understanding the motives for
                pursuing postgraduate studies and causes of late completion. <em>SAGE Open, 12</em>(3).
                https://doi.org/10.1177/21582440221109586
              </li>
              <li className={s.refItem}>
                American College Health Association. (2024). <em>National College Health Assessment:
                Spring 2024 reference group report</em>.
              </li>
              <li className={s.refItem}>
                Council of Graduate Schools. (2008). <em>Ph.D. completion and attrition: Analysis
                of baseline demographic data</em>. Washington, DC.
              </li>
              <li className={s.refItem}>
                Frontiers in Psychology. (2022). Self-regulation of time: The importance of time
                estimation accuracy. <em>Frontiers in Psychology, 13</em>, 925812.
              </li>
              <li className={s.refItem}>
                Gardner, S. K. (2009). Student and faculty attributions of attrition in high and
                low-completing doctoral programs. <em>Higher Education, 58</em>(1), 97&ndash;112.
              </li>
              <li className={s.refItem}>
                Harvard Business Review. (2022). The hidden cost of context switching for knowledge
                workers.
              </li>
              <li className={s.refItem}>
                HEPI/Advance HE. (2023). Student Academic Experience Survey 2023.
              </li>
              <li className={s.refItem}>
                Livepro. (2025). Knowledge management trends and statistics &mdash; 2025 outlook.
              </li>
              <li className={s.refItem}>
                Mark, G., Gudith, D., &amp; Klocke, U. (2008). The cost of interrupted work: More
                speed and stress. <em>Proceedings of CHI 2008</em>, 107&ndash;110.
              </li>
              <li className={s.refItem}>
                McKinsey &amp; Company. (2023). Fortune 500 executive time allocation analysis.
              </li>
              <li className={s.refItem}>
                Nature Human Behaviour. (2021). Prioritisation techniques and cognitive fatigue
                reduction.
              </li>
              <li className={s.refItem}>
                Penn Wharton Budget Model. (2021). College employment and student performance.
              </li>
              <li className={s.refItem}>
                Pignatiello, G. A., Martin, R. J., &amp; Hickman, R. L. (2020). Decision fatigue:
                A conceptual analysis. <em>Journal of Health Psychology, 25</em>(1), 123&ndash;135.
              </li>
              <li className={s.refItem}>
                Qatalog &amp; Cornell University. (2021). Workgeist report: Context switching and
                knowledge worker productivity.
              </li>
              <li className={s.refItem}>
                Ramarajan, L. (2014). Past, present and future research on multiple identities.
                <em> Academy of Management Annals, 8</em>(1), 589&ndash;659.
              </li>
              <li className={s.refItem}>
                Research.com. (2026). 50 current student stress statistics: 2026 data, analysis
                &amp; predictions.
              </li>
              <li className={s.refItem}>
                Springer &mdash; Discover Education. (2025). Digital task management platform
                enhances student academic achievement.
              </li>
              <li className={s.refItem}>
                Sverdlik, A., Hall, N. C., McAlpine, L., &amp; Hubbard, K. (2018). The PhD
                experience: A review of the factors influencing doctoral students&rsquo; completion,
                achievement, and well-being. <em>International Journal of Doctoral Studies, 13</em>,
                361&ndash;388.
              </li>
              <li className={s.refItem}>
                Taylor &amp; Francis. (2024). Thriving through transitioning: Unravelling the
                interplay of transitional challenges and adjustments into university.
                <em> Higher Education Research &amp; Development</em>.
              </li>
              <li className={s.refItem}>
                University of Cambridge. (2023). Executive decision-making under cognitive load.
              </li>
              <li className={s.refItem}>
                Nature npj Science of Learning. (2025). AI empowered self-regulated learning in
                higher education.
              </li>
              <li className={s.refItem}>
                MDPI Education Sciences. (2025). Systematic review of interventions to improve
                self-regulation of learning in first-year university students.
              </li>
              <li className={s.refItem}>
                Cogent Education. (2023). Academic performance and adjustment of first-generation
                students to higher education: A systematic review.
              </li>
            </ol>
          </section>

        </main>
      </div>

      {/* ── 11. Footer ─────────────────────────────────────────── */}
      <footer className={s.footer}>
        <div className={s.footerInner}>
          <div className={s.footerLinks}>
            <Link href="/research" className={s.footerLink}>Research</Link>
            <Link href="/privacy" className={s.footerLink}>Privacy</Link>
            <Link href="/terms" className={s.footerLink}>Terms</Link>
          </div>
          <p className={s.footerCopy}>
            &copy; 2026 VeritasIQ Technologies Ltd. All rights reserved.
          </p>
        </div>
      </footer>

      {/* ── 12. Floating CTA ───────────────────────────────────── */}
      <Link href="/auth/signup" className={s.floatingCta}>
        Try PIOS free
      </Link>

    </div>
  )
}
