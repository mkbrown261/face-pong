import { useEffect, useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { audioEngine } from '../audio/AudioEngine'

export function RoundEndScreen() {
  const phase = useGameStore(s => s.phase)
  const round = useGameStore(s => s.round)
  const roundScores = useGameStore(s => s.roundScores)
  const maxRounds = useGameStore(s => s.settings.maxRounds)
  const roundDuration = useGameStore(s => s.settings.roundDuration)
  const [countdown, setCountdown] = useState(3)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (phase !== 'roundEnd') { setVisible(false); return }
    setCountdown(3); setVisible(true)
    audioEngine.playScore()

    const iv = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(iv)
          useGameStore.setState({
            phase: 'playing',
            leftScore: 0, rightScore: 0,
            timeLeft: roundDuration,
            hitCount: 0, combo: 0,
            speedTier: 0, finalSeconds: false,
            particles: [], scorePopups: [], lastHitPlayer: null,
            comboColors: ['#ff6b00','#ff0000'],
          })
          useGameStore.getState().resetBall()
          audioEngine.playRoundStart()
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(iv)
  }, [phase, roundDuration])

  if (phase !== 'roundEnd' || !visible) return null

  const last = roundScores[roundScores.length - 1]
  const rw = last ? (last.left > last.right ? 'left' : last.right > last.left ? 'right' : 'tie') : null
  const totalL = roundScores.reduce((a, b) => a + b.left, 0)
  const totalR = roundScores.reduce((a, b) => a + b.right, 0)

  return (
    <div style={{
      position:'absolute', inset:0, display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center',
      background:'rgba(0,0,15,0.86)', zIndex:30,
      animation:'fadeIn 0.35s ease-out',
    }}>
      <div style={{ fontSize:10, fontWeight:700, letterSpacing:6, color:'rgba(100,150,255,0.65)', marginBottom:12, textTransform:'uppercase' }}>
        ROUND {round - 1} COMPLETE
      </div>
      {rw && (
        <div style={{
          fontSize:40, fontWeight:900,
          color: rw==='left'?'#ff4422': rw==='right'?'#2244ff':'#ffaa00',
          textShadow: rw==='left'?'0 0 35px #ff4422': rw==='right'?'0 0 35px #2244ff':'0 0 35px #ffaa00',
          marginBottom:22, animation:'popIn 0.4s ease-out', letterSpacing:2,
        }}>
          {rw==='tie'?'🤝 TIE ROUND!': `${rw==='left'?'🔴 P1':'🔵 P2'} WINS ROUND!`}
        </div>
      )}
      {last && (
        <div style={{ display:'flex', gap:44, marginBottom:28, alignItems:'center' }}>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:60,fontWeight:900,color:'#ff4422',textShadow:'0 0 18px #ff4422',lineHeight:1}}>{last.left}</div>
            <div style={{fontSize:10,color:'rgba(255,100,80,0.6)',letterSpacing:3}}>P1</div>
          </div>
          <div style={{fontSize:26,color:'rgba(150,180,255,0.3)',fontWeight:700}}>vs</div>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:60,fontWeight:900,color:'#2244ff',textShadow:'0 0 18px #2244ff',lineHeight:1}}>{last.right}</div>
            <div style={{fontSize:10,color:'rgba(80,120,255,0.6)',letterSpacing:3}}>P2</div>
          </div>
        </div>
      )}
      {roundScores.length > 1 && (
        <div style={{ fontSize:11, color:'rgba(140,170,255,0.5)', marginBottom:22, letterSpacing:2 }}>
          SERIES — P1: {totalL} · P2: {totalR}
        </div>
      )}
      <div style={{ fontSize:13, color:'rgba(140,170,255,0.65)', letterSpacing:4, textTransform:'uppercase' }}>
        Round {round} starts in...
      </div>
      <div style={{
        fontSize:70, fontWeight:900, color:'#ffffff',
        textShadow:'0 0 28px #4488ff', animation:'timerPop 0.4s ease-out', marginTop:6,
      }}>{countdown}</div>

      <style>{`
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes popIn{0%{transform:scale(0.4);opacity:0}60%{transform:scale(1.1)}100%{transform:scale(1);opacity:1}}
        @keyframes timerPop{0%{transform:scale(1.6);opacity:0.4}100%{transform:scale(1);opacity:1}}
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
  const [h, setH] = useState(false)
  const setSettingsOpen = useGameStore(s => s.setSettingsOpen)

  useEffect(() => {
    if (phase === 'gameOver') { setTimeout(() => setVisible(true), 300); audioEngine.playRoundStart() }
    else setVisible(false)
  }, [phase])

  if (phase !== 'gameOver' || !visible) return null

  const tl = roundScores.reduce((a,b)=>a+b.left,0)
  const tr = roundScores.reduce((a,b)=>a+b.right,0)
  const wc = winner==='left'?'#ff4422':winner==='right'?'#2244ff':'#ffaa00'
  const wl = winner==='left'?'PLAYER 1':winner==='right'?'PLAYER 2':'TIE GAME'
  const we = winner==='left'?'🔴':winner==='right'?'🔵':'🤝'

  return (
    <div style={{
      position:'absolute', inset:0, display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center',
      background:'radial-gradient(ellipse at center, rgba(5,5,22,0.93) 0%, rgba(0,0,5,0.97) 100%)',
      zIndex:30, animation:'fadeIn 0.5s ease-out',
    }}>
      {/* confetti */}
      <div style={{position:'absolute',inset:0,overflow:'hidden',pointerEvents:'none'}}>
        {Array.from({length:22}).map((_,i)=>(
          <div key={i} style={{
            position:'absolute', left:`${4+i*4.5}%`, top:'-20px',
            width: 7, height: 7,
            borderRadius: i%3===0?'50%':'0',
            background: i%3===0?wc:i%2===0?'#fff':'#ffaa00',
            animation:`fall ${2+Math.random()*3}s linear ${Math.random()*2}s infinite`,
            opacity:0.75,
          }}/>
        ))}
      </div>

      <div style={{fontSize:10,fontWeight:700,letterSpacing:8,color:'rgba(100,150,255,0.55)',marginBottom:14,textTransform:'uppercase'}}>
        GAME OVER
      </div>
      <div style={{
        fontSize:34,fontWeight:900,letterSpacing:3,
        color:wc,textShadow:`0 0 36px ${wc}, 0 0 70px ${wc}55`,
        marginBottom:6,textTransform:'uppercase',animation:'popIn 0.55s ease-out',
      }}>
        {we} {wl} {winner!=='tie'?'WINS!':''}
      </div>

      <div style={{display:'flex',gap:56,margin:'22px 0',alignItems:'center'}}>
        <div style={{textAlign:'center'}}>
          <div style={{fontSize:72,fontWeight:900,color:'#ff4422',textShadow:'0 0 25px #ff4422',lineHeight:1}}>{tl}</div>
          <div style={{fontSize:11,color:'rgba(255,100,80,0.55)',letterSpacing:3,marginTop:4}}>PLAYER 1</div>
        </div>
        <div style={{fontSize:24,color:'rgba(150,180,255,0.28)',fontWeight:700}}>vs</div>
        <div style={{textAlign:'center'}}>
          <div style={{fontSize:72,fontWeight:900,color:'#2244ff',textShadow:'0 0 25px #2244ff',lineHeight:1}}>{tr}</div>
          <div style={{fontSize:11,color:'rgba(80,120,255,0.55)',letterSpacing:3,marginTop:4}}>PLAYER 2</div>
        </div>
      </div>

      {/* Round breakdown */}
      <div style={{display:'flex',gap:10,marginBottom:22}}>
        {roundScores.map((rs,i)=>(
          <div key={i} style={{
            background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.09)',
            borderRadius:8,padding:'7px 14px',textAlign:'center',
          }}>
            <div style={{fontSize:9,color:'rgba(140,170,255,0.45)',letterSpacing:2,marginBottom:3}}>R{i+1}</div>
            <div style={{fontSize:13,fontWeight:700,color:'#fff'}}>
              <span style={{color:'#ff4422'}}>{rs.left}</span>
              <span style={{color:'rgba(255,255,255,0.25)',margin:'0 5px'}}>–</span>
              <span style={{color:'#2244ff'}}>{rs.right}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{display:'flex',gap:18,marginBottom:28,fontSize:11,color:'rgba(140,170,255,0.45)',letterSpacing:1.5}}>
        <span>🎯 {hitCount} HITS</span>
        <span>⚡ {maxCombo}× MAX COMBO</span>
      </div>

      <div style={{display:'flex',gap:14,flexWrap:'wrap',justifyContent:'center'}}>
        <button onClick={()=>{resetGame();audioEngine.init();audioEngine.resume()}}
          onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
          style={{
            background:h?'rgba(68,136,255,0.25)':'rgba(68,136,255,0.1)',
            border:`2px solid ${h?'#4488ff':'#4488ff88'}`,
            borderRadius:8,color:'#fff',fontSize:14,fontWeight:700,
            letterSpacing:3,textTransform:'uppercase',padding:'12px 40px',
            cursor:'pointer',transition:'all 0.18s',
            boxShadow:h?'0 0 28px #4488ff88':'0 0 12px #4488ff44',
            transform:h?'scale(1.05)':'scale(1)',fontFamily:'inherit',
          }}>🔄 Play Again</button>
        <button onClick={()=>setSettingsOpen(true)}
          style={{
            background:'rgba(255,255,255,0.05)',border:'1.5px solid rgba(255,255,255,0.12)',
            borderRadius:8,color:'rgba(200,220,255,0.7)',fontSize:13,fontWeight:700,
            letterSpacing:2,textTransform:'uppercase',padding:'12px 24px',
            cursor:'pointer',fontFamily:'inherit',
          }}>⚙️ Settings</button>
      </div>

      <style>{`
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes popIn{0%{transform:scale(0.3);opacity:0}60%{transform:scale(1.1)}100%{transform:scale(1);opacity:1}}
        @keyframes fall{0%{transform:translateY(-20px) rotate(0deg);opacity:0.8}100%{transform:translateY(110vh) rotate(720deg);opacity:0}}
      `}</style>
    </div>
  )
}
