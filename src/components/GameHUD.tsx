import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../store/gameStore'

function formatTime(seconds: number): string {
  const s = Math.ceil(seconds)
  return s.toString().padStart(2, '0')
}

function ScoreDisplay({ side }: { side: 'left' | 'right' }) {
  const score = useGameStore(s => side === 'left' ? s.leftScore : s.rightScore)
  const detected = useGameStore(s => side === 'left' ? s.leftFaceDetected : s.rightFaceDetected)
  const [prevScore, setPrevScore] = useState(score)
  const [animating, setAnimating] = useState(false)

  useEffect(() => {
    if (score !== prevScore) {
      setAnimating(true)
      setPrevScore(score)
      setTimeout(() => setAnimating(false), 600)
    }
  }, [score, prevScore])

  const color = side === 'left' ? '#ff4422' : '#2244ff'
  const label = side === 'left' ? 'P1' : 'P2'

  return (
    <div style={{
      textAlign: 'center',
      position: 'relative',
    }}>
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 3,
        color: color,
        textTransform: 'uppercase',
        marginBottom: 4,
        opacity: 0.9,
      }}>{label}</div>
      <div style={{
        fontSize: 72,
        fontWeight: 900,
        color: '#ffffff',
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1,
        textShadow: `0 0 30px ${color}, 0 0 60px ${color}40`,
        transform: animating ? 'scale(1.3)' : 'scale(1)',
        transition: 'transform 0.1s ease-out',
        minWidth: 80,
      }}>
        {score}
      </div>
      {/* Face detection indicator */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        marginTop: 4,
        fontSize: 10,
        color: detected ? '#00ff88' : '#ff4444',
        fontWeight: 600,
        letterSpacing: 1,
      }}>
        <div style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: detected ? '#00ff88' : '#ff4444',
          boxShadow: detected ? '0 0 8px #00ff88' : '0 0 8px #ff4444',
          animation: detected ? 'pulse 1.5s infinite' : 'none',
        }} />
        {detected ? 'TRACKED' : 'NO FACE'}
      </div>
    </div>
  )
}

function ComboDisplay() {
  const combo = useGameStore(s => s.combo)
  const hitCount = useGameStore(s => s.hitCount)
  const speedTier = useGameStore(s => s.speedTier)
  const [visible, setVisible] = useState(false)
  const [prevCombo, setPrevCombo] = useState(0)

  useEffect(() => {
    if (combo > prevCombo && combo >= 3) {
      setVisible(true)
    }
    if (combo === 0) setVisible(false)
    setPrevCombo(combo)
  }, [combo, prevCombo])

  const speedLabels = ['', 'WARMING UP', 'GETTING HOT', 'INTENSE!']
  const speedColors = ['', '#ffaa00', '#ff6600', '#ff0000']

  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      textAlign: 'center',
      pointerEvents: 'none',
    }}>
      {combo >= 3 && (
        <div style={{
          animation: 'popIn 0.3s ease-out',
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.3s',
        }}>
          <div style={{
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: 4,
            color: '#ffdd00',
            textTransform: 'uppercase',
            textShadow: '0 0 20px #ffaa00',
          }}>
            {combo}x COMBO!
          </div>
        </div>
      )}
      {speedTier > 0 && (
        <div style={{
          marginTop: 8,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 3,
          color: speedColors[speedTier],
          textShadow: `0 0 15px ${speedColors[speedTier]}`,
          animation: 'blink 0.5s infinite',
          textTransform: 'uppercase',
        }}>
          ⚡ {speedLabels[speedTier]}
        </div>
      )}
      {hitCount >= 10 && hitCount % 5 === 0 && (
        <div style={{
          fontSize: 10,
          color: '#aaaaff',
          marginTop: 4,
          letterSpacing: 2,
        }}>
          {hitCount} HITS
        </div>
      )}
    </div>
  )
}

function Timer() {
  const timeLeft = useGameStore(s => s.timeLeft)
  const finalSeconds = useGameStore(s => s.finalSeconds)
  const round = useGameStore(s => s.round)
  const maxRounds = useGameStore(s => s.maxRounds)

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 4,
        color: 'rgba(150,180,255,0.7)',
        textTransform: 'uppercase',
        marginBottom: 4,
      }}>
        ROUND {round}/{maxRounds}
      </div>
      <div style={{
        fontSize: 44,
        fontWeight: 900,
        fontVariantNumeric: 'tabular-nums',
        color: finalSeconds ? '#ff3300' : '#ffffff',
        textShadow: finalSeconds
          ? '0 0 20px #ff3300, 0 0 40px #ff330060'
          : '0 0 15px rgba(100,150,255,0.5)',
        animation: finalSeconds && timeLeft <= 5 ? 'blink 0.5s infinite' : 'none',
        lineHeight: 1,
      }}>
        {formatTime(timeLeft)}
      </div>
    </div>
  )
}

function ScorePopups() {
  const popups = useGameStore(s => s.scorePopups)
  
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {popups.map(popup => {
        const age = (Date.now() - popup.timestamp) / 1000
        const opacity = Math.max(0, 1 - age * 2)
        const y = 50 + age * -80
        return (
          <div key={popup.id} style={{
            position: 'absolute',
            top: `${y}%`,
            left: popup.player === 'left' ? '20%' : '75%',
            transform: 'translateX(-50%)',
            fontSize: 28,
            fontWeight: 900,
            color: popup.player === 'left' ? '#ff4422' : '#2244ff',
            opacity,
            textShadow: popup.player === 'left' 
              ? '0 0 20px #ff4422' 
              : '0 0 20px #2244ff',
            letterSpacing: 2,
            pointerEvents: 'none',
          }}>
            +1
          </div>
        )
      })}
    </div>
  )
}

export function GameHUD() {
  const phase = useGameStore(s => s.phase)
  
  if (phase !== 'playing') return null

  return (
    <>
      {/* Main HUD */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        padding: '16px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        pointerEvents: 'none',
        zIndex: 10,
      }}>
        <ScoreDisplay side="left" />
        <Timer />
        <ScoreDisplay side="right" />
      </div>

      {/* Combo display in center */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }}>
        <ComboDisplay />
      </div>

      {/* Score popups */}
      <ScorePopups />

      {/* Style tags */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.8); }
        }
        @keyframes popIn {
          0% { transform: scale(0.5); opacity: 0; }
          60% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes slideDown {
          from { transform: translateY(-40px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes fadeInUp {
          from { transform: translateY(30px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 20px currentColor; }
          50% { box-shadow: 0 0 40px currentColor; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  )
}
