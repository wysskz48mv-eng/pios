'use client'
import { AiChat } from '@/components/layout/AiChat'
export default function AiPage() {
  return (
    <div className="fade-in">
      <div style={{ marginBottom:'24px' }}>
        <h1 style={{ fontSize:'22px', fontWeight:700, marginBottom:'4px' }}>AI Companion</h1>
        <p style={{ fontSize:'13px', color:'var(--pios-muted)' }}>Your cross-domain intelligence layer · claude-sonnet-4</p>
      </div>
      <div style={{ maxWidth:'720px', margin:'0 auto' }}>
        <div style={{ height:'calc(100vh - 200px)', display:'flex', flexDirection:'column', background:'var(--pios-surface)', borderRadius:'12px', border:'1px solid rgba(167,139,250,0.2)', overflow:'hidden' }}>
          <AiChat isOpen={true} onClose={()=>{}} />
        </div>
      </div>
    </div>
  )
}
