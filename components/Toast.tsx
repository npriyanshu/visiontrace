'use client'

interface ToastProps {
  message: string
}

export function Toast({ message }: ToastProps) {
  return (
    <div
      id="vt-toast"
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 100,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,107,53,0.4)',
        borderRadius: 16,
        padding: '16px 28px',
        color: '#fff',
        fontFamily: 'DM Mono, monospace',
        fontSize: 14,
        fontWeight: 600,
        letterSpacing: 1,
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        animation: 'vtToastFade 3s ease forwards',
      }}
    >
      {message}
      <style>{`
        @keyframes vtToastFade {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
          10% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          80% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}
