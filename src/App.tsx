import { GameCanvas } from './components/GameCanvas'
import { GameHUD } from './components/GameHUD'
import { MenuScreen } from './components/MenuScreen'
import { RoundEndScreen, GameOverScreen } from './components/RoundEndScreen'
import { WebcamOverlay } from './components/WebcamOverlay'
import { SettingsPanel } from './components/SettingsPanel'
import { useGameStore } from './store/gameStore'
import { audioEngine } from './audio/AudioEngine'
import { useState } from 'react'

export function App() {
  const phase = useGameStore(s => s.phase)
  const settingsOpen = useGameStore(s => s.settingsOpen)
  const setSettingsOpen = useGameStore(s => s.setSettingsOpen)
  const speedTier = useGameStore(s => s.speedTier)

  return (
    <div style={{
      width: '100vw', height: '100vh', overflow: 'hidden',
      background: '#000005', position: 'relative',
      fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    }}>
      {/* Game Canvas — always rendered */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <GameCanvas />
      </div>

      {/* HUD */}
      <GameHUD />

      {/* Webcam + face tracking */}
      {(phase === 'playing' || phase === 'roundEnd') && <WebcamOverlay />}

      {/* Screens */}
      <MenuScreen />
      <RoundEndScreen />
      <GameOverScreen />

      {/* Settings panel (accessible from anywhere) */}
      {settingsOpen && <SettingsPanel />}

      {/* Settings gear button — visible when playing */}
      {phase === 'playing' && !settingsOpen && (
        <button
          onClick={() => { setSettingsOpen(true) }}
          style={{
            position: 'absolute', top: 12, right: 12, zIndex: 20,
            width: 34, height: 34, borderRadius: '50%',
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(200,220,255,0.7)',
            fontSize: 16, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s', fontFamily: 'inherit',
          }}
          title="Settings"
        >⚙️</button>
      )}

      {/* Speed tier chromatic aberration hint */}
      {speedTier >= 3 && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          mixBlendMode: 'screen',
          background: 'linear-gradient(90deg, rgba(255,0,0,0.025) 0%, transparent 33%, rgba(0,0,255,0.025) 66%, transparent 100%)',
        }} />
      )}

      {/* Vignette */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,8,0.38) 100%)',
      }} />
    </div>
  )
}
