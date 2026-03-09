'use client'
import { useRef, useCallback } from 'react'

export interface Corner { x: number; y: number }

interface Props {
  corners: Corner[]
  onChange: (corners: Corner[]) => void
}

// Bigger handle radius for easier touch on phones
const HANDLE_R = 24  // visible circle
const HANDLE_TOUCH_R = 36  // invisible larger touch target

export function PerspectiveOverlay({ corners, onChange }: Props) {
  const dragging = useRef<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const toSVGPoint = useCallback((e: React.PointerEvent): Corner => {
    const rect = svgRef.current!.getBoundingClientRect()
    return {
      x: Math.min(Math.max(((e.clientX - rect.left) / rect.width) * 100, 0), 100),
      y: Math.min(Math.max(((e.clientY - rect.top) / rect.height) * 100, 0), 100),
    }
  }, [])

  const onHandleDown = useCallback((e: React.PointerEvent, index: number) => {
    e.stopPropagation()
    e.preventDefault()
    dragging.current = index
      ; (e.target as Element).setPointerCapture(e.pointerId)
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (dragging.current === null) return
    e.stopPropagation()
    const pt = toSVGPoint(e)
    const next = corners.map((c, i) => i === dragging.current ? pt : c)
    onChange(next)
  }, [corners, onChange, toSVGPoint])

  const onPointerUp = useCallback(() => {
    dragging.current = null
  }, [])

  // Polygon path from corners (percentage-based viewBox 0 0 100 100)
  const points = corners.map(c => `${c.x},${c.y}`).join(' ')

  const LABEL_ICONS = ['↖', '↗', '↘', '↙']

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        zIndex: 30,
        overflow: 'visible',
        touchAction: 'none',
      }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      {/* Quad outline */}
      <polygon
        points={points}
        fill="rgba(255,107,53,0.06)"
        stroke="rgba(255,107,53,0.5)"
        strokeWidth="0.5"
        strokeDasharray="2 1.5"
      />

      {/* Corner handles */}
      {corners.map((c, i) => (
        <g
          key={i}
          onPointerDown={(e) => onHandleDown(e, i)}
          style={{ cursor: 'grab' }}
        >
          {/* Large transparent hit area */}
          <circle
            cx={c.x} cy={c.y}
            r={HANDLE_TOUCH_R * (100 / window.innerWidth) * 100}
            fill="transparent"
          />
          {/* Outer glow ring */}
          <circle
            cx={c.x} cy={c.y}
            r={HANDLE_R * (100 / Math.min(window.innerWidth, window.innerHeight)) * 50}
            fill="rgba(255,107,53,0.18)"
            stroke="rgba(255,107,53,0.6)"
            strokeWidth="0.4"
          />
          {/* Inner handle */}
          <circle
            cx={c.x} cy={c.y}
            r={HANDLE_R * (100 / Math.min(window.innerWidth, window.innerHeight)) * 30}
            fill="rgba(255,107,53,0.95)"
            stroke="white"
            strokeWidth="0.5"
          />
          {/* Arrow icon */}
          <text
            x={c.x} y={c.y}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={HANDLE_R * (100 / Math.min(window.innerWidth, window.innerHeight)) * 18}
            fill="white"
            fontWeight="600"
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            {LABEL_ICONS[i]}
          </text>
        </g>
      ))}
    </svg>
  )
}
