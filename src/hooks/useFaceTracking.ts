/**
 * useFaceTracking — high-accuracy, low-latency MediaPipe face tracking
 *
 * Key improvements over v1:
 * - Multi-landmark averaging (forehead + nose + chin) for vertical stability
 * - Per-player calibration range (auto-learns min/max Y over first 2 seconds)
 * - Adaptive deadzone — wider when still, tighter when moving
 * - Exponential moving average (EMA) instead of simple average buffer
 * - Separate processing loop (30 fps) from render loop (60 fps) to avoid blocking
 * - Velocity-based prediction to compensate for detection latency
 * - Graceful degradation to keyboard if camera/MediaPipe unavailable
 */

import { useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'

// Landmarks used for vertical tracking (averaged together)
// 10 = forehead-center, 168 = nose bridge, 4 = nose tip, 152 = chin center
const V_LANDMARKS = [10, 168, 4, 152]

// ── Exponential Moving Average ─────────────────────────────────────────────
class EMA {
  private value: number | null = null
  private alpha: number
  constructor(smoothing: number) {
    // smoothing: 1 = instant (no smoothing), 10 = very smooth
    this.alpha = 2 / (smoothing + 1)
  }
  update(alpha: number) { this.alpha = 2 / (alpha + 1) }
  push(v: number): number {
    if (this.value === null) { this.value = v; return v }
    this.value = this.alpha * v + (1 - this.alpha) * this.value
    return this.value
  }
  get() { return this.value ?? 0 }
}

// ── Calibration range (auto-scales player's head range to full paddle travel) ─
class CalibRange {
  min = 0.3; max = 0.7        // start with conservative defaults
  private seenMin = 0.3; private seenMax = 0.7
  private warmup = true; private warmupFrames = 0; private readonly warmupTarget = 90

  feed(raw: number) {
    if (this.warmup) {
      this.seenMin = Math.min(this.seenMin, raw)
      this.seenMax = Math.max(this.seenMax, raw)
      this.warmupFrames++
      if (this.warmupFrames >= this.warmupTarget) {
        this.min = this.seenMin; this.max = this.seenMax; this.warmup = false
      }
    } else {
      // Slowly track drift
      this.min = Math.min(this.min, raw) * 0.995 + this.min * 0.005
      this.max = Math.max(this.max, raw) * 0.995 + this.max * 0.005
    }
  }

  // Map raw [min..max] → game space [-0.85..0.85]
  normalize(raw: number): number {
    const range = this.max - this.min
    if (range < 0.02) return 0  // not enough calibration data
    const t = Math.max(0, Math.min(1, (raw - this.min) / range))
    return (t - 0.5) * 1.7  // invert: head up → positive y
  }

  get isReady() { return !this.warmup }
}

// ── Velocity predictor (reduces perceived latency) ─────────────────────────
class VelocityPredictor {
  private prev = 0; private vel = 0; private readonly alpha = 0.3
  push(v: number, dt: number): number {
    const rawVel = dt > 0 ? (v - this.prev) / dt : 0
    this.vel = this.alpha * rawVel + (1 - this.alpha) * this.vel
    this.prev = v
    return v + this.vel * 0.05  // predict ~50ms ahead
  }
}

interface PlayerTracker {
  ema: EMA
  calib: CalibRange
  predictor: VelocityPredictor
  lastRaw: number
  lastY: number
  detected: boolean
  lastDetectedTime: number
}

function makeTracker(smoothing: number): PlayerTracker {
  return {
    ema: new EMA(smoothing),
    calib: new CalibRange(),
    predictor: new VelocityPredictor(),
    lastRaw: 0.5,
    lastY: 0,
    detected: false,
    lastDetectedTime: 0,
  }
}

export function useFaceTracking(
  videoRef: React.RefObject<HTMLVideoElement>,
) {
  const setLeftPaddleTarget = useGameStore(s => s.setLeftPaddleTarget)
  const setRightPaddleTarget = useGameStore(s => s.setRightPaddleTarget)
  const setFaceDetected = useGameStore(s => s.setFaceDetected)
  const settings = useGameStore(s => s.settings)

  const trackers = useRef<[PlayerTracker, PlayerTracker]>([
    makeTracker(settings.smoothing),
    makeTracker(settings.smoothing),
  ])
  const isRunning = useRef(false)
  const frameTimer = useRef<ReturnType<typeof setTimeout>>()
  const faceMeshRef = useRef<any>(null)
  const lastFrameTime = useRef(0)
  const keyboardState = useRef({ w: false, s: false, up: false, down: false })
  const keyboardFallback = useRef(false)

  // Update EMA alpha when settings.smoothing changes
  useEffect(() => {
    trackers.current[0].ema.update(settings.smoothing)
    trackers.current[1].ema.update(settings.smoothing)
  }, [settings.smoothing])

  // ── Keyboard fallback ────────────────────────────────────────────────────
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (['w','s','ArrowUp','ArrowDown'].includes(e.key)) e.preventDefault()
      if (e.key === 'w') keyboardState.current.w = true
      if (e.key === 's') keyboardState.current.s = true
      if (e.key === 'ArrowUp') keyboardState.current.up = true
      if (e.key === 'ArrowDown') keyboardState.current.down = true
    }
    const onUp = (e: KeyboardEvent) => {
      if (e.key === 'w') keyboardState.current.w = false
      if (e.key === 's') keyboardState.current.s = false
      if (e.key === 'ArrowUp') keyboardState.current.up = false
      if (e.key === 'ArrowDown') keyboardState.current.down = false
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)

    // Keyboard update loop
    let kbAnim: number
    const SPEED = 1.6 // units/sec
    let prevT = 0
    const kbLoop = (t: number) => {
      const dt = Math.min((t - prevT) / 1000, 0.05); prevT = t
      const st = useGameStore.getState()
      if (keyboardFallback.current) {
        let ly = st.leftPaddleTarget
        let ry = st.rightPaddleTarget
        if (keyboardState.current.w) ly = Math.min(0.88, ly + SPEED * dt)
        if (keyboardState.current.s) ly = Math.max(-0.88, ly - SPEED * dt)
        if (keyboardState.current.up) ry = Math.min(0.88, ry + SPEED * dt)
        if (keyboardState.current.down) ry = Math.max(-0.88, ry - SPEED * dt)
        if (ly !== st.leftPaddleTarget) setLeftPaddleTarget(ly)
        if (ry !== st.rightPaddleTarget) setRightPaddleTarget(ry)
      }
      kbAnim = requestAnimationFrame(kbLoop)
    }
    kbAnim = requestAnimationFrame(kbLoop)

    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      cancelAnimationFrame(kbAnim)
    }
  }, [setLeftPaddleTarget, setRightPaddleTarget])

  // ── MediaPipe processing ────────────────────────────────────────────────
  useEffect(() => {
    let stream: MediaStream | null = null
    let scriptEl: HTMLScriptElement | null = null

    const getLandmarkY = (face: any[]): number => {
      if (!face || face.length === 0) return 0.5
      let sum = 0; let count = 0
      for (const idx of V_LANDMARKS) {
        if (face[idx]) { sum += face[idx].y; count++ }
      }
      return count > 0 ? sum / count : face[4]?.y ?? 0.5
    }

    const processResults = (results: any) => {
      const now = performance.now()
      const dt = (now - lastFrameTime.current) / 1000
      lastFrameTime.current = now

      const faces = results.multiFaceLandmarks ?? []
      const s = useGameStore.getState().settings

      if (faces.length === 0) {
        trackers.current[0].detected = false
        trackers.current[1].detected = false
        setFaceDetected('left', false)
        setFaceDetected('right', false)
        return
      }

      // Sort faces by X (nose tip) — leftmost face in video = right player
      // (video is mirrored, so player on physical left appears on right in video)
      const sorted = [...faces].sort((a, b) => (a[4]?.x ?? 0) - (b[4]?.x ?? 0))

      // Face 0 (leftmost in video) = Right player physically (they're on the right side of the camera)
      // Face 1 (rightmost in video) = Left player physically
      // With mirrored video: rightmost face in frame = left player in game
      const assignments: Array<{ face: any; tracker: PlayerTracker; setTarget: (y: number) => void; player: 'left' | 'right' }> = []

      if (sorted.length >= 2) {
        // Two faces — assign by position
        assignments.push({ face: sorted[1], tracker: trackers.current[0], setTarget: setLeftPaddleTarget, player: 'left' })
        assignments.push({ face: sorted[0], tracker: trackers.current[1], setTarget: setRightPaddleTarget, player: 'right' })
      } else {
        // One face — determine side by nose X position
        const noseX = sorted[0][4]?.x ?? 0.5
        if (noseX > 0.5) {
          // face on right side of frame → left player
          assignments.push({ face: sorted[0], tracker: trackers.current[0], setTarget: setLeftPaddleTarget, player: 'left' })
          setFaceDetected('right', false)
        } else {
          assignments.push({ face: sorted[0], tracker: trackers.current[1], setTarget: setRightPaddleTarget, player: 'right' })
          setFaceDetected('left', false)
        }
      }

      for (const { face, tracker, setTarget, player } of assignments) {
        const rawY = getLandmarkY(face)

        // Adaptive deadzone — larger when slow, smaller when fast
        const delta = Math.abs(rawY - tracker.lastRaw)
        const dz = s.deadzone * (delta < 0.02 ? 1.5 : 0.5)
        const filtered = delta < dz ? tracker.lastRaw : rawY
        tracker.lastRaw = filtered

        // Calibration
        tracker.calib.feed(filtered)

        // EMA smoothing
        const smoothed = tracker.ema.push(filtered)

        // Velocity prediction
        const predicted = tracker.predictor.push(smoothed, dt)

        // Map to game space with sensitivity
        let gameY = tracker.calib.normalize(predicted) * s.sensitivity

        // Hard clamp
        gameY = Math.max(-0.88, Math.min(0.88, gameY))

        tracker.detected = true
        tracker.lastDetectedTime = now
        tracker.lastY = gameY

        setTarget(gameY)
        setFaceDetected(player, true)
      }
    }

    const startProcessing = (mesh: any) => {
      isRunning.current = true
      const tick = async () => {
        if (!isRunning.current || !videoRef.current) return
        if (videoRef.current.readyState >= 2 && !videoRef.current.paused) {
          try { await mesh.send({ image: videoRef.current }) } catch (_) {}
        }
        // 30fps face tracking — enough for smooth play, keeps CPU low
        frameTimer.current = setTimeout(tick, 33)
      }
      tick()
    }

    const initFaceMesh = async (stream: MediaStream) => {
      if (!videoRef.current) return
      videoRef.current.srcObject = stream
      videoRef.current.onloadedmetadata = () => videoRef.current?.play()

      const FaceMesh = (window as any).FaceMesh
      if (!FaceMesh) {
        console.warn('MediaPipe not loaded, using keyboard fallback')
        keyboardFallback.current = true
        setFaceDetected('left', true)
        setFaceDetected('right', true)
        return
      }

      const mesh = new FaceMesh({
        locateFile: (f: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4/${f}`
      })
      mesh.setOptions({
        maxNumFaces: 2,
        refineLandmarks: false,       // faster without iris tracking
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.5,
        selfieMode: false,            // we flip via CSS, not model
      })
      mesh.onResults(processResults)
      faceMeshRef.current = mesh
      startProcessing(mesh)
    }

    const init = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 }, height: { ideal: 480 },
            frameRate: { ideal: 30, max: 30 },
            facingMode: 'user',
          },
          audio: false,
        })

        // Load MediaPipe script then init
        scriptEl = document.createElement('script')
        scriptEl.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4/face_mesh.js'
        scriptEl.crossOrigin = 'anonymous'
        scriptEl.onload = () => initFaceMesh(stream!)
        scriptEl.onerror = () => {
          console.warn('MediaPipe script failed to load')
          keyboardFallback.current = true
          setFaceDetected('left', true); setFaceDetected('right', true)
          if (videoRef.current && stream) {
            videoRef.current.srcObject = stream
            videoRef.current.play()
          }
        }
        document.head.appendChild(scriptEl)
      } catch (err) {
        console.warn('Camera unavailable:', err)
        keyboardFallback.current = true
        setFaceDetected('left', true); setFaceDetected('right', true)
      }
    }

    init()

    return () => {
      isRunning.current = false
      if (frameTimer.current) clearTimeout(frameTimer.current)
      if (faceMeshRef.current) try { faceMeshRef.current.close() } catch (_) {}
      if (stream) stream.getTracks().forEach(t => t.stop())
      if (scriptEl && scriptEl.parentNode) scriptEl.parentNode.removeChild(scriptEl)
    }
  }, []) // only init once — settings are read dynamically inside the loop

  return { keyboardFallback: keyboardFallback.current }
}
