import Link from 'next/link'
export default function NotFound() {
  return (
    <div style={{ minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0f0f0f',color:'#f5f5f5',fontFamily:'system-ui' }}>
      <div style={{ textAlign:'center',padding:'2rem' }}>
        <div style={{ fontSize:'5rem',fontWeight:700,color:'#333' }}>404</div>
        <h1 style={{ fontSize:'1.5rem',fontWeight:600,marginBottom:'0.75rem' }}>Page not found</h1>
        <p style={{ color:'#888',marginBottom:'1.5rem' }}>This page doesn't exist or has been moved.</p>
        <Link href="/platform/dashboard"
          style={{ display:'inline-block',padding:'0.625rem 1.25rem',background:'#6366f1',color:'#fff',borderRadius:'0.5rem',fontWeight:500,fontSize:'0.875rem',textDecoration:'none' }}>
          Back to Dashboard →
        </Link>
        <p style={{ marginTop:'2rem',fontSize:'0.75rem',color:'#555' }}>PIOS v1.0 · VeritasIQ Technologies Ltd</p>
      </div>
    </div>
  )
}
