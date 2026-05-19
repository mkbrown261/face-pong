import { useRef, useEffect, useCallback } from 'react'
import { useGameStore } from '../store/gameStore'
import { audioEngine } from '../audio/AudioEngine'

const CW = 1280
const CH = 720
const PADDLE_W = 14
const BASE_PADDLE_H = 130   // scaled by settings.paddleSize

interface TrailPt { x: number; y: number; age: number }
interface Ring { x: number; y: number; r: number; maxR: number; alpha: number; color: string }
interface AmbPt { x: number; y: number; vx: number; vy: number; r: number; alpha: number; color: string; pulse: number }

// Screen FX — kept in ref (not store) to avoid React re-renders
interface ScreenFX {
  shakeX: number; shakeY: number
  pulse: number; chromatic: number
  flashColor: string; flashAlpha: number
  paddleStretchL: number; paddleStretchR: number
}

export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>()
  const trail = useRef<TrailPt[]>([])
  const rings = useRef<Ring[]>([])
  const ambPts = useRef<AmbPt[]>([])
  const bgT = useRef(0)
  const lastT = useRef(0)
  const finalBeat = useRef(0)
  const fx = useRef<ScreenFX>({
    shakeX: 0, shakeY: 0, pulse: 0, chromatic: 0,
    flashColor: '#fff', flashAlpha: 0,
    paddleStretchL: 1, paddleStretchR: 1,
  })

  // coordinate helpers
  const toX = (nx: number) => (nx + 1) * 0.5 * CW
  const toY = (ny: number) => (1 - (ny + 1) * 0.5) * CH

  useEffect(() => {
    ambPts.current = Array.from({ length: 90 }, () => ({
      x: Math.random() * CW, y: Math.random() * CH,
      vx: (Math.random() - 0.5) * 0.35,
      vy: -(0.1 + Math.random() * 0.35),
      r: 0.5 + Math.random() * 2.5,
      alpha: 0.06 + Math.random() * 0.3,
      color: ['#4488ff','#ff4488','#44ffcc','#ffaa44','#8844ff'][Math.floor(Math.random()*5)],
      pulse: Math.random() * Math.PI * 2,
    }))
  }, [])

  // ── PHYSICS ─────────────────────────────────────────────────────────────
  const physics = useCallback((dt: number) => {
    const st = useGameStore.getState()
    if (st.phase !== 'playing') return
    const { settings } = st

    const slow = st.slowMotion ? 0.22 : 1
    useGameStore.getState().updateTimer(dt * slow)

    if (st.timeLeft <= 0) { useGameStore.getState().endRound(); return }

    // ── Paddle lerp ──
    // Faster lerp = more responsive. We use settings.sensitivity to tune.
    // Base lerp 0.22 → at max sensitivity (2.0) we get near-instant at 0.38
    const LERP = Math.min(0.42, 0.22 + (settings.sensitivity - 1) * 0.10)
    const ly = st.leftPaddleY  + (st.leftPaddleTarget  - st.leftPaddleY)  * LERP
    const ry = st.rightPaddleY + (st.rightPaddleTarget - st.rightPaddleY) * LERP
    useGameStore.getState().updatePaddles(ly, ry)

    // ── Ball movement ──
    const HIT_ACCEL = 0.028 * settings.speedIntensity
    const speedMult = Math.min(1 + st.hitCount * HIT_ACCEL, 3.8)
    let bx = st.ballX + st.ballVX * speedMult * slow
    let by = st.ballY + st.ballVY * speedMult * slow
    let vx = st.ballVX, vy = st.ballVY

    // cap absolute velocity
    const bspd = Math.sqrt(vx*vx + vy*vy)
    const maxV = 0.048
    if (bspd > maxV) { vx *= maxV/bspd; vy *= maxV/bspd }

    // ── Wall bounce ──
    const WALL = 0.915
    if (by > WALL)  { by = WALL;  vy = -Math.abs(vy) * 0.98; audioEngine.playWhoosh() }
    if (by < -WALL) { by = -WALL; vy =  Math.abs(vy) * 0.98; audioEngine.playWhoosh() }

    // ── Paddle geometry ──
    const PH = (BASE_PADDLE_H / CH) * settings.paddleSize  // half-height in norm coords
    const LX = -0.895, RX = 0.895
    const HIT_ZONE = 0.06   // how close ball has to be on X axis

    const hitPaddle = (side: 'left' | 'right', py: number) => {
      const cx = side === 'left' ? toX(LX) : toX(RX)
      const cy = toY(py)
      const relY = by - py
      const hitFrac = relY / PH  // -1 to 1
      const bounceAngle = hitFrac * (Math.PI / 3.2)
      const spd = Math.sqrt(vx*vx + vy*vy) * 1.06  // slight speedup

      if (side === 'left') {
        vx =  Math.cos(bounceAngle) * spd
        vy =  Math.sin(bounceAngle) * spd
        bx = LX + HIT_ZONE
        fx.current.paddleStretchL = 1.35
        fx.current.flashColor = '#ff3300'; fx.current.flashAlpha = 0.09
      } else {
        vx = -Math.cos(bounceAngle) * spd
        vy =  Math.sin(bounceAngle) * spd
        bx = RX - HIT_ZONE
        fx.current.paddleStretchR = 1.35
        fx.current.flashColor = '#0033ff'; fx.current.flashAlpha = 0.09
      }

      if (settings.screenShake) {
        fx.current.shakeX = (side === 'left' ? 1 : -1) * (6 + st.combo * 1.2)
        fx.current.shakeY = (Math.random() - 0.5) * 5
      }
      fx.current.pulse = 0.28
      fx.current.chromatic = 7 + st.speedTier * 3

      rings.current.push({ x: cx, y: cy, r: 0, maxR: 130, alpha: 1, color: side === 'left' ? '#ff4422' : '#2244ff' })
      useGameStore.getState().onPaddleHit(side, cx, cy)
      audioEngine.playHit(st.combo + 1, st.speedTier)
    }

    // Left paddle hit (ball moving left)
    if (vx < 0 && bx <= LX + HIT_ZONE && bx >= LX - 0.02) {
      if (Math.abs(by - ly) <= PH) hitPaddle('left', ly)
    }
    // Right paddle hit (ball moving right)
    if (vx > 0 && bx >= RX - HIT_ZONE && bx <= RX + 0.02) {
      if (Math.abs(by - ry) <= PH) hitPaddle('right', ry)
    }

    // ── Scoring ──
    if (bx < -1.12) {
      useGameStore.getState().incrementScore('right')
      useGameStore.getState().addScorePopup('right')
      audioEngine.playScore()
      fx.current.shakeX = 22; fx.current.shakeY = 18; fx.current.pulse = 0.55
      fx.current.flashColor = '#2244ff'; fx.current.flashAlpha = 0.22
      useGameStore.getState().resetBall(); return
    }
    if (bx > 1.12) {
      useGameStore.getState().incrementScore('left')
      useGameStore.getState().addScorePopup('left')
      audioEngine.playScore()
      fx.current.shakeX = -22; fx.current.shakeY = 18; fx.current.pulse = 0.55
      fx.current.flashColor = '#ff4422'; fx.current.flashAlpha = 0.22
      useGameStore.getState().resetBall(); return
    }

    useGameStore.getState().updateBall(bx, by, vx, vy)
    useGameStore.getState().updateParticles()

    // Trail
    trail.current.push({ x: toX(bx), y: toY(by), age: 0 })
    trail.current = trail.current.map(p => ({ ...p, age: p.age + 1 })).filter(p => p.age < 20)

    // Final seconds audio tick
    const st2 = useGameStore.getState()
    if (st2.finalSeconds) {
      const beat = Math.floor(st2.timeLeft)
      const prevBeat = Math.floor(st2.timeLeft + dt * slow)
      if (beat !== prevBeat) audioEngine.playFinalSeconds()
    }
    audioEngine.setAmbientIntensity(st2.speedTier / 3)
  }, [])

  // ── RENDER ──────────────────────────────────────────────────────────────
  const render = useCallback((ts: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return
    const st = useGameStore.getState()
    bgT.current += 0.0025

    // decay FX
    const f = fx.current
    f.shakeX *= 0.78; f.shakeY *= 0.78
    f.pulse  *= 0.84; f.chromatic *= 0.80
    f.flashAlpha *= 0.70
    f.paddleStretchL += (1 - f.paddleStretchL) * 0.22
    f.paddleStretchR += (1 - f.paddleStretchR) * 0.22

    ctx.save()
    ctx.translate(Math.round(f.shakeX), Math.round(f.shakeY))

    // ── BG ──────────────────────────────────────────────────────────────
    ctx.fillStyle = '#000005'
    ctx.fillRect(-30,-30, CW+60, CH+60)

    // Animated radial
    const t = bgT.current
    const rg = ctx.createRadialGradient(
      CW*0.5 + Math.cos(t*0.8)*90, CH*0.5 + Math.sin(t*0.6)*55, 60,
      CW*0.5, CH*0.5, CW*0.88)
    rg.addColorStop(0, 'rgba(12,8,30,0.9)')
    rg.addColorStop(0.45, 'rgba(5,4,20,0.6)')
    rg.addColorStop(1, 'rgba(0,0,6,0)')
    ctx.fillStyle = rg; ctx.fillRect(-30,-30, CW+60, CH+60)

    // Side arena glow
    const lg = ctx.createLinearGradient(0,0,220,0)
    lg.addColorStop(0,'rgba(255,60,20,0.07)'); lg.addColorStop(1,'rgba(255,60,20,0)')
    ctx.fillStyle = lg; ctx.fillRect(0,0,220,CH)
    const rgl = ctx.createLinearGradient(CW,0,CW-220,0)
    rgl.addColorStop(0,'rgba(20,80,255,0.07)'); rgl.addColorStop(1,'rgba(20,80,255,0)')
    ctx.fillStyle = rgl; ctx.fillRect(CW-220,0,220,CH)

    // Grid
    ctx.strokeStyle = 'rgba(30,50,120,0.09)'; ctx.lineWidth = 1
    for (let x=0; x<CW; x+=64) {
      ctx.globalAlpha = 0.4 + 0.4*Math.sin(t*1.2+x*0.01)
      ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,CH); ctx.stroke()
    }
    for (let y=0; y<CH; y+=64) {
      ctx.globalAlpha = 0.4 + 0.4*Math.cos(t*1.4+y*0.015)
      ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(CW,y); ctx.stroke()
    }
    ctx.globalAlpha = 1

    // Center dashed line
    const cg = ctx.createLinearGradient(CW/2-2,0,CW/2+2,CH)
    cg.addColorStop(0,'rgba(80,120,255,0)'); cg.addColorStop(0.5,'rgba(80,120,255,0.25)'); cg.addColorStop(1,'rgba(80,120,255,0)')
    ctx.strokeStyle = cg; ctx.lineWidth = 2; ctx.setLineDash([14,14])
    ctx.beginPath(); ctx.moveTo(CW/2,0); ctx.lineTo(CW/2,CH); ctx.stroke()
    ctx.setLineDash([])
    // Center circle
    ctx.beginPath(); ctx.arc(CW/2,CH/2,80,0,Math.PI*2)
    ctx.strokeStyle='rgba(60,100,200,0.1)'; ctx.lineWidth=1.5; ctx.stroke()

    // ── Ambient particles ─────────────────────────────────────────────
    ctx.shadowBlur = 0
    ambPts.current.forEach(p => {
      p.x+=p.vx; p.y+=p.vy; p.pulse+=0.018
      if (p.y<-5) p.y=CH+5; if (p.x<-5) p.x=CW+5; if (p.x>CW+5) p.x=-5
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2)
      ctx.globalAlpha = p.alpha*(0.65+0.35*Math.sin(p.pulse))
      ctx.fillStyle = p.color
      ctx.shadowBlur = 3; ctx.shadowColor = p.color
      ctx.fill()
    })
    ctx.globalAlpha=1; ctx.shadowBlur=0

    // ── Rings ─────────────────────────────────────────────────────────
    rings.current = rings.current.filter(r=>r.alpha>0.02)
    rings.current.forEach(r=>{
      r.r += 4.5; r.alpha *= 0.88
      ctx.beginPath(); ctx.arc(r.x,r.y,r.r,0,Math.PI*2)
      ctx.strokeStyle=r.color; ctx.lineWidth=2
      ctx.globalAlpha=r.alpha; ctx.shadowBlur=12; ctx.shadowColor=r.color; ctx.stroke()
    })
    ctx.globalAlpha=1; ctx.shadowBlur=0

    // ── Ball trail ────────────────────────────────────────────────────
    const tc = st.comboColors || ['#ffffff','#aaffff']
    trail.current.forEach((p,i)=>{
      const prog = 1 - p.age/20
      ctx.beginPath(); ctx.arc(p.x,p.y, Math.max(0.5, PADDLE_W*0.55*prog),0,Math.PI*2)
      ctx.globalAlpha = prog*0.45
      ctx.fillStyle = tc[i%tc.length]
      ctx.shadowBlur=6; ctx.shadowColor=tc[i%tc.length]; ctx.fill()
    })
    ctx.globalAlpha=1; ctx.shadowBlur=0

    // ── Game particles ────────────────────────────────────────────────
    if (st.settings.particles) {
      st.particles.forEach(p=>{
        const prog = p.life/p.maxLife
        ctx.beginPath(); ctx.arc(toX(p.x),toY(p.y), Math.max(0.3,p.size*prog),0,Math.PI*2)
        ctx.globalAlpha = Math.min(1,prog*1.1)
        ctx.fillStyle = p.color
        ctx.shadowBlur=5; ctx.shadowColor=p.color; ctx.fill()
      })
      ctx.globalAlpha=1; ctx.shadowBlur=0
    }

    // ── Paddles ───────────────────────────────────────────────────────
    const paddleH = BASE_PADDLE_H * st.settings.paddleSize
    drawPaddle(ctx, toX(-0.895), toY(st.leftPaddleY),  PADDLE_W, paddleH, '#ff3300','#ff7744', f.paddleStretchL, st.leftFaceDetected,  st.lastHitPlayer==='left')
    drawPaddle(ctx, toX( 0.895), toY(st.rightPaddleY), PADDLE_W, paddleH, '#0044ff','#4488ff', f.paddleStretchR, st.rightFaceDetected, st.lastHitPlayer==='right')

    // ── Ball ──────────────────────────────────────────────────────────
    const bCX = toX(st.ballX), bCY = toY(st.ballY)
    const bc1 = tc[0], bc2 = tc[1]||'#ffffff'

    // Motion streak
    const bspd = Math.sqrt(st.ballVX*st.ballVX+st.ballVY*st.ballVY)
    if (bspd > 0.012 && st.phase==='playing') {
      const sl = Math.min(55, bspd * 2200)
      const sg = ctx.createLinearGradient(bCX-st.ballVX*sl*28, bCY-st.ballVY*sl*28, bCX, bCY)
      sg.addColorStop(0,'rgba(255,255,255,0)'); sg.addColorStop(1,`${bc1}99`)
      ctx.strokeStyle=sg; ctx.lineWidth=PADDLE_W*1.4; ctx.lineCap='round'
      ctx.globalAlpha=0.45
      ctx.beginPath()
      ctx.moveTo(bCX-st.ballVX*sl*28, bCY-st.ballVY*sl*28); ctx.lineTo(bCX,bCY); ctx.stroke()
      ctx.globalAlpha=1; ctx.lineCap='butt'
    }

    // Glow halos
    for(let i=4;i>=0;i--){
      ctx.beginPath(); ctx.arc(bCX,bCY, 13+i*9,0,Math.PI*2)
      ctx.globalAlpha=(0.055-i*0.007)+st.speedTier*0.012
      ctx.fillStyle=bc1; ctx.fill()
    }
    ctx.globalAlpha=1

    // Core
    const bg = ctx.createRadialGradient(bCX-4,bCY-4,2, bCX,bCY,13)
    bg.addColorStop(0,'#ffffff'); bg.addColorStop(0.35,'#ffffffdd')
    bg.addColorStop(0.7,bc1); bg.addColorStop(1,bc2)
    ctx.beginPath(); ctx.arc(bCX,bCY,13,0,Math.PI*2)
    ctx.fillStyle=bg; ctx.shadowBlur=28+st.speedTier*8; ctx.shadowColor=bc1; ctx.fill()
    ctx.shadowBlur=0
    // Specular
    ctx.beginPath(); ctx.arc(bCX-4,bCY-4,4,0,Math.PI*2)
    ctx.fillStyle='rgba(255,255,255,0.55)'; ctx.fill()

    // ── Walls ─────────────────────────────────────────────────────────
    drawWall(ctx, 0,    0,    CW, 10, 'top',    t)
    drawWall(ctx, 0, CH-10, CW, 10, 'bottom', t)

    // ── FX overlays ───────────────────────────────────────────────────
    if (f.flashAlpha > 0.005) {
      ctx.globalAlpha=f.flashAlpha; ctx.fillStyle=f.flashColor
      ctx.fillRect(-30,-30,CW+60,CH+60); ctx.globalAlpha=1
    }
    if (f.pulse > 0.01) {
      const pv = ctx.createRadialGradient(CW/2,CH/2,CH*0.2,CW/2,CH/2,CW*0.85)
      pv.addColorStop(0,'rgba(0,0,0,0)'); pv.addColorStop(1,`rgba(255,255,255,${f.pulse*0.14})`)
      ctx.fillStyle=pv; ctx.fillRect(-30,-30,CW+60,CH+60)
    }

    // Final seconds
    if (st.finalSeconds && st.phase==='playing') {
      finalBeat.current+=0.07
      const beat=(Math.sin(finalBeat.current*9)+1)*0.5
      const intensity=Math.max(0,(10-st.timeLeft)/10)
      ctx.globalAlpha=beat*0.07*intensity; ctx.fillStyle='#ff0000'
      ctx.fillRect(-30,-30,CW+60,CH+60); ctx.globalAlpha=1
      ctx.strokeStyle=`rgba(255,0,0,${beat*0.55*intensity})`
      ctx.lineWidth=5; ctx.strokeRect(3,3,CW-6,CH-6)
    }

    // Vignette
    const vig=ctx.createRadialGradient(CW/2,CH/2,CH*0.3,CW/2,CH/2,CW*0.78)
    vig.addColorStop(0,'rgba(0,0,0,0)'); vig.addColorStop(1,'rgba(0,0,8,0.42)')
    ctx.fillStyle=vig; ctx.globalAlpha=1; ctx.fillRect(-30,-30,CW+60,CH+60)

    ctx.restore()
  }, [])

  // ── Paddle draw helper ───────────────────────────────────────────────────
  function drawPaddle(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    col1: string, col2: string,
    stretch: number, detected: boolean, isHit: boolean
  ) {
    const hw=w/2, hh=(h*stretch)/2

    // Outer glow
    for(let i=5;i>=1;i--){
      const sp=i*(isHit?8:4.5)
      ctx.beginPath()
      if(ctx.roundRect) ctx.roundRect(x-hw-sp*0.5, y-hh-sp*0.25, w+sp, h*stretch+sp*0.5, 6)
      else ctx.rect(x-hw-sp*0.5, y-hh-sp*0.25, w+sp, h*stretch+sp*0.5)
      ctx.fillStyle=col1; ctx.globalAlpha=0.022*(6-i)*(isHit?2.2:1); ctx.fill()
    }
    ctx.globalAlpha=1

    // Body
    const pg=ctx.createLinearGradient(x-hw,y-hh, x+hw,y+hh)
    pg.addColorStop(0,col2); pg.addColorStop(0.4,'#ffffff')
    pg.addColorStop(0.6,col2); pg.addColorStop(1,col1)
    ctx.beginPath()
    if(ctx.roundRect) ctx.roundRect(x-hw,y-hh,w,h*stretch,5)
    else ctx.rect(x-hw,y-hh,w,h*stretch)
    ctx.fillStyle=pg; ctx.shadowBlur=isHit?32:16; ctx.shadowColor=col1; ctx.fill()
    ctx.shadowBlur=0

    // Highlight
    ctx.beginPath()
    if(ctx.roundRect) ctx.roundRect(x-hw+3,y-hh+5,w-6,(h*stretch)*0.36,3)
    else ctx.rect(x-hw+3,y-hh+5,w-6,(h*stretch)*0.36)
    ctx.fillStyle='rgba(255,255,255,0.22)'; ctx.fill()

    // Rim
    ctx.beginPath()
    if(ctx.roundRect) ctx.roundRect(x-hw,y-hh,w,h*stretch,5)
    else ctx.rect(x-hw,y-hh,w,h*stretch)
    ctx.strokeStyle=`${col2}cc`; ctx.lineWidth=1.5; ctx.stroke()

    // Detection dot
    ctx.beginPath(); ctx.arc(x,y-hh-13,5.5,0,Math.PI*2)
    ctx.fillStyle=detected?'#00ff88':'#ff3344'
    ctx.shadowBlur=9; ctx.shadowColor=detected?'#00ff88':'#ff3344'; ctx.fill()
    ctx.shadowBlur=0
  }

  // ── Wall draw helper ─────────────────────────────────────────────────────
  function drawWall(ctx: CanvasRenderingContext2D, x:number,y:number,w:number,h:number,pos:'top'|'bottom',t:number){
    const a1=0.5+0.28*Math.sin(t*2.8)
    const wg=ctx.createLinearGradient(0,y,0,y+h)
    if(pos==='top'){wg.addColorStop(0,`rgba(80,130,255,${a1})`);wg.addColorStop(1,'rgba(30,60,180,0.08)')}
    else{wg.addColorStop(0,'rgba(30,60,180,0.08)');wg.addColorStop(1,`rgba(80,130,255,${a1})`)}
    ctx.fillStyle=wg; ctx.fillRect(x,y,w,h)
    const ly=pos==='top'?y+h-1:y+1
    const lg=ctx.createLinearGradient(0,ly,w,ly)
    lg.addColorStop(0,'rgba(100,160,255,0)'); lg.addColorStop(0.1,'rgba(150,200,255,0.9)')
    lg.addColorStop(0.5,'rgba(220,240,255,1)'); lg.addColorStop(0.9,'rgba(150,200,255,0.9)')
    lg.addColorStop(1,'rgba(100,160,255,0)')
    ctx.strokeStyle=lg; ctx.lineWidth=2; ctx.shadowBlur=11; ctx.shadowColor='#88aaff'
    ctx.beginPath(); ctx.moveTo(0,ly); ctx.lineTo(w,ly); ctx.stroke()
    ctx.shadowBlur=0
  }

  // ── Main loop ────────────────────────────────────────────────────────────
  const loop = useCallback((ts: number) => {
    const dt = Math.min((ts - (lastT.current||ts)) / 1000, 0.05)
    lastT.current = ts
    const st = useGameStore.getState()
    if (st.phase === 'playing') physics(dt)
    render(ts)
    rafRef.current = requestAnimationFrame(loop)
  }, [physics, render])

  useEffect(() => {
    lastT.current = 0
    rafRef.current = requestAnimationFrame(loop)
    return () => { if(rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [loop])

  return (
    <canvas ref={canvasRef} width={CW} height={CH}
      style={{ width:'100%', height:'100%', display:'block' }} />
  )
}
