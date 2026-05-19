import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { audioEngine } from '../audio/AudioEngine'

function AnimatedTitle() {
  const chars = 'FACE PONG'.split('')
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      gap: 8,
      marginBottom: 8,
    }}>
      {chars.map((ch, i) => (
        <span
          key={i}
          style={{
            fontSize: ch === ' ' ? 40 : 80,
            fontWeight: 900,
            color: '#ffffff',
            textShadow: i < 4
              ? '0 0 30px #ff4422, 0 0 60px #ff442240'
              : ch === ' '
              ? 'none'
              : '0 0 30px #2244ff, 0 0 60px #2244ff40',
            animation: `float ${1.5 + i * 0.15}s ease-in-out infinite alternate`,
            animationDelay: `${i * 0.08}s`,
            letterSpacing: 4,
            display: 'inline-block',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          {ch}
        </span>
      ))}
    </div>
  )
}

function NeonButton({ onClick, children, color = '#4488ff', disabled = false }: {
  onClick: () => void
  children: React.ReactNode
  color?: string
  disabled?: boolean
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered
          ? `linear-gradient(135deg, ${color}22, ${color}44)`
          : `linear-gradient(135deg, ${color}11, ${color}22)`,
        border: `2px solid ${color}${hovered ? 'ff' : '88'}`,
        borderRadius: 8,
        color: '#ffffff',
        fontSize: 16,
        fontWeight: 700,
        letterSpacing: 4,
        textTransform: 'uppercase',
        padding: '14px 40px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s ease',
        boxShadow: hovered
          ? `0 0 30px ${color}88, 0 0 60px ${color}44`
          : `0 0 15px ${color}44`,
        transform: hovered ? 'scale(1.05)' : 'scale(1)',
        opacity: disabled ? 0.5 : 1,
        fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  )
}

function InstructionCard({ icon, title, desc, color }: {
  icon: string
  title: string
  desc: string
  color: string
}) {
  return (
    <div style={{
      background: `linear-gradient(135deg, ${color}0a, ${color}18)`,
      border: `1px solid ${color}44`,
      borderRadius: 12,
      padding: '16px 20px',
      textAlign: 'center',
      flex: 1,
    }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>{icon}</div>
      <div style={{
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 2,
        color: color,
        marginBottom: 6,
        textTransform: 'uppercase',
      }}>{title}</div>
      <div style={{ fontSize: 12, color: 'rgba(200,210,255,0.7)', lineHeight: 1.5 }}>
        {desc}
      </div>
    </div>
  )
}

export function MenuScreen() {
  const phase = useGameStore(s => s.phase)
  const startGame = useGameStore(s => s.startGame)
  const setPhase = useGameStore(s => s.setPhase)
  const bgCanvas = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>()
  const particles = useRef<Array<{x:number;y:number;vx:number;vy:number;r:number;color:string;alpha:number}>>([])

  useEffect(() => {
    particles.current = Array.from({ length: 120 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      r: 1 + Math.random() * 3,
      color: Math.random() > 0.5 ? '#4488ff' : '#ff4422',
      alpha: 0.1 + Math.random() * 0.5,
    }))

    const draw = () => {
      const canvas = bgCanvas.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const w = canvas.width
      const h = canvas.height

      ctx.fillStyle = 'rgba(0,0,8,0.15)'
      ctx.fillRect(0, 0, w, h)

      particles.current.forEach(p => {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0
        if (p.y < 0) p.y = h; if (p.y > h) p.y = 0
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.globalAlpha = p.alpha * 0.7
        ctx.fillStyle = p.color
        ctx.shadowBlur = 6
        ctx.shadowColor = p.color
        ctx.fill()
      })
      ctx.globalAlpha = 1
      ctx.shadowBlur = 0
      animRef.current = requestAnimationFrame(draw)
    }
    draw()
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [])

  const handleStart = () => {
    audioEngine.init()
    audioEngine.resume()
    audioEngine.playRoundStart()
    startGame()
  }

  if (phase !== 'menu') return null

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 20,
      overflow: 'hidden',
    }}>
      {/* Animated background */}
      <canvas
        ref={bgCanvas}
        width={window.innerWidth}
        height={window.innerHeight}
        style={{ position: 'absolute', inset: 0 }}
      />

      {/* Radial gradient overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse at center, rgba(10,10,30,0.6) 0%, rgba(0,0,8,0.9) 70%)',
        pointerEvents: 'none',
      }} />

      {/* Content */}
      <div style={{
        position: 'relative',
        textAlign: 'center',
        maxWidth: 800,
        padding: '0 24px',
        animation: 'fadeInUp 0.8s ease-out',
      }}>
        {/* Logo */}
        <div style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 8,
          color: 'rgba(100,150,255,0.7)',
          marginBottom: 20,
          textTransform: 'uppercase',
          animation: 'slideDown 0.6s ease-out',
        }}>
          MULTIPLAYER WEBCAM BATTLE
        </div>

        <AnimatedTitle />

        <div style={{
          fontSize: 13,
          color: 'rgba(150,180,255,0.6)',
          letterSpacing: 3,
          marginBottom: 40,
          textTransform: 'uppercase',
        }}>
          Use your face to control the paddle
        </div>

        {/* Instructions */}
        <div style={{
          display: 'flex',
          gap: 12,
          marginBottom: 36,
          justifyContent: 'center',
        }}>
          <InstructionCard
            icon="👤"
            title="2 Players"
            desc="Stand side-by-side facing the webcam from the side"
            color="#ff4422"
          />
          <InstructionCard
            icon="🎯"
            title="Move Your Head"
            desc="Move your head up & down to control your glowing paddle"
            color="#4488ff"
          />
          <InstructionCard
            icon="⚡"
            title="3 Rounds"
            desc="60 seconds per round. Ball speeds up with every hit!"
            color="#ffaa00"
          />
          <InstructionCard
            icon="🎮"
            title="Fallback"
            desc="No webcam? W/S keys for P1, Arrow Up/Down for P2"
            color="#44ffaa"
          />
        </div>

        {/* CTA */}
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
          <NeonButton onClick={handleStart} color="#4488ff">
            🚀 Start Game
          </NeonButton>
        </div>

        {/* Bottom text */}
        <div style={{
          marginTop: 32,
          fontSize: 11,
          color: 'rgba(100,120,160,0.5)',
          letterSpacing: 2,
        }}>
          Requires camera permission for face tracking • Works on Chrome/Edge/Safari
        </div>
      </div>

      <style>{`
        @keyframes float {
          from { transform: translateY(0px); }
          to { transform: translateY(-12px); }
        }
        @keyframes fadeInUp {
          from { transform: translateY(40px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes slideDown {
          from { transform: translateY(-20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
