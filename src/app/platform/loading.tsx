export default function PlatformLoading() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '60vh',
    }}>
      <div style={{
        width: 24, height: 24,
        border: '2px solid rgba(167,139,250,0.15)',
        borderTop: '2px solid #a78bfa',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
    </div>
  )
}
