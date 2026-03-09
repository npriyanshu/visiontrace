'use client'
import { useEffect, useRef, useState } from 'react'

export type CameraStatus = 'idle' | 'requesting' | 'active' | 'denied' | 'error'

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<CameraStatus>('idle')

  useEffect(() => {
    let stream: MediaStream | null = null

    async function startCamera() {
      setStatus('requesting')
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' }, // back camera on phones
            width:  { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
          setStatus('active')
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'NotAllowedError') {
          setStatus('denied')
        } else {
          setStatus('error')
        }
      }
    }

    startCamera()

    return () => {
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  return { videoRef, status }
}
