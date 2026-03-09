'use client'
import { ButtonHTMLAttributes } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?:  boolean
  danger?:  boolean
  label?:   string
  children: React.ReactNode
}

export function HudButton({ active, danger, label, children, style, ...rest }: Props) {
  return (
    <button
      {...rest}
      title={label}
      aria-label={label}
      style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            '3px',
        width:          '52px',
        height:         '52px',
        borderRadius:   '14px',
        border:         `1px solid ${active ? (danger ? 'rgba(239,83,80,0.6)' : 'rgba(255,107,53,0.6)') : 'rgba(255,255,255,0.1)'}`,
        background:     active
          ? (danger ? 'rgba(239,83,80,0.25)' : 'rgba(255,107,53,0.22)')
          : 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(12px)',
        color:          active ? (danger ? '#ef5350' : '#ff6b35') : 'rgba(255,255,255,0.85)',
        fontSize:       '20px',
        cursor:         'pointer',
        WebkitTapHighlightColor: 'transparent',
        transition:     'all 0.15s ease',
        flexShrink:     0,
        ...style,
      }}
    >
      {children}
      {label && (
        <span style={{
          fontSize:   '8px',
          fontFamily: 'DM Mono, monospace',
          fontWeight: 500,
          letterSpacing: '0.5px',
          opacity:    0.7,
          lineHeight: 1,
          textTransform: 'uppercase',
        }}>
          {label}
        </span>
      )}
    </button>
  )
}
