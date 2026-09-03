import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../store/gameStore'

function formatTime(seconds: number): string {
  const s = Math.ceil(seconds)
  return s.toString().padStart(2, '0')
}

const REACTION_EMOJIS_HIT   = ['💥', '⚡', '🔥', '💫', '✨', '🎯']
const REACTION_EMOJIS_SCORE = ['🎉', '🏆', '💪', '😱', '🙌', '🎊']
const REACTION_EMOJIS_COMBO = ['🔥🔥', '⚡⚡', '💥💥', '🚀', '🌟', '💯']

const TIER_LABELS = ['', '⚡ SPEED', '👻 PHANTOM', '🔥 FIREBALL', '🚀 MISSILE']
const TIER_COLORS = ['', '#00ff44', '#c77dff', '#ff8800', '#ff2200']
const TIER_BG     = ['', '#00ff4415', '#c77dff15', '#ff880015', '#ff220015']
const TIER_EMOJIS = ['', '⚡', '👻', '🔥', '🚀']

function EmojiReaction({ emoji, x, y, id }: { emoji: string; x: number; y: number; id: number }) {
  return (
    <div key={id} style={{
      position: 'absolute',
      left: `${x}%`, top: `${y}%`,
      fontSize: 28,
      animation: 'emojiFloat 1.2s ease-out forwards',
      pointerEvents: 'none', zIndex: 25,
      textShadow: '0 0 10px rgba(255,255,255,0.5)',
    }}>
      {emoji}
    </div>
  )
}

