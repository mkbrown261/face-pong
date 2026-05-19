import { create } from 'zustand'

export type GamePhase = 'menu' | 'calibrate' | 'playing' | 'roundEnd' | 'gameOver'

export interface ParticleData {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  color: string
  life: number
  maxLife: number
  size: number
}

export interface HitEffect {
  id: number
  x: number
  y: number
  color: string
  timestamp: number
  player: 'left' | 'right'
}

export interface ScorePopup {
  id: number
  player: 'left' | 'right'
  timestamp: number
}

export interface GameState {
  phase: GamePhase
  leftScore: number
  rightScore: number
  round: number
  maxRounds: number
  timeLeft: number
  hitCount: number
  combo: number
  maxCombo: number
  ballSpeed: number
  ballX: number
  ballY: number
  ballVX: number
  ballVY: number
  leftPaddleY: number
  rightPaddleY: number
  leftPaddleTarget: number
  rightPaddleTarget: number
  particles: ParticleData[]
  hitEffects: HitEffect[]
  scorePopups: ScorePopup[]
  screenShake: number
  screenPulse: number
  chromaticAberration: number
  slowMotion: boolean
  slowMotionTimer: number
  finalSeconds: boolean
  lastHitPlayer: 'left' | 'right' | null
  ballTrail: Array<{ x: number; y: number; opacity: number }>
  leftFaceDetected: boolean
  rightFaceDetected: boolean
  roundScores: Array<{ left: number; right: number }>
  winner: 'left' | 'right' | 'tie' | null
  speedTier: number
  comboColors: string[]
  currentComboColorIndex: number
  
  // Actions
  setPhase: (phase: GamePhase) => void
  startGame: () => void
  resetGame: () => void
  updateBall: (x: number, y: number, vx: number, vy: number) => void
  updatePaddles: (leftY: number, rightY: number) => void
  setLeftPaddleTarget: (y: number) => void
  setRightPaddleTarget: (y: number) => void
  addParticles: (particles: ParticleData[]) => void
  updateParticles: () => void
  addHitEffect: (effect: HitEffect) => void
  addScorePopup: (player: 'left' | 'right') => void
  incrementScore: (player: 'left' | 'right') => void
  onPaddleHit: (player: 'left' | 'right', x: number, y: number) => void
  setScreenShake: (val: number) => void
  setScreenPulse: (val: number) => void
  setChromaticAberration: (val: number) => void
  setSlowMotion: (val: boolean) => void
  updateTimer: (delta: number) => void
  endRound: () => void
  setBallTrail: (trail: Array<{ x: number; y: number; opacity: number }>) => void
  setFaceDetected: (player: 'left' | 'right', detected: boolean) => void
  resetBall: () => void
}

const COMBO_COLOR_SETS = [
  ['#ff6b00', '#ff0000'],
  ['#9b00ff', '#ffffff'],
  ['#00ffff', '#ffff00'],
  ['#0088ff', '#ff44aa'],
  ['#00ff88', '#ffd700'],
]

const initialBallState = {
  ballX: 0,
  ballY: 0,
  ballVX: 0.012,
  ballVY: 0.008,
  ballSpeed: 1,
  hitCount: 0,
}

