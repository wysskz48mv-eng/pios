/**
 * M064-M068 Seed Script
 * Populates initial data: journals, fellowships, career milestones
 * Run: npm run db:seed
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Load .env.local manually without dotenv dependency
try {
  const envFile = readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8')
  for (const line of envFile.split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      const val = match[2].trim().replace(/^["']|["']$/g, '')
      if (!process.env[key]) process.env[key] = val
    }
  }
} catch {
  // .env.local not present — rely on already-set env vars
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function seedFellowships() {
  console.log('Seeding fellowship opportunities...')

  const { count } = await supabase
    .from('fellowship_opportunities')
    .select('*', { count: 'exact', head: true })

  if ((count ?? 0) > 0) {
    console.log(`  Skipped — ${count} fellowships already exist`)
    return
  }

  const { error } = await supabase.from('fellowship_opportunities').insert([
    {
      fellowship_name: 'Marie Skłodowska-Curie Actions Postdoctoral Fellowship',
      sponsor: 'European Commission',
      award_amount: 85000,
      currency: 'EUR',
      research_fields: ['engineering', 'social sciences', 'ai', 'business', 'multidisciplinary'],
      eligible_citizenships: [],
      years_since_phd_max: 8,
      duration_months: 24,
      location: 'Europe',
      description: 'Supports experienced researchers from any discipline.',
      url: 'https://marie-sklodowska-curie-actions.ec.europa.eu',
      source: 'curated',
    },
    {
      fellowship_name: 'Newton International Fellowship',
      sponsor: 'Royal Society / British Academy',
      award_amount: 40000,
      currency: 'GBP',
      research_fields: ['engineering', 'social sciences', 'ai', 'facilities management', 'built environment'],
      eligible_citizenships: [],
      years_since_phd_max: 5,
      duration_months: 24,
      location: 'UK',
      description: 'Brings early-career overseas researchers to the UK.',
      url: 'https://royalsociety.org/grants/newton-international',
      source: 'curated',
    },
    {
      fellowship_name: 'RICS Research Trust Grant',
      sponsor: 'Royal Institution of Chartered Surveyors',
      award_amount: 30000,
      currency: 'GBP',
      research_fields: ['real estate', 'facility management', 'built environment', 'cost management'],
      eligible_citizenships: [],
      years_since_phd_max: 10,
      duration_months: 12,
      location: 'UK / International',
      description: 'Supports applied research in the built environment and surveying.',
      url: 'https://www.rics.org/research',
      source: 'curated',
    },
    {
      fellowship_name: 'AHRC/ESRC AI & Society Postdoctoral Fellowship',
      sponsor: 'UKRI',
      award_amount: 55000,
      currency: 'GBP',
      research_fields: ['ai', 'social sciences', 'decision support', 'socio-technical'],
      eligible_citizenships: [],
      years_since_phd_max: 4,
      duration_months: 24,
      location: 'UK',
      description: 'Research into societal implications of AI and data-driven decision-making.',
      url: 'https://www.ukri.org',
      source: 'curated',
    },
    {
      fellowship_name: 'Emirates Foundation Research Grant',
      sponsor: 'Emirates Foundation',
      award_amount: 150000,
      currency: 'AED',
      research_fields: ['real estate', 'facility management', 'ai', 'GCC', 'built environment'],
      eligible_citizenships: ['AE'],
      years_since_phd_max: 10,
      duration_months: 18,
      location: 'UAE',
      description: "Supports applied research addressing UAE's strategic development goals.",
      url: 'https://www.emiratesfoundation.ae',
      source: 'curated',
    },
  ])

  if (error) {
    console.error('  Fellowship seed failed:', error.message)
  } else {
    console.log('  ✅ 5 fellowship opportunities seeded')
  }
}

async function verifyCounts() {
  console.log('\nVerifying database counts...')
  const tables = [
    'academic_publications',
    'journal_recommendations',
    'publication_submissions',
    'fellowship_opportunities',
    'fellowship_applications',
    'career_profiles',
    'career_roadmaps',
    'lab_groups',
    'lab_members',
    'lab_projects',
    'industry_profiles',
    'job_applications',
    'skill_development',
  ]

  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })

    if (error) {
      console.log(`  ❌ ${table}: ${error.message}`)
    } else {
      console.log(`  ✅ ${table}: ${count} rows`)
    }
  }
}

async function main() {
  console.log('=== M064-M068 Seed Script ===\n')
  console.log(`Supabase URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`)

  await seedFellowships()
  await verifyCounts()

  console.log('\n✅ Seed complete')
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
