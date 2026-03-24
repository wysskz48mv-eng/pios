export default function Loading() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#0a0b0d',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 32, height: 32,
          border: '2px solid rgba(167,139,250,0.2)',
          borderTop: '2px solid #a78bfa',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          margin: '0 auto 12px',
        }} />
        <p style={{ fontSize: 12, color: '#555c70', letterSpacing: '0.08em' }}>PIOS</p>
      </div>
    </div>
  )
}
