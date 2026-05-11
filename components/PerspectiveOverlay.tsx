'use client'
import { useRef, useCallback, useMemo } from 'react'

export interface Corner { x: number; y: number }

interface Props {
  corners: Corner[]
  onChange: (corners: Corner[]) => void
}

const HANDLE_R = 24
const HANDLE_TOUCH_R = 36
const VIEWBOX = 100

function computeScaleFactor() {
  if (typeof window === 'undefined') return 1
  return VIEWBOX / Math.min(window.innerWidth, window.innerHeight) / 2
}

export function PerspectiveOverlay({ corners, onChange }: Props) {
  const dragging = useRef<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const scaleFactor = useMemo(computeScaleFactor, [])

  const toSVGPoint = useCallback((e: React.PointerEvent): Corner => {
    const rect = svgRef.current!.getBoundingClientRect()
    return {
      x: Math.min(Math.max(((e.clientX - rect.left) / rect.width) * VIEWBOX, 0), VIEWBOX),
      y: Math.min(Math.max(((e.clientY - rect.top) / rect.height) * VIEWBOX, 0), VIEWBOX),
    }
  }, [])

  const onHandleDown = useCallback((e: React.PointerEvent, index: number) => {
    e.stopPropagation()
    e.preventDefault()
    dragging.current = index
    ;(e.target as Element).setPointerCapture(e.pointerId)
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

  const points = corners.map(c => `${c.x},${c.y}`).join(' ')

  const LABEL_ICONS = ['↖', '↗', '↘', '↙']

  const touchR = HANDLE_TOUCH_R * scaleFactor
  const outerR = HANDLE_R * scaleFactor
  const innerR = HANDLE_R * scaleFactor * 0.6
  const fontSz = HANDLE_R * scaleFactor * 0.6

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
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
      <polygon
        points={points}
        fill="rgba(255,107,53,0.06)"
        stroke="rgba(255,107,53,0.5)"
        strokeWidth="0.5"
        strokeDasharray="2 1.5"
      />

      {corners.map((c, i) => (
        <g
          key={i}
          onPointerDown={(e) => onHandleDown(e, i)}
          style={{ cursor: 'grab' }}
        >
          <circle
            cx={c.x} cy={c.y}
            r={touchR}
            fill="transparent"
          />
          <circle
            cx={c.x} cy={c.y}
            r={outerR}
            fill="rgba(255,107,53,0.18)"
            stroke="rgba(255,107,53,0.6)"
            strokeWidth="0.4"
          />
          <circle
            cx={c.x} cy={c.y}
            r={innerR}
            fill="rgba(255,107,53,0.95)"
            stroke="white"
            strokeWidth="0.5"
          />
          <text
            x={c.x} y={c.y}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={fontSz}
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
