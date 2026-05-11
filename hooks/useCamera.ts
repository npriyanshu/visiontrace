'use client'
import { useEffect, useRef, useState, useCallback } from 'react'

export type CameraStatus = 'idle' | 'requesting' | 'active' | 'denied' | 'error'

export type CameraFacing = 'environment' | 'user'

export function useCamera(facing: CameraFacing = 'environment') {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<CameraStatus>('idle')
  const [facingState, setFacingState] = useState<CameraFacing>(facing)
  const streamRef = useRef<MediaStream | null>(null)
  const pendingRef = useRef<CameraFacing | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const startCamera = useCallback(async (camFacing: CameraFacing) => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    setStatus('requesting')
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
      await new Promise(r => setTimeout(r, 150))
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: camFacing },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
        setStatus('active')
        setFacingState(camFacing)
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setStatus('denied')
      } else {
        setStatus('error')
      }
    }
  }, [])

  useEffect(() => {
    startCamera(facing)
    return () => {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [startCamera, facing])

  return { videoRef, status, facing: facingState }
}
