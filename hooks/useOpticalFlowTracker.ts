'use client'
import { useEffect, useRef, useState, useCallback } from 'react'

// ─── Types ─────────────────────────────────────────────────────────────────
export type AnchorStatus = 'idle' | 'searching' | 'locked' | 'lost'

export interface AnchorDelta {
    dx: number
    dy: number
}

// Global declaration for OpenCV.js
declare global {
    interface Window {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cv: any
    }
}

// ─── Constants ─────────────────────────────────────────────────────────────
const MAX_CORNERS = 100
const QUALITY_LEVEL = 0.1
const MIN_DISTANCE = 5
const WIN_SIZE = 15
const MAX_LEVEL = 2

// ─── Hook ──────────────────────────────────────────────────────────────────
export function useOpticalFlowTracker(videoRef: React.RefObject<HTMLVideoElement>) {
    const [status, setStatus] = useState<AnchorStatus>('idle')
    const [delta, setDelta] = useState<AnchorDelta>({ dx: 0, dy: 0 })
    const [libReady, setLibReady] = useState(false)

    // Internal refs for state that shouldn't trigger re-renders on every 16ms frame
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
    const statusRef = useRef<AnchorStatus>('idle')
    const rafRef = useRef<number | null>(null)

    // OpenCV Matrices
    const oldGrayRef = useRef<any>(null)
    const p0Ref = useRef<any>(null)
    const maskRef = useRef<any>(null)

    // Target relative coordinate (0-1) where user tapped
    const targetRef = useRef<{ x: number, y: number } | null>(null)

    const updateStatus = useCallback((s: AnchorStatus) => {
        statusRef.current = s
        setStatus(s)
    }, [])

    // ── Load OpenCV.js ──────────────────────────────────────────────────────
    useEffect(() => {
        if (typeof window === 'undefined') return

        // Check if already loaded
        if (window.cv && window.cv.Mat) {
            setLibReady(true)
            return
        }

        // Define the callback for when WASM compiles
        ; (window as any).onloadCallback = function () {
            setLibReady(true)
        }

        const script = document.createElement('script')
        script.src = 'https://docs.opencv.org/4.8.0/opencv.js'
        script.async = true
        script.onload = () => {
            // Sometimes onload fires before CV is fully ready if WASM is still compiling.
            // We check if mat is available, else rely on onloadCallback / interval check.
            const checkCv = setInterval(() => {
                if (window.cv && window.cv.Mat) {
                    clearInterval(checkCv)
                    setLibReady(true)
                }
            }, 100)
        }
        script.onerror = () => console.warn('[VisionTrace] Could not load OpenCV.js')

        document.head.appendChild(script)
    }, [])

    // ── Create hidden canvas once ───────────────────────────────────────────
    useEffect(() => {
        const canvas = document.createElement('canvas')
        // Downscale for performance: 320x240 is enough for flow tracking
        canvas.width = 320
        canvas.height = 240
        canvasRef.current = canvas
        ctxRef.current = canvas.getContext('2d', { willReadFrequently: true })

        return () => {
            // Cleanup mats on unmount
            if (oldGrayRef.current) oldGrayRef.current.delete()
            if (p0Ref.current) p0Ref.current.delete()
            if (maskRef.current) maskRef.current.delete()
        }
    }, [])

    // ── Detection loop ──────────────────────────────────────────────────────
    useEffect(() => {
        if (!libReady || !window.cv) return

        let alive = true
        let p1 = new window.cv.Mat()
        let st = new window.cv.Mat()
        let err = new window.cv.Mat()
        let termCrit = new window.cv.TermCriteria(
            window.cv.TERM_CRITERIA_EPS | window.cv.TERM_CRITERIA_COUNT, 10, 0.03
        )

        const tick = () => {
            if (!alive) return

            const curStatus = statusRef.current
            if (curStatus === 'idle') { rafRef.current = requestAnimationFrame(tick); return }

            const video = videoRef.current
            const canvas = canvasRef.current
            const ctx = ctxRef.current

            if (!video || !canvas || !ctx || video.readyState < 2) {
                rafRef.current = requestAnimationFrame(tick)
                return
            }

            const W = canvas.width
            const H = canvas.height

            // Try-catch block vital for OpenCV to avoid crashing loop on WASM memory errors
            try {
                ctx.drawImage(video, 0, 0, W, H)
                const frame = window.cv.imread(canvas)
                const gray = new window.cv.Mat()
                window.cv.cvtColor(frame, gray, window.cv.COLOR_RGBA2GRAY)

                if (curStatus === 'searching' && targetRef.current) {
                    // Initialization Phase: We just tapped "Lock"
                    // We define a 80x80 ROI around the tap point and find features to track.

                    const tx = Math.floor(targetRef.current.x * W)
                    const ty = Math.floor(targetRef.current.y * H)

                    // ROI bounding box, safely clamped to image bounds
                    const roiW = 80
                    const roiH = 80
                    const rx = Math.max(0, Math.min(tx - roiW / 2, W - roiW))
                    const ry = Math.max(0, Math.min(ty - roiH / 2, H - roiH))
                    const rect = new window.cv.Rect(rx, ry, roiW, roiH)

                    const roiGray = gray.roi(rect)

                    // Find features inside ROI
                    const corners = new window.cv.Mat()
                    const noMask = new window.cv.Mat()
                    window.cv.goodFeaturesToTrack(roiGray, corners, MAX_CORNERS, QUALITY_LEVEL, MIN_DISTANCE, noMask, 3, false, 0.04)

                    if (corners.rows > 0) {
                        // Offset the local ROI corners back to global image coordinates
                        const pointsData = new Float32Array(corners.rows * 2)
                        for (let i = 0; i < corners.rows; i++) {
                            pointsData[i * 2] = corners.data32F[i * 2] + rx
                            pointsData[i * 2 + 1] = corners.data32F[i * 2 + 1] + ry
                        }
                        const p0Info = window.cv.matFromArray(corners.rows, 1, window.cv.CV_32FC2, pointsData)

                        if (p0Ref.current) p0Ref.current.delete()
                        if (oldGrayRef.current) oldGrayRef.current.delete()

                        p0Ref.current = p0Info
                        oldGrayRef.current = gray.clone()

                        // Reset delta, we are now tracking!
                        setDelta({ dx: 0, dy: 0 })
                        updateStatus('locked')
                    } else {
                        // Found nothing distinct to track in that spot (e.g. blank paper)
                        updateStatus('lost')
                    }

                    roiGray.delete()
                    corners.delete()
                    noMask.delete()

                } else if (curStatus === 'locked' && p0Ref.current && oldGrayRef.current) {
                    // Tracking Phase: Calculate Optical Flow

                    window.cv.calcOpticalFlowPyrLK(
                        oldGrayRef.current, gray, p0Ref.current, p1, st, err,
                        new window.cv.Size(WIN_SIZE, WIN_SIZE), MAX_LEVEL, termCrit
                    )

                    // Filter out bad points and calculate average movement
                    let goodNew = []
                    let goodOld = []
                    let sumDx = 0
                    let sumDy = 0
                    let count = 0

                    for (let i = 0; i < st.rows; i++) {
                        if (st.data[i] === 1) { // 1 means track was found
                            const px = p1.data32F[i * 2]
                            const py = p1.data32F[i * 2 + 1]
                            const ox = p0Ref.current.data32F[i * 2]
                            const oy = p0Ref.current.data32F[i * 2 + 1]

                            goodNew.push(px, py)
                            goodOld.push(ox, oy)

                            // Delta in normalized space (0 to 1) 
                            // which maps smoothly regardless of actual screen size
                            sumDx += (px - ox) / W
                            sumDy += (py - oy) / H
                            count++
                        }
                    }

                    if (count > 5) {
                        // We have enough points, it is a solid track
                        const avgDx = sumDx / count
                        const avgDy = sumDy / count

                        // Update accumulated delta for React to render
                        setDelta(prev => ({
                            dx: prev.dx + avgDx * window.innerWidth,
                            dy: prev.dy + avgDy * window.innerHeight
                        }))

                        // Update old references for next frame
                        const p0Flat = new Float32Array(goodNew)
                        oldGrayRef.current.delete()
                        p0Ref.current.delete()

                        oldGrayRef.current = gray.clone()
                        p0Ref.current = window.cv.matFromArray(count, 1, window.cv.CV_32FC2, p0Flat)

                    } else {
                        // Lost tracking (too few points survived)
                        updateStatus('lost')
                    }
                }

                gray.delete()
                frame.delete()

            } catch (e) {
                console.error("[VisionTrace] CV error in tick: ", e)
                // Recover state
                if (curStatus === 'locked') updateStatus('lost')
            }

            rafRef.current = requestAnimationFrame(tick)
        }

        rafRef.current = requestAnimationFrame(tick)
        return () => {
            alive = false
            if (rafRef.current) cancelAnimationFrame(rafRef.current)
            p1.delete()
            st.delete()
            err.delete()
        }
    }, [videoRef, updateStatus, libReady])

    // ── Public API ──────────────────────────────────────────────────────────

    const startTargeting = useCallback(() => {
        setDelta({ dx: 0, dy: 0 })
        updateStatus('searching')
        targetRef.current = null
    }, [updateStatus])

    // Call this right when the user locks on a spot. Screen coordinates [0-1]
    const lockAnchor = useCallback((normalizedX: number, normalizedY: number) => {
        // We remain in searching until the next frame actually finds the features and transitions us to 'locked'
        targetRef.current = { x: normalizedX, y: normalizedY }
    }, [])

    const stopTracking = useCallback(() => {
        setDelta({ dx: 0, dy: 0 })
        updateStatus('idle')
        targetRef.current = null
        if (p0Ref.current) { p0Ref.current.delete(); p0Ref.current = null }
        if (oldGrayRef.current) { oldGrayRef.current.delete(); oldGrayRef.current = null }
    }, [updateStatus])

    return { status, delta, libReady, startTargeting, lockAnchor, stopTracking }
}
