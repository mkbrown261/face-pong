import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { audioEngine } from '../audio/AudioEngine'
import { OnlineModal } from './OnlineModal'

function AnimatedTitle() {
  const chars = 'FACE PONG'.split('')
  return (
    <div style={{ display:'flex', justifyContent:'center', gap: 6, marginBottom: 8, flexWrap:'wrap' }}>
      {chars.map((ch, i) => (
        <span key={i} style={{
          fontSize: ch === ' ' ? 32 : 72,
          fontWeight: 900,
          color: '#ffffff',
          textShadow: i < 4
            ? '0 0 25px #ff4422, 0 0 50px #ff442240'
            : ch === ' ' ? 'none'
            : '0 0 25px #2244ff, 0 0 50px #2244ff40',
          animation: `float ${1.5 + i * 0.15}s ease-in-out infinite alternate`,
          animationDelay: `${i * 0.08}s`,
          letterSpacing: 3,
          display: 'inline-block',
        }}>{ch}</span>
      ))}
    </div>
  )
}

function NeonBtn({
  onClick, children, color = '#4488ff', disabled = false, outline = false,
}: {
  onClick: () => void; children: React.ReactNode; color?: string; disabled?: boolean; outline?: boolean
}) {
  const [h, setH] = useState(false)
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        background: h ? `${color}28` : outline ? 'transparent' : `${color}12`,
        border: `2px solid ${h ? color : color + '66'}`,
        borderRadius: 8, color: '#fff',
        fontSize: 14, fontWeight: 700, letterSpacing: 3,
        textTransform: 'uppercase', padding: '12px 28px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.18s',
        boxShadow: h ? `0 0 24px ${color}66` : `0 0 10px ${color}33`,
        transform: h ? 'scale(1.05)' : 'scale(1)',
        opacity: disabled ? 0.45 : 1,
        fontFamily: 'inherit',
      }}>
      {children}
    </button>
  )
}

function Card({ icon, title, desc, color }: { icon:string; title:string; desc:string; color:string }) {
  return (
    <div style={{
      background: `${color}0a`, border:`1px solid ${color}33`,
      borderRadius:12, padding:'14px 16px', textAlign:'center', flex:1, minWidth:130,
    }}>
      <div style={{fontSize:28, marginBottom:6}}>{icon}</div>
      <div style={{fontSize:11,fontWeight:700,letterSpacing:2,color,marginBottom:5,textTransform:'uppercase'}}>{title}</div>
      <div style={{fontSize:11,color:'rgba(190,205,240,0.65)',lineHeight:1.55}}>{desc}</div>
    </div>
  )
}

export function MenuScreen() {
  const phase = useGameStore(s => s.phase)
  const startGame = useGameStore(s => s.startGame)
  const setSettingsOpen = useGameStore(s => s.setSettingsOpen)
  const bgRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>()
  const pts = useRef<Array<{x:number;y:number;vx:number;vy:number;r:number;color:string;alpha:number}>>([])
  const [showOnline, setShowOnline] = useState(false)

  useEffect(() => {
    pts.current = Array.from({length:130}, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random()-0.5)*0.5, vy: (Math.random()-0.5)*0.5,
      r: 0.8 + Math.random()*2.8,
      color: Math.random()>0.5?'#4488ff':'#ff4422',
      alpha: 0.08 + Math.random()*0.45,
    }))

    const draw = () => {
      const c = bgRef.current; if (!c) return
      const ctx = c.getContext('2d'); if (!ctx) return
      ctx.fillStyle = 'rgba(0,0,8,0.18)'; ctx.fillRect(0,0,c.width,c.height)
      pts.current.forEach(p => {
        p.x+=p.vx; p.y+=p.vy
        if (p.x<0) p.x=c.width; if (p.x>c.width) p.x=0
        if (p.y<0) p.y=c.height; if (p.y>c.height) p.y=0
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2)
        ctx.globalAlpha=p.alpha*0.7; ctx.fillStyle=p.color
        ctx.shadowBlur=5; ctx.shadowColor=p.color; ctx.fill()
      })
      ctx.globalAlpha=1; ctx.shadowBlur=0
      rafRef.current = requestAnimationFrame(draw)
    }
    draw()
    return () => { if(rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])

  const handleStart = () => {
    audioEngine.init(); audioEngine.resume(); audioEngine.playRoundStart()
    startGame('local')
  }

  if (phase !== 'menu') return null

  return (
    <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', zIndex:20, overflow:'hidden' }}>
      <canvas ref={bgRef} width={window.innerWidth} height={window.innerHeight} style={{position:'absolute',inset:0}} />
      <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse at center, rgba(8,8,26,0.55) 0%, rgba(0,0,6,0.92) 72%)', pointerEvents:'none' }} />

      <div style={{ position:'relative', textAlign:'center', maxWidth:780, padding:'0 20px', animation:'fadeInUp 0.7s ease-out' }}>
        <div style={{ fontSize:10, fontWeight:700, letterSpacing:8, color:'rgba(100,150,255,0.65)', marginBottom:18, textTransform:'uppercase' }}>
          MULTIPLAYER WEBCAM BATTLE
        </div>

        <AnimatedTitle />

        <div style={{ fontSize:12, color:'rgba(140,170,255,0.5)', letterSpacing:3, marginBottom:36, textTransform:'uppercase' }}>
          Use your face to control the paddle
        </div>

        {/* Cards */}
        <div style={{ display:'flex', gap:10, marginBottom:32, flexWrap:'wrap', justifyContent:'center' }}>
          <Card icon="👥" title="Shared Cam" desc="Both players face the same webcam from the side" color="#ff4422" />
          <Card icon="🌐" title="Online" desc="Each player uses their own device + camera" color="#4488ff" />
          <Card icon="🎯" title="Head Control" desc="Move up & down to control your paddle" color="#ffaa00" />
          <Card icon="⚡" title="3 Rounds" desc="Ball speeds up every hit — pure chaos!" color="#44ffaa" />
        </div>

        {/* Buttons */}
        <div style={{ display:'flex', gap:14, justifyContent:'center', flexWrap:'wrap' }}>
          <NeonBtn onClick={handleStart} color="#4488ff">▶ Local Play</NeonBtn>
          <NeonBtn onClick={() => setShowOnline(true)} color="#ff4422">🌐 Online Play</NeonBtn>
          <NeonBtn onClick={() => setSettingsOpen(true)} color="#888" outline>⚙️ Settings</NeonBtn>
        </div>

        {/* Keyboard hint */}
        <div style={{ marginTop:28, fontSize:10, color:'rgba(80,100,140,0.45)', letterSpacing:1.5 }}>
          No webcam? · Keyboard fallback: <b style={{color:'rgba(120,150,200,0.5)'}}>W/S</b> → P1 · <b style={{color:'rgba(120,150,200,0.5)'}}>↑↓</b> → P2
        </div>
      </div>

      {showOnline && <OnlineModal onClose={() => setShowOnline(false)} />}

      <style>{`
        @keyframes float { from{transform:translateY(0)} to{transform:translateY(-10px)} }
        @keyframes fadeInUp { from{transform:translateY(36px);opacity:0} to{transform:translateY(0);opacity:1} }
      `}</style>
    </div>
  )
}
