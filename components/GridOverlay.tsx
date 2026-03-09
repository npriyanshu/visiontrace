'use client'

export type GridMode = 'none' | '3x3' | '10x10'

export function GridOverlay({ mode }: { mode: GridMode }) {
  if (mode === 'none') return null

  const divisions = mode === '3x3' ? 3 : 10
  const lines = []

  for (let i = 1; i < divisions; i++) {
    const pct = (i / divisions) * 100

    // Vertical
    lines.push(
      <line
        key={`v${i}`}
        x1={`${pct}%`} y1="0%"
        x2={`${pct}%`} y2="100%"
        stroke={mode === '3x3' ? 'rgba(79,195,247,0.55)' : 'rgba(79,195,247,0.3)'}
        strokeWidth={mode === '3x3' ? '1.2' : '0.7'}
      />
    )
    // Horizontal
    lines.push(
      <line
        key={`h${i}`}
        x1="0%" y1={`${pct}%`}
        x2="100%" y2={`${pct}%`}
        stroke={mode === '3x3' ? 'rgba(79,195,247,0.55)' : 'rgba(79,195,247,0.3)'}
        strokeWidth={mode === '3x3' ? '1.2' : '0.7'}
      />
    )
  }

  return (
    <svg
      style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none',
        zIndex: 20,
      }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {lines}
      {/* Border */}
      <rect
        x="1" y="1"
        width="calc(100% - 2px)" height="calc(100% - 2px)"
        fill="none"
        stroke="rgba(79,195,247,0.25)"
        strokeWidth="1"
      />
    </svg>
  )
}
