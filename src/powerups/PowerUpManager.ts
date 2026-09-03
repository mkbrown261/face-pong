/**
 * PowerUpManager — tracks consecutive hits per player, manages tier state,
 * and owns the video assets for fireball/explosion overlays.
 *
 * Tier rules (consecutive hits, no miss):
 *   3 hits  → SPEED SURGE   + Matrix rain on attacker's half
 *   5 hits  → PHANTOM BALL  (extra ball spawns, double-edged)
 *   7 hits  → FIREBALL       (ball becomes fireball video; explosion on any hit)
 *   9 hits  → MISSILE LOCK   (homing missile fires, leaves smoke trail)
 *
 * Reset on: opponent scores, or ball falls past your paddle.
 */

export type PowerTier = 0 | 1 | 2 | 3 | 4   // 0=none 1=speed 2=phantom 3=fireball 4=missile

export interface MatrixColumn {
  x: number
  y: number
  speed: number
  chars: string[]
  alpha: number
  color: string
}

export interface MissileState {
  active: boolean
  x: number          // normalized -1..1
  y: number
  vx: number
  vy: number
  firedBy: 'left' | 'right'
  age: number        // frames alive
  trail: Array<{ x: number; y: number; alpha: number }>
  exploding: boolean
  explodeX: number
  explodeY: number
  explodeAge: number
}

export interface PhantomBall {
  active: boolean
  x: number; y: number
  vx: number; vy: number
  color: string
  age: number
}

export interface ExplosionOverlay {
  id: number
  x: number        // canvas pixel
  y: number
  size: number
  startTime: number
  duration: number // ms
}

const MATRIX_CHARS = '01アイウエオカキクケコサシスセソタチツテト数字秘密量子波動'
const TIER_THRESHOLDS = [3, 5, 7, 9]

export class PowerUpManager {
  // ── Streak tracking ─────────────────────────────────────────────────────
  private leftStreak  = 0
  private rightStreak = 0
  public  leftTier:  PowerTier = 0
  public  rightTier: PowerTier = 0
  public  activeTier: PowerTier = 0   // highest tier currently active
  public  activeSide: 'left' | 'right' | null = null

  // Newly-reached tier this frame (for one-shot activation)
  public  tierJustReached: { side: 'left'|'right', tier: PowerTier } | null = null

  // ── Matrix rain ──────────────────────────────────────────────────────────
  public matrixColsLeft:  MatrixColumn[] = []
  public matrixColsRight: MatrixColumn[] = []
  private matrixActive = false
  private readonly CANVAS_W: number
  private readonly CANVAS_H: number

  // ── Phantom ball ─────────────────────────────────────────────────────────
  public phantom: PhantomBall = {
    active: false, x: 0, y: 0, vx: 0, vy: 0,
    color: '#c77dff', age: 0,
  }

  // ── Video elements ────────────────────────────────────────────────────────
  private fireballVid:   HTMLVideoElement | null = null
  private explosionVid:  HTMLVideoElement | null = null
  public  videosReady = false

  // ── Explosion overlays (canvas-drawn, multiple simultaneous) ─────────────
  public explosions: ExplosionOverlay[] = []

  // ── Missile ───────────────────────────────────────────────────────────────
  public missile: MissileState = {
    active: false, x: 0, y: 0, vx: 0, vy: 0,
    firedBy: 'left', age: 0, trail: [],
    exploding: false, explodeX: 0, explodeY: 0, explodeAge: 0,
  }

  // ── Fireball rotation accumulator ─────────────────────────────────────────
  public fireballAngle = 0

  constructor(canvasW: number, canvasH: number) {
    this.CANVAS_W = canvasW
    this.CANVAS_H = canvasH
  }

  // ── Video asset loading ──────────────────────────────────────────────────
  loadVideos() {
    if (this.videosReady) return

    this.fireballVid = document.createElement('video')
    this.fireballVid.src = '/videos/fireball.webm'
    this.fireballVid.loop = true
    this.fireballVid.muted = true
    this.fireballVid.playsInline = true
    this.fireballVid.preload = 'auto'

    this.explosionVid = document.createElement('video')
    this.explosionVid.src = '/videos/explosion.webm'
    this.explosionVid.muted = true
    this.explosionVid.playsInline = true
    this.explosionVid.preload = 'auto'

    let loaded = 0
    const onReady = () => { if (++loaded >= 2) this.videosReady = true }
    this.fireballVid.addEventListener('canplaythrough', onReady, { once: true })
    this.explosionVid.addEventListener('canplaythrough', onReady, { once: true })
    // fallback — mark ready after 3s regardless
    setTimeout(() => { this.videosReady = true }, 3000)
  }

