'use client'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function VerifyContent() {
  const params = useSearchParams()
  const email  = params.get('email') ?? 'your email'
  return (
    <div style={{ minHeight:'100vh', background:'#0a0b0d', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ width:'100%', maxWidth:400, textAlign:'center' }}>
        <div style={{ width:64, height:64, borderRadius:16, background:'rgba(34,197,94,0.15)', border:'1px solid rgba(34,197,94,0.3)', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:28, marginBottom:20 }}>✉</div>
        <h1 style={{ fontSize:22, fontWeight:700, color:'#f1f5f9', marginBottom:8 }}>Check your email</h1>
        <p style={{ fontSize:14, color:'#64748b', lineHeight:1.65, marginBottom:24 }}>
          We sent a verification link to <strong style={{ color:'#94a3b8' }}>{email}</strong>. Click the link to activate your PIOS account.
        </p>
        <div style={{ padding:'16px', borderRadius:10, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', marginBottom:20 }}>
          <p style={{ fontSize:12, color:'#64748b', lineHeight:1.65, margin:0 }}>
            Didn't receive it? Check your spam folder. The link expires in 24 hours.
          </p>
        </div>
        <Link href="/auth/login" style={{ fontSize:13, color:'#a78bfa', textDecoration:'none', fontWeight:600 }}>← Back to sign in</Link>
      </div>
    </div>
  )
}

export default function VerifyPage() {
  return <Suspense fallback={null}><VerifyContent /></Suspense>
}