// ── Power-Up Streak Bar ──────────────────────────────────────────────────────
function PowerBar({ side }: { side: 'left' | 'right' }) {
  const streak    = useGameStore(s => side === 'left' ? s.leftStreak  : s.rightStreak)
  const tier      = useGameStore(s => side === 'left' ? s.leftPowerTier : s.rightPowerTier)
  const tierJust  = useGameStore(s => s.tierJustReached)
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    if (tierJust && tierJust.side === side) {
      setFlash(true)
      setTimeout(() => setFlash(false), 800)
    }
  }, [tierJust, side])

  const THRESHOLDS = [3, 5, 7, 9]
  const maxStreak  = 9
  const nextThresh = THRESHOLDS.find(t => t > (streak % 10 || streak)) ?? 9

  // Which segment we're filling toward
  const progress   = Math.min(streak / maxStreak, 1)
  const tierColor  = TIER_COLORS[tier] || '#ffffff'
  const isRight    = side === 'right'

  if (tier === 0 && streak === 0) return null

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: isRight ? 'flex-end' : 'flex-start',
      gap: 3,
      minWidth: 120,
    }}>
      {/* Active tier label */}
      {tier > 0 && (
        <div style={{
          fontSize: 9,
          fontWeight: 900,
          letterSpacing: 3,
          color: tierColor,
          textShadow: `0 0 10px ${tierColor}`,
          animation: flash ? 'tierFlash 0.8s ease-out' : 'none',
          background: TIER_BG[tier],
          border: `1px solid ${tierColor}44`,
          borderRadius: 3,
          padding: '2px 8px',
          textTransform: 'uppercase',
        }}>
          {TIER_LABELS[tier]}
        </div>
      )}

      {/* Streak pip bar */}
      <div style={{
        display: 'flex',
        gap: 3,
        flexDirection: isRight ? 'row-reverse' : 'row',
      }}>
        {[3, 5, 7, 9].map((thresh, i) => {
          const filled = streak >= thresh
          const partial = !filled && streak > (i === 0 ? 0 : [3,5,7][i-1])
          const pct = partial
            ? ((streak - (i === 0 ? 0 : [3,5,7][i-1])) / (thresh - (i === 0 ? 0 : [3,5,7][i-1]))) * 100
            : filled ? 100 : 0

          return (
            <div key={thresh} style={{ position: 'relative' }}>
              {/* Segment emoji label */}
              <div style={{
                fontSize: 8,
                textAlign: 'center',
                marginBottom: 2,
                opacity: filled ? 1 : 0.35,
              }}>{TIER_EMOJIS[i+1]}</div>
              {/* Bar segment */}
              <div style={{
                width: 22,
                height: 6,
                borderRadius: 3,
                background: 'rgba(255,255,255,0.08)',
                border: filled ? `1px solid ${TIER_COLORS[i+1]}88` : '1px solid rgba(255,255,255,0.1)',
                overflow: 'hidden',
                position: 'relative',
              }}>
                <div style={{
                  position: 'absolute',
                  left: 0, top: 0, bottom: 0,
                  width: `${pct}%`,
                  background: filled
                    ? `linear-gradient(90deg, ${TIER_COLORS[i+1]}, ${TIER_COLORS[i+1]}cc)`
                    : `linear-gradient(90deg, rgba(255,255,255,0.5), rgba(255,255,255,0.3))`,
                  borderRadius: 3,
                  boxShadow: filled ? `0 0 6px ${TIER_COLORS[i+1]}` : 'none',
                  transition: 'width 0.15s ease-out',
                }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Streak count */}
      <div style={{
        fontSize: 8,
        color: 'rgba(180,200,255,0.5)',
        letterSpacing: 1,
        fontWeight: 700,
      }}>
        {streak} HIT{streak !== 1 ? 'S' : ''} IN A ROW
      </div>
    </div>
  )
}

// ── Tier unlock announce banner ───────────────────────────────────────────────
function TierAnnounce() {
  const tierJust = useGameStore(s => s.tierJustReached)
  const [shown, setShown]   = useState<typeof tierJust>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (tierJust && tierJust.tier > 0) {
      setShown(tierJust)
      setVisible(true)
      const t = setTimeout(() => setVisible(false), 2200)
      return () => clearTimeout(t)
    }
  }, [tierJust])

  if (!shown || !visible) return null

  const tier  = shown.tier
  const side  = shown.side
  const color = TIER_COLORS[tier]

  const bannerLines: Record<number, string[]> = {
    1: ['SPEED SURGE', 'MATRIX RAIN ENGAGED'],
    2: ['PHANTOM BALL', 'DOUBLE-EDGED SWORD!'],
    3: ['🔥 FIREBALL 🔥', 'THE BALL IS ON FIRE!'],
    4: ['🚀 MISSILE LOCK 🚀', 'INCOMING — INTERCEPT OR DIE'],
  }
  const [line1, line2] = bannerLines[tier] ?? [TIER_LABELS[tier], '']

  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: side === 'left' ? '25%' : '75%',
      transform: 'translate(-50%, -50%)',
      textAlign: 'center',
      pointerEvents: 'none',
      zIndex: 30,
      animation: 'tierBannerIn 2.2s ease-out forwards',
    }}>
      <div style={{
        fontSize: 11,
        fontWeight: 900,
        letterSpacing: 4,
        color,
        textShadow: `0 0 20px ${color}, 0 0 40px ${color}80`,
        textTransform: 'uppercase',
        lineHeight: 1.3,
      }}>
        {line1}
      </div>
      <div style={{
        fontSize: 8,
        fontWeight: 700,
        color: `${color}cc`,
        letterSpacing: 3,
        marginTop: 4,
        textTransform: 'uppercase',
      }}>
        {line2}
      </div>
    </div>
  )
}

