'use client'
import { useEffect, useRef, useState, useCallback } from 'react'

export type AnchorStatus = 'idle' | 'searching' | 'locked' | 'lost' | 'loading'

export interface AnchorDelta {
    dx: number
    dy: number
}

declare global {
    interface Window {
        cv: any
    }
}

const CANVAS_W = 240
const CANVAS_H = 180
const MAX_CORNERS = 80
const QUALITY_LEVEL = 0.08
const MIN_DISTANCE = 6
const WIN_SIZE = 15
const MAX_LEVEL = 3
const TRACK_SKIP_FRAMES = 1
const REDETECT_EVERY = 30

export function useOpticalFlowTracker(videoRef: React.RefObject<HTMLVideoElement>) {
    const [status, setStatus] = useState<AnchorStatus>('idle')
    const [delta, setDelta] = useState<AnchorDelta>({ dx: 0, dy: 0 })
    const [libReady, setLibReady] = useState(false)
    const [cvError, setCvError] = useState(false)

    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
    const statusRef = useRef<AnchorStatus>('idle')
    const rafRef = useRef<number | null>(null)
    const frameCountRef = useRef(0)
    const trackFrameRef = useRef(0)

    const oldGrayRef = useRef<any>(null)
    const p0Ref = useRef<any>(null)
    const termCritRef = useRef<any>(null)

    const targetRef = useRef<{ x: number, y: number } | null>(null)
    const loadCvFn = useRef<(() => void) | null>(null)
    const cvLoadedRef = useRef(false)

    const updateStatus = useCallback((s: AnchorStatus) => {
        statusRef.current = s
        setStatus(s)
    }, [])

    const loadOpenCV = useCallback(() => {
        if (cvLoadedRef.current || (window.cv && window.cv.Mat)) {
            cvLoadedRef.current = true
            setLibReady(true)
            return
        }

        updateStatus('loading')

        ;(window as any).onloadCallback = function () {
            cvLoadedRef.current = true
            setLibReady(true)
        }

        const script = document.createElement('script')
        script.src = 'https://docs.opencv.org/4.8.0/opencv.js'
        script.async = true
        script.onload = () => {
            const checkCv = setInterval(() => {
                if (window.cv && window.cv.Mat) {
                    clearInterval(checkCv)
                    cvLoadedRef.current = true
                    setLibReady(true)
                    if (loadCvFn.current) {
                        loadCvFn.current()
                        loadCvFn.current = null
                    }
                }
            }, 50)
        }
        script.onerror = () => {
            console.warn('[VisionTrace] Could not load OpenCV.js')
            setCvError(true)
            updateStatus('idle')
        }

        document.head.appendChild(script)
    }, [updateStatus])

    useEffect(() => {
        const canvas = document.createElement('canvas')
        canvas.width = CANVAS_W
        canvas.height = CANVAS_H
        canvasRef.current = canvas
        ctxRef.current = canvas.getContext('2d', { willReadFrequently: true })

        return () => {
            if (oldGrayRef.current) oldGrayRef.current.delete()
            if (p0Ref.current) p0Ref.current.delete()
            if (termCritRef.current) termCritRef.current.delete()
        }
    }, [])

    useEffect(() => {
        if (!libReady || !window.cv) return

        let alive = true

        if (!termCritRef.current) {
            termCritRef.current = new window.cv.TermCriteria(
                window.cv.TERM_CRITERIA_EPS | window.cv.TERM_CRITERIA_COUNT, 12, 0.02
            )
        }

        const tick = () => {
            if (!alive) return

            const curStatus = statusRef.current
            if (curStatus === 'idle' || curStatus === 'loading') {
                rafRef.current = requestAnimationFrame(tick)
                return
            }

            const video = videoRef.current
            const canvas = canvasRef.current
            const ctx = ctxRef.current

            if (!video || !canvas || !ctx || video.readyState < 2) {
                rafRef.current = requestAnimationFrame(tick)
                return
            }

            frameCountRef.current++

            if (frameCountRef.current % (TRACK_SKIP_FRAMES + 1) !== 0) {
                rafRef.current = requestAnimationFrame(tick)
                return
            }

            try {
                ctx.drawImage(video, 0, 0, CANVAS_W, CANVAS_H)
                const frame = window.cv.imread(canvas)
                const gray = new window.cv.Mat()
                window.cv.cvtColor(frame, gray, window.cv.COLOR_RGBA2GRAY)
                frame.delete()

                if (curStatus === 'searching' && targetRef.current) {
                    const tx = Math.floor(targetRef.current.x * CANVAS_W)
                    const ty = Math.floor(targetRef.current.y * CANVAS_H)

                    const roiW = 60
                    const roiH = 60
                    const rx = Math.max(0, Math.min(tx - roiW / 2, CANVAS_W - roiW))
                    const ry = Math.max(0, Math.min(ty - roiH / 2, CANVAS_H - roiH))
                    const rect = new window.cv.Rect(rx, ry, roiW, roiH)
                    const roiGray = gray.roi(rect)

                    const corners = new window.cv.Mat()
                    const noMask = new window.cv.Mat()
                    window.cv.goodFeaturesToTrack(roiGray, corners, MAX_CORNERS, QUALITY_LEVEL, MIN_DISTANCE, noMask, 3, false, 0.04)

                    if (corners.rows >= 5) {
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

                        setDelta({ dx: 0, dy: 0 })
                        updateStatus('locked')
                        trackFrameRef.current = 0
                    } else {
                        updateStatus('lost')
                    }

                    roiGray.delete()
                    corners.delete()
                    noMask.delete()
                    gray.delete()

                } else if ((curStatus === 'locked' || curStatus === 'lost') && p0Ref.current && oldGrayRef.current) {
                    const p1 = new window.cv.Mat()
                    const st = new window.cv.Mat()
                    const err = new window.cv.Mat()

                    window.cv.calcOpticalFlowPyrLK(
                        oldGrayRef.current, gray, p0Ref.current, p1, st, err,
                        new window.cv.Size(WIN_SIZE, WIN_SIZE), MAX_LEVEL, termCritRef.current
                    )

                    let sumDx = 0
                    let sumDy = 0
                    let count = 0
                    const goodNew: number[] = []

                    for (let i = 0; i < st.rows; i++) {
                        if (st.data[i] === 1) {
                            const px = p1.data32F[i * 2]
                            const py = p1.data32F[i * 2 + 1]
                            const ox = p0Ref.current.data32F[i * 2]
                            const oy = p0Ref.current.data32F[i * 2 + 1]

                            sumDx += px - ox
                            sumDy += py - oy
                            count++
                            goodNew.push(px, py)
                        }
                    }

                    p1.delete()
                    st.delete()
                    err.delete()

                    trackFrameRef.current++

                    if (count >= 5) {
                        const avgDx = sumDx / count
                        const avgDy = sumDy / count

                        const scaleX = window.innerWidth / CANVAS_W
                        const scaleY = window.innerHeight / CANVAS_H

                        setDelta(prev => ({
                            dx: prev.dx + avgDx * scaleX,
                            dy: prev.dy + avgDy * scaleY,
                        }))

                        oldGrayRef.current.delete()
                        p0Ref.current.delete()

                        if (trackFrameRef.current % REDETECT_EVERY === 0) {
                            oldGrayRef.current = gray.clone()
                            p0Ref.current = window.cv.matFromArray(count, 1, window.cv.CV_32FC2, new Float32Array(goodNew))
                            trackFrameRef.current = 0
                        } else {
                            oldGrayRef.current = gray.clone()
                            p0Ref.current = window.cv.matFromArray(count, 1, window.cv.CV_32FC2, new Float32Array(goodNew))
                        }
                    } else {
                        updateStatus('lost')
                    }
                } else {
                    gray.delete()
                }

            } catch (e) {
                console.error("[VisionTrace] CV error: ", e)
                if (statusRef.current === 'locked') updateStatus('lost')
            }

            rafRef.current = requestAnimationFrame(tick)
        }

        rafRef.current = requestAnimationFrame(tick)
        return () => {
            alive = false
            if (rafRef.current) cancelAnimationFrame(rafRef.current)
        }
    }, [videoRef, updateStatus, libReady])

    const startTargeting = useCallback(() => {
        frameCountRef.current = 0
        trackFrameRef.current = 0
        setDelta({ dx: 0, dy: 0 })
        updateStatus('searching')
        targetRef.current = null
    }, [updateStatus])

    const triggerCvLoad = useCallback(() => {
        if (cvLoadedRef.current) {
            return
        }
        loadCvFn.current = () => {
            updateStatus('searching')
        }
        loadOpenCV()
    }, [loadOpenCV, updateStatus])

    const lockAnchor = useCallback((normalizedX: number, normalizedY: number) => {
        targetRef.current = { x: normalizedX, y: normalizedY }
    }, [])

    const stopTracking = useCallback(() => {
        frameCountRef.current = 0
        trackFrameRef.current = 0
        setDelta({ dx: 0, dy: 0 })
        updateStatus('idle')
        targetRef.current = null
        if (p0Ref.current) { p0Ref.current.delete(); p0Ref.current = null }
        if (oldGrayRef.current) { oldGrayRef.current.delete(); oldGrayRef.current = null }
    }, [updateStatus])

    return { status, delta, libReady, cvError, triggerCvLoad, startTargeting, lockAnchor, stopTracking }
}
