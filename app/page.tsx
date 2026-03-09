'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useCamera } from '@/hooks/useCamera'
import { useAutoHide } from '@/hooks/useAutoHide'
import { usePWA } from '@/hooks/usePWA'
import { useOpticalFlowTracker } from '@/hooks/useOpticalFlowTracker'
import { GridOverlay, GridMode } from '@/components/GridOverlay'
import { PerspectiveOverlay, Corner } from '@/components/PerspectiveOverlay'
import { HudButton } from '@/components/HudButton'
import { AnchorStatusBar } from '@/components/AnchorStatusBar'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Transform { x: number; y: number; scale: number; rotation: number }

const DEFAULT_TRANSFORM: Transform = { x: 0, y: 0, scale: 1, rotation: 0 }
const DEFAULT_CORNERS: Corner[] = [
  { x: 5, y: 5 }, { x: 95, y: 5 },
  { x: 95, y: 95 }, { x: 5, y: 95 },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getDistance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(b.x - a.x, b.y - a.y)

const getAngle = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI)

// ─── Icons ────────────────────────────────────────────────────────────────────
const Icon = {
  plus: '＋',
  image: '🖼',
  lock: '🔒',
  unlock: '🔓',
  grid: '⊞',
  perspective: '⬡',
  reset: '↺',
  anchorOn: '◉',
  anchorOff: '⊕',
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function Page() {
  usePWA()

  const { videoRef, status: camStatus } = useCamera()

  // Reference image
  const [imgSrc, setImgSrc] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Manual transform (user drag/pinch)
  const [transform, setTransform] = useState<Transform>(DEFAULT_TRANSFORM)

  // Gesture tracking refs
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map())
  const lastDist = useRef<number | null>(null)
  const lastAngle = useRef<number | null>(null)
  const lastMid = useRef<{ x: number; y: number } | null>(null)

  // UI state
  const [opacity, setOpacity] = useState(0.75)
  const [isLocked, setIsLocked] = useState(false)
  const [gridMode, setGridMode] = useState<GridMode>('none')
  const [perspective, setPerspective] = useState(false)
  const [corners, setCorners] = useState<Corner[]>(DEFAULT_CORNERS)
  const [lockBanner, setLockBanner] = useState(false)

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { visible: uiVisible, show: showUI } = useAutoHide(isLocked)

  // ── AR Anchor (Optical Flow) ──────────────────────────────────────────────
  const { status: anchorStatus, delta, libReady, startTargeting, lockAnchor, stopTracking } =
    useOpticalFlowTracker(videoRef)

  const [anchorActive, setAnchorActive] = useState(false)

  // Store the image transform AT THE MOMENT we start tracking
  // so we can apply AR delta on top of it
  const baseLockTransform = useRef<Transform>(DEFAULT_TRANSFORM)
  useEffect(() => {
    if (anchorStatus === 'searching') {
      baseLockTransform.current = { ...transform }
    }
  }, [anchorStatus]) // intentionally NOT including transform — only want snapshot at moment of locking

  // Compute the EFFECTIVE transform to render:
  // - When AR locked/lost: apply delta on top of base transform
  // - Otherwise: use manual transform
  const arActive = anchorActive && (anchorStatus === 'locked' || anchorStatus === 'lost' || anchorStatus === 'searching')

  const displayTransform: Transform = arActive && (anchorStatus === 'locked' || anchorStatus === 'lost')
    ? {
      x: baseLockTransform.current.x + delta.dx,
      y: baseLockTransform.current.y + delta.dy,
      scale: baseLockTransform.current.scale,
      rotation: baseLockTransform.current.rotation,
    }
    : transform

  const imgTransform = `translate(${displayTransform.x}px, ${displayTransform.y}px) scale(${displayTransform.scale}) rotate(${displayTransform.rotation}deg)`

  // ── Lock banner ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (isLocked) {
      setLockBanner(true)
      const t = setTimeout(() => setLockBanner(false), 2500)
      return () => clearTimeout(t)
    } else {
      setLockBanner(false)
    }
  }, [isLocked])

  // ── File picker ───────────────────────────────────────────────────────────
  const pickImage = useCallback(() => { fileRef.current?.click() }, [])

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setImgSrc(url)
    setTransform(DEFAULT_TRANSFORM)
    setCorners(DEFAULT_CORNERS)
    showUI()
    e.target.value = ''
  }, [showUI])

  // ── Gesture handlers ──────────────────────────────────────────────────────
  const onImgPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)

    if (isLocked) {
      longPressTimer.current = setTimeout(() => {
        setIsLocked(false)
        if (navigator.vibrate) navigator.vibrate([50, 30, 50])
        showUI()
      }, 800)
      return
    }

    // Disable manual gestures when AR is controlling the transform
    if (arActive && anchorStatus === 'locked') return

    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values())
      lastDist.current = getDistance(a, b)
      lastAngle.current = getAngle(a, b)
      lastMid.current = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    }
    showUI()
  }, [isLocked, showUI, arActive, anchorStatus])

  const onImgPointerMove = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    if (isLocked || (arActive && anchorStatus === 'locked')) return
    if (!pointers.current.has(e.pointerId)) return

    const prev = pointers.current.get(e.pointerId)!
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const pts = Array.from(pointers.current.values())

    if (pts.length === 1) {
      const dx = e.clientX - prev.x
      const dy = e.clientY - prev.y
      setTransform(t => ({ ...t, x: t.x + dx, y: t.y + dy }))
    }

    if (pts.length === 2) {
      const [a, b] = pts
      const dist = getDistance(a, b)
      const angle = getAngle(a, b)
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      if (lastDist.current !== null) {
        const scaleDelta = dist / lastDist.current
        const rotDelta = angle - lastAngle.current!
        const panX = mid.x - lastMid.current!.x
        const panY = mid.y - lastMid.current!.y
        setTransform(t => ({
          x: t.x + panX,
          y: t.y + panY,
          scale: Math.min(Math.max(t.scale * scaleDelta, 0.05), 20),
          rotation: t.rotation + rotDelta,
        }))
      }
      lastDist.current = dist
      lastAngle.current = angle
      lastMid.current = mid
    }
    showUI()
  }, [isLocked, showUI, arActive, anchorStatus])

  const onImgPointerUp = useCallback((e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null }
    if (pointers.current.size < 2) { lastDist.current = null; lastAngle.current = null; lastMid.current = null }
  }, [])

  // ── Grid ──────────────────────────────────────────────────────────────────
  const cycleGrid = useCallback(() => {
    setGridMode(m => m === 'none' ? '3x3' : m === '3x3' ? '10x10' : 'none')
    showUI()
  }, [showUI])

  // ── Lock ──────────────────────────────────────────────────────────────────
  const toggleLock = useCallback(() => {
    setIsLocked(v => {
      const next = !v
      if (navigator.vibrate) navigator.vibrate(next ? 100 : 60)
      return next
    })
    showUI()
  }, [showUI])

  // ── Anchor toggle ─────────────────────────────────────────────────────────
  const toggleAnchor = useCallback(() => {
    if (!imgSrc) {
      alert("Please tap 'Load' to select a reference image to trace before locking an AR Anchor.")
      showUI()
      return
    }

    if (anchorActive) {
      // Deactivate: sync manual transform to wherever AR left it
      setTransform({ ...displayTransform })
      stopTracking()
      setAnchorActive(false)
    } else {
      // Activate: switch to targeting mode
      setAnchorActive(true)
      startTargeting()
    }
    showUI()
  }, [anchorActive, displayTransform, stopTracking, startTargeting, showUI])

  // ── Camera denied screen ──────────────────────────────────────────────────
  if (camStatus === 'denied' || camStatus === 'error') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100dvh', gap: 16, padding: 32,
        background: '#000', color: '#fff', textAlign: 'center',
      }}>
        <div style={{ fontSize: 48 }}>📷</div>
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 22, fontWeight: 700, letterSpacing: 2 }}>
          VisionTrace
        </div>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 1.6 }}>
          Camera access was denied.<br />
          Please allow camera access in your browser settings and reload.
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: 8, padding: '14px 32px', borderRadius: 14,
            background: '#ff6b35', border: 'none', color: '#000',
            fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15,
            cursor: 'pointer', touchAction: 'manipulation',
          }}
        >
          Retry
        </button>
      </div>
    )
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <main
      style={{
        position: 'relative', width: '100dvw', height: '100dvh',
        overflow: 'hidden', background: '#000',
        overscrollBehavior: 'none',
      }}
      onClick={showUI}
    >
      {/* ── Layer 1: Camera ───────────────────────────────────────────────── */}
      <video
        ref={videoRef}
        muted playsInline autoPlay
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover', zIndex: 1,
        }}
      />

      {/* ── Layer 2: Reference image ──────────────────────────────────────── */}
      {imgSrc && (
        <div
          onPointerDown={onImgPointerDown}
          onPointerMove={onImgPointerMove}
          onPointerUp={onImgPointerUp}
          onPointerCancel={onImgPointerUp}
          style={{
            position: 'absolute', inset: 0,
            zIndex: 10, touchAction: 'none',
            cursor: isLocked ? 'default' : (arActive && anchorStatus === 'locked') ? 'crosshair' : 'grab',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <img
            src={imgSrc}
            alt="Reference"
            draggable={false}
            style={{
              maxWidth: '100%', maxHeight: '100%',
              objectFit: 'contain',
              opacity: opacity,
              transform: imgTransform,
              transformOrigin: 'center center',
              userSelect: 'none', WebkitUserSelect: 'none',
              pointerEvents: 'none',
              willChange: 'transform',
              ...(perspective ? {
                clipPath: `polygon(
                  ${corners[0].x}% ${corners[0].y}%,
                  ${corners[1].x}% ${corners[1].y}%,
                  ${corners[2].x}% ${corners[2].y}%,
                  ${corners[3].x}% ${corners[3].y}%
                )`,
              } : {}),
            }}
          />
        </div>
      )}

      {/* ── Layer 3: Perspective handles ──────────────────────────────────── */}
      {perspective && imgSrc && <PerspectiveOverlay corners={corners} onChange={setCorners} />}

      {/* ── Layer 4: Grid ─────────────────────────────────────────────────── */}
      <GridOverlay mode={gridMode} />

      {/* ── Layer 5: AR status pill ───────────────────────────────────────── */}
      {anchorActive && (
        <AnchorStatusBar status={anchorStatus} libReady={libReady} />
      )}

      {/* ── Layer 6: Center Targeting Crosshair & Re-anchor hint ────────────── */}
      {anchorActive && anchorStatus === 'searching' && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none', zIndex: 55,
        }}>
          {/* Subtle overlay box showing tracking region */}
          <div style={{
            width: 80, height: 80, border: '2px solid rgba(251, 191, 36, 0.5)',
            position: 'relative',
          }}>
            {/* Crosshair inside */}
            <div style={{ position: 'absolute', width: 2, height: 20, background: '#fbbf24', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
            <div style={{ position: 'absolute', width: 20, height: 2, background: '#fbbf24', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
          </div>

          <button
            onClick={() => { lockAnchor(0.5, 0.5); showUI(); }}
            style={{
              pointerEvents: 'auto',
              marginTop: 40,
              padding: '12px 32px', borderRadius: 24,
              background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', border: 'none',
              color: '#000', fontFamily: 'Syne, sans-serif',
              fontSize: 16, fontWeight: 800, cursor: 'pointer',
              touchAction: 'manipulation',
              boxShadow: '0 4px 16px rgba(251, 191, 36, 0.4)',
            }}
          >
            {Icon.lock} Lock Here
          </button>
        </div>
      )}

      {anchorActive && anchorStatus === 'lost' && (
        <div style={{
          position: 'absolute', bottom: 100, left: '50%',
          transform: 'translateX(-50%)', zIndex: 55,
          whiteSpace: 'nowrap',
        }}>
          <button
            onClick={() => { startTargeting(); showUI() }}
            style={{
              padding: '10px 20px', borderRadius: 24,
              background: 'rgba(255,107,53,0.9)', border: 'none',
              color: '#fff', fontFamily: 'DM Mono, monospace',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              touchAction: 'manipulation',
              boxShadow: '0 4px 16px rgba(255,107,53,0.4)',
            }}
          >
            ⌖ Aim Again
          </button>
        </div>
      )}

      {/* ── Layer 7: Lock banner ──────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', bottom: 100, left: '50%',
        transform: 'translateX(-50%)', zIndex: 50,
        transition: 'opacity 0.35s ease',
        opacity: lockBanner ? 1 : 0,
        pointerEvents: 'none', whiteSpace: 'nowrap',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(239,83,80,0.9)', backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)', borderRadius: 28,
          padding: '12px 22px', fontSize: 13, fontWeight: 600,
          color: '#fff', boxShadow: '0 4px 20px rgba(239,83,80,0.4)',
        }}>
          🔒 Tracing Locked — Long press to unlock
        </div>
      </div>

      {/* ── Layer 8: HUD ──────────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 40,
        pointerEvents: 'none', transition: 'opacity 0.4s ease',
        opacity: uiVisible ? 1 : (isLocked ? 0.15 : 0),
      }}>
        {/* Top toolbar */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          padding: '52px 16px 14px',
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.82) 0%, transparent 100%)',
          pointerEvents: uiVisible ? 'auto' : (isLocked ? 'auto' : 'none'),
          flexWrap: 'nowrap', overflowX: 'auto',
        }}>
          {/* App name */}
          <div style={{
            fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 800,
            letterSpacing: '3px', color: '#ff6b35', marginRight: 2,
            textTransform: 'uppercase', flexShrink: 0,
          }}>VT</div>

          {/* Load image */}
          <HudButton onClick={pickImage} label={imgSrc ? 'Swap' : 'Load'}>
            {imgSrc ? Icon.image : Icon.plus}
          </HudButton>
          <input
            ref={fileRef} type="file" accept="image/*"
            onChange={onFileChange} style={{ display: 'none' }}
          />

          {/* Tracing lock */}
          <HudButton onClick={toggleLock} active={isLocked} danger={isLocked}
            label={isLocked ? 'Locked' : 'Lock'}>
            {isLocked ? Icon.lock : Icon.unlock}
          </HudButton>

          {/* AR Anchor */}
          <HudButton
            onClick={toggleAnchor}
            active={anchorActive}
            label={anchorActive ? (anchorStatus === 'locked' ? 'AR On' : 'AR…') : 'Anchor'}
            style={{
              border: anchorActive && anchorStatus === 'locked'
                ? '1px solid rgba(34,197,94,0.7)'
                : undefined,
              background: anchorActive && anchorStatus === 'locked'
                ? 'rgba(34,197,94,0.22)'
                : undefined,
              color: anchorActive && anchorStatus === 'locked'
                ? '#22c55e'
                : undefined,
            }}
          >
            {anchorActive ? Icon.anchorOn : Icon.anchorOff}
          </HudButton>

          {/* Grid */}
          <HudButton onClick={cycleGrid} active={gridMode !== 'none'}
            label={gridMode === 'none' ? 'Grid' : gridMode}>
            {Icon.grid}
          </HudButton>

          {/* Perspective */}
          <HudButton
            onClick={() => { setPerspective(v => !v); showUI() }}
            active={perspective} label="Persp">
            {Icon.perspective}
          </HudButton>

          <div style={{ flex: 1, minWidth: 8 }} />

          {/* Reset */}
          <HudButton
            onClick={() => {
              setTransform(DEFAULT_TRANSFORM)
              setCorners(DEFAULT_CORNERS)
              if (anchorActive) { stopTracking(); setAnchorActive(false) }
              showUI()
            }}
            label="Reset">
            {Icon.reset}
          </HudButton>
        </div>

        {/* ── Opacity slider ───────────────────────────────────────────── */}
        {imgSrc && (
          <div style={{
            position: 'absolute', right: 12, top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            pointerEvents: uiVisible ? 'auto' : 'none',
          }}>
            <span style={{ fontSize: 9, fontFamily: 'DM Mono, monospace', color: 'rgba(255,255,255,0.6)', letterSpacing: 1 }}>
              {Math.round(opacity * 100)}%
            </span>
            <VerticalSlider value={opacity} onChange={setOpacity} onInteract={showUI} />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>◑</span>
          </div>
        )}

        {/* ── Bottom status strip ──────────────────────────────────────── */}
        {imgSrc && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            padding: '12px 20px 36px',
            display: 'flex', justifyContent: 'space-around',
            background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)',
            pointerEvents: 'none',
          }}>
            {[
              ['Opacity', `${Math.round(opacity * 100)}%`],
              ['Scale', `${displayTransform.scale.toFixed(1)}×`],
              ['Rotate', `${Math.round(displayTransform.rotation)}°`],
              ['AR', anchorActive ? (anchorStatus === 'locked' ? '🔵' : '…') : 'Off'],
            ].map(([label, value]) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontFamily: 'DM Mono, monospace', letterSpacing: 1 }}>{label}</div>
                <div style={{ fontSize: 13, color: '#fff', fontWeight: 600, fontFamily: 'DM Mono, monospace' }}>{value}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── No image placeholder ──────────────────────────────────────────── */}
      {!imgSrc && camStatus === 'active' && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 5,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none', gap: 14,
        }}>
          <div style={{
            fontFamily: 'Syne, sans-serif', fontSize: 32, fontWeight: 800,
            letterSpacing: '6px', color: '#ff6b35', textTransform: 'uppercase',
          }}>VisionTrace</div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', fontFamily: 'DM Mono, monospace', letterSpacing: '1px' }}>
            tap Load to add a reference image
          </div>
        </div>
      )}

    </main>
  )
}

