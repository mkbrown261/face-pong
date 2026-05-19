import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../store/gameStore'

function formatTime(seconds: number): string {
  const s = Math.ceil(seconds)
  return s.toString().padStart(2, '0')
}

const REACTION_EMOJIS_HIT = ['💥', '⚡', '🔥', '💫', '✨', '🎯']
const REACTION_EMOJIS_SCORE = ['🎉', '🏆', '💪', '😱', '🙌', '🎊']
const REACTION_EMOJIS_COMBO = ['🔥🔥', '⚡⚡', '💥💥', '🚀', '🌟', '💯']

function EmojiReaction({ emoji, x, y, id }: { emoji: string; x: number; y: number; id: number }) {
  return (
    <div
      key={id}
      style={{
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        fontSize: 28,
        animation: 'emojiFloat 1.2s ease-out forwards',
        pointerEvents: 'none',
        zIndex: 25,
        textShadow: '0 0 10px rgba(255,255,255,0.5)',
      }}
    >
      {emoji}
    </div>
  )
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
      minWidth: 100,
    }}>
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 3,
        color: color,
        textTransform: 'uppercase',
        marginBottom: 2,
        textShadow: `0 0 10px ${color}88`,
      }}>{label}</div>
      <div style={{
        fontSize: 68,
        fontWeight: 900,
        color: '#ffffff',
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1,
        textShadow: `0 0 20px ${color}, 0 0 40px ${color}60`,
        transform: animating ? 'scale(1.4) translateY(-5px)' : 'scale(1) translateY(0)',
        transition: 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}>
        {score}
      </div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        marginTop: 4,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: 2,
        color: detected ? '#00ff88' : '#ff4444',
        textShadow: detected ? '0 0 8px #00ff88' : '0 0 8px #ff4444',
      }}>
        <div style={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: detected ? '#00ff88' : '#ff4444',
          boxShadow: detected ? '0 0 6px #00ff88' : '0 0 6px #ff4444',
        }} />
        {detected ? 'FACE LOCKED' : 'NO FACE'}
      </div>
    </div>
  )
}

function ComboDisplay() {
  const combo = useGameStore(s => s.combo)
  const speedTier = useGameStore(s => s.speedTier)
  const hitCount = useGameStore(s => s.hitCount)
  const [displayCombo, setDisplayCombo] = useState(0)
  const [shake, setShake] = useState(false)

  useEffect(() => {
    if (combo > displayCombo) {
      setShake(true)
      setTimeout(() => setShake(false), 300)
    }
    setDisplayCombo(combo)
  }, [combo, displayCombo])

  const speedLabels = ['', '⚡ WARMING UP', '🔥 GETTING HOT', '💥 INTENSE!!!']
  const speedColors = ['', '#ffaa00', '#ff6600', '#ff0000']

  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      textAlign: 'center',
      pointerEvents: 'none',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 6,
    }}>
      {combo >= 3 && (
        <div style={{
          fontSize: 20,
          fontWeight: 900,
          color: '#ffdd00',
          letterSpacing: 3,
          textShadow: '0 0 15px #ffaa00, 0 0 30px #ff660088',
          animation: shake ? 'comboShake 0.3s ease-out' : 'comboFloat 2s ease-in-out infinite alternate',
          textTransform: 'uppercase',
        }}>
          {combo}✕ COMBO
        </div>
      )}
      {speedTier > 0 && (
        <div style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 3,
          color: speedColors[speedTier],
          textShadow: `0 0 12px ${speedColors[speedTier]}`,
          animation: speedTier >= 3 ? 'blink 0.4s infinite' : 'none',
          textTransform: 'uppercase',
          background: `${speedColors[speedTier]}15`,
          border: `1px solid ${speedColors[speedTier]}44`,
          borderRadius: 4,
          padding: '3px 10px',
        }}>
          {speedLabels[speedTier]}
        </div>
      )}
      {/* SPEED UP flash */}
      {hitCount > 0 && hitCount % 5 === 0 && hitCount <= 20 && (
        <div style={{
          fontSize: 12,
          fontWeight: 900,
          color: '#ffffff',
          letterSpacing: 4,
          textShadow: '0 0 20px #ffffff',
          animation: 'speedUpFlash 0.8s ease-out forwards',
          textTransform: 'uppercase',
        }}>
          SPEED UP!
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
  const [prevTime, setPrevTime] = useState(Math.ceil(timeLeft))
  const [tick, setTick] = useState(false)

  useEffect(() => {
    const current = Math.ceil(timeLeft)
    if (current !== prevTime) {
      setTick(true)
      setTimeout(() => setTick(false), 200)
      setPrevTime(current)
    }
  }, [timeLeft, prevTime])

  const displayTime = Math.ceil(timeLeft)

  return (
    <div style={{ textAlign: 'center' }}>
      {/* Round indicator dots */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 6 }}>
        {Array.from({ length: maxRounds }).map((_, i) => (
          <div key={i} style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: i < round - 1 ? '#4488ff' : i === round - 1 ? '#ffffff' : 'rgba(255,255,255,0.2)',
            boxShadow: i === round - 1 ? '0 0 8px #ffffff' : 'none',
          }} />
        ))}
      </div>
      <div style={{
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: 4,
        color: 'rgba(120,160,255,0.6)',
        textTransform: 'uppercase',
        marginBottom: 3,
      }}>
        ROUND {round}
      </div>
      <div style={{
        fontSize: 52,
        fontWeight: 900,
        fontVariantNumeric: 'tabular-nums',
        color: finalSeconds ? '#ff3300' : '#ffffff',
        textShadow: finalSeconds
          ? '0 0 15px #ff3300, 0 0 30px #ff330080'
          : '0 0 10px rgba(100,150,255,0.4)',
        animation: (finalSeconds && displayTime <= 5) ? 'timerBlink 0.5s infinite' : tick ? 'timerTick 0.2s ease-out' : 'none',
        lineHeight: 1,
      }}>
        {displayTime}
      </div>
    </div>
  )
}

