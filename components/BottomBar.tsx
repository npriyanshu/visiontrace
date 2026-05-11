'use client'
import { AnchorStatus } from '@/hooks/useOpticalFlowTracker'
import { GridMode } from '@/components/GridOverlay'

const ICONS = {
  load: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="3"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21 15 16 10 5 21"/>
    </svg>
  ),
  lock: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="11" width="18" height="11" rx="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  ),
  unlock: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="11" width="18" height="11" rx="2"/>
      <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
    </svg>
  ),
  grid: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <line x1="3" y1="9" x2="21" y2="9"/>
      <line x1="3" y1="15" x2="21" y2="15"/>
      <line x1="9" y1="3" x2="9" y2="21"/>
      <line x1="15" y1="3" x2="15" y2="21"/>
    </svg>
  ),
  ar: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3"/>
      <line x1="12" y1="3" x2="12" y2="7"/>
      <line x1="12" y1="17" x2="12" y2="21"/>
      <line x1="3" y1="12" x2="7" y2="12"/>
      <line x1="17" y1="12" x2="21" y2="12"/>
    </svg>
  ),
  arLocked: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/>
      <line x1="12" y1="3" x2="12" y2="7"/>
      <line x1="12" y1="17" x2="12" y2="21"/>
      <line x1="3" y1="12" x2="7" y2="12"/>
      <line x1="17" y1="12" x2="21" y2="12"/>
    </svg>
  ),
  tools: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="4" y1="6" x2="20" y2="6"/>
      <line x1="4" y1="12" x2="20" y2="12"/>
      <line x1="4" y1="18" x2="20" y2="18"/>
    </svg>
  ),
}

interface Props {
  imgSrc: boolean
  isLocked: boolean
  gridMode: GridMode
  anchorActive: boolean
  anchorStatus: AnchorStatus
  uiVisible: boolean
  showTools: boolean
  onPickImage: () => void
  onToggleLock: () => void
  onCycleGrid: () => void
  onToggleAnchor: () => void
  onToggleTools: () => void
  onShowTools: () => void
}

const GRID_LABELS: Record<GridMode, string> = { none: 'Grid', '3x3': '3×3', '10x10': '10×10' }

export function BottomBar({
  imgSrc, isLocked, gridMode, anchorActive, anchorStatus, uiVisible, showTools,
  onPickImage, onToggleLock, onCycleGrid, onToggleAnchor, onToggleTools, onShowTools,
}: Props) {
  const arColor = anchorActive && (anchorStatus === 'locked' || anchorStatus === 'lost') ? '#22c55e' : undefined

  return (
    <div
      style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        zIndex: 50,
        pointerEvents: uiVisible ? 'auto' : 'none',
        transition: 'opacity 0.4s',
        opacity: uiVisible ? 1 : 0.1,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Main action bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        padding: '12px 16px 36px',
        background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.6) 70%, transparent 100%)',
      }}>
        {/* Load / Swap */}
        <ActionBtn onClick={onPickImage} color={imgSrc ? '#ff6b35' : '#fff'}>
          {ICONS.load}
          <span>{imgSrc ? 'Swap' : 'Load'}</span>
        </ActionBtn>

        {/* Lock */}
        <ActionBtn onClick={onToggleLock} color={isLocked ? '#ef5350' : undefined}>
          {isLocked ? ICONS.lock : ICONS.unlock}
          <span>Lock</span>
        </ActionBtn>

        {/* AR Anchor */}
        <ActionBtn onClick={onToggleAnchor} color={arColor}>
          {anchorActive && (anchorStatus === 'locked' || anchorStatus === 'lost') ? ICONS.arLocked : ICONS.ar}
          <span>
            {anchorActive
              ? anchorStatus === 'locked' ? 'AR On'
              : anchorStatus === 'loading' ? '…'
              : 'AR…'
              : 'Anchor'}
          </span>
        </ActionBtn>

        {/* Grid */}
        <ActionBtn onClick={onCycleGrid} color={gridMode !== 'none' ? '#4fc3f7' : undefined}>
          {ICONS.grid}
          <span>{GRID_LABELS[gridMode]}</span>
        </ActionBtn>

        {/* Tools */}
        <ActionBtn onClick={onToggleTools} color={showTools ? '#ff6b35' : undefined}>
          {ICONS.tools}
          <span>More</span>
        </ActionBtn>
      </div>

      {/* Status strip */}
      {imgSrc && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: '0 16px 36px',
          display: 'flex', justifyContent: 'center',
          gap: 0,
          pointerEvents: 'none',
        }}>
          <div style={{
            display: 'flex', gap: 0,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
            borderRadius: 16, padding: '8px 20px',
            border: '1px solid rgba(255,255,255,0.08)',
          }}>
            {[
              { label: 'Opacity', value: '' },
              { label: 'Scale', value: '' },
              { label: 'Rotate', value: '' },
            ].map(({ label }) => (
              <div key={label} style={{
                padding: '0 12px',
                textAlign: 'center',
                borderRight: label !== 'Rotate' ? '1px solid rgba(255,255,255,0.1)' : 'none',
              }}>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontFamily: 'DM Mono, monospace', letterSpacing: 1 }}>{label}</div>
                <div id={`vt-status-${label.toLowerCase()}`} style={{ fontSize: 12, color: '#fff', fontFamily: 'DM Mono, monospace', fontWeight: 600 }}>—</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ActionBtn({ children, onClick, color, disabled }: {
  children: React.ReactNode
  onClick: () => void
  color?: string
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 5,
        background: 'none', border: 'none',
        color: disabled ? 'rgba(255,255,255,0.3)' : (color || 'rgba(255,255,255,0.85)'),
        cursor: disabled ? 'default' : 'pointer',
        padding: '8px 12px',
        borderRadius: 16,
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
        transition: 'transform 0.1s',
        minWidth: 56,
      }}
      onTouchStart={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.92)' }}
      onTouchEnd={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)' }}
    >
      {children}
    </button>
  )
}