// ─── Custom Vertical Slider ───────────────────────────────────────────────────
interface SliderProps {
  value: number
  onChange: (v: number) => void
  onInteract: () => void
}
function VerticalSlider({ value, onChange, onInteract }: SliderProps) {
  const TRACK_H = 180
  const trackRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const getVal = useCallback((e: React.PointerEvent | PointerEvent) => {
    const rect = trackRef.current!.getBoundingClientRect()
    return 1 - Math.min(Math.max((e.clientY - rect.top) / TRACK_H, 0), 1)
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation()
    dragging.current = true
      ; (e.target as Element).setPointerCapture(e.pointerId)
    onChange(getVal(e)); onInteract()
  }, [getVal, onChange, onInteract])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return
    e.preventDefault()
    onChange(getVal(e)); onInteract()
  }, [getVal, onChange, onInteract])

  const onPointerUp = useCallback(() => { dragging.current = false }, [])

  const thumbY = (1 - value) * TRACK_H

  return (
    <div
      ref={trackRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        position: 'relative', width: 44, height: TRACK_H,
        cursor: 'ns-resize', touchAction: 'none',
        display: 'flex', justifyContent: 'center',
      }}
    >
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 6, borderRadius: 3, background: 'rgba(255,255,255,0.12)' }} />
      <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 6, height: `${value * 100}%`, borderRadius: 3, background: 'linear-gradient(to top, #ff6b35, rgba(255,107,53,0.4))' }} />
      <div style={{ position: 'absolute', left: '50%', top: thumbY, transform: 'translate(-50%, -50%)', width: 26, height: 26, borderRadius: '50%', background: '#ff6b35', border: '2.5px solid white', boxShadow: '0 2px 10px rgba(255,107,53,0.6)' }} />
    </div>
  )
}
