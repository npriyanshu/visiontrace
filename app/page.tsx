'use client'

import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import { useCamera, CameraFacing } from '@/hooks/useCamera'
import { useAutoHide } from '@/hooks/useAutoHide'
import { usePWA } from '@/hooks/usePWA'
import { useOpticalFlowTracker, AnchorStatus } from '@/hooks/useOpticalFlowTracker'
import { GridOverlay, GridMode } from '@/components/GridOverlay'
import { PerspectiveOverlay, Corner } from '@/components/PerspectiveOverlay'
import { Toast } from '@/components/Toast'
import { BottomBar } from '@/components/BottomBar'

interface Transform { x: number; y: number; scale: number; rotation: number }

const DEFAULT_TRANSFORM: Transform = { x: 0, y: 0, scale: 1, rotation: 0 }
const DEFAULT_CORNERS: Corner[] = [
  { x: 5, y: 5 }, { x: 95, y: 5 },
  { x: 95, y: 95 }, { x: 5, y: 95 },
]
const MAX_HISTORY = 30

export default function Page() {
  usePWA()

  const [facing, setFacing] = useState<CameraFacing>('environment')
  const { videoRef, status: camStatus } = useCamera(facing)

  const [imgSrc, setImgSrc] = useState<string | null>(null)
  const blobUrlRef = useRef<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [transform, setTransform] = useState<Transform>(() => {
    if (typeof window !== 'undefined') {
      try {
        const s = localStorage.getItem('vt_transform')
        if (s) return JSON.parse(s)
      } catch {}
    }
    return DEFAULT_TRANSFORM
  })
  const [corners, setCorners] = useState<Corner[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const s = localStorage.getItem('vt_corners')
        if (s) return JSON.parse(s)
      } catch {}
    }
    return DEFAULT_CORNERS
  })

  const transformHistory = useRef<Transform[]>([{ ...DEFAULT_TRANSFORM }])
  const historyIndex = useRef(0)

  const pushHistory = useCallback((t: Transform) => {
    const arr = transformHistory.current
    if (historyIndex.current < arr.length - 1) arr.splice(historyIndex.current + 1)
    arr.push({ ...t })
    if (arr.length > MAX_HISTORY) arr.shift()
    historyIndex.current = arr.length - 1
  }, [])

  const undo = useCallback(() => {
    if (historyIndex.current > 0) {
      historyIndex.current--
      setTransform({ ...transformHistory.current[historyIndex.current] })
    }
  }, [])

  const redo = useCallback(() => {
    if (historyIndex.current < transformHistory.current.length - 1) {
      historyIndex.current++
      setTransform({ ...transformHistory.current[historyIndex.current] })
    }
  }, [])

  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map())
  const lastDist = useRef<number | null>(null)
  const lastAngle = useRef<number | null>(null)
  const lastMid = useRef<{ x: number; y: number } | null>(null)

  const [opacity, setOpacity] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const s = localStorage.getItem('vt_opacity')
        if (s) return parseFloat(s)
      } catch {}
    }
    return 0.75
  })
  const [isLocked, setIsLocked] = useState(false)
  const [gridMode, setGridMode] = useState<GridMode>(() => {
    if (typeof window !== 'undefined') {
      try { return (localStorage.getItem('vt_grid') as GridMode) || 'none' } catch {}
    }
    return 'none'
  })
  const [perspective, setPerspective] = useState(false)
  const [lockBanner, setLockBanner] = useState(false)
  const [showTools, setShowTools] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { visible: uiVisible, show: showUI } = useAutoHide(isLocked)

  const [toast, setToast] = useState<string | null>(null)
  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }, [])

  const {
    status: anchorStatus, delta, libReady, cvError,
    triggerCvLoad, startTargeting, lockAnchor, stopTracking
  } = useOpticalFlowTracker(videoRef)

  const [anchorActive, setAnchorActive] = useState(false)

  useEffect(() => {
    const seen = localStorage.getItem('vt_onboarded')
    if (!seen) setShowOnboarding(true)
  }, [])

  const dismissOnboarding = useCallback(() => {
    setShowOnboarding(false)
    localStorage.setItem('vt_onboarded', '1')
  }, [])

  const baseLockTransform = useRef<Transform>(DEFAULT_TRANSFORM)
  useEffect(() => {
    if (anchorStatus === 'searching') baseLockTransform.current = { ...transform }
  }, [anchorStatus])

  const transformRef = useRef<Transform>(transform)
  useEffect(() => { transformRef.current = transform }, [transform])

  const commitRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null)
  const commitTransform = useCallback((t: Transform, saveHistory = false) => {
    if (commitRef.current) cancelAnimationFrame(commitRef.current)
    commitRef.current = requestAnimationFrame(() => {
      setTransform(t)
      if (saveHistory) pushHistory(t)
      commitRef.current = null
    })
  }, [pushHistory])

  const arActive = anchorActive && (anchorStatus === 'locked' || anchorStatus === 'lost' || anchorStatus === 'searching' || anchorStatus === 'loading')

  const displayTransform: Transform = arActive && (anchorStatus === 'locked' || anchorStatus === 'lost')
    ? {
      x: baseLockTransform.current.x + delta.dx,
      y: baseLockTransform.current.y + delta.dy,
      scale: baseLockTransform.current.scale,
      rotation: baseLockTransform.current.rotation,
    }
    : transform

  const imgTransform = useMemo(
    () => `translate(${displayTransform.x}px, ${displayTransform.y}px) scale(${displayTransform.scale}) rotate(${displayTransform.rotation}deg)`,
    [displayTransform.x, displayTransform.y, displayTransform.scale, displayTransform.rotation]
  )

  useEffect(() => {
    if (transform !== DEFAULT_TRANSFORM) {
      try { localStorage.setItem('vt_transform', JSON.stringify(transform)) } catch {}
    }
  }, [transform])
  useEffect(() => { try { localStorage.setItem('vt_corners', JSON.stringify(corners)) } catch {} }, [corners])
  useEffect(() => { try { localStorage.setItem('vt_opacity', String(opacity)) } catch {} }, [opacity])
  useEffect(() => { try { localStorage.setItem('vt_grid', gridMode) } catch {} }, [gridMode])

  useEffect(() => {
    if (isLocked) {
      setLockBanner(true)
      const t = setTimeout(() => setLockBanner(false), 2500)
      return () => clearTimeout(t)
    }
    setLockBanner(false)
  }, [isLocked])

  const pickImage = useCallback(() => { fileRef.current?.click() }, [])

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
    blobUrlRef.current = URL.createObjectURL(file)
    setImgSrc(blobUrlRef.current)
    setTransform(DEFAULT_TRANSFORM)
    setCorners(DEFAULT_CORNERS)
    transformHistory.current = [{ ...DEFAULT_TRANSFORM }]
    historyIndex.current = 0
    showUI()
    e.target.value = ''
  }, [showUI])

  const onImgPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)

    if (isLocked) {
      longPressTimer.current = setTimeout(() => {
        setIsLocked(false)
        if (navigator.vibrate) navigator.vibrate([50, 30, 50])
        showUI()
      }, 600)
      return
    }

    if (arActive && anchorStatus === 'locked') return

    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values())
      lastDist.current = Math.hypot(b.x - a.x, b.y - a.y)
      lastAngle.current = Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI)
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
      const t = transformRef.current
      commitTransform({ ...t, x: t.x + dx, y: t.y + dy })
    }

    if (pts.length === 2) {
      const [a, b] = pts
      const dist = Math.hypot(b.x - a.x, b.y - a.y)
      const angle = Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI)
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      if (lastDist.current !== null) {
        const scaleDelta = dist / lastDist.current
        const rotDelta = angle - lastAngle.current!
        const panX = mid.x - lastMid.current!.x
        const panY = mid.y - lastMid.current!.y
        const t = transformRef.current
        commitTransform({
          x: t.x + panX,
          y: t.y + panY,
          scale: Math.min(Math.max(t.scale * scaleDelta, 0.05), 20),
          rotation: t.rotation + rotDelta,
        })
      }
      lastDist.current = dist
      lastAngle.current = angle
      lastMid.current = mid
    }
    showUI()
  }, [isLocked, showUI, arActive, anchorStatus, commitTransform])

  const onImgPointerUp = useCallback((e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null }
    if (pointers.current.size < 2) { lastDist.current = null; lastAngle.current = null; lastMid.current = null }
    if (pointers.current.size === 0) pushHistory(transformRef.current)
  }, [pushHistory])

  const cycleGrid = useCallback(() => {
    setGridMode(m => m === 'none' ? '3x3' : m === '3x3' ? '10x10' : 'none')
    showUI()
  }, [showUI])

  const toggleLock = useCallback(() => {
    setIsLocked(v => {
      const next = !v
      if (navigator.vibrate) navigator.vibrate(next ? 100 : 60)
      return next
    })
    showUI()
  }, [showUI])

  const handleAnchor = useCallback(() => {
    if (anchorActive) {
      setTransform({ ...displayTransform })
      stopTracking()
      setAnchorActive(false)
    } else {
      setAnchorActive(true)
      triggerCvLoad()
      startTargeting()
    }
    showUI()
  }, [anchorActive, displayTransform, stopTracking, triggerCvLoad, startTargeting, showUI])

  useEffect(() => {
    if (cvError) showToast('AR failed to load — check internet')
  }, [cvError, showToast])

  useEffect(() => {
    if (delta.dx !== 0 || delta.dy !== 0) {
      const limit = 300
      if (Math.abs(delta.dx) > limit || Math.abs(delta.dy) > limit) {
        setTransform(prev => ({ ...prev, x: prev.x + delta.dx / 3, y: prev.y + delta.dy / 3 }))
      }
    }
  }, [delta])

  const toggleCamera = useCallback(() => {
    setFacing(f => f === 'environment' ? 'user' : 'environment')
    if (anchorActive) { stopTracking(); setAnchorActive(false) }
    showUI()
  }, [anchorActive, stopTracking, showUI])

  const flipHorizontal = useCallback(() => {
    const t = transformRef.current
    commitTransform({ ...t, x: -t.x, scale: t.scale }, true)
    showUI()
  }, [commitTransform, showUI])

  const flipVertical = useCallback(() => {
    const t = transformRef.current
    commitTransform({ ...t, y: -t.y, scale: t.scale }, true)
    showUI()
  }, [commitTransform, showUI])

  const takeScreenshot = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    if (imgSrc) {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        ctx.save()
        ctx.translate(canvas.width / 2 + displayTransform.x, canvas.height / 2 + displayTransform.y)
        ctx.scale(displayTransform.scale, displayTransform.scale)
        ctx.rotate((displayTransform.rotation * Math.PI) / 180)
        const imgW = Math.min(img.width, canvas.width * 0.9)
        const imgH = (imgW / img.width) * img.height
        ctx.globalAlpha = opacity
        ctx.drawImage(img, -imgW / 2, -imgH / 2, imgW, imgH)
        ctx.restore()
        const link = document.createElement('a')
        link.download = `visiontrace-${Date.now()}.png`
        link.href = canvas.toDataURL('image/png')
        link.click()
        showToast('Saved!')
      }
      img.onerror = () => showToast('Save failed')
      img.src = imgSrc
    } else {
      const link = document.createElement('a')
      link.download = `visiontrace-${Date.now()}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
      showToast('Saved!')
    }
  }, [videoRef, imgSrc, displayTransform, opacity, showToast])

  const resetAll = useCallback(() => {
    setTransform(DEFAULT_TRANSFORM)
    setCorners(DEFAULT_CORNERS)
    transformHistory.current = [{ ...DEFAULT_TRANSFORM }]
    historyIndex.current = 0
    if (anchorActive) { stopTracking(); setAnchorActive(false) }
    showUI()
  }, [anchorActive, stopTracking, showUI])

  const AR_STATUS_LABELS: Record<AnchorStatus, string> = {
    idle: '',
    loading: 'Loading AR…',
    searching: 'Point at surface & tap Lock',
    locked: 'Tracking',
    lost: 'Tap to re-lock',
  }

  if (camStatus === 'denied' || camStatus === 'error') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100dvh', gap: 20, padding: 32,
        background: '#000', color: '#fff', textAlign: 'center',
      }}>
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ff6b35" strokeWidth="1.5">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 1.4-1.9l8-3.6a2 2 0 0 1 1.6 0l8 3.6A2 2 0 0 1 23 8v11z"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 24, fontWeight: 800, letterSpacing: 2 }}>
          VisionTrace
        </div>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, lineHeight: 1.6 }}>
          Camera access denied.<br />Allow camera in browser settings.
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

  return (
    <main
      style={{
        position: 'relative', width: '100dvw', height: '100dvh',
        overflow: 'hidden', background: '#000',
        overscrollBehavior: 'none',
        userSelect: 'none',
      }}
      onClick={showUI}
    >
      {toast && <Toast message={toast} />}

      <video
        ref={videoRef}
        muted playsInline autoPlay
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover', zIndex: 1,
        }}
      />

      {imgSrc && (
        <div
          onPointerDown={onImgPointerDown}
          onPointerMove={onImgPointerMove}
          onPointerUp={onImgPointerUp}
          onPointerCancel={onImgPointerUp}
          style={{
            position: 'absolute', inset: 0,
            zIndex: 10, touchAction: 'none',
            cursor: isLocked ? 'default' : 'grab',
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
            }}
          />
        </div>
      )}

      {perspective && imgSrc && <PerspectiveOverlay corners={corners} onChange={setCorners} />}

      <GridOverlay mode={gridMode} />

      {/* AR Status */}
      {anchorActive && anchorStatus !== 'idle' && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none', zIndex: 60,
          transition: 'opacity 0.3s',
        }}>
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            opacity: anchorStatus === 'searching' || anchorStatus === 'loading' ? 1 : 0,
            transition: 'opacity 0.3s',
          }}>
            <div style={{
              width: 72, height: 72, border: '2px solid rgba(255,107,53,0.7)',
              borderRadius: 16, position: 'relative',
            }}>
              <div style={{ position: 'absolute', width: 2, height: 24, background: '#ff6b35', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
              <div style={{ position: 'absolute', width: 24, height: 2, background: '#ff6b35', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
            </div>
            <div style={{
              background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)',
              borderRadius: 10, padding: '8px 16px',
              color: '#fff', fontFamily: 'DM Mono, monospace',
              fontSize: 13, fontWeight: 600, letterSpacing: 0.5,
              whiteSpace: 'nowrap',
            }}>
              {AR_STATUS_LABELS[anchorStatus]}
            </div>
          </div>
        </div>
      )}

      {anchorActive && anchorStatus === 'lost' && (
        <div style={{
          position: 'absolute', bottom: 180, left: '50%',
          transform: 'translateX(-50%)', zIndex: 60,
          whiteSpace: 'nowrap',
        }}>
          <button
            onClick={(e) => { e.stopPropagation(); startTargeting(); showUI() }}
            style={{
              padding: '12px 24px', borderRadius: 24,
              background: 'rgba(255,107,53,0.9)', border: 'none',
              color: '#fff', fontFamily: 'DM Mono, monospace',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
              touchAction: 'manipulation',
              boxShadow: '0 4px 16px rgba(255,107,53,0.4)',
            }}
          >
            Relock
          </button>
        </div>
      )}

      {/* Lock banner */}
      <div style={{
        position: 'absolute', bottom: 180, left: '50%',
        transform: 'translateX(-50%)', zIndex: 55,
        opacity: lockBanner ? 1 : 0,
        pointerEvents: 'none', whiteSpace: 'nowrap',
        transition: 'opacity 0.35s',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(239,83,80,0.9)', backdropFilter: 'blur(16px)',
          borderRadius: 28, padding: '12px 22px', fontSize: 13, fontWeight: 600,
          color: '#fff',
        }}>
          Locked — long press to unlock
        </div>
      </div>

      {/* Onboarding */}
      {showOnboarding && (
        <div
          style={{
            position: 'absolute', inset: 0, zIndex: 70,
            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 24, padding: '32px 40px',
            textAlign: 'center',
          }}
          onClick={dismissOnboarding}
        >
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 28, fontWeight: 800, color: '#ff6b35', letterSpacing: 3 }}>
            VisionTrace
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {[
              ['1', 'Load', 'Pick any reference image from your gallery'],
              ['2', 'Trace', 'Drag, pinch & rotate to position over your drawing'],
              ['3', 'AR Lock', 'Lock the image in place so it tracks your movement'],
              ['4', 'Save', 'Export your traced work anytime'],
            ].map(([num, title, desc]) => (
              <div key={num} style={{ display: 'flex', gap: 16, alignItems: 'flex-start', textAlign: 'left' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#ff6b35', color: '#000', fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {num}
                </div>
                <div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 17, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
                    {title}
                  </div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
                    {desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={dismissOnboarding}
            style={{
              marginTop: 8, padding: '14px 40px', borderRadius: 14,
              background: '#ff6b35', border: 'none', color: '#000',
              fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 16,
              cursor: 'pointer', touchAction: 'manipulation',
            }}
          >
            Let's Go
          </button>
        </div>
      )}

      {/* Opacity slider */}
      {imgSrc && uiVisible && (
        <div style={{
          position: 'absolute', right: 16, top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
          zIndex: 45,
        }}>
          <OpacitySlider value={opacity} onChange={setOpacity} />
          <span style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', color: 'rgba(255,255,255,0.5)', letterSpacing: 1 }}>
            {Math.round(opacity * 100)}%
          </span>
        </div>
      )}

      {/* No image hint */}
      {!imgSrc && camStatus === 'active' && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 5,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none', gap: 16,
        }}>
          <div style={{
            fontFamily: 'Syne, sans-serif', fontSize: 28, fontWeight: 800,
            letterSpacing: '4px', color: '#ff6b35', textTransform: 'uppercase',
          }}>VisionTrace</div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)', fontFamily: 'DM Mono, monospace' }}>
            tap Load to add an image
          </div>
        </div>
      )}

      {/* Bottom Bar */}
      <BottomBar
        imgSrc={!!imgSrc}
        isLocked={isLocked}
        gridMode={gridMode}
        anchorActive={anchorActive}
        anchorStatus={anchorStatus}
        uiVisible={uiVisible}
        showTools={showTools}
        onPickImage={pickImage}
        onToggleLock={toggleLock}
        onCycleGrid={cycleGrid}
        onToggleAnchor={handleAnchor}
        onToggleTools={() => setShowTools(v => !v)}
        onShowTools={showUI}
      />

      {/* Tools panel */}
      {showTools && (
        <div
          style={{
            position: 'absolute', bottom: 88, left: 0, right: 0,
            zIndex: 50,
            display: 'flex', justifyContent: 'center',
            padding: '0 16px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{
            display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center',
            background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(16px)',
            borderRadius: 20, padding: '12px 14px',
          }}>
            <ToolBtn onClick={flipHorizontal}>Flip H</ToolBtn>
            <ToolBtn onClick={flipVertical}>Flip V</ToolBtn>
            <ToolBtn onClick={toggleCamera}>{facing === 'environment' ? 'Front' : 'Back'}</ToolBtn>
            <ToolBtn onClick={() => { setPerspective(v => !v); showUI() }} active={perspective}>Persp</ToolBtn>
            <ToolBtn onClick={undo} disabled={historyIndex.current <= 0}>Undo</ToolBtn>
            <ToolBtn onClick={redo} disabled={historyIndex.current >= transformHistory.current.length - 1}>Redo</ToolBtn>
            <ToolBtn onClick={resetAll}>Reset</ToolBtn>
            <ToolBtn onClick={takeScreenshot}>Save</ToolBtn>
          </div>
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*" onChange={onFileChange} style={{ display: 'none' }} />
    </main>
  )
}

function OpacitySlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const H = 160

  const getVal = (e: React.PointerEvent) => {
    const rect = ref.current!.getBoundingClientRect()
    return 1 - Math.min(Math.max((e.clientY - rect.top) / H, 0), 1)
  }

  return (
    <div
      ref={ref}
      onPointerDown={(e) => {
        e.stopPropagation()
        dragging.current = true
        ;(e.target as Element).setPointerCapture(e.pointerId)
        onChange(getVal(e))
      }}
      onPointerMove={(e) => {
        if (!dragging.current) return
        e.stopPropagation()
        onChange(getVal(e))
      }}
      onPointerUp={() => { dragging.current = false }}
      style={{
        width: 40, height: H,
        cursor: 'ns-resize', touchAction: 'none',
        display: 'flex', justifyContent: 'center',
      }}
    >
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 5, borderRadius: 3, background: 'rgba(255,255,255,0.12)' }} />
      <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 5, height: `${value * 100}%`, borderRadius: 3, background: '#ff6b35' }} />
      <div style={{ position: 'absolute', left: '50%', top: (1 - value) * H, transform: 'translate(-50%, -50%)', width: 24, height: 24, borderRadius: '50%', background: '#ff6b35', border: '2px solid white' }} />
    </div>
  )
}

function ToolBtn({ children, onClick, active, disabled }: {
  children: React.ReactNode
  onClick: () => void
  active?: boolean
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '10px 16px', borderRadius: 12,
        border: `1px solid ${active ? 'rgba(255,107,53,0.7)' : 'rgba(255,255,255,0.15)'}`,
        background: active ? 'rgba(255,107,53,0.25)' : 'rgba(255,255,255,0.08)',
        color: disabled ? 'rgba(255,255,255,0.3)' : '#fff',
        fontFamily: 'DM Mono, monospace',
        fontSize: 12, fontWeight: 600, letterSpacing: 0.5,
        cursor: disabled ? 'default' : 'pointer',
        touchAction: 'manipulation',
        transition: 'all 0.15s',
      }}
    >
      {children}
    </button>
  )
}
