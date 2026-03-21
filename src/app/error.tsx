'use client'
import { useEffect } from 'react'
import Link from 'next/link'
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('PIOS Error:', error) }, [error])
  return (
    <div style={{ minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0f0f0f',color:'#f5f5f5',fontFamily:'system-ui' }}>
      <div style={{ textAlign:'center',padding:'2rem',maxWidth:'400px' }}>
        <div style={{ fontSize:'3rem',marginBottom:'1rem' }}>⚠</div>
        <h1 style={{ fontSize:'1.25rem',fontWeight:600,marginBottom:'0.5rem' }}>Something went wrong</h1>
        <p style={{ color:'#888',fontSize:'0.875rem',marginBottom:'1.5rem' }}>{error.message ?? 'An unexpected error occurred.'}</p>
        {error.digest && <p style={{ fontFamily:'monospace',fontSize:'0.7rem',color:'#555',marginBottom:'1rem' }}>ref: {error.digest}</p>}
        <div style={{ display:'flex',gap:'0.75rem',justifyContent:'center' }}>
          <button onClick={reset} style={{ padding:'0.5rem 1rem',background:'#6366f1',color:'#fff',border:'none',borderRadius:'0.375rem',cursor:'pointer',fontSize:'0.875rem',fontWeight:500 }}>
            Try again
          </button>
          <Link href="/platform/dashboard" style={{ padding:'0.5rem 1rem',background:'transparent',color:'#aaa',border:'1px solid #333',borderRadius:'0.375rem',fontSize:'0.875rem',textDecoration:'none' }}>
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