function FloatingEmojis() {
  const [reactions, setReactions] = useState<Array<{ id: number; emoji: string; x: number; y: number }>>([])
  const lastHitPlayer = useGameStore(s => s.lastHitPlayer)
  const combo = useGameStore(s => s.combo)
  const lastCombo = useRef(0)
  const lastHit = useRef<string | null>(null)

  useEffect(() => {
    if (lastHitPlayer && lastHitPlayer !== lastHit.current) {
      lastHit.current = lastHitPlayer
      // Only show emoji reactions for notable hits
      if (combo >= 5 || Math.random() < 0.3) {
        const emoji = combo >= 5
          ? REACTION_EMOJIS_COMBO[Math.floor(Math.random() * REACTION_EMOJIS_COMBO.length)]
          : REACTION_EMOJIS_HIT[Math.floor(Math.random() * REACTION_EMOJIS_HIT.length)]
        const x = lastHitPlayer === 'left' ? 8 + Math.random() * 15 : 77 + Math.random() * 15
        const y = 20 + Math.random() * 60
        const id = Date.now() + Math.random()
        setReactions(r => [...r, { id, emoji, x, y }].slice(-8))
        setTimeout(() => setReactions(r => r.filter(rx => rx.id !== id)), 1500)
      }
    }
  }, [lastHitPlayer, combo])

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 15 }}>
      {reactions.map(r => <EmojiReaction key={r.id} {...r} />)}
    </div>
  )
}

function ScorePopups() {
  const popups = useGameStore(s => s.scorePopups)
  const now = Date.now()

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 15 }}>
      {popups.map(popup => {
        const age = (now - popup.timestamp) / 1000
        const opacity = Math.max(0, 1 - age * 1.8)
        const translateY = -age * 100
        const scale = 1 + Math.min(age * 0.5, 0.3)
        return (
          <div key={popup.id} style={{
            position: 'absolute',
            top: '45%',
            left: popup.player === 'right' ? '78%' : '14%',
            transform: `translateY(${translateY}px) scale(${scale})`,
            fontSize: 36,
            fontWeight: 900,
            color: popup.player === 'left' ? '#ff4422' : '#2244ff',
            opacity,
            textShadow: popup.player === 'left'
              ? '0 0 15px #ff4422, 0 2px 0 #000'
              : '0 0 15px #2244ff, 0 2px 0 #000',
            letterSpacing: 1,
            pointerEvents: 'none',
            transition: 'none',
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
      {/* Top HUD bar */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        padding: '12px 28px 0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        pointerEvents: 'none',
        zIndex: 10,
        background: 'linear-gradient(to bottom, rgba(0,0,10,0.7) 0%, transparent 100%)',
      }}>
        <ScoreDisplay side="left" />
        <Timer />
        <ScoreDisplay side="right" />
      </div>

      {/* Center combo/speed display */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }}>
        <ComboDisplay />
      </div>

      {/* Score popups */}
      <ScorePopups />

      {/* Floating emoji reactions */}
      <FloatingEmojis />

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
        @keyframes timerBlink {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.92); }
        }
        @keyframes timerTick {
          0% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
        @keyframes comboShake {
          0% { transform: translateX(-5px) scale(1.2); }
          25% { transform: translateX(5px) scale(1.15); }
          50% { transform: translateX(-3px) scale(1.1); }
          75% { transform: translateX(3px) scale(1.05); }
          100% { transform: translateX(0) scale(1); }
        }
        @keyframes comboFloat {
          from { transform: translateY(0); }
          to { transform: translateY(-5px); }
        }
        @keyframes speedUpFlash {
          0% { opacity: 0; transform: scale(0.5) translateY(10px); }
          30% { opacity: 1; transform: scale(1.3) translateY(-5px); }
          60% { opacity: 1; transform: scale(1) translateY(0); }
          100% { opacity: 0; transform: scale(0.8) translateY(-20px); }
        }
        @keyframes emojiFloat {
          0% { opacity: 0; transform: scale(0.5) translateY(0); }
          20% { opacity: 1; transform: scale(1.3) translateY(-15px); }
          60% { opacity: 1; transform: scale(1) translateY(-40px); }
          100% { opacity: 0; transform: scale(0.8) translateY(-70px); }
        }
      `}</style>
    </>
  )
}
