'use client';

/**
 * ProposalWorkbench — AI-powered proposal editor for a single proposal.
 *
 * Layout (desktop, >1024px):
 *
 *   ┌────────────────────────────────────────────────────────────────┐
 *   │ HEADER: title · client · due date · status pill · progress bar │
 *   ├────────────────────┬───────────────────────────────────────────┤
 *   │ LEFT  (4 cols)     │ RIGHT (8 cols)                            │
 *   │ - Intake panel     │ Tabs:                                     │
 *   │   · drop RFP       │   1. Requirements ← AI-extracted          │
 *   │   · paste text     │   2. Draft sections ← AI-written markdown │
 *   │   · add URL        │   3. Commercials ← structured form        │
 *   │ - Ingest button    │   4. Outputs ← Word/PDF/PPT/Excel buttons │
 *   │ - Recent AI runs   │   5. Audit ← token/cost/run log           │
 *   └────────────────────┴───────────────────────────────────────────┘
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  OutputFormat,
  Priority,
  Proposal,
  ProposalAiRun,
  ProposalIntakeDocument,
  ProposalOutput,
  ProposalRequirement,
  ResponseStatus,
} from '@/lib/proposals/types';

type Bundle = {
  proposal: Proposal;
  intake_documents: ProposalIntakeDocument[];
  requirements: ProposalRequirement[];
  outputs: ProposalOutput[];
  recent_runs: ProposalAiRun[];
};

const OUTPUT_FORMATS: Array<{ format: OutputFormat; label: string; icon: string }> = [
  { format: 'docx', label: 'Word document', icon: '📄' },
  { format: 'pdf', label: 'PDF', icon: '📕' },
  { format: 'pptx', label: 'PowerPoint deck', icon: '📊' },
  { format: 'xlsx', label: 'Excel commercial schedule', icon: '📈' },
];

const PRIORITY_ORDER: Priority[] = ['mandatory', 'high', 'medium', 'low', 'nice_to_have'];

export function ProposalWorkbench({ proposalId }: { proposalId: string }) {
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [tab, setTab] = useState<'requirements' | 'draft' | 'commercials' | 'outputs' | 'audit'>('requirements');
  const [busy, setBusy] = useState<null | 'ingest' | 'draft' | 'render'>(null);
  const [ingestText, setIngestText] = useState('');
  const [ingestUrl, setIngestUrl] = useState('');
  const [selectedFormats, setSelectedFormats] = useState<OutputFormat[]>(['docx', 'pdf']);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/proposals/${proposalId}`);
    if (res.ok) setBundle((await res.json()) as Bundle);
  }, [proposalId]);

  useEffect(() => {
    refresh();
    const poll = setInterval(() => {
      if (
        bundle?.proposal?.generation_status &&
        ['ingesting', 'analysing', 'drafting', 'rendering'].includes(bundle.proposal.generation_status)
      ) {
        refresh();
      }
    }, 3000);
    return () => clearInterval(poll);
  }, [refresh, bundle?.proposal?.generation_status]);

  const handleIngest = async (mode: 'text' | 'url') => {
    setBusy('ingest');
    try {
      const body =
        mode === 'text'
          ? { source_type: 'brief', raw_text: ingestText }
          : { source_type: 'url', source_url: ingestUrl };
      await fetch(`/api/proposals/${proposalId}/ingest`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      setIngestText('');
      setIngestUrl('');
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const handleDraft = async () => {
    setBusy('draft');
    try {
      await fetch(`/api/proposals/${proposalId}/draft`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const handleRender = async () => {
    if (selectedFormats.length === 0) return;
    setBusy('render');
    try {
      await fetch(`/api/proposals/${proposalId}/render`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ formats: selectedFormats, kinds: ['full_proposal'] }),
      });
      await refresh();
      setTab('outputs');
    } finally {
      setBusy(null);
    }
  };

  const updateRequirement = async (
    id: string,
    patch: { our_response?: string; response_status?: ResponseStatus },
  ) => {
    await fetch(`/api/proposals/${proposalId}/requirements`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ requirement_id: id, ...patch }),
    });
    refresh();
  };

  const sortedReqs = useMemo(() => {
    if (!bundle) return [];
    return [...bundle.requirements].sort((a, b) => {
      const pa = PRIORITY_ORDER.indexOf(a.priority);
      const pb = PRIORITY_ORDER.indexOf(b.priority);
      if (pa !== pb) return pa - pb;
      return a.created_at.localeCompare(b.created_at);
    });
  }, [bundle]);

  if (!bundle) return <div className="p-8 text-slate-500">Loading proposal…</div>;

  const p = bundle.proposal;
  const isBusy = busy !== null || ['ingesting', 'analysing', 'drafting', 'rendering'].includes(p.generation_status);

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* HEADER */}
      <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{p.title}</h1>
            <p className="mt-1 text-sm text-slate-600">
              {p.client_org ?? 'No client set'} · {p.rfp_reference ?? 'No RFP ref'} ·{' '}
              {p.submission_due_at ? `Due ${new Date(p.submission_due_at).toLocaleDateString('en-GB')}` : 'No deadline'}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <StatusPill status={p.generation_status} />
            <p className="text-xs text-slate-500">
              {p.total_tokens_used.toLocaleString('en-GB')} tokens ·{' '}
              {p.ai_confidence !== null ? `${Math.round(p.ai_confidence * 100)}% confidence` : 'no confidence yet'}
            </p>
          </div>
        </div>
        {isBusy && (
          <div className="mt-4">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${p.generation_progress}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {p.generation_status} · {p.generation_progress}%
            </p>
          </div>
        )}
      </header>

      <div className="grid grid-cols-12 gap-4">
        {/* LEFT — intake */}
        <aside className="col-span-12 space-y-4 lg:col-span-4">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Brief / RFP intake</h2>
            <p className="mt-1 text-xs text-slate-500">
              Paste the client's brief, RFP, or meeting notes. PIOS will extract the problem statement,
              deliverables, evaluation criteria and deadlines.
            </p>
            <textarea
              className="mt-3 h-40 w-full resize-y rounded-lg border border-slate-200 p-2 text-sm"
              placeholder="Paste the RFP text here…"
              value={ingestText}
              onChange={(e) => setIngestText(e.target.value)}
            />
            <button
              disabled={isBusy || ingestText.trim().length < 20}
              onClick={() => handleIngest('text')}
              className="mt-2 w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {busy === 'ingest' ? 'Analysing…' : 'Ingest & extract requirements'}
            </button>

            <div className="my-4 border-t border-slate-100" />

            <label className="text-xs font-medium text-slate-600">Or from a URL</label>
            <input
              type="url"
              className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm"
              placeholder="https://…"
              value={ingestUrl}
              onChange={(e) => setIngestUrl(e.target.value)}
            />
            <button
              disabled={isBusy || !ingestUrl}
              onClick={() => handleIngest('url')}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-40"
            >
              Fetch URL
            </button>

            <p className="mt-3 text-xs text-slate-400">
              Tip: to attach a PDF or Word file, upload it to your PIOS vault first — the file picker is
              on the roadmap for M116.
            </p>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Attached briefs</h2>
            <ul className="mt-2 space-y-2">
              {bundle.intake_documents.length === 0 && (
                <li className="text-xs text-slate-400">No briefs attached yet.</li>
              )}
              {bundle.intake_documents.map((d) => (
                <li key={d.id} className="rounded-lg border border-slate-100 p-2 text-xs">
                  <div className="font-medium text-slate-700">
                    {d.original_filename ?? d.source_url ?? `${d.source_type} intake`}
                  </div>
                  <div className="text-slate-500">
                    {d.text_length?.toLocaleString('en-GB') ?? 0} chars · {d.extraction_status}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </aside>

        {/* RIGHT — tabs */}
        <main className="col-span-12 space-y-4 lg:col-span-8">
          <nav className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
            {(['requirements', 'draft', 'commercials', 'outputs', 'audit'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium capitalize ${
                  tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t}
              </button>
            ))}
          </nav>

          {tab === 'requirements' && (
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Extracted requirements ({sortedReqs.length})
                </h2>
                <button
                  disabled={isBusy || sortedReqs.length === 0}
                  onClick={handleDraft}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
                >
                  {busy === 'draft' ? 'Drafting sections…' : 'Draft proposal sections'}
                </button>
              </div>
              {sortedReqs.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">
                  No requirements yet — paste a brief on the left and click “Ingest”.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-slate-100">
                  {sortedReqs.map((r) => (
                    <li key={r.id} className="py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <PriorityPill priority={r.priority} />
                            <span className="text-xs uppercase text-slate-500">{r.requirement_type}</span>
                          </div>
                          <p className="mt-1 text-sm font-medium text-slate-900">{r.title}</p>
                          {r.detail && <p className="mt-0.5 text-xs text-slate-600">{r.detail}</p>}
                          {r.source_quote && (
                            <blockquote className="mt-1 border-l-2 border-slate-200 pl-2 text-xs italic text-slate-500">
                              {r.source_quote}
                              {r.source_page && <span className="ml-1 text-slate-400">({r.source_page})</span>}
                            </blockquote>
                          )}
                        </div>
                        <select
                          value={r.response_status}
                          onChange={(e) =>
                            updateRequirement(r.id, { response_status: e.target.value as ResponseStatus })
                          }
                          className="rounded-md border border-slate-200 px-2 py-1 text-xs"
                        >
                          <option value="unaddressed">Unaddressed</option>
                          <option value="drafted">Drafted</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="gap">Gap</option>
                        </select>
                      </div>
                      <textarea
                        placeholder="Our response to this requirement…"
                        defaultValue={r.our_response ?? ''}
                        onBlur={(e) => {
                          if (e.target.value !== (r.our_response ?? '')) {
                            updateRequirement(r.id, { our_response: e.target.value });
                          }
                        }}
                        className="mt-2 w-full rounded-md border border-slate-200 p-2 text-xs"
                        rows={2}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {tab === 'draft' && <DraftSections proposal={p} />}

          {tab === 'commercials' && <CommercialsForm proposalId={proposalId} proposal={p} onSaved={refresh} />}

          {tab === 'outputs' && (
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Generate output documents
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Select one or more formats. PIOS will render each one using the drafted content.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {OUTPUT_FORMATS.map((fmt) => {
                  const active = selectedFormats.includes(fmt.format);
                  return (
                    <button
                      key={fmt.format}
                      onClick={() =>
                        setSelectedFormats((prev) =>
                          prev.includes(fmt.format)
                            ? prev.filter((f) => f !== fmt.format)
                            : [...prev, fmt.format],
                        )
                      }
                      className={`flex items-center gap-2 rounded-lg border p-3 text-left text-sm ${
                        active ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-slate-200 text-slate-700'
                      }`}
                    >
                      <span className="text-xl">{fmt.icon}</span>
                      <span className="font-medium">{fmt.label}</span>
                    </button>
                  );
                })}
              </div>
              <button
                disabled={isBusy || selectedFormats.length === 0}
                onClick={handleRender}
                className="mt-4 w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                {busy === 'render' ? 'Rendering…' : `Render ${selectedFormats.length} document(s)`}
              </button>

              <div className="mt-6">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rendered files</h3>
                <ul className="mt-2 space-y-1 text-sm">
                  {bundle.outputs.length === 0 && (
                    <li className="text-xs text-slate-400">No outputs yet.</li>
                  )}
                  {bundle.outputs.map((o) => (
                    <li key={o.id} className="flex items-center justify-between rounded-md border border-slate-100 p-2">
                      <span>
                        <span className="font-mono text-xs uppercase">{o.output_format}</span> ·{' '}
                        {o.output_kind.replace(/_/g, ' ')} · v{o.version}
                      </span>
                      {o.render_status === 'ready' && o.public_url ? (
                        <a className="text-xs text-emerald-700 underline" href={o.public_url} target="_blank" rel="noreferrer">
                          Download
                        </a>
                      ) : (
                        <span className="text-xs text-slate-500">{o.render_status}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {tab === 'audit' && (
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">AI run log</h2>
              <table className="mt-2 w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="pb-1">When</th>
                    <th className="pb-1">Stage</th>
                    <th className="pb-1">Tier</th>
                    <th className="pb-1 text-right">Tokens</th>
                    <th className="pb-1 text-right">Latency</th>
                    <th className="pb-1">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bundle.recent_runs.map((r) => (
                    <tr key={r.id} className="border-t border-slate-100">
                      <td className="py-1 text-slate-500">{new Date(r.created_at).toLocaleTimeString('en-GB')}</td>
                      <td className="py-1">{r.stage}</td>
                      <td className="py-1 uppercase">{r.tier ?? '—'}</td>
                      <td className="py-1 text-right">{r.total_tokens?.toLocaleString('en-GB') ?? '—'}</td>
                      <td className="py-1 text-right">{r.latency_ms ?? '—'} ms</td>
                      <td className="py-1">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            r.status === 'success'
                              ? 'bg-emerald-100 text-emerald-800'
                              : r.status === 'fallback'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------
function StatusPill({ status }: { status: Proposal['generation_status'] }) {
  const colors: Record<Proposal['generation_status'], string> = {
    idle: 'bg-slate-100 text-slate-700',
    ingesting: 'bg-sky-100 text-sky-800',
    analysing: 'bg-sky-100 text-sky-800',
    drafting: 'bg-violet-100 text-violet-800',
    rendering: 'bg-amber-100 text-amber-800',
    ready: 'bg-emerald-100 text-emerald-800',
    failed: 'bg-rose-100 text-rose-800',
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status]}`}>
      {status}
    </span>
  );
}

function PriorityPill({ priority }: { priority: Priority }) {
  const colors: Record<Priority, string> = {
    mandatory: 'bg-rose-100 text-rose-800',
    high: 'bg-amber-100 text-amber-800',
    medium: 'bg-slate-100 text-slate-700',
    low: 'bg-slate-50 text-slate-500',
    nice_to_have: 'bg-slate-50 text-slate-400',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${colors[priority]}`}>
      {priority.replace(/_/g, ' ')}
    </span>
  );
}

function DraftSections({ proposal }: { proposal: Proposal }) {
  type Section = { key: string; label: string; content: string | null };
  const sections: Section[] = [
    { key: 'problem_statement', label: 'Problem statement', content: proposal.problem_statement },
    {
      key: 'proposed_approach',
      label: 'Proposed approach',
      content: (proposal.proposed_approach as { markdown?: string })?.markdown ?? null,
    },
    {
      key: 'deliverables',
      label: 'Deliverables',
      content: proposal.deliverables?.length
        ? proposal.deliverables.map((d) => `- **${d.title}** — ${d.description}`).join('\n')
        : null,
    },
    {
      key: 'risks',
      label: 'Risks',
      content: proposal.risks?.length
        ? proposal.risks.map((r) => `- **${r.risk}** (${r.likelihood}/${r.impact}) — ${r.mitigation}`).join('\n')
        : null,
    },
  ];

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Drafted sections</h2>
      {sections.every((s) => !s.content) ? (
        <p className="mt-4 text-sm text-slate-500">
          No draft yet. Click “Draft proposal sections” on the Requirements tab.
        </p>
      ) : (
        <div className="mt-3 space-y-4">
          {sections.map((s) => (
            <article key={s.key} className="rounded-lg border border-slate-100 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{s.label}</h3>
              <div className="prose prose-sm mt-1 max-w-none whitespace-pre-wrap text-sm text-slate-800">
                {s.content ?? <span className="text-slate-400">Not drafted.</span>}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function CommercialsForm({
  proposalId,
  proposal,
  onSaved,
}: {
  proposalId: string;
  proposal: Proposal;
  onSaved: () => void;
}) {
  const [dayRate, setDayRate] = useState<number | ''>(proposal.day_rate ?? '');
  const [estDays, setEstDays] = useState<number | ''>(proposal.estimated_days ?? '');
  const [currency, setCurrency] = useState(proposal.currency ?? 'GBP');

  const fee = useMemo(() => (typeof dayRate === 'number' && typeof estDays === 'number' ? dayRate * estDays : null), [
    dayRate,
    estDays,
  ]);

  const save = async () => {
    await fetch(`/api/proposals/${proposalId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        day_rate: dayRate === '' ? null : dayRate,
        estimated_days: estDays === '' ? null : estDays,
        currency,
        fee_gbp: fee,
      }),
    });
    onSaved();
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Commercials</h2>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <label className="text-xs font-medium text-slate-600">
          Day rate
          <input
            type="number"
            value={dayRate}
            onChange={(e) => setDayRate(e.target.value === '' ? '' : Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-slate-200 p-2 text-sm"
          />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Estimated days
          <input
            type="number"
            value={estDays}
            onChange={(e) => setEstDays(e.target.value === '' ? '' : Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-slate-200 p-2 text-sm"
          />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Currency
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-200 p-2 text-sm"
          >
            <option>GBP</option>
            <option>USD</option>
            <option>EUR</option>
            <option>SAR</option>
            <option>AED</option>
          </select>
        </label>
      </div>
      <p className="mt-3 text-sm text-slate-700">
        Total fee: <strong>{fee !== null ? `${currency} ${fee.toLocaleString('en-GB')}` : '—'}</strong>
      </p>
      <button
        onClick={save}
        className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
      >
        Save commercials
      </button>
    </section>
  );
}
