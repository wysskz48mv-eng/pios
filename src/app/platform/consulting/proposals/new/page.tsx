'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewProposalPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/proposals', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ title: 'Untitled proposal' }),
        });
        const data = await res.json();
        const proposalId = data?.proposal?.id;
        if (!res.ok || !proposalId) throw new Error(data?.error ?? 'Failed to create proposal');
        if (mounted) router.replace(`/platform/consulting/proposals/${proposalId}`);
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : 'Failed to create proposal');
      }
    })();
    return () => {
      mounted = false;
    };
  }, [router]);

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px' }}>
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>Creating proposal…</h1>
      {!error ? (
        <p style={{ color: 'var(--pios-muted)' }}>Preparing the AI Proposal Workbench.</p>
      ) : (
        <div>
          <p style={{ color: 'var(--dng)' }}>{error}</p>
          <button
            onClick={() => router.refresh()}
            style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--pios-border)' }}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
