'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

const HIDE_DELAY = 3500

export function useAutoHide(paused: boolean = false) {
  const [visible, setVisible] = useState(true)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback(() => {
    setVisible(true)
    if (timer.current) clearTimeout(timer.current)
    if (!paused) {
      timer.current = setTimeout(() => setVisible(false), HIDE_DELAY)
    }
  }, [paused])

  // When paused (locked), stay hidden
  useEffect(() => {
    if (paused) {
      if (timer.current) clearTimeout(timer.current)
      setVisible(false)
    } else {
      show()
    }
  }, [paused, show])

  // Trigger on mount
  useEffect(() => { show() }, [show])

  return { visible, show }
}
