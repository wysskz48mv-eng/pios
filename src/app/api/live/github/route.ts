import { NextResponse } from 'next/server'

// GET /api/live/github
// Pulls recent commits from VeritasEdge™ and InvestiScript repos
// Uses PAT stored as GITHUB_PAT env var

export const runtime = 'nodejs'

const REPOS = [
  { key: 'veritasedge',  repo: 'wysskz48mv-eng/sustainedge',   label: 'VeritasEdge™' }  // GitHub repo slug unchanged,
  { key: 'investiscript', repo: 'wysskz48mv-eng/investiscript', label: 'InvestiScript' },
  { key: 'pios',          repo: 'wysskz48mv-eng/pios',          label: 'PIOS' },
]

export async function GET() {
  const pat = process.env.GITHUB_PAT
  if (!pat) {
    return NextResponse.json({ connected: false, error: 'GITHUB_PAT not configured', repos: {} })
  }

  const headers = {
    Authorization: `Bearer ${pat}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }

  const results: Record<string, any> = {}

  await Promise.all(REPOS.map(async ({ key, repo, label }) => {
    try {
      const [commitsRes, repoRes] = await Promise.all([
        fetch(`https://api.github.com/repos/${repo}/commits?per_page=5`, { headers }),
        fetch(`https://api.github.com/repos/${repo}`, { headers }),
      ])

      if (!commitsRes.ok) {
        results[key] = { label, connected: false, error: `GitHub ${commitsRes.status}` }
        return
      }

      const commits = await commitsRes.json()
      const repoData = repoRes.ok ? await repoRes.json() : {}

      results[key] = {
        label,
        connected: true,
        head: commits[0]?.sha?.slice(0, 7) ?? null,
        defaultBranch: repoData.default_branch ?? 'main',
        openIssues: repoData.open_issues_count ?? 0,
        commits: commits.map((c: Record<string, unknown>) => ({
          sha: c.sha?.slice(0, 7),
          message: c.commit?.message?.split('\n')[0] ?? '',
          author: c.commit?.author?.name ?? '',
          date: c.commit?.author?.date ?? '',
          url: c.html_url,
        })),
      }
    } catch (err: unknown) {
      results[key] = { label, connected: false, error: err.message }
    }
  }))

  return NextResponse.json({ connected: true, repos: results, pulledAt: new Date().toISOString() })
}
