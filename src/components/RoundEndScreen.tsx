import { useEffect, useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { audioEngine } from '../audio/AudioEngine'

export function RoundEndScreen() {
  const phase = useGameStore(s => s.phase)
  const round = useGameStore(s => s.round)
  const roundScores = useGameStore(s => s.roundScores)
  const setPhase = useGameStore(s => s.setPhase)
  const maxRounds = useGameStore(s => s.maxRounds)
  const [countdown, setCountdown] = useState(3)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (phase !== 'roundEnd') { setVisible(false); return }
    setCountdown(3)
    setVisible(true)
    audioEngine.playScore()

    const interval = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(interval)
          // Start next round
          const { resetBall, updateBall, updatePaddles } = useGameStore.getState()
          useGameStore.setState({
            phase: 'playing',
            leftScore: 0,
            rightScore: 0,
            timeLeft: 60,
            hitCount: 0,
            combo: 0,
            speedTier: 0,
            finalSeconds: false,
            particles: [],
            hitEffects: [],
            scorePopups: [],
          })
          resetBall()
          audioEngine.playRoundStart()
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [phase])

  if (phase !== 'roundEnd' || !visible) return null

  const lastRound = roundScores[roundScores.length - 1]
  const roundWinner = lastRound
    ? lastRound.left > lastRound.right
      ? 'left'
      : lastRound.right > lastRound.left
      ? 'right'
      : 'tie'
    : null

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0,0,15,0.85)',
      zIndex: 30,
      animation: 'fadeIn 0.4s ease-out',
    }}>
      {/* Round over */}
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 6,
        color: 'rgba(100,150,255,0.7)',
        marginBottom: 12,
        textTransform: 'uppercase',
      }}>
        ROUND {round - 1} COMPLETE
      </div>

      {/* Round result */}
      {roundWinner && (
        <div style={{
          fontSize: 48,
          fontWeight: 900,
          color: roundWinner === 'left' ? '#ff4422' : roundWinner === 'right' ? '#2244ff' : '#ffaa00',
          textShadow: roundWinner === 'left'
            ? '0 0 40px #ff4422'
            : roundWinner === 'right'
            ? '0 0 40px #2244ff'
            : '0 0 40px #ffaa00',
          marginBottom: 24,
          animation: 'popIn 0.4s ease-out',
          letterSpacing: 2,
        }}>
          {roundWinner === 'tie' ? '🤝 TIE ROUND!' : `${roundWinner === 'left' ? '🔴 P1' : '🔵 P2'} WINS ROUND!`}
        </div>
      )}

      {/* Round scores */}
      {lastRound && (
        <div style={{
          display: 'flex',
          gap: 40,
          marginBottom: 32,
          alignItems: 'center',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 64, fontWeight: 900, color: '#ff4422', textShadow: '0 0 20px #ff4422' }}>
              {lastRound.left}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,100,80,0.7)', letterSpacing: 3 }}>P1</div>
          </div>
          <div style={{ fontSize: 32, color: 'rgba(150,180,255,0.4)', fontWeight: 700 }}>vs</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 64, fontWeight: 900, color: '#2244ff', textShadow: '0 0 20px #2244ff' }}>
              {lastRound.right}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(80,120,255,0.7)', letterSpacing: 3 }}>P2</div>
          </div>
        </div>
      )}

      {/* Overall scores */}
      {roundScores.length > 1 && (
        <div style={{
          fontSize: 12,
          color: 'rgba(150,180,255,0.6)',
          marginBottom: 24,
          letterSpacing: 2,
        }}>
          TOTAL — P1: {roundScores.reduce((a, b) => a + b.left, 0)} | P2: {roundScores.reduce((a, b) => a + b.right, 0)}
        </div>
      )}

      {/* Next round countdown */}
      <div style={{
        fontSize: 14,
        color: 'rgba(150,180,255,0.7)',
        letterSpacing: 4,
        textTransform: 'uppercase',
      }}>
        Round {round} starts in...
      </div>
      <div style={{
        fontSize: 72,
        fontWeight: 900,
        color: '#ffffff',
        textShadow: '0 0 30px #4488ff',
        animation: 'pulse 0.5s ease-out',
        marginTop: 8,
      }}>
        {countdown}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes popIn {
          0% { transform: scale(0.5); opacity: 0; }
          60% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes pulse {
          0% { transform: scale(1.5); opacity: 0.5; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

export function GameOverScreen() {
  const phase = useGameStore(s => s.phase)
  const winner = useGameStore(s => s.winner)
  const roundScores = useGameStore(s => s.roundScores)
  const resetGame = useGameStore(s => s.resetGame)
  const maxCombo = useGameStore(s => s.maxCombo)
  const hitCount = useGameStore(s => s.hitCount)

  const [visible, setVisible] = useState(false)
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    if (phase === 'gameOver') {
      setTimeout(() => setVisible(true), 300)
      audioEngine.playRoundStart()
    } else {
      setVisible(false)
    }
  }, [phase])

  if (phase !== 'gameOver' || !visible) return null

  const totalLeft = roundScores.reduce((a, b) => a + b.left, 0)
  const totalRight = roundScores.reduce((a, b) => a + b.right, 0)

  const winnerColor = winner === 'left' ? '#ff4422' : winner === 'right' ? '#2244ff' : '#ffaa00'
  const winnerLabel = winner === 'left' ? 'PLAYER 1' : winner === 'right' ? 'PLAYER 2' : 'TIE GAME'
  const winnerEmoji = winner === 'left' ? '🔴' : winner === 'right' ? '🔵' : '🤝'

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(ellipse at center, rgba(5,5,20,0.92) 0%, rgba(0,0,5,0.97) 100%)',
      zIndex: 30,
      animation: 'fadeIn 0.5s ease-out',
    }}>
      {/* Confetti-like particles */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} style={{
            position: 'absolute',
            left: `${5 + i * 5}%`,
            top: '-20px',
            width: 8,
            height: 8,
            borderRadius: Math.random() > 0.5 ? '50%' : '0',
            background: i % 3 === 0 ? winnerColor : i % 2 === 0 ? '#ffffff' : '#ffaa00',
            animation: `confettiFall ${2 + Math.random() * 3}s linear ${Math.random() * 2}s infinite`,
            opacity: 0.7,
          }} />
        ))}
      </div>

      {/* GAME OVER label */}
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 10,
        color: 'rgba(100,150,255,0.6)',
        marginBottom: 16,
        textTransform: 'uppercase',
        animation: 'fadeInUp 0.5s ease-out',
      }}>
        GAME OVER
      </div>

      {/* Winner */}
      <div style={{
        fontSize: 22,
        fontWeight: 900,
        letterSpacing: 4,
        color: winnerColor,
        textShadow: `0 0 40px ${winnerColor}, 0 0 80px ${winnerColor}60`,
        marginBottom: 8,
        textTransform: 'uppercase',
        animation: 'popIn 0.6s ease-out',
      }}>
        {winnerEmoji} {winnerLabel} {winner !== 'tie' ? 'WINS!' : ''}
      </div>

      {/* Score breakdown */}
      <div style={{
        display: 'flex',
        gap: 60,
        margin: '24px 0',
        alignItems: 'center',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 80, fontWeight: 900, color: '#ff4422', textShadow: '0 0 30px #ff4422', lineHeight: 1 }}>
            {totalLeft}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,100,80,0.6)', letterSpacing: 3, marginTop: 4 }}>PLAYER 1</div>
        </div>
        <div style={{ fontSize: 28, color: 'rgba(150,180,255,0.3)', fontWeight: 700 }}>vs</div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 80, fontWeight: 900, color: '#2244ff', textShadow: '0 0 30px #2244ff', lineHeight: 1 }}>
            {totalRight}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(80,120,255,0.6)', letterSpacing: 3, marginTop: 4 }}>PLAYER 2</div>
        </div>
      </div>

      {/* Round details */}
      <div style={{
        display: 'flex',
        gap: 12,
        marginBottom: 24,
      }}>
        {roundScores.map((rs, i) => (
          <div key={i} style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            padding: '8px 16px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 10, color: 'rgba(150,180,255,0.5)', letterSpacing: 2, marginBottom: 4 }}>
              R{i + 1}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#ffffff' }}>
              <span style={{ color: '#ff4422' }}>{rs.left}</span>
              <span style={{ color: 'rgba(255,255,255,0.3)', margin: '0 6px' }}>–</span>
              <span style={{ color: '#2244ff' }}>{rs.right}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div style={{
        display: 'flex',
        gap: 20,
        marginBottom: 32,
        fontSize: 11,
        color: 'rgba(150,180,255,0.5)',
        letterSpacing: 2,
      }}>
        <span>🎯 {hitCount} TOTAL HITS</span>
        <span>⚡ {maxCombo}x MAX COMBO</span>
      </div>

      {/* Play Again Button */}
      <button
        onClick={() => { resetGame(); audioEngine.init(); audioEngine.resume() }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          background: hovered
            ? 'linear-gradient(135deg, rgba(68,136,255,0.3), rgba(68,136,255,0.5))'
            : 'linear-gradient(135deg, rgba(68,136,255,0.1), rgba(68,136,255,0.2))',
          border: `2px solid ${hovered ? '#4488ff' : '#4488ff88'}`,
          borderRadius: 8,
          color: '#ffffff',
          fontSize: 16,
          fontWeight: 700,
          letterSpacing: 4,
          textTransform: 'uppercase',
          padding: '14px 48px',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: hovered
            ? '0 0 30px #4488ff88, 0 0 60px #4488ff44'
            : '0 0 15px #4488ff44',
          transform: hovered ? 'scale(1.05)' : 'scale(1)',
          fontFamily: 'inherit',
        }}
      >
        🔄 Play Again
      </button>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeInUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes popIn {
          0% { transform: scale(0.3); opacity: 0; }
          60% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes confettiFall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 0.8; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