// ── Missile warning overlay ───────────────────────────────────────────────────
function MissileWarning() {
  const missileActive = useGameStore(s => s.missileActive)
  const activeSide    = useGameStore(s => s.activePowerSide)
  if (!missileActive) return null

  const warnSide = activeSide === 'left' ? 'right' : 'left'
  return (
    <div style={{
      position: 'absolute',
      top: '12%',
      left: warnSide === 'left' ? '8%' : '92%',
      transform: 'translateX(-50%)',
      pointerEvents: 'none', zIndex: 28,
      animation: 'missileWarn 0.4s ease-in-out infinite alternate',
    }}>
      <div style={{
        fontSize: 10,
        fontWeight: 900,
        color: '#ff4400',
        letterSpacing: 2,
        textShadow: '0 0 15px #ff6600',
        background: 'rgba(255,50,0,0.1)',
        border: '1px solid rgba(255,100,0,0.4)',
        borderRadius: 4,
        padding: '3px 8px',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}>
        ⚠ MISSILE
      </div>
    </div>
  )
}

// ── Phantom ball warning ──────────────────────────────────────────────────────
function PhantomWarning() {
  const phantomActive = useGameStore(s => s.phantomActive)
  if (!phantomActive) return null

  return (
    <div style={{
      position: 'absolute',
      bottom: '8%',
      left: '50%',
      transform: 'translateX(-50%)',
      pointerEvents: 'none', zIndex: 28,
    }}>
      <div style={{
        fontSize: 9,
        fontWeight: 800,
        color: '#c77dff',
        letterSpacing: 3,
        textShadow: '0 0 12px #c77dff',
        background: 'rgba(160,50,255,0.08)',
        border: '1px solid rgba(180,80,255,0.3)',
        borderRadius: 4,
        padding: '2px 10px',
        textTransform: 'uppercase',
      }}>
        👻 PHANTOM BALL ACTIVE
      </div>
    </div>
  )
}

function ScoreDisplay({ side }: { side: 'left' | 'right' }) {
  const score    = useGameStore(s => side === 'left' ? s.leftScore : s.rightScore)
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
      textAlign: 'center', position: 'relative', minWidth: 100,
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: 3, color,
        textTransform: 'uppercase', marginBottom: 2,
        textShadow: `0 0 10px ${color}88`,
      }}>{label}</div>
      <div style={{
        fontSize: 68, fontWeight: 900, color: '#ffffff',
        fontVariantNumeric: 'tabular-nums', lineHeight: 1,
        textShadow: `0 0 20px ${color}, 0 0 40px ${color}60`,
        transform: animating ? 'scale(1.4) translateY(-5px)' : 'scale(1) translateY(0)',
        transition: 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}>
        {score}
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 4, marginTop: 4, fontSize: 9, fontWeight: 700, letterSpacing: 2,
        color: detected ? '#00ff88' : '#ff4444',
        textShadow: detected ? '0 0 8px #00ff88' : '0 0 8px #ff4444',
      }}>
        <div style={{
          width: 5, height: 5, borderRadius: '50%',
          background: detected ? '#00ff88' : '#ff4444',
          boxShadow: detected ? '0 0 6px #00ff88' : '0 0 6px #ff4444',
        }} />
        {detected ? 'FACE LOCKED' : 'NO FACE'}
      </div>
    </div>
  )
}

