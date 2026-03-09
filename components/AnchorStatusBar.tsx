'use client'

// AnchorStatusBar — animated pill showing AR lock state
// Rendered above everything else when anchor is active

export type AnchorStatus = 'idle' | 'searching' | 'locked' | 'lost'

interface Props {
    status: AnchorStatus
    libReady: boolean
}

const CONFIG = {
    searching: {
        bg: 'rgba(251, 191, 36, 0.92)',
        text: '#000',
        icon: '⌖',
        label: 'Point crosshair & tap Anchor to Lock',
        pulse: true,
    },
    locked: {
        bg: 'rgba(34, 197, 94, 0.92)',
        text: '#000',
        icon: '◉',
        label: 'Tracking Locked',
        pulse: false,
    },
    lost: {
        bg: 'rgba(239, 83, 80, 0.92)',
        text: '#fff',
        icon: '◎',
        label: 'Tracking lost — aim & tap Anchor again',
        pulse: true,
    },
    idle: null,
}

export function AnchorStatusBar({ status, libReady }: Props) {
    if (status === 'idle') return null

    const cfg = CONFIG[status]
    if (!cfg) return null

    const loadingMsg = !libReady && status === 'searching'
        ? 'Loading AR library…'
        : cfg.label

    return (
        <>
            <style>{`
        @keyframes vtPulse {
          0%, 100% { opacity: 1;    transform: translateX(-50%) scale(1); }
          50%       { opacity: 0.75; transform: translateX(-50%) scale(0.97); }
        }
        .vt-anchor-pill {
          position: absolute;
          top: 120px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 60;
          white-space: nowrap;
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 9px 18px;
          border-radius: 999px;
          font-family: 'DM Mono', monospace;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.3px;
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          box-shadow: 0 4px 20px rgba(0,0,0,0.35);
          pointer-events: none;
          animation: ${cfg.pulse ? 'vtPulse 1.4s ease-in-out infinite' : 'none'};
        }
        .vt-anchor-icon { font-size: 16px; line-height: 1; }
      `}</style>
            <div
                className="vt-anchor-pill"
                style={{ background: cfg.bg, color: cfg.text }}
            >
                <span className="vt-anchor-icon">{cfg.icon}</span>
                {loadingMsg}
            </div>
        </>
    )
}