export const useGameStore = create<GameState>((set, get) => ({
  phase: 'menu',
  leftScore: 0,
  rightScore: 0,
  round: 1,
  maxRounds: 3,
  timeLeft: 60,
  hitCount: 0,
  combo: 0,
  maxCombo: 0,
  ballSpeed: 1,
  ballX: 0,
  ballY: 0,
  ballVX: 0.012,
  ballVY: 0.008,
  leftPaddleY: 0,
  rightPaddleY: 0,
  leftPaddleTarget: 0,
  rightPaddleTarget: 0,
  particles: [],
  hitEffects: [],
  scorePopups: [],
  screenShake: 0,
  screenPulse: 0,
  chromaticAberration: 0,
  slowMotion: false,
  slowMotionTimer: 0,
  finalSeconds: false,
  lastHitPlayer: null,
  ballTrail: [],
  leftFaceDetected: false,
  rightFaceDetected: false,
  roundScores: [],
  winner: null,
  speedTier: 0,
  comboColors: COMBO_COLOR_SETS[0],
  currentComboColorIndex: 0,

  setPhase: (phase) => set({ phase }),

  startGame: () => set({
    phase: 'playing',
    leftScore: 0,
    rightScore: 0,
    round: 1,
    timeLeft: 60,
    hitCount: 0,
    combo: 0,
    maxCombo: 0,
    roundScores: [],
    winner: null,
    finalSeconds: false,
    ...initialBallState,
  }),

  resetGame: () => set({
    phase: 'menu',
    leftScore: 0,
    rightScore: 0,
    round: 1,
    timeLeft: 60,
    hitCount: 0,
    combo: 0,
    maxCombo: 0,
    particles: [],
    hitEffects: [],
    scorePopups: [],
    roundScores: [],
    winner: null,
    screenShake: 0,
    screenPulse: 0,
    chromaticAberration: 0,
    slowMotion: false,
    finalSeconds: false,
    ...initialBallState,
  }),

  resetBall: () => {
    const angle = (Math.random() * Math.PI / 3) - Math.PI / 6
    const dir = Math.random() > 0.5 ? 1 : -1
    const speed = 0.012 + get().hitCount * 0.0003
    set({
      ballX: 0,
      ballY: (Math.random() - 0.5) * 0.5,
      ballVX: Math.cos(angle) * speed * dir,
      ballVY: Math.sin(angle) * speed,
      combo: 0,
    })
  },

  updateBall: (x, y, vx, vy) => set({ ballX: x, ballY: y, ballVX: vx, ballVY: vy }),

  updatePaddles: (leftY, rightY) => set({ leftPaddleY: leftY, rightPaddleY: rightY }),

  setLeftPaddleTarget: (y) => set({ leftPaddleTarget: y }),
  setRightPaddleTarget: (y) => set({ rightPaddleTarget: y }),

  addParticles: (newParticles) => set((state) => ({
    particles: [...state.particles, ...newParticles].slice(-200)
  })),

  updateParticles: () => set((state) => ({
    particles: state.particles
      .map(p => ({
        ...p,
        x: p.x + p.vx,
        y: p.y + p.vy,
        vx: p.vx * 0.95,
        vy: p.vy * 0.95 - 0.0002,
        life: p.life - 1,
      }))
      .filter(p => p.life > 0)
  })),

  addHitEffect: (effect) => set((state) => ({
    hitEffects: [...state.hitEffects, effect].slice(-20)
  })),

  addScorePopup: (player) => set((state) => ({
    scorePopups: [...state.scorePopups, {
      id: Date.now() + Math.random(),
      player,
      timestamp: Date.now(),
    }].slice(-5)
  })),

  incrementScore: (player) => set((state) => {
    const newLeft = player === 'left' ? state.leftScore + 1 : state.leftScore
    const newRight = player === 'right' ? state.rightScore + 1 : state.rightScore
    return { leftScore: newLeft, rightScore: newRight, combo: 0, lastHitPlayer: null }
  }),

  onPaddleHit: (player, x, y) => set((state) => {
    const newHitCount = state.hitCount + 1
    const newCombo = state.combo + 1
    const maxCombo = Math.max(state.maxCombo, newCombo)
    
    // Speed tiers
    let speedTier = 0
    if (newHitCount >= 15) speedTier = 3
    else if (newHitCount >= 10) speedTier = 2
    else if (newHitCount >= 5) speedTier = 1

    // Color rotation
    const colorIndex = (newHitCount % COMBO_COLOR_SETS.length)
    
    // Generate burst particles
    const colors = COMBO_COLOR_SETS[colorIndex]
    const numParticles = 20 + newCombo * 3
    const newParticles: ParticleData[] = Array.from({ length: Math.min(numParticles, 60) }, (_, i) => {
      const angle = (i / numParticles) * Math.PI * 2
      const speed = 0.008 + Math.random() * 0.025
      const color = colors[Math.floor(Math.random() * colors.length)]
      return {
        id: Date.now() + i + Math.random(),
        x,
        y,
        vx: Math.cos(angle) * speed * (player === 'left' ? 1 : -1),
        vy: Math.sin(angle) * speed,
        color,
        life: 40 + Math.random() * 30,
        maxLife: 70,
        size: 2 + Math.random() * 4,
      }
    })

    return {
      hitCount: newHitCount,
      combo: newCombo,
      maxCombo,
      speedTier,
      lastHitPlayer: player,
      comboColors: colors,
      currentComboColorIndex: colorIndex,
      particles: [...state.particles, ...newParticles].slice(-300),
      hitEffects: [...state.hitEffects, {
        id: Date.now() + Math.random(),
        x, y,
        color: colors[0],
        timestamp: Date.now(),
        player,
      }].slice(-20),
      screenShake: 0.015 + newCombo * 0.003,
      screenPulse: 0.3 + newCombo * 0.05,
    }
  }),

  setScreenShake: (val) => set({ screenShake: val }),
  setScreenPulse: (val) => set({ screenPulse: val }),
  setChromaticAberration: (val) => set({ chromaticAberration: val }),
  setSlowMotion: (val) => set({ slowMotion: val }),

  updateTimer: (delta) => set((state) => {
    if (state.phase !== 'playing') return {}
    const newTime = Math.max(0, state.timeLeft - delta)
    const finalSeconds = newTime <= 10
    if (newTime <= 0) {
      return { timeLeft: 0, finalSeconds: true }
    }
    return { timeLeft: newTime, finalSeconds }
  }),

  endRound: () => set((state) => {
    const newRoundScores = [...state.roundScores, { left: state.leftScore, right: state.rightScore }]
    
    if (state.round >= state.maxRounds) {
      // Game over - calculate winner
      const totalLeft = newRoundScores.reduce((a, b) => a + b.left, 0)
      const totalRight = newRoundScores.reduce((a, b) => a + b.right, 0)
      const winner = totalLeft > totalRight ? 'left' : totalRight > totalLeft ? 'right' : 'tie'
      return {
        phase: 'gameOver',
        roundScores: newRoundScores,
        winner,
      }
    }
    
    return {
      phase: 'roundEnd',
      roundScores: newRoundScores,
      round: state.round + 1,
    }
  }),

  setBallTrail: (trail) => set({ ballTrail: trail }),

  setFaceDetected: (player, detected) => {
    if (player === 'left') set({ leftFaceDetected: detected })
    else set({ rightFaceDetected: detected })
  },
}))
