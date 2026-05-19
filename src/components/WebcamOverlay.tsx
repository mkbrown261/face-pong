import { useRef, useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import { useFaceTracking } from '../hooks/useFaceTracking'
import { webRTC } from '../net/WebRTCManager'

export function WebcamOverlay() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const phase = useGameStore(s => s.phase)
  const leftFaceDetected  = useGameStore(s => s.leftFaceDetected)
  const rightFaceDetected = useGameStore(s => s.rightFaceDetected)
  const online = useGameStore(s => s.online)

  useFaceTracking(videoRef)

  // ── In online mode, forward our paddle to the peer in real-time ──────────
  useEffect(() => {
    if (!online.connected) return
    let raf: number
    const loop = () => {
      const st = useGameStore.getState()
      if (online.isHost) {
        // Host controls left paddle
        webRTC.sendPaddle(st.leftPaddleTarget)
        // Host also sends authoritative ball + score
        webRTC.send({ type: 'ball', x: st.ballX, y: st.ballY, vx: st.ballVX, vy: st.ballVY })
        webRTC.send({ type: 'score', left: st.leftScore, right: st.rightScore })
      } else {
        // Guest controls right paddle
        webRTC.sendPaddle(st.rightPaddleTarget)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [online.connected, online.isHost])

  const modeLabel = online.connected
    ? online.isHost
      ? '🔴 You: Left Paddle'
      : '🔵 You: Right Paddle'
    : '🎭 Shared Camera'

  return (
    <div style={{
      position: 'absolute',
      bottom: 14,
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      zIndex: 15,
      opacity: phase === 'playing' ? 0.9 : 0.6,
      transition: 'opacity 0.4s',
    }}>
      <div style={{
        position: 'relative',
        width: 190,
        height: 108,
        borderRadius: 8,
        overflow: 'hidden',
        border: '1.5px solid rgba(80,120,255,0.35)',
        boxShadow: '0 0 18px rgba(80,120,255,0.25)',
      }}>
        <video ref={videoRef}
          style={{ width:'100%', height:'100%', objectFit:'cover', transform:'scaleX(-1)', display:'block' }}
          muted playsInline autoPlay
        />
        {/* Face dots */}
        <div style={{ position:'absolute', top:5, left:5, width:7, height:7, borderRadius:'50%',
          background: leftFaceDetected ? '#00ff88' : '#ff4444',
          boxShadow: leftFaceDetected ? '0 0 7px #00ff88' : '0 0 7px #ff4444' }}
        />
        <div style={{ position:'absolute', top:5, right:5, width:7, height:7, borderRadius:'50%',
          background: rightFaceDetected ? '#00ff88' : '#ff4444',
          boxShadow: rightFaceDetected ? '0 0 7px #00ff88' : '0 0 7px #ff4444' }}
        />
        {/* Online latency badge */}
        {online.connected && online.peerLatency > 0 && (
          <div style={{
            position:'absolute', top:5, left:'50%', transform:'translateX(-50%)',
            fontSize:9, fontWeight:700, color: online.peerLatency < 80 ? '#00ff88' : online.peerLatency < 150 ? '#ffaa00' : '#ff4444',
            background:'rgba(0,0,0,0.6)', borderRadius:4, padding:'1px 5px', letterSpacing:0.5,
          }}>
            {online.peerLatency}ms
          </div>
        )}
        {/* Bottom bar */}
        <div style={{
          position:'absolute', bottom:0, left:0, right:0,
          background:'rgba(0,0,20,0.75)', fontSize:9, fontWeight:700,
          letterSpacing:1, color:'rgba(140,170,255,0.85)', textAlign:'center', padding:'3px 0',
        }}>
          {leftFaceDetected || rightFaceDetected ? `🎯 ${modeLabel}` : '📷 Looking...'}
        </div>
      </div>
    </div>
  )
}
