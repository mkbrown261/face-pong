import { useRef, useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import { useFaceTracking } from '../hooks/useFaceTracking'

export function WebcamOverlay() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const phase = useGameStore(s => s.phase)
  const leftFaceDetected = useGameStore(s => s.leftFaceDetected)
  const rightFaceDetected = useGameStore(s => s.rightFaceDetected)

  useFaceTracking(videoRef, canvasRef)

  return (
    <div style={{
      position: 'absolute',
      bottom: 16,
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      zIndex: 15,
      opacity: phase === 'playing' ? 0.85 : 0.5,
      transition: 'opacity 0.5s',
    }}>
      {/* Video preview container */}
      <div style={{
        position: 'relative',
        width: 200,
        height: 112,
        borderRadius: 8,
        overflow: 'hidden',
        border: `2px solid rgba(80,120,255,0.4)`,
        boxShadow: '0 0 20px rgba(80,120,255,0.3)',
      }}>
        <video
          ref={videoRef}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: 'scaleX(-1)', // Mirror for intuitive control
            display: 'block',
          }}
          muted
          playsInline
          autoPlay
        />
        
        {/* Face detection indicators */}
        <div style={{
          position: 'absolute',
          top: 4,
          left: 4,
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: leftFaceDetected ? '#00ff88' : '#ff4444',
          boxShadow: leftFaceDetected ? '0 0 8px #00ff88' : '0 0 8px #ff4444',
        }} />
        <div style={{
          position: 'absolute',
          top: 4,
          right: 4,
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: rightFaceDetected ? '#00ff88' : '#ff4444',
          boxShadow: rightFaceDetected ? '0 0 8px #00ff88' : '0 0 8px #ff4444',
        }} />

        {/* Label */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'rgba(0,0,20,0.7)',
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: 2,
          color: 'rgba(150,180,255,0.8)',
          textAlign: 'center',
          padding: '3px 0',
          textTransform: 'uppercase',
        }}>
          {(leftFaceDetected || rightFaceDetected) ? '🎯 Face Tracking Active' : '📷 Looking for faces...'}
        </div>
      </div>

      {/* Hidden canvas for face mesh processing */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  )
}
