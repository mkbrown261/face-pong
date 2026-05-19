import { useEffect, useRef, useCallback } from 'react'
import { useGameStore } from '../store/gameStore'

interface FacePosition {
  x: number // 0-1 normalized
  y: number // 0-1 normalized
  detected: boolean
}

// Smoothing buffer
class SmoothBuffer {
  private buffer: number[] = []
  private size: number
  constructor(size: number) { this.size = size }
  push(val: number): number {
    this.buffer.push(val)
    if (this.buffer.length > this.size) this.buffer.shift()
    return this.buffer.reduce((a, b) => a + b, 0) / this.buffer.length
  }
  get() {
    if (this.buffer.length === 0) return 0
    return this.buffer.reduce((a, b) => a + b, 0) / this.buffer.length
  }
}

export function useFaceTracking(
  videoRef: React.RefObject<HTMLVideoElement>,
  canvasRef: React.RefObject<HTMLCanvasElement>
) {
  const setLeftPaddleTarget = useGameStore(s => s.setLeftPaddleTarget)
  const setRightPaddleTarget = useGameStore(s => s.setRightPaddleTarget)
  const setFaceDetected = useGameStore(s => s.setFaceDetected)
  const phase = useGameStore(s => s.phase)

  const faceMeshRef = useRef<any>(null)
  const cameraRef = useRef<any>(null)
  const leftSmoothY = useRef(new SmoothBuffer(8))
  const rightSmoothY = useRef(new SmoothBuffer(8))
  const leftPrevY = useRef(0.5)
  const rightPrevY = useRef(0.5)
  const animFrameRef = useRef<number>()
  const isRunning = useRef(false)

  // Convert face y position (0-1, where 0=top) to game space (-0.8 to 0.8)
  const faceYToGameSpace = (normalizedY: number): number => {
    // Invert because video y=0 is top but game y goes up
    return (0.5 - normalizedY) * 1.6
  }

  const processFaces = useCallback((results: any) => {
    if (!results.multiFaceLandmarks) return

    const landmarks = results.multiFaceLandmarks
    const detected = [false, false]
    const yPositions: number[] = []

    for (let i = 0; i < Math.min(landmarks.length, 2); i++) {
      const face = landmarks[i]
      if (!face || face.length === 0) continue

      // Get nose tip (landmark 4) for stable vertical tracking
      const noseTip = face[4]
      const yRaw = noseTip.y

      // Deadzone filtering - ignore tiny movements
      const prevY = i === 0 ? leftPrevY.current : rightPrevY.current
      const diff = Math.abs(yRaw - prevY)
      const filteredY = diff < 0.005 ? prevY : yRaw

      if (i === 0) leftPrevY.current = filteredY
      else rightPrevY.current = filteredY

      // Smooth
      const smoothedY = i === 0 
        ? leftSmoothY.current.push(filteredY)
        : rightSmoothY.current.push(filteredY)

      yPositions[i] = smoothedY
      detected[i] = true
    }

    // Determine which face is left player and which is right
    // Left player = face on right side of video (their right = our left since mirrored)
    // We sort by x position of nose
    if (landmarks.length >= 2) {
      const face0X = landmarks[0][4].x
      const face1X = landmarks[1][4].x

      let leftFaceIdx = face0X > face1X ? 0 : 1
      let rightFaceIdx = leftFaceIdx === 0 ? 1 : 0

      const leftY = faceYToGameSpace(yPositions[leftFaceIdx] ?? 0.5)
      const rightY = faceYToGameSpace(yPositions[rightFaceIdx] ?? 0.5)

      setLeftPaddleTarget(Math.max(-0.85, Math.min(0.85, leftY)))
      setRightPaddleTarget(Math.max(-0.85, Math.min(0.85, rightY)))
      setFaceDetected('left', detected[leftFaceIdx])
      setFaceDetected('right', detected[rightFaceIdx])
    } else if (landmarks.length === 1) {
      // Only one face - map to nearest paddle
      const faceX = landmarks[0][4].x
      const faceY = faceYToGameSpace(yPositions[0] ?? 0.5)
      const clampedY = Math.max(-0.85, Math.min(0.85, faceY))
      
      if (faceX > 0.5) {
        setLeftPaddleTarget(clampedY)
        setFaceDetected('left', true)
        setFaceDetected('right', false)
      } else {
        setRightPaddleTarget(clampedY)
        setFaceDetected('right', true)
        setFaceDetected('left', false)
      }
    } else {
      setFaceDetected('left', false)
      setFaceDetected('right', false)
    }
  }, [setLeftPaddleTarget, setRightPaddleTarget, setFaceDetected])

  useEffect(() => {
    let stream: MediaStream | null = null

    const initCamera = async () => {
      try {
        // Get webcam stream
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
          audio: false
        })

        if (!videoRef.current) return
        videoRef.current.srcObject = stream
        await videoRef.current.play()

        // Load MediaPipe FaceMesh
        const FaceMesh = (window as any).FaceMesh
        if (!FaceMesh) {
          // Fallback: use mouse/keyboard controls
          console.log('FaceMesh not available, using fallback controls')
          startFallbackControls()
          return
        }

        const faceMesh = new FaceMesh({
          locateFile: (file: string) => 
            `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
        })

        faceMesh.setOptions({
          maxNumFaces: 2,
          refineLandmarks: false,
          minDetectionConfidence: 0.7,
          minTrackingConfidence: 0.6,
        })

        faceMesh.onResults(processFaces)
        faceMeshRef.current = faceMesh

        // Process video frames
        isRunning.current = true
        const processFrame = async () => {
          if (!isRunning.current || !videoRef.current) return
          if (videoRef.current.readyState >= 2) {
            try {
              await faceMesh.send({ image: videoRef.current })
            } catch (e) {
              // Ignore frame errors
            }
          }
          animFrameRef.current = requestAnimationFrame(() => {
            setTimeout(processFrame, 33) // ~30fps for face tracking
          })
        }
        processFrame()

      } catch (err) {
        console.warn('Camera/FaceMesh init failed:', err)
        startFallbackControls()
      }
    }

    const startFallbackControls = () => {
      // Keyboard fallback: W/S for left, Up/Down for right
      const handleKey = (e: KeyboardEvent) => {
        const state = useGameStore.getState()
        const step = 0.08
        switch (e.key) {
          case 'w': setLeftPaddleTarget(Math.min(0.85, state.leftPaddleTarget + step)); break
          case 's': setLeftPaddleTarget(Math.max(-0.85, state.leftPaddleTarget - step)); break
          case 'ArrowUp': setRightPaddleTarget(Math.min(0.85, state.rightPaddleTarget + step)); break
          case 'ArrowDown': setRightPaddleTarget(Math.max(-0.85, state.rightPaddleTarget - step)); break
        }
      }
      window.addEventListener('keydown', handleKey)
      
      // Also mark faces as detected for keyboard mode
      setFaceDetected('left', true)
      setFaceDetected('right', true)

      return () => window.removeEventListener('keydown', handleKey)
    }

    // Try to load MediaPipe from CDN first
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js'
    script.crossOrigin = 'anonymous'
    script.onload = () => initCamera()
    script.onerror = () => {
      // If CDN fails, init camera without face mesh
      initCamera()
    }
    document.head.appendChild(script)

    return () => {
      isRunning.current = false
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      if (faceMeshRef.current) {
        try { faceMeshRef.current.close() } catch (e) {}
      }
      if (stream) {
        stream.getTracks().forEach(t => t.stop())
      }
    }
  }, [processFaces, setFaceDetected, setLeftPaddleTarget, setRightPaddleTarget, videoRef])

  return { isTracking: isRunning.current }
}
