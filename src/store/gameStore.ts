import { create } from 'zustand'

export type GamePhase = 'menu' | 'playing' | 'roundEnd' | 'gameOver'
export type GameMode = 'local' | 'online-host' | 'online-guest'

export interface ParticleData {
  id: number; x: number; y: number
  vx: number; vy: number
  color: string; life: number; maxLife: number; size: number
}

export interface ScorePopup {
  id: number; player: 'left' | 'right'; timestamp: number
}

// ── Settings ──────────────────────────────────────────────────────────────────
export interface GameSettings {
  sensitivity: number        // 0.5 – 2.0  (face tracking multiplier)
  smoothing: number          // 1 – 10     (buffer size; higher = smoother but more lag)
  paddleSize: number         // 0.5 – 2.0  (multiplier on PADDLE_H)
  speedIntensity: number     // 0.5 – 2.0  (ball speed multiplier)
  roundDuration: number      // 30 | 60 | 90 | 120
  maxRounds: number          // 1 | 3 | 5
  particles: boolean
  screenShake: boolean
  deadzone: number           // 0 – 0.03   (ignore movements smaller than this)
}

export const defaultSettings: GameSettings = {
  sensitivity: 1.0,
  smoothing: 5,
  paddleSize: 1.0,
  speedIntensity: 1.0,
  roundDuration: 60,
  maxRounds: 3,
  particles: true,
  screenShake: true,
  deadzone: 0.008,
}

// ── Online / WebRTC ───────────────────────────────────────────────────────────
export interface OnlineState {
  mode: GameMode
  roomCode: string
  connected: boolean
  isHost: boolean
  peerLatency: number
}

// ── Main Store ────────────────────────────────────────────────────────────────
export interface GameState {
  phase: GamePhase
  settings: GameSettings
  online: OnlineState

  leftScore: number; rightScore: number
  round: number; timeLeft: number
  hitCount: number; combo: number; maxCombo: number
  ballX: number; ballY: number; ballVX: number; ballVY: number
  leftPaddleY: number; rightPaddleY: number
  leftPaddleTarget: number; rightPaddleTarget: number
  particles: ParticleData[]
  scorePopups: ScorePopup[]
  finalSeconds: boolean
  lastHitPlayer: 'left' | 'right' | null
  leftFaceDetected: boolean; rightFaceDetected: boolean
  roundScores: Array<{ left: number; right: number }>
  winner: 'left' | 'right' | 'tie' | null
  speedTier: number
  comboColors: string[]
  // screen fx (managed by renderer, not stored)
  settingsOpen: boolean

  // Actions
  setPhase: (phase: GamePhase) => void
  setSettings: (s: Partial<GameSettings>) => void
  setSettingsOpen: (v: boolean) => void
  startGame: (mode?: GameMode) => void
  resetGame: () => void
  resetBall: () => void
  updateBall: (x: number, y: number, vx: number, vy: number) => void
  updatePaddles: (leftY: number, rightY: number) => void
  setLeftPaddleTarget: (y: number) => void
  setRightPaddleTarget: (y: number) => void
  updateParticles: () => void
  addScorePopup: (player: 'left' | 'right') => void
  incrementScore: (player: 'left' | 'right') => void
  onPaddleHit: (player: 'left' | 'right', x: number, y: number) => ParticleData[]
  updateTimer: (delta: number) => void
  endRound: () => void
  setFaceDetected: (player: 'left' | 'right', detected: boolean) => void
  setOnline: (o: Partial<OnlineState>) => void
}

const COMBO_COLOR_SETS = [
  ['#ff6b00', '#ff0000'],
  ['#9b00ff', '#ffffff'],
  ['#00ffff', '#ffff00'],
  ['#0088ff', '#ff44aa'],
  ['#00ff88', '#ffd700'],
]

const makeBallState = (settings: GameSettings, hitCount = 0) => {
  const angle = (Math.random() * Math.PI / 3) - Math.PI / 6
  const dir = Math.random() > 0.5 ? 1 : -1
  const baseSpeed = 0.013 * settings.speedIntensity
  const speed = baseSpeed + hitCount * 0.0002
  return {
    ballX: 0,
    ballY: (Math.random() - 0.5) * 0.4,
    ballVX: Math.cos(angle) * speed * dir,
    ballVY: Math.sin(angle) * speed,
  }
}