function ComboDisplay() {
  const combo     = useGameStore(s => s.combo)
  const speedTier = useGameStore(s => s.speedTier)
  const hitCount  = useGameStore(s => s.hitCount)
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
      position: 'absolute', top: '50%', left: '50%',
      transform: 'translate(-50%, -50%)',
      textAlign: 'center', pointerEvents: 'none',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
    }}>
      {combo >= 3 && (
        <div style={{
          fontSize: 20, fontWeight: 900, color: '#ffdd00', letterSpacing: 3,
          textShadow: '0 0 15px #ffaa00, 0 0 30px #ff660088',
          animation: shake ? 'comboShake 0.3s ease-out' : 'comboFloat 2s ease-in-out infinite alternate',
          textTransform: 'uppercase',
        }}>
          {combo}✕ COMBO
        </div>
      )}
      {speedTier > 0 && (
        <div style={{
          fontSize: 11, fontWeight: 800, letterSpacing: 3,
          color: speedColors[speedTier],
          textShadow: `0 0 12px ${speedColors[speedTier]}`,
          animation: speedTier >= 3 ? 'blink 0.4s infinite' : 'none',
          textTransform: 'uppercase',
          background: `${speedColors[speedTier]}15`,
          border: `1px solid ${speedColors[speedTier]}44`,
          borderRadius: 4, padding: '3px 10px',
        }}>
          {speedLabels[speedTier]}
        </div>
      )}
      {hitCount > 0 && hitCount % 5 === 0 && hitCount <= 20 && (
        <div style={{
          fontSize: 12, fontWeight: 900, color: '#ffffff',
          letterSpacing: 4, textShadow: '0 0 20px #ffffff',
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
  const timeLeft    = useGameStore(s => s.timeLeft)
  const finalSeconds = useGameStore(s => s.finalSeconds)
  const round       = useGameStore(s => s.round)
  const maxRounds   = useGameStore(s => s.settings.maxRounds)
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
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 6 }}>
        {Array.from({ length: maxRounds }).map((_, i) => (
          <div key={i} style={{
            width: 8, height: 8, borderRadius: '50%',
            background: i < round - 1 ? '#4488ff' : i === round - 1 ? '#ffffff' : 'rgba(255,255,255,0.2)',
            boxShadow: i === round - 1 ? '0 0 8px #ffffff' : 'none',
          }} />
        ))}
      </div>
      <div style={{
        fontSize: 9, fontWeight: 700, letterSpacing: 4,
        color: 'rgba(120,160,255,0.6)', textTransform: 'uppercase', marginBottom: 3,
      }}>
        ROUND {round}
      </div>
      <div style={{
        fontSize: 52, fontWeight: 900, fontVariantNumeric: 'tabular-nums',
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
  const combo         = useGameStore(s => s.combo)
  const tierJust      = useGameStore(s => s.tierJustReached)
  const lastHit       = useRef<string | null>(null)

  useEffect(() => {
    if (tierJust) {
      const emoji = TIER_EMOJIS[tierJust.tier] || '⚡'
      const x = tierJust.side === 'left' ? 10 + Math.random() * 10 : 80 + Math.random() * 10
      const y = 30 + Math.random() * 30
      const id = Date.now() + Math.random()
      setReactions(r => [...r, { id, emoji, x, y }].slice(-8))
      setTimeout(() => setReactions(r => r.filter(rx => rx.id !== id)), 1500)
    }
  }, [tierJust])

  useEffect(() => {
    if (lastHitPlayer && lastHitPlayer !== lastHit.current) {
      lastHit.current = lastHitPlayer
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
            position: 'absolute', top: '45%',
            left: popup.player === 'right' ? '78%' : '14%',
            transform: `translateY(${translateY}px) scale(${scale})`,
            fontSize: 36, fontWeight: 900,
            color: popup.player === 'left' ? '#ff4422' : '#2244ff',
            opacity,
            textShadow: popup.player === 'left'
              ? '0 0 15px #ff4422, 0 2px 0 #000'
              : '0 0 15px #2244ff, 0 2px 0 #000',
            letterSpacing: 1, pointerEvents: 'none', transition: 'none',
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
        position: 'absolute', top: 0, left: 0, right: 0,
        padding: '10px 20px 0',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        pointerEvents: 'none', zIndex: 10,
        background: 'linear-gradient(to bottom, rgba(0,0,10,0.75) 0%, transparent 100%)',
      }}>
        {/* Left side: score + power bar */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
          <ScoreDisplay side="left" />
          <PowerBar side="left" />
        </div>

        <Timer />

        {/* Right side: score + power bar */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <ScoreDisplay side="right" />
          <PowerBar side="right" />
        </div>
      </div>

      {/* Center combo/speed display */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }}>
        <ComboDisplay />
      </div>

      {/* Tier unlock announce */}
      <TierAnnounce />

      {/* Missile warning */}
      <MissileWarning />

      {/* Phantom warning */}
      <PhantomWarning />

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
          to   { transform: translateY(-5px); }
        }
        @keyframes speedUpFlash {
          0%   { opacity: 0; transform: scale(0.5) translateY(10px); }
          30%  { opacity: 1; transform: scale(1.3) translateY(-5px); }
          60%  { opacity: 1; transform: scale(1) translateY(0); }
          100% { opacity: 0; transform: scale(0.8) translateY(-20px); }
        }
        @keyframes emojiFloat {
          0%   { opacity: 0; transform: scale(0.5) translateY(0); }
          20%  { opacity: 1; transform: scale(1.3) translateY(-15px); }
          60%  { opacity: 1; transform: scale(1) translateY(-40px); }
          100% { opacity: 0; transform: scale(0.8) translateY(-70px); }
        }
        @keyframes tierFlash {
          0%   { opacity: 0; transform: scale(0.6); }
          30%  { opacity: 1; transform: scale(1.4); }
          60%  { opacity: 1; transform: scale(1.1); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes tierBannerIn {
          0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.6); }
          15%  { opacity: 1; transform: translate(-50%, -50%) scale(1.2); }
          30%  { opacity: 1; transform: translate(-50%, -50%) scale(1.0); }
          75%  { opacity: 1; transform: translate(-50%, -50%) scale(1.0); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(0.9) translateY(-20px); }
        }
        @keyframes missileWarn {
          from { opacity: 1; transform: translateX(-50%) scale(1); }
          to   { opacity: 0.4; transform: translateX(-50%) scale(0.95); }
        }
      `}</style>
    </>
  )
}
