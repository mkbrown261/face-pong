import { useEffect, useRef } from 'react'
import { GameCanvas } from './components/GameCanvas'
import { GameHUD } from './components/GameHUD'
import { MenuScreen } from './components/MenuScreen'
import { RoundEndScreen, GameOverScreen } from './components/RoundEndScreen'
import { WebcamOverlay } from './components/WebcamOverlay'
import { useGameStore } from './store/gameStore'
import { audioEngine } from './audio/AudioEngine'

export function App() {
  const phase = useGameStore(s => s.phase)
  const finalSeconds = useGameStore(s => s.finalSeconds)
  const speedTier = useGameStore(s => s.speedTier)

  // Keyboard support hint
  const showKeyHint = phase === 'playing'

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      background: '#000005',
      position: 'relative',
      fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    }}>
      {/* Game Canvas - always rendered as background */}
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <GameCanvas />
      </div>

      {/* Game HUD overlay */}
      <GameHUD />

      {/* Webcam overlay */}
      {(phase === 'playing' || phase === 'roundEnd') && <WebcamOverlay />}

      {/* Menu Screen */}
      <MenuScreen />

      {/* Round End Screen */}
      <RoundEndScreen />

      {/* Game Over Screen */}
      <GameOverScreen />

      {/* Keyboard hint */}
      {showKeyHint && (
        <div style={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          fontSize: 9,
          color: 'rgba(100,120,160,0.4)',
          letterSpacing: 1,
          textAlign: 'right',
          fontWeight: 600,
          pointerEvents: 'none',
        }}>
          FALLBACK: W/S → P1 | ↑↓ → P2
        </div>
      )}

      {/* Chrome aberration overlay for intense moments */}
      {speedTier >= 3 && (
        <div style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          mixBlendMode: 'screen',
          background: 'linear-gradient(90deg, rgba(255,0,0,0.03) 0%, transparent 33%, rgba(0,0,255,0.03) 66%, transparent 100%)',
        }} />
      )}

      {/* Vignette */}
      <div style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,8,0.4) 100%)',
      }} />
    </div>
  )
}