export const useGameStore = create<GameState>((set, get) => ({
  phase: 'menu',
  settings: { ...defaultSettings },
  online: { mode: 'local', roomCode: '', connected: false, isHost: false, peerLatency: 0 },
  settingsOpen: false,

  leftScore: 0, rightScore: 0,
  round: 1, timeLeft: 60,
  hitCount: 0, combo: 0, maxCombo: 0,
  ballX: 0, ballY: 0, ballVX: 0.013, ballVY: 0.008,
  leftPaddleY: 0, rightPaddleY: 0,
  leftPaddleTarget: 0, rightPaddleTarget: 0,
  particles: [], scorePopups: [],
  finalSeconds: false, lastHitPlayer: null,
  leftFaceDetected: false, rightFaceDetected: false,
  roundScores: [], winner: null,
  speedTier: 0, comboColors: COMBO_COLOR_SETS[0],

  setPhase: (phase) => set({ phase }),

  setSettings: (s) => set((state) => ({
    settings: { ...state.settings, ...s }
  })),

  setSettingsOpen: (v) => set({ settingsOpen: v }),

  startGame: (mode = 'local') => {
    const s = get().settings
    set({
      phase: 'playing',
      leftScore: 0, rightScore: 0,
      round: 1, timeLeft: s.roundDuration,
      hitCount: 0, combo: 0, maxCombo: 0,
      roundScores: [], winner: null, finalSeconds: false,
      particles: [], scorePopups: [], lastHitPlayer: null,
      speedTier: 0, comboColors: COMBO_COLOR_SETS[0],
      online: { ...get().online, mode },
      ...makeBallState(s),
    })
  },

  resetGame: () => set((state) => ({
    phase: 'menu',
    leftScore: 0, rightScore: 0,
    round: 1, timeLeft: state.settings.roundDuration,
    hitCount: 0, combo: 0, maxCombo: 0,
    particles: [], scorePopups: [], roundScores: [], winner: null,
    finalSeconds: false, lastHitPlayer: null,
    speedTier: 0, comboColors: COMBO_COLOR_SETS[0],
    ...makeBallState(state.settings),
  })),

  resetBall: () => set((state) => ({
    ...makeBallState(state.settings, state.hitCount),
    combo: 0,
  })),

  updateBall: (x, y, vx, vy) => set({ ballX: x, ballY: y, ballVX: vx, ballVY: vy }),
  updatePaddles: (leftY, rightY) => set({ leftPaddleY: leftY, rightPaddleY: rightY }),
  setLeftPaddleTarget: (y) => set({ leftPaddleTarget: y }),
  setRightPaddleTarget: (y) => set({ rightPaddleTarget: y }),

  updateParticles: () => set((state) => ({
    particles: state.particles
      .map(p => ({
        ...p,
        x: p.x + p.vx, y: p.y + p.vy,
        vx: p.vx * 0.93, vy: p.vy * 0.93 - 0.00015,
        life: p.life - 1,
      }))
      .filter(p => p.life > 0)
  })),

  addScorePopup: (player) => set((state) => ({
    scorePopups: [...state.scorePopups, {
      id: Date.now() + Math.random(), player, timestamp: Date.now()
    }].slice(-5)
  })),

  incrementScore: (player) => set((state) => ({
    leftScore: player === 'left' ? state.leftScore + 1 : state.leftScore,
    rightScore: player === 'right' ? state.rightScore + 1 : state.rightScore,
    combo: 0, lastHitPlayer: null,
  })),

  // Returns new particles so canvas can use them without extra store read
  onPaddleHit: (player, x, y) => {
    const state = get()
    const newHitCount = state.hitCount + 1
    const newCombo = state.combo + 1
    const maxCombo = Math.max(state.maxCombo, newCombo)

    let speedTier = 0
    const thresholds = [5, 10, 15].map(t => Math.round(t / state.settings.speedIntensity))
    if (newHitCount >= thresholds[2]) speedTier = 3
    else if (newHitCount >= thresholds[1]) speedTier = 2
    else if (newHitCount >= thresholds[0]) speedTier = 1

    const colorIndex = newHitCount % COMBO_COLOR_SETS.length
    const colors = COMBO_COLOR_SETS[colorIndex]

    // Particles (only if enabled)
    let newParticles: ParticleData[] = []
    if (state.settings.particles) {
      const count = Math.min(15 + newCombo * 4, 60)
      newParticles = Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3
        const spd = 0.006 + Math.random() * 0.022
        return {
          id: Date.now() + i + Math.random(),
          x, y,
          vx: Math.cos(angle) * spd * (player === 'left' ? 1 : -1),
          vy: Math.sin(angle) * spd,
          color: colors[Math.floor(Math.random() * colors.length)],
          life: 35 + Math.random() * 30, maxLife: 65,
          size: 1.5 + Math.random() * 4,
        }
      })
    }

    set({
      hitCount: newHitCount, combo: newCombo, maxCombo,
      speedTier, lastHitPlayer: player,
      comboColors: colors,
      particles: [...state.particles, ...newParticles].slice(-300),
    })

    return newParticles
  },

  updateTimer: (delta) => set((state) => {
    if (state.phase !== 'playing') return {}
    const newTime = Math.max(0, state.timeLeft - delta)
    return { timeLeft: newTime, finalSeconds: newTime <= 10 }
  }),

  endRound: () => set((state) => {
    const newRoundScores = [...state.roundScores, { left: state.leftScore, right: state.rightScore }]
    if (state.round >= state.settings.maxRounds) {
      const tl = newRoundScores.reduce((a, b) => a + b.left, 0)
      const tr = newRoundScores.reduce((a, b) => a + b.right, 0)
      return { phase: 'gameOver', roundScores: newRoundScores, winner: tl > tr ? 'left' : tr > tl ? 'right' : 'tie' }
    }
    return {
      phase: 'roundEnd', roundScores: newRoundScores, round: state.round + 1,
    }
  }),

  setFaceDetected: (player, detected) =>
    player === 'left' ? set({ leftFaceDetected: detected }) : set({ rightFaceDetected: detected }),

  setOnline: (o) => set((state) => ({ online: { ...state.online, ...o } })),
}))
