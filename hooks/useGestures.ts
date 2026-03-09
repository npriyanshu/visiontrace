'use client'
import { useCallback, useRef } from 'react'

export interface Transform {
  x:        number
  y:        number
  scale:    number
  rotation: number
}

interface PointerInfo {
  id: number
  x:  number
  y:  number
}

export function useGestures(
  onTransform: (delta: Partial<Transform>) => void,
  enabled: boolean = true,
) {
  const pointers = useRef<Map<number, PointerInfo>>(new Map())
  const lastDist = useRef<number | null>(null)
  const lastAngle = useRef<number | null>(null)
  const lastMid = useRef<{ x: number; y: number } | null>(null)

  const getDistance = (a: PointerInfo, b: PointerInfo) =>
    Math.hypot(b.x - a.x, b.y - a.y)

  const getAngle = (a: PointerInfo, b: PointerInfo) =>
    Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI)

  const getMid = (a: PointerInfo, b: PointerInfo) => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  })

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!enabled) return
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { id: e.pointerId, x: e.clientX, y: e.clientY })
    // Reset multi-touch refs
    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values())
      lastDist.current  = getDistance(a, b)
      lastAngle.current = getAngle(a, b)
      lastMid.current   = getMid(a, b)
    }
  }, [enabled])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!enabled) return
    if (!pointers.current.has(e.pointerId)) return

    pointers.current.set(e.pointerId, { id: e.pointerId, x: e.clientX, y: e.clientY })
    const pts = Array.from(pointers.current.values())

    if (pts.length === 1) {
      // Single finger — pan
      const prev = pointers.current.get(e.pointerId)!
      onTransform({ x: e.movementX, y: e.movementY })
    }

    if (pts.length === 2) {
      const [a, b] = pts
      const dist  = getDistance(a, b)
      const angle = getAngle(a, b)
      const mid   = getMid(a, b)

      if (lastDist.current !== null) {
        const scaleDelta    = dist / lastDist.current
        const rotationDelta = angle - lastAngle.current!
        const panX = mid.x - lastMid.current!.x
        const panY = mid.y - lastMid.current!.y

        onTransform({
          scale:    scaleDelta,
          rotation: rotationDelta,
          x:        panX,
          y:        panY,
        })
      }

      lastDist.current  = dist
      lastAngle.current = angle
      lastMid.current   = mid
    }
  }, [enabled, onTransform])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) {
      lastDist.current  = null
      lastAngle.current = null
      lastMid.current   = null
    }
  }, [])

  return { onPointerDown, onPointerMove, onPointerUp }
}
