import { useRef, useEffect, useCallback } from 'react'
import { useGameStore } from '../store/gameStore'
import { audioEngine } from '../audio/AudioEngine'

const CANVAS_W = 1280
const CANVAS_H = 720
const PADDLE_W = 14
const PADDLE_H = 140
const BALL_RADIUS = 13

interface TrailPoint { x: number; y: number; age: number; vx: number; vy: number }
interface AmbientParticle { x: number; y: number; vx: number; vy: number; r: number; alpha: number; color: string; pulse: number }
interface HitRing { x: number; y: number; r: number; maxR: number; alpha: number; color: string }

export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>()
  const ballTrail = useRef<TrailPoint[]>([])
  const lastTime = useRef<number>(0)
  const shakeX = useRef(0)
  const shakeY = useRef(0)
  const pulseAlpha = useRef(0)
  const chromaticOffset = useRef(0)
  const ambientParticles = useRef<AmbientParticle[]>([])
  const hitRings = useRef<HitRing[]>([])
  const finalSecondsBeat = useRef(0)
  const hitColorFlash = useRef<{ color: string; alpha: number } | null>(null)
  const leftPaddleStretch = useRef(1)
  const rightPaddleStretch = useRef(1)
  const bgTime = useRef(0)
  const lastTimestamp = useRef(0)

  // Initialize ambient particles
  useEffect(() => {
    ambientParticles.current = Array.from({ length: 100 }, () => ({
      x: Math.random() * CANVAS_W,
      y: Math.random() * CANVAS_H,
      vx: (Math.random() - 0.5) * 0.4,
      vy: -(0.1 + Math.random() * 0.4), // mostly drift upward
      r: 0.5 + Math.random() * 2.5,
      alpha: 0.05 + Math.random() * 0.35,
      color: ['#4488ff', '#ff4488', '#44ffcc', '#ffaa44', '#8844ff'][Math.floor(Math.random() * 5)],
      pulse: Math.random() * Math.PI * 2,
    }))
  }, [])

  const toX = (nx: number) => (nx + 1) * 0.5 * CANVAS_W
  const toY = (ny: number) => (1 - (ny + 1) * 0.5) * CANVAS_H

  // === PHYSICS UPDATE ===
  const updatePhysics = useCallback((delta: number) => {
    const state = useGameStore.getState()
    if (state.phase !== 'playing') return

    const slowFactor = state.slowMotion ? 0.2 : 1

    // Update timer
    useGameStore.getState().updateTimer(delta * slowFactor)

    if (state.timeLeft <= 0 && state.phase === 'playing') {
      useGameStore.getState().endRound()
      audioEngine.playScore()
      return
    }

    // Paddle interpolation (smooth lerp)
    const LERP = 0.14
    const newLeftY = state.leftPaddleY + (state.leftPaddleTarget - state.leftPaddleY) * LERP
    const newRightY = state.rightPaddleY + (state.rightPaddleTarget - state.rightPaddleY) * LERP
    useGameStore.getState().updatePaddles(newLeftY, newRightY)

    // Ball speed multiplier from hits
    const speedMult = 1 + state.hitCount * 0.028
    const clampedSpeedMult = Math.min(speedMult, 3.5)

    let bx = state.ballX + state.ballVX * clampedSpeedMult * slowFactor
    let by = state.ballY + state.ballVY * clampedSpeedMult * slowFactor
    let vx = state.ballVX
    let vy = state.ballVY

    // Clamp ball velocity
    const ballSpeed = Math.sqrt(vx * vx + vy * vy)
    const maxBallSpeed = 0.05
    if (ballSpeed > maxBallSpeed) {
      const s = maxBallSpeed / ballSpeed
      vx *= s; vy *= s
    }

    // Top/bottom wall bounce
    if (by > 0.91) { by = 0.91; vy = -Math.abs(vy) * 0.97; audioEngine.playWhoosh() }
    if (by < -0.91) { by = -0.91; vy = Math.abs(vy) * 0.97; audioEngine.playWhoosh() }

    // Paddle dimensions in normalized coords
    const leftPX = -0.89
    const rightPX = 0.89
    const paddleHalfH = 0.215 // PADDLE_H / CANVAS_H * something

    // === LEFT PADDLE COLLISION ===
    if (vx < 0 && bx <= leftPX + 0.055 && bx >= leftPX - 0.03) {
      const relY = by - newLeftY
      if (Math.abs(relY) <= paddleHalfH) {
        bx = leftPX + 0.055
        const angle = (relY / paddleHalfH) * (Math.PI / 3)
        const speed = Math.sqrt(vx * vx + vy * vy) * 1.07
        vx = Math.cos(angle) * speed
        vy = Math.sin(angle) * speed
        leftPaddleStretch.current = 1.3
        useGameStore.getState().onPaddleHit('left', toX(bx), toY(by))
        audioEngine.playHit(state.combo + 1, state.speedTier)
        shakeX.current = 8 + state.combo * 1.5
        shakeY.current = (Math.random() - 0.5) * 6
        pulseAlpha.current = 0.3
        chromaticOffset.current = 8 + state.speedTier * 4
        hitColorFlash.current = { color: '#ff3300', alpha: 0.1 }
        hitRings.current.push({ x: toX(bx), y: toY(by), r: 0, maxR: 120, alpha: 1, color: '#ff4422' })
      }
    }

    // === RIGHT PADDLE COLLISION ===
    if (vx > 0 && bx >= rightPX - 0.055 && bx <= rightPX + 0.03) {
      const relY = by - newRightY
      if (Math.abs(relY) <= paddleHalfH) {
        bx = rightPX - 0.055
        const angle = Math.PI - (relY / paddleHalfH) * (Math.PI / 3)
        const speed = Math.sqrt(vx * vx + vy * vy) * 1.07
        vx = Math.cos(angle) * speed
        vy = Math.sin(angle) * speed
        rightPaddleStretch.current = 1.3
        useGameStore.getState().onPaddleHit('right', toX(bx), toY(by))
        audioEngine.playHit(state.combo + 1, state.speedTier)
        shakeX.current = -8 - state.combo * 1.5
        shakeY.current = (Math.random() - 0.5) * 6
        pulseAlpha.current = 0.3
        chromaticOffset.current = 8 + state.speedTier * 4
        hitColorFlash.current = { color: '#0033ff', alpha: 0.1 }
        hitRings.current.push({ x: toX(bx), y: toY(by), r: 0, maxR: 120, alpha: 1, color: '#2244ff' })
      }
    }

    // Scoring
    if (bx < -1.1) {
      useGameStore.getState().incrementScore('right')
      useGameStore.getState().addScorePopup('right')
      audioEngine.playScore()
      shakeX.current = 25; shakeY.current = 25
      pulseAlpha.current = 0.6
      hitColorFlash.current = { color: '#2244ff', alpha: 0.25 }
      useGameStore.getState().resetBall()
      return
    }
    if (bx > 1.1) {
      useGameStore.getState().incrementScore('left')
      useGameStore.getState().addScorePopup('left')
      audioEngine.playScore()
      shakeX.current = -25; shakeY.current = 25
      pulseAlpha.current = 0.6
      hitColorFlash.current = { color: '#ff4422', alpha: 0.25 }
      useGameStore.getState().resetBall()
      return
    }

    useGameStore.getState().updateBall(bx, by, vx, vy)
    useGameStore.getState().updateParticles()

    // Update ball trail
    const ballCX = toX(bx)
    const ballCY = toY(by)
    const speed = Math.sqrt(vx * vx + vy * vy)
    ballTrail.current.push({ x: ballCX, y: ballCY, age: 0, vx, vy })
    ballTrail.current = ballTrail.current
      .map(p => ({ ...p, age: p.age + 1 }))
      .filter(p => p.age < 18)

    // Final seconds audio beat
    if (state.finalSeconds) {
      const beatTime = Math.floor(lastTimestamp.current / 1000)
      if (beatTime !== Math.floor((lastTimestamp.current - delta * 1000) / 1000)) {
        audioEngine.playFinalSeconds()
      }
    }

    // Ambient audio intensity
    audioEngine.setAmbientIntensity(state.speedTier / 3)
  }, [])

  // === RENDER ===
  const render = useCallback((timestamp: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const state = useGameStore.getState()
    const cw = CANVAS_W, ch = CANVAS_H
    bgTime.current += 0.003
    lastTimestamp.current = timestamp

    // Decay effects
    shakeX.current *= 0.80
    shakeY.current *= 0.80
    pulseAlpha.current *= 0.86
    chromaticOffset.current *= 0.82
    leftPaddleStretch.current += (1 - leftPaddleStretch.current) * 0.25
    rightPaddleStretch.current += (1 - rightPaddleStretch.current) * 0.25

    ctx.save()
    ctx.translate(shakeX.current, shakeY.current)

    // === BACKGROUND ===
    ctx.fillStyle = '#000005'
    ctx.fillRect(-20, -20, cw + 40, ch + 40)

    // Animated radial gradient
    const t = bgTime.current
    const grad = ctx.createRadialGradient(
      cw * 0.5 + Math.cos(t * 0.7) * 100,
      ch * 0.5 + Math.sin(t * 0.5) * 60,
      80,
      cw * 0.5, ch * 0.5, cw * 0.9
    )
    grad.addColorStop(0, 'rgba(10,8,28,0.8)')
    grad.addColorStop(0.4, 'rgba(5,4,18,0.6)')
    grad.addColorStop(1, 'rgba(0,0,5,0)')
    ctx.fillStyle = grad
    ctx.fillRect(-20, -20, cw + 40, ch + 40)

    // Side glow from paddles
    const leftGlow = ctx.createLinearGradient(0, 0, 200, 0)
    leftGlow.addColorStop(0, 'rgba(255,50,20,0.08)')
    leftGlow.addColorStop(1, 'rgba(255,50,20,0)')
    ctx.fillStyle = leftGlow
    ctx.fillRect(0, 0, 200, ch)

    const rightGlow = ctx.createLinearGradient(cw, 0, cw - 200, 0)
    rightGlow.addColorStop(0, 'rgba(20,80,255,0.08)')
    rightGlow.addColorStop(1, 'rgba(20,80,255,0)')
    ctx.fillStyle = rightGlow
    ctx.fillRect(cw - 200, 0, 200, ch)

    // Grid lines
    ctx.strokeStyle = 'rgba(30,50,120,0.1)'
    ctx.lineWidth = 1
    for (let x = 0; x < cw; x += 64) {
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t + x * 0.01)
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ch); ctx.stroke()
    }
    for (let y = 0; y < ch; y += 64) {
      ctx.globalAlpha = 0.5 + 0.5 * Math.cos(t + y * 0.015)
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cw, y); ctx.stroke()
    }
    ctx.globalAlpha = 1

    // Center line
    const centerGrad = ctx.createLinearGradient(cw/2-2, 0, cw/2+2, ch)
    centerGrad.addColorStop(0, 'rgba(80,120,255,0)')
    centerGrad.addColorStop(0.2, 'rgba(80,120,255,0.2)')
    centerGrad.addColorStop(0.5, 'rgba(80,120,255,0.3)')
    centerGrad.addColorStop(0.8, 'rgba(80,120,255,0.2)')
    centerGrad.addColorStop(1, 'rgba(80,120,255,0)')
    ctx.strokeStyle = centerGrad
    ctx.lineWidth = 2
    ctx.setLineDash([14, 14])
    ctx.beginPath(); ctx.moveTo(cw/2, 0); ctx.lineTo(cw/2, ch); ctx.stroke()
    ctx.setLineDash([])

    // Center circle
    ctx.beginPath()
    ctx.arc(cw/2, ch/2, 80, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(60,100,200,0.12)'
    ctx.lineWidth = 1.5
    ctx.stroke()

    // === AMBIENT PARTICLES ===
    ctx.shadowBlur = 0
    ambientParticles.current.forEach(p => {
      p.x += p.vx; p.y += p.vy
      p.pulse += 0.02
      if (p.y < -5) p.y = ch + 5
      if (p.x < -5) p.x = cw + 5; if (p.x > cw + 5) p.x = -5

      const pulsedAlpha = p.alpha * (0.7 + 0.3 * Math.sin(p.pulse))
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
      ctx.globalAlpha = pulsedAlpha
      ctx.fillStyle = p.color
      ctx.shadowBlur = 4
      ctx.shadowColor = p.color
      ctx.fill()
    })
    ctx.globalAlpha = 1
    ctx.shadowBlur = 0

    // === HIT RINGS ===
    hitRings.current = hitRings.current.filter(ring => ring.alpha > 0.02)
    hitRings.current.forEach(ring => {
      ring.r += 5
      ring.alpha *= 0.9
      ctx.beginPath()
      ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2)
      ctx.strokeStyle = ring.color
      ctx.lineWidth = 2
      ctx.globalAlpha = ring.alpha
      ctx.shadowBlur = 15
      ctx.shadowColor = ring.color
      ctx.stroke()
    })
    ctx.globalAlpha = 1
    ctx.shadowBlur = 0

    // === BALL TRAIL ===
    const trailColors = state.comboColors || ['#ffffff', '#aaaaff']
    ballTrail.current.forEach((p, i) => {
      const progress = 1 - p.age / 18
      const r = BALL_RADIUS * 0.8 * progress
      const ci = i % trailColors.length
      ctx.beginPath()
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
      ctx.globalAlpha = progress * 0.5
      ctx.fillStyle = trailColors[ci]
      ctx.shadowBlur = 8
      ctx.shadowColor = trailColors[ci]
      ctx.fill()
    })
    ctx.globalAlpha = 1
    ctx.shadowBlur = 0

    // === GAME PARTICLES ===
    state.particles.forEach(p => {
      const progress = p.life / p.maxLife
      const bpx = toX(p.x)
      const bpy = toY(p.y)
      ctx.beginPath()
      ctx.arc(bpx, bpy, Math.max(0.5, p.size * progress), 0, Math.PI * 2)
      ctx.globalAlpha = Math.min(1, progress * 1.2)
      ctx.fillStyle = p.color
      ctx.shadowBlur = 6
      ctx.shadowColor = p.color
      ctx.fill()
    })
    ctx.globalAlpha = 1
    ctx.shadowBlur = 0

    // === PADDLES ===
    const leftPaddleCX = toX(-0.89)
    const rightPaddleCX = toX(0.89)
    const leftPaddleCY = toY(state.leftPaddleY)
    const rightPaddleCY = toY(state.rightPaddleY)
    const pW = PADDLE_W
    const pH = PADDLE_H

    drawPaddle(ctx, leftPaddleCX, leftPaddleCY, pW, pH, '#ff3300', '#ff7744',
      leftPaddleStretch.current, state.leftFaceDetected, state.lastHitPlayer === 'left')
    drawPaddle(ctx, rightPaddleCX, rightPaddleCY, pW, pH, '#0044ff', '#4488ff',
      rightPaddleStretch.current, state.rightFaceDetected, state.lastHitPlayer === 'right')

    // === BALL ===
    const ballCX = toX(state.ballX)
    const ballCY = toY(state.ballY)
    const ballCol1 = trailColors[0]
    const ballCol2 = trailColors[1] || '#ffffff'

    // Motion blur streak
    const bSpeed = Math.sqrt(state.ballVX * state.ballVX + state.ballVY * state.ballVY)
    if (bSpeed > 0.015 && state.phase === 'playing') {
      const streakLen = Math.min(60, bSpeed * 2000)
      const streakGrad = ctx.createLinearGradient(
        ballCX - state.ballVX * streakLen * 30,
        ballCY - state.ballVY * streakLen * 30,
        ballCX,
        ballCY
      )
      streakGrad.addColorStop(0, 'rgba(255,255,255,0)')
      streakGrad.addColorStop(1, `${ballCol1}88`)
      ctx.strokeStyle = streakGrad
      ctx.lineWidth = BALL_RADIUS * 1.5
      ctx.lineCap = 'round'
      ctx.globalAlpha = 0.5
      ctx.beginPath()
      ctx.moveTo(ballCX - state.ballVX * streakLen * 30, ballCY - state.ballVY * streakLen * 30)
      ctx.lineTo(ballCX, ballCY)
      ctx.stroke()
      ctx.globalAlpha = 1
      ctx.lineCap = 'butt'
    }

    // Ball glow halos
    for (let i = 4; i >= 0; i--) {
      const haloR = BALL_RADIUS + i * 9
      ctx.beginPath()
      ctx.arc(ballCX, ballCY, haloR, 0, Math.PI * 2)
      ctx.globalAlpha = (0.06 - i * 0.008) + state.speedTier * 0.015
      ctx.fillStyle = ballCol1
      ctx.shadowBlur = 0
      ctx.fill()
    }
    ctx.globalAlpha = 1

    // Ball core gradient
    const ballGrad = ctx.createRadialGradient(
      ballCX - BALL_RADIUS * 0.35, ballCY - BALL_RADIUS * 0.35, BALL_RADIUS * 0.1,
      ballCX, ballCY, BALL_RADIUS
    )
    ballGrad.addColorStop(0, '#ffffff')
    ballGrad.addColorStop(0.35, '#ffffffdd')
    ballGrad.addColorStop(0.7, ballCol1)
    ballGrad.addColorStop(1, ballCol2)

    ctx.beginPath()
    ctx.arc(ballCX, ballCY, BALL_RADIUS, 0, Math.PI * 2)
    ctx.fillStyle = ballGrad
    ctx.shadowBlur = 30 + state.speedTier * 10
    ctx.shadowColor = ballCol1
    ctx.fill()
    ctx.shadowBlur = 0

    // Ball specular
    ctx.beginPath()
    ctx.arc(ballCX - BALL_RADIUS * 0.3, ballCY - BALL_RADIUS * 0.3, BALL_RADIUS * 0.3, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.fill()

    // === WALLS ===
    drawWall(ctx, 0, 0, cw, 10, 'top', t)
    drawWall(ctx, 0, ch - 10, cw, 10, 'bottom', t)

    // === EFFECTS ===
    // Hit flash
    if (hitColorFlash.current && hitColorFlash.current.alpha > 0.005) {
      ctx.globalAlpha = hitColorFlash.current.alpha
      ctx.fillStyle = hitColorFlash.current.color
      ctx.fillRect(-20, -20, cw + 40, ch + 40)
      hitColorFlash.current.alpha *= 0.7
      ctx.globalAlpha = 1
    }

    // Screen pulse vignette
    if (pulseAlpha.current > 0.01) {
      const vign = ctx.createRadialGradient(cw/2, ch/2, ch * 0.2, cw/2, ch/2, cw * 0.85)
      vign.addColorStop(0, 'rgba(0,0,0,0)')
      vign.addColorStop(1, `rgba(255,255,255,${pulseAlpha.current * 0.15})`)
      ctx.fillStyle = vign
      ctx.globalAlpha = 1
      ctx.fillRect(-20, -20, cw + 40, ch + 40)
    }

    // Chromatic aberration
    if (chromaticOffset.current > 1) {
      const off = chromaticOffset.current
      ctx.globalCompositeOperation = 'screen'
      ctx.globalAlpha = 0.12
      // Red channel offset
      ctx.fillStyle = 'rgba(255,0,0,0.05)'
      ctx.fillRect(-20, -20, cw + 40, ch + 40)
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
    }

    // Final seconds red border
    if (state.finalSeconds && state.phase === 'playing') {
      finalSecondsBeat.current += 0.08
      const beat = (Math.sin(finalSecondsBeat.current * 10) + 1) * 0.5
      const intensity = Math.max(0, (10 - state.timeLeft) / 10)
      
      ctx.globalAlpha = beat * 0.08 * intensity
      ctx.fillStyle = '#ff0000'
      ctx.fillRect(-20, -20, cw + 40, ch + 40)
      ctx.globalAlpha = 1

      // Pulsing border
      ctx.strokeStyle = `rgba(255,0,0,${beat * 0.6 * intensity})`
      ctx.lineWidth = 5
      ctx.strokeRect(3, 3, cw - 6, ch - 6)
    }

    // Vignette overlay
    const vigOuter = ctx.createRadialGradient(cw/2, ch/2, ch * 0.3, cw/2, ch/2, cw * 0.75)
    vigOuter.addColorStop(0, 'rgba(0,0,0,0)')
    vigOuter.addColorStop(1, 'rgba(0,0,8,0.45)')
    ctx.fillStyle = vigOuter
    ctx.globalAlpha = 1
    ctx.fillRect(-20, -20, cw + 40, ch + 40)

    ctx.restore()
  }, [])

  function drawPaddle(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    w: number, h: number,
    col1: string, col2: string,
    stretch: number,
    detected: boolean,
    isHit: boolean
  ) {
    const hw = w / 2
    const stretchedH = h * stretch
    const squashedH = stretchedH
    const hh = squashedH / 2

    // Outer glow layers
    const glowColor = col1
    for (let i = 5; i >= 1; i--) {
      const spread = i * (isHit ? 9 : 5)
      ctx.beginPath()
      if (ctx.roundRect) {
        ctx.roundRect(x - hw - spread * 0.5, y - hh - spread * 0.3, w + spread, squashedH + spread * 0.6, 6)
      } else {
        ctx.rect(x - hw - spread * 0.5, y - hh - spread * 0.3, w + spread, squashedH + spread * 0.6)
      }
      ctx.fillStyle = glowColor
      ctx.globalAlpha = 0.025 * (6 - i) * (isHit ? 2 : 1)
      ctx.fill()
    }
    ctx.globalAlpha = 1

    // Main paddle body
    const pGrad = ctx.createLinearGradient(x - hw, y - hh, x + hw, y + hh)
    pGrad.addColorStop(0, col2)
    pGrad.addColorStop(0.4, '#ffffff')
    pGrad.addColorStop(0.6, col2)
    pGrad.addColorStop(1, col1)

    ctx.beginPath()
    if (ctx.roundRect) ctx.roundRect(x - hw, y - hh, w, squashedH, 5)
    else ctx.rect(x - hw, y - hh, w, squashedH)
    ctx.fillStyle = pGrad
    ctx.shadowBlur = isHit ? 35 : 18
    ctx.shadowColor = col1
    ctx.fill()
    ctx.shadowBlur = 0

    // Inner highlight stripe
    ctx.beginPath()
    if (ctx.roundRect) ctx.roundRect(x - hw + 3, y - hh + 6, w - 6, squashedH * 0.38, 3)
    else ctx.rect(x - hw + 3, y - hh + 6, w - 6, squashedH * 0.38)
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.fill()

    // Edge highlight
    ctx.strokeStyle = `${col2}cc`
    ctx.lineWidth = 1.5
    ctx.beginPath()
    if (ctx.roundRect) ctx.roundRect(x - hw, y - hh, w, squashedH, 5)
    else ctx.rect(x - hw, y - hh, w, squashedH)
    ctx.stroke()

    // Face detection dot
    ctx.beginPath()
    ctx.arc(x, y - hh - 14, 6, 0, Math.PI * 2)
    ctx.fillStyle = detected ? '#00ff88' : '#ff3344'
    ctx.shadowBlur = 10
    ctx.shadowColor = detected ? '#00ff88' : '#ff3344'
    ctx.fill()
    ctx.shadowBlur = 0
  }

  function drawWall(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    pos: 'top' | 'bottom', t: number
  ) {
    // Animated wall glow
    const wallGrad = ctx.createLinearGradient(0, y, 0, y + h)
    const alpha1 = 0.5 + 0.3 * Math.sin(t * 3)
    const alpha2 = 0.1 + 0.1 * Math.sin(t * 2)
    if (pos === 'top') {
      wallGrad.addColorStop(0, `rgba(80,130,255,${alpha1})`)
      wallGrad.addColorStop(1, `rgba(30,60,180,${alpha2})`)
    } else {
      wallGrad.addColorStop(0, `rgba(30,60,180,${alpha2})`)
      wallGrad.addColorStop(1, `rgba(80,130,255,${alpha1})`)
    }

    ctx.fillStyle = wallGrad
    ctx.fillRect(x, y, w, h)

    // Glow line
    const lineY = pos === 'top' ? y + h - 1 : y + 1
    const lineGrad = ctx.createLinearGradient(0, lineY, w, lineY)
    lineGrad.addColorStop(0, 'rgba(100,160,255,0)')
    lineGrad.addColorStop(0.1, 'rgba(150,200,255,0.9)')
    lineGrad.addColorStop(0.5, 'rgba(200,230,255,1.0)')
    lineGrad.addColorStop(0.9, 'rgba(150,200,255,0.9)')
    lineGrad.addColorStop(1, 'rgba(100,160,255,0)')
    ctx.strokeStyle = lineGrad
    ctx.lineWidth = 2
    ctx.shadowBlur = 12
    ctx.shadowColor = '#88aaff'
    ctx.beginPath()
    ctx.moveTo(0, lineY)
    ctx.lineTo(w, lineY)
    ctx.stroke()
    ctx.shadowBlur = 0
  }

  // Main game loop
  const gameLoop = useCallback((timestamp: number) => {
    const delta = Math.min((timestamp - (lastTime.current || timestamp)) / 1000, 0.05)
    lastTime.current = timestamp

    const state = useGameStore.getState()
    if (state.phase === 'playing') {
      updatePhysics(delta)
    }

    render(timestamp)
    animRef.current = requestAnimationFrame(gameLoop)
  }, [updatePhysics, render])

  useEffect(() => {
    lastTime.current = 0
    animRef.current = requestAnimationFrame(gameLoop)
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [gameLoop])

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_W}
      height={CANVAS_H}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        imageRendering: 'auto',
      }}
    />
  )
}