  get fireballVideo(): HTMLVideoElement | null { return this.fireballVid }
  get explosionVideo(): HTMLVideoElement | null { return this.explosionVid }

  // ── Streak / tier logic ──────────────────────────────────────────────────
  onHit(side: 'left' | 'right') {
    this.tierJustReached = null

    if (side === 'left') {
      this.leftStreak++
      this.rightStreak = 0          // opponent's streak resets on your hit
      const prev = this.leftTier
      this.leftTier = this._calcTier(this.leftStreak)
      if (this.leftTier > prev) this.tierJustReached = { side: 'left', tier: this.leftTier }
    } else {
      this.rightStreak++
      this.leftStreak = 0
      const prev = this.rightTier
      this.rightTier = this._calcTier(this.rightStreak)
      if (this.rightTier > prev) this.tierJustReached = { side: 'right', tier: this.rightTier }
    }

    // Recompute dominant side
    if (this.leftTier >= this.rightTier) {
      this.activeTier = this.leftTier; this.activeSide = this.leftTier > 0 ? 'left' : null
    } else {
      this.activeTier = this.rightTier; this.activeSide = 'right'
    }
  }

  onScore(scoringSide: 'left' | 'right') {
    // The side that GOT scored on loses their streak
    const loser = scoringSide === 'left' ? 'right' : 'left'
    this._resetSide(loser)
    this.tierJustReached = null
  }

  private _resetSide(side: 'left' | 'right') {
    if (side === 'left') {
      this.leftStreak = 0; this.leftTier = 0
      this.matrixColsLeft = []
    } else {
      this.rightStreak = 0; this.rightTier = 0
      this.matrixColsRight = []
    }
    // Deactivate effects if that side was the active one
    if (this.activeSide === side) {
      this.activeTier = 0; this.activeSide = null
      this._deactivateMatrix(side)
      if (this.phantom.active) this.phantom.active = false
      if (this.missile.active && this.missile.firedBy === side) this.missile.active = false
    }
    // Recalculate from remaining side
    const otherTier = side === 'left' ? this.rightTier : this.leftTier
    if (otherTier > 0) {
      this.activeTier = otherTier
      this.activeSide = side === 'left' ? 'right' : 'left'
    }
  }

  reset() {
    this.leftStreak = 0; this.rightStreak = 0
    this.leftTier = 0; this.rightTier = 0
    this.activeTier = 0; this.activeSide = null
    this.tierJustReached = null
    this.matrixColsLeft = []; this.matrixColsRight = []
    this.matrixActive = false
    this.phantom = { active: false, x: 0, y: 0, vx: 0, vy: 0, color: '#c77dff', age: 0 }
    this.missile = { active: false, x: 0, y: 0, vx: 0, vy: 0, firedBy: 'left', age: 0, trail: [], exploding: false, explodeX: 0, explodeY: 0, explodeAge: 0 }
    this.explosions = []
    if (this.fireballVid) { this.fireballVid.pause(); this.fireballVid.currentTime = 0 }
  }

  private _calcTier(streak: number): PowerTier {
    if (streak >= TIER_THRESHOLDS[3]) return 4
    if (streak >= TIER_THRESHOLDS[2]) return 3
    if (streak >= TIER_THRESHOLDS[1]) return 2
    if (streak >= TIER_THRESHOLDS[0]) return 1
    return 0
  }

  getStreak(side: 'left' | 'right') {
    return side === 'left' ? this.leftStreak : this.rightStreak
  }

  // ── Tier activation handlers (called once when tier is first reached) ────
  activateTier(side: 'left' | 'right', tier: PowerTier, ballX: number, ballY: number, ballVX: number, ballVY: number) {
    switch (tier) {
      case 1: this._activateSpeedSurge(side); break
      case 2: this._activatePhantom(side, ballX, ballY, ballVX, ballVY); break
      case 3: this._activateFireball(); break
      case 4: this._activateMissile(side, ballX, ballY); break
    }
  }

  // Tier 1 — speed surge handled in physics (see speedMultiplierBonus below)
  private _activateSpeedSurge(side: 'left' | 'right') {
    this._initMatrixColumns(side)
  }

  get speedMultiplierBonus(): number {
    // +30% at tier 1+, +50% at tier 3+
    if (this.activeTier >= 3) return 0.50
    if (this.activeTier >= 1) return 0.30
    return 0
  }

  // ── Matrix rain ──────────────────────────────────────────────────────────
  private _initMatrixColumns(side: 'left' | 'right') {
    const cols: MatrixColumn[] = []
    const halfW = this.CANVAS_W / 2
    const colCount = 22
    const spacing = halfW / colCount
    const offsetX = side === 'right' ? halfW : 0

    for (let i = 0; i < colCount; i++) {
      const charLen = 8 + Math.floor(Math.random() * 12)
      cols.push({
        x: offsetX + i * spacing + spacing * 0.5,
        y: Math.random() * this.CANVAS_H,
        speed: 2.5 + Math.random() * 4,
        chars: Array.from({ length: charLen }, () =>
          MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)]),
        alpha: 0.3 + Math.random() * 0.5,
        color: Math.random() > 0.15 ? '#00ff41' : '#88ffaa',
      })
    }

    if (side === 'left') this.matrixColsLeft = cols
    else this.matrixColsRight = cols
    this.matrixActive = true
  }

  private _deactivateMatrix(side: 'left' | 'right') {
    if (side === 'left') this.matrixColsLeft = []
    else this.matrixColsRight = []
  }

  updateMatrix() {
    const update = (cols: MatrixColumn[]) => {
      cols.forEach(col => {
        col.y += col.speed
        if (col.y > this.CANVAS_H + 100) {
          col.y = -100 - Math.random() * 200
          col.speed = 2.5 + Math.random() * 4
        }
        // Randomly mutate chars
        if (Math.random() < 0.08) {
          const idx = Math.floor(Math.random() * col.chars.length)
          col.chars[idx] = MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)]
        }
      })
    }
    update(this.matrixColsLeft)
    update(this.matrixColsRight)
  }

  // ── Phantom ball ─────────────────────────────────────────────────────────
  private _activatePhantom(side: 'left' | 'right', bx: number, by: number, bvx: number, bvy: number) {
    // Spawn phantom going the opposite-ish direction at 45°
    const angle = Math.PI / 4 + (Math.random() * Math.PI / 8 - Math.PI / 16)
    const spd = Math.sqrt(bvx * bvx + bvy * bvy) * 0.9
    const dir = side === 'left' ? 1 : -1
    this.phantom = {
      active: true,
      x: bx, y: by,
      vx: Math.cos(angle) * spd * dir,
      vy: (Math.random() > 0.5 ? 1 : -1) * Math.sin(angle) * spd,
      color: '#c77dff',
      age: 0,
    }
  }

  updatePhantom(leftPaddleY: number, rightPaddleY: number,
    paddleHalfH: number, speedMult: number): {
    scored: 'left' | 'right' | null
    paddleHit: 'left' | 'right' | null
  } {
    const p = this.phantom
    if (!p.active) return { scored: null, paddleHit: null }

    p.age++
    // Auto-expire after 12 seconds (720 frames)
    if (p.age > 720) { p.active = false; return { scored: null, paddleHit: null } }

    const SPEED = speedMult
    p.x += p.vx * SPEED
    p.y += p.vy * SPEED

    // Wall bounce
    if (p.y > 0.915)  { p.y = 0.915;  p.vy = -Math.abs(p.vy) }
    if (p.y < -0.915) { p.y = -0.915; p.vy =  Math.abs(p.vy) }

    const LX = -0.895, RX = 0.895, HZ = 0.06

    let paddleHit: 'left' | 'right' | null = null

    // Left paddle
    if (p.vx < 0 && p.x <= LX + HZ && p.x >= LX - 0.02) {
      if (Math.abs(p.y - leftPaddleY) <= paddleHalfH) {
        const hitFrac = (p.y - leftPaddleY) / paddleHalfH
        const angle = hitFrac * (Math.PI / 3.2)
        const spd = Math.sqrt(p.vx*p.vx+p.vy*p.vy)*1.04
        p.vx = Math.cos(angle) * spd
        p.vy = Math.sin(angle) * spd
        p.x = LX + HZ
        paddleHit = 'left'
      }
    }
    // Right paddle
    if (p.vx > 0 && p.x >= RX - HZ && p.x <= RX + 0.02) {
      if (Math.abs(p.y - rightPaddleY) <= paddleHalfH) {
        const hitFrac = (p.y - rightPaddleY) / paddleHalfH
        const angle = hitFrac * (Math.PI / 3.2)
        const spd = Math.sqrt(p.vx*p.vx+p.vy*p.vy)*1.04
        p.vx = -Math.cos(angle) * spd
        p.vy = Math.sin(angle) * spd
        p.x = RX - HZ
        paddleHit = 'right'
      }
    }

    // Scoring
    if (p.x < -1.12) { p.active = false; return { scored: 'right', paddleHit } }
    if (p.x >  1.12) { p.active = false; return { scored: 'left',  paddleHit } }

    return { scored: null, paddleHit }
  }

  // ── Fireball ─────────────────────────────────────────────────────────────
  private _activateFireball() {
    if (this.fireballVid) {
      this.fireballVid.currentTime = 0
      this.fireballVid.play().catch(() => {})
    }
  }

  triggerExplosion(canvasX: number, canvasY: number, size = 260) {
    this.explosions.push({
      id: Date.now() + Math.random(),
      x: canvasX, y: canvasY,
      size,
      startTime: performance.now(),
      duration: 1400,
    })
    // Restart explosion video for this hit
    if (this.explosionVid) {
      this.explosionVid.currentTime = 0
      this.explosionVid.play().catch(() => {})
    }
  }

  updateExplosions() {
    const now = performance.now()
    this.explosions = this.explosions.filter(e => now - e.startTime < e.duration)
  }

  // ── Missile ───────────────────────────────────────────────────────────────
  private _activateMissile(side: 'left' | 'right', ballX: number, ballY: number) {
    if (this.missile.active) return
    const dir = side === 'left' ? 1 : -1
    this.missile = {
      active: true,
      x: side === 'left' ? -0.88 : 0.88,
      y: ballY,
      vx: dir * 0.032,
      vy: 0,
      firedBy: side,
      age: 0,
      trail: [],
      exploding: false,
      explodeX: 0, explodeY: 0, explodeAge: 0,
    }
  }

  updateMissile(
    targetY: number,
    leftPaddleY: number, rightPaddleY: number,
    paddleHalfH: number,
    toCanvasX: (n: number) => number,
    toCanvasY: (n: number) => number
  ): { hit: boolean; missileX: number; missileY: number } {
    const m = this.missile
    if (!m.active && !m.exploding) return { hit: false, missileX: 0, missileY: 0 }

    // Handle exploding state
    if (m.exploding) {
      m.explodeAge++
      if (m.explodeAge > 80) { m.exploding = false }
      return { hit: false, missileX: m.explodeX, missileY: m.explodeY }
    }

    m.age++
    // Homing: steer toward target Y
    const dy = targetY - m.y
    m.vy += dy * 0.07
    m.vy = Math.max(-0.025, Math.min(0.025, m.vy))  // clamp turn rate

    m.x += m.vx
    m.y += m.vy

    // Wall bounce
    if (m.y > 0.915)  { m.y = 0.915;  m.vy = -Math.abs(m.vy) }
    if (m.y < -0.915) { m.y = -0.915; m.vy =  Math.abs(m.vy) }

    // Trail
    m.trail.push({ x: toCanvasX(m.x), y: toCanvasY(m.y), alpha: 0.9 })
    m.trail = m.trail.map(t => ({ ...t, alpha: t.alpha * 0.92 })).filter(t => t.alpha > 0.05)
    if (m.trail.length > 40) m.trail.shift()

    const LX = -0.895, RX = 0.895, HZ = 0.08

    // Intercept checks — can the defending paddle deflect?
    if (m.firedBy === 'left' && m.vx > 0 && m.x >= RX - HZ && m.x <= RX + 0.02) {
      if (Math.abs(m.y - rightPaddleY) <= paddleHalfH * 1.2) {
        // Deflected! Bounce back
        m.vx = -m.vx * 0.9
        m.x = RX - HZ
        return { hit: false, missileX: 0, missileY: 0 }
      } else {
        // Hit! Explode
        const cx = toCanvasX(m.x), cy = toCanvasY(m.y)
        m.active = false; m.exploding = true
        m.explodeX = cx; m.explodeY = cy; m.explodeAge = 0
        this.triggerExplosion(cx, cy, 380)
        return { hit: true, missileX: cx, missileY: cy }
      }
    }

    if (m.firedBy === 'right' && m.vx < 0 && m.x <= LX + HZ && m.x >= LX - 0.02) {
      if (Math.abs(m.y - leftPaddleY) <= paddleHalfH * 1.2) {
        m.vx = -m.vx * 0.9
        m.x = LX + HZ
        return { hit: false, missileX: 0, missileY: 0 }
      } else {
        const cx = toCanvasX(m.x), cy = toCanvasY(m.y)
        m.active = false; m.exploding = true
        m.explodeX = cx; m.explodeY = cy; m.explodeAge = 0
        this.triggerExplosion(cx, cy, 380)
        return { hit: true, missileX: cx, missileY: cy }
      }
    }

    // Out of bounds miss
    if (m.x < -1.2 || m.x > 1.2) {
      m.active = false
    }

    return { hit: false, missileX: 0, missileY: 0 }
  }

  // ── Draw routines ────────────────────────────────────────────────────────

  drawMatrix(ctx: CanvasRenderingContext2D) {
    const allCols = [...this.matrixColsLeft, ...this.matrixColsRight]
    if (allCols.length === 0) return

    ctx.save()
    ctx.font = '11px monospace'
    ctx.textAlign = 'center'

    allCols.forEach(col => {
      const charH = 14
      col.chars.forEach((ch, i) => {
        const y = col.y - i * charH
        if (y < -charH || y > this.CANVAS_H + charH) return
        // Head character is bright
        const isTip = i === 0
        ctx.globalAlpha = isTip ? col.alpha : col.alpha * (1 - i / col.chars.length) * 0.7
        ctx.fillStyle = isTip ? '#aaffaa' : col.color
        ctx.shadowBlur = isTip ? 8 : 0
        ctx.shadowColor = '#00ff41'
        ctx.fillText(ch, col.x, y)
      })
    })

    ctx.restore()
    ctx.shadowBlur = 0
    ctx.globalAlpha = 1
  }

  drawPhantom(ctx: CanvasRenderingContext2D, toX: (n: number) => number, toY: (n: number) => number) {
    const p = this.phantom
    if (!p.active) return

    const px = toX(p.x), py = toY(p.y)
    const pulse = 0.7 + 0.3 * Math.sin(p.age * 0.18)

    ctx.save()
    // Outer glow halos
    for (let i = 3; i >= 0; i--) {
      ctx.beginPath(); ctx.arc(px, py, 11 + i * 8, 0, Math.PI * 2)
      ctx.globalAlpha = (0.04 - i * 0.007) * pulse
      ctx.fillStyle = '#c77dff'; ctx.fill()
    }
    ctx.globalAlpha = 1

    // Core
    const grad = ctx.createRadialGradient(px - 3, py - 3, 1, px, py, 11)
    grad.addColorStop(0, 'rgba(255,255,255,0.85)')
    grad.addColorStop(0.4, 'rgba(199,125,255,0.9)')
    grad.addColorStop(1, 'rgba(157,78,221,0.6)')
    ctx.beginPath(); ctx.arc(px, py, 11, 0, Math.PI * 2)
    ctx.globalAlpha = 0.82 * pulse
    ctx.fillStyle = grad
    ctx.shadowBlur = 22; ctx.shadowColor = '#c77dff'
    ctx.fill()
    ctx.shadowBlur = 0; ctx.globalAlpha = 1

    // "PHANTOM" label
    ctx.fillStyle = 'rgba(199,125,255,0.7)'
    ctx.font = 'bold 8px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('PHANTOM', px, py - 18)
    ctx.restore()
  }

  drawFireball(ctx: CanvasRenderingContext2D, ballX: number, ballY: number, angle: number) {
    if (this.activeTier < 3) return
    if (!this.fireballVid || this.fireballVid.readyState < 2) return

    const SIZE = 110

    ctx.save()
    ctx.translate(ballX, ballY)
    ctx.rotate(angle)
    ctx.globalCompositeOperation = 'screen'
    ctx.globalAlpha = 0.95
    ctx.drawImage(this.fireballVid, -SIZE / 2, -SIZE / 2, SIZE, SIZE)
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
    ctx.restore()
  }

  drawExplosions(ctx: CanvasRenderingContext2D) {
    if (!this.explosionVid || this.explosionVid.readyState < 2) return
    const now = performance.now()

    this.explosions.forEach(exp => {
      const elapsed = now - exp.startTime
      const progress = elapsed / exp.duration
      if (progress >= 1) return

      const alpha = progress < 0.6 ? 1 : 1 - (progress - 0.6) / 0.4
      const size = exp.size * (0.5 + progress * 0.5)

      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      ctx.globalAlpha = alpha * 0.92
      ctx.drawImage(this.explosionVid!, exp.x - size/2, exp.y - size/2, size, size)
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1
      ctx.restore()
    })
  }

  drawMissile(ctx: CanvasRenderingContext2D, toX: (n: number) => number, toY: (n: number) => number) {
    const m = this.missile
    if (!m.active && !m.exploding) return

    // Trail
    if (m.trail.length > 1) {
      ctx.save()
      m.trail.forEach((pt, i) => {
        if (i === 0) return
        const prev = m.trail[i - 1]
        const grad = ctx.createLinearGradient(prev.x, prev.y, pt.x, pt.y)
        grad.addColorStop(0, `rgba(255,120,0,${prev.alpha * 0.6})`)
        grad.addColorStop(1, `rgba(255,200,50,${pt.alpha * 0.4})`)
        ctx.beginPath()
        ctx.moveTo(prev.x, prev.y)
        ctx.lineTo(pt.x, pt.y)
        ctx.strokeStyle = grad
        ctx.lineWidth = 3 + pt.alpha * 4
        ctx.lineCap = 'round'
        ctx.globalAlpha = pt.alpha
        ctx.stroke()
      })
      ctx.restore()
    }

    if (!m.active) return   // only trail lingers after explosion

    const mx = toX(m.x), my = toY(m.y)
    const heading = Math.atan2(m.vy, m.vx)

    ctx.save()
    ctx.translate(mx, my)
    ctx.rotate(heading)

    // Body
    const bodyGrad = ctx.createLinearGradient(-28, 0, 28, 0)
    bodyGrad.addColorStop(0, '#ff4400')
    bodyGrad.addColorStop(0.4, '#ffcc44')
    bodyGrad.addColorStop(0.7, '#ff8800')
    bodyGrad.addColorStop(1, '#cc2200')

    // Nosecone (pointed)
    ctx.beginPath()
    ctx.moveTo(26, 0)
    ctx.lineTo(14, -5)
    ctx.lineTo(14,  5)
    ctx.closePath()
    ctx.fillStyle = '#ffeeaa'
    ctx.shadowBlur = 12; ctx.shadowColor = '#ffaa00'
    ctx.fill()

    // Main cylinder
    ctx.beginPath()
    ctx.roundRect(-14, -5, 28, 10, 3)
    ctx.fillStyle = bodyGrad
    ctx.fill()

    // Fins
    ctx.beginPath()
    ctx.moveTo(-14, -5); ctx.lineTo(-22, -12); ctx.lineTo(-18, -5); ctx.closePath()
    ctx.fillStyle = '#cc3300'; ctx.fill()
    ctx.beginPath()
    ctx.moveTo(-14,  5); ctx.lineTo(-22,  12); ctx.lineTo(-18,  5); ctx.closePath()
    ctx.fillStyle = '#cc3300'; ctx.fill()

    // Exhaust glow
    ctx.beginPath()
    ctx.arc(-18, 0, 5 + 3 * Math.sin(m.age * 0.3), 0, Math.PI * 2)
    ctx.fillStyle = '#ff6600'
    ctx.globalAlpha = 0.7
    ctx.shadowBlur = 14; ctx.shadowColor = '#ff4400'
    ctx.fill()

    ctx.shadowBlur = 0; ctx.globalAlpha = 1
    ctx.restore()

    // WARNING text on defender's side
    if (m.age < 120) {
      const warnSide = m.firedBy === 'left' ? 0.6 : -0.8
      const warnX = toX(warnSide)
      const flash = Math.sin(m.age * 0.25) > 0
      if (flash) {
        ctx.save()
        ctx.font = 'bold 13px monospace'
        ctx.textAlign = 'center'
        ctx.fillStyle = '#ff4400'
        ctx.globalAlpha = 0.85
        ctx.shadowBlur = 12; ctx.shadowColor = '#ff6600'
        ctx.fillText('⚠ MISSILE INCOMING ⚠', warnX, 40)
        ctx.shadowBlur = 0; ctx.globalAlpha = 1
        ctx.restore()
      }
    }
  }
}
