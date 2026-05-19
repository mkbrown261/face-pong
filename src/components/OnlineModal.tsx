import { useState, useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'
import { webRTC, NetMsg } from '../net/WebRTCManager'
import { audioEngine } from '../audio/AudioEngine'

type ModalState = 'choose' | 'hosting' | 'joining' | 'connected' | 'error'

const ACCENT = '#4488ff'

function NeonBtn({
  onClick, children, color = ACCENT, disabled = false, small = false
}: {
  onClick: () => void; children: React.ReactNode
  color?: string; disabled?: boolean; small?: boolean
}) {
  const [h, setH] = useState(false)
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        background: h ? `${color}28` : `${color}12`,
        border: `1.5px solid ${h ? color : color+'66'}`,
        borderRadius: 8, color: '#fff',
        fontSize: small ? 12 : 14, fontWeight: 700,
        letterSpacing: small ? 1.5 : 2, textTransform: 'uppercase',
        padding: small ? '8px 20px' : '12px 32px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s',
        boxShadow: h ? `0 0 22px ${color}66` : `0 0 10px ${color}33`,
        transform: h ? 'scale(1.04)' : 'scale(1)',
        opacity: disabled ? 0.45 : 1,
        fontFamily: 'inherit',
      }}>
      {children}
    </button>
  )
}

function RoomCodeDisplay({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }
  return (
    <div style={{ textAlign: 'center', margin: '24px 0' }}>
      <div style={{ fontSize: 10, letterSpacing: 4, color: 'rgba(120,160,255,0.6)', marginBottom: 12, textTransform: 'uppercase' }}>
        Share this room code
      </div>
      <div onClick={copy} style={{
        display: 'inline-flex', alignItems: 'center', gap: 14,
        background: 'rgba(68,136,255,0.1)',
        border: '2px solid rgba(68,136,255,0.4)',
        borderRadius: 12, padding: '14px 28px', cursor: 'pointer',
        transition: 'all 0.15s',
      }}>
        <span style={{ fontSize: 40, fontWeight: 900, letterSpacing: 10, color: '#fff', textShadow: `0 0 20px ${ACCENT}` }}>
          {code}
        </span>
        <span style={{ fontSize: 18, opacity: 0.6 }}>{copied ? '✅' : '📋'}</span>
      </div>
      <div style={{ fontSize: 11, color: 'rgba(100,140,200,0.5)', marginTop: 10 }}>
        {copied ? 'Copied!' : 'Click to copy'}
      </div>
    </div>
  )
}

function CodeInput({ onJoin }: { onJoin: (code: string) => void }) {
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const submit = () => {
    const c = code.trim().toUpperCase()
    if (c.length !== 6) { setErr('Code must be 6 characters'); return }
    setErr('')
    onJoin(c)
  }

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 10, letterSpacing: 4, color: 'rgba(120,160,255,0.6)', marginBottom: 14, textTransform: 'uppercase' }}>
        Enter Room Code
      </div>
      <input
        ref={inputRef}
        value={code}
        onChange={e => setCode(e.target.value.toUpperCase().slice(0,6))}
        onKeyDown={e => e.key === 'Enter' && submit()}
        placeholder="ABCDEF"
        maxLength={6}
        style={{
          background: 'rgba(68,136,255,0.08)',
          border: `2px solid ${err ? '#ff4444' : 'rgba(68,136,255,0.35)'}`,
          borderRadius: 10, color: '#fff', outline: 'none',
          fontSize: 36, fontWeight: 900, letterSpacing: 10,
          padding: '12px 28px', textAlign: 'center', width: '100%',
          fontFamily: 'inherit', textTransform: 'uppercase',
          transition: 'border-color 0.15s',
          boxSizing: 'border-box',
        }}
      />
      {err && <div style={{ color:'#ff6666', fontSize:11, marginTop:8 }}>{err}</div>}
      <div style={{ marginTop: 16 }}>
        <NeonBtn onClick={submit} disabled={code.length !== 6} color={ACCENT}>
          🔗 Join Game
        </NeonBtn>
      </div>
    </div>
  )
}

function LatencyBadge({ ms }: { ms: number }) {
  const color = ms < 50 ? '#00ff88' : ms < 120 ? '#ffaa00' : '#ff4444'
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: `${color}15`, border: `1px solid ${color}44`,
      borderRadius: 20, padding: '3px 10px',
      fontSize: 11, fontWeight: 700, color,
    }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}` }} />
      {ms < 999 ? `${ms}ms` : '—'}
    </div>
  )
}

export function OnlineModal({ onClose }: { onClose: () => void }) {
  const [modalState, setModalState] = useState<ModalState>('choose')
  const [roomCode, setRoomCode] = useState('')
  const [statusMsg, setStatusMsg] = useState('')
  const [latency, setLatency] = useState(999)
  const [errMsg, setErrMsg] = useState('')
  const startGame = useGameStore(s => s.startGame)
  const setOnline = useGameStore(s => s.setOnline)
  const settings = useGameStore(s => s.settings)

  useEffect(() => {
    webRTC.onStatus = (status, detail) => {
      if (status === 'connecting') setStatusMsg('Connecting...')
      if (status === 'connected') {
        setModalState('connected')
        setStatusMsg('Connected!')
        setOnline({ connected: true, peerLatency: 0 })
      }
      if (status === 'disconnected') {
        setStatusMsg('Disconnected')
        setOnline({ connected: false })
      }
      if (status === 'error') {
        setErrMsg(detail || 'Connection error')
        setModalState('error')
      }
    }
    webRTC.onLatency = (ms) => {
      const rounded = Math.round(ms)
      setLatency(rounded)
      setOnline({ peerLatency: rounded })
    }
    return () => { webRTC.onStatus = () => {}; webRTC.onLatency = () => {} }
  }, [setOnline])

  // Wire incoming messages to game store
  useEffect(() => {
    webRTC.onMessage = (msg: NetMsg) => {
      const st = useGameStore.getState()
      switch (msg.type) {
        case 'paddle':
          // Guest receives host's right-paddle update (or vice versa)
          if (webRTC.hosting) st.setRightPaddleTarget(msg.y)
          else st.setLeftPaddleTarget(msg.y)
          break
        case 'ball':
          if (!webRTC.hosting) st.updateBall(msg.x, msg.y, msg.vx, msg.vy)
          break
        case 'score':
          if (!webRTC.hosting) useGameStore.setState({ leftScore: msg.left, rightScore: msg.right })
          break
        case 'settings':
          if (!webRTC.hosting) useGameStore.getState().setSettings(msg.settings)
          break
        case 'start':
          if (!webRTC.hosting) {
            useGameStore.getState().startGame('online-guest')
            audioEngine.playRoundStart()
          }
          break
        case 'roundEnd':
          if (!webRTC.hosting) useGameStore.setState({ phase: 'roundEnd', roundScores: msg.roundScores })
          break
        case 'ready':
          // Guest is ready, host can start
          setStatusMsg('Opponent ready! Starting...')
          break
      }
    }
  }, [])

  const handleHost = async () => {
    setModalState('hosting')
    setStatusMsg('Creating room...')
    try {
      const code = await webRTC.createRoom()
      setRoomCode(code)
      setOnline({ mode: 'online-host', roomCode: code, isHost: true })
      setStatusMsg('Waiting for opponent...')
    } catch (e) {
      setErrMsg(String(e))
      setModalState('error')
    }
  }

  const handleJoin = async (code: string) => {
    setModalState('joining')
    setStatusMsg('Joining room...')
    setRoomCode(code)
    setOnline({ mode: 'online-guest', roomCode: code, isHost: false })
    try {
      await webRTC.joinRoom(code)
      webRTC.send({ type: 'ready' })
    } catch (e) {
      setErrMsg(String(e))
      setModalState('error')
    }
  }

  const handleStartOnline = () => {
    // Sync settings to guest
    webRTC.send({ type: 'settings', settings })
    webRTC.send({ type: 'start' })
    startGame('online-host')
    audioEngine.init(); audioEngine.resume(); audioEngine.playRoundStart()
    onClose()
  }

  const handleDisconnect = () => {
    webRTC.cleanup()
    setOnline({ connected: false, mode: 'local' })
    setModalState('choose')
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,10,0.82)', backdropFilter: 'blur(8px)',
      animation: 'fadeIn 0.2s ease-out',
    }}>
      <div style={{
        background: 'rgba(5,5,22,0.98)',
        border: '1px solid rgba(68,136,255,0.25)',
        borderRadius: 18, width: 'min(460px, 94vw)',
        padding: '32px 28px',
        boxShadow: '0 0 60px rgba(40,80,255,0.2)',
        animation: 'slideUp 0.25s ease-out',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 900, color: '#fff', letterSpacing: 2 }}>🌐 ONLINE PLAY</div>
            <div style={{ fontSize: 10, color: 'rgba(100,150,255,0.5)', letterSpacing: 2, marginTop: 3 }}>
              PLAY WITH SOMEONE ON ANOTHER DEVICE
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 30, height: 30, borderRadius: '50%', border: 'none',
            background: 'rgba(255,255,255,0.07)', color: '#fff',
            fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
          }}>✕</button>
        </div>

        {/* ── Choose ── */}
        {modalState === 'choose' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{
              background: 'rgba(255,80,60,0.07)', border: '1px solid rgba(255,80,60,0.2)',
              borderRadius: 12, padding: '18px 22px',
            }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#ff6644', marginBottom: 6, letterSpacing: 1 }}>
                🔴 HOST — Create a Room
              </div>
              <div style={{ fontSize: 11, color: 'rgba(200,180,170,0.6)', marginBottom: 14, lineHeight: 1.6 }}>
                You control the <b>left paddle</b> (red). Share the code with your opponent.
              </div>
              <NeonBtn onClick={handleHost} color="#ff4422">🎮 Create Room</NeonBtn>
            </div>

            <div style={{ textAlign: 'center', fontSize: 11, color: 'rgba(100,120,160,0.4)', letterSpacing: 2 }}>— OR —</div>

            <div style={{
              background: 'rgba(30,80,255,0.07)', border: '1px solid rgba(30,80,255,0.2)',
              borderRadius: 12, padding: '18px 22px',
            }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#4488ff', marginBottom: 6, letterSpacing: 1 }}>
                🔵 GUEST — Join a Room
              </div>
              <div style={{ fontSize: 11, color: 'rgba(170,185,220,0.6)', marginBottom: 14, lineHeight: 1.6 }}>
                You control the <b>right paddle</b> (blue). Enter the host's room code.
              </div>
              <CodeInput onJoin={handleJoin} />
            </div>

            <div style={{
              marginTop: 8, fontSize: 10, color: 'rgba(100,120,160,0.4)',
              textAlign: 'center', lineHeight: 1.8, letterSpacing: 0.5,
            }}>
              ⚡ Direct peer-to-peer connection — no server lag<br/>
              Each player uses their own webcam for tracking
            </div>
          </div>
        )}

        {/* ── Hosting — waiting for guest ── */}
        {modalState === 'hosting' && (
          <div>
            <RoomCodeDisplay code={roomCode || '......'} />
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 10,
                fontSize: 12, color: 'rgba(150,180,255,0.7)', letterSpacing: 1,
              }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ffaa00', animation: 'pulse 1.2s infinite', boxShadow: '0 0 8px #ffaa00' }} />
                {statusMsg}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <NeonBtn onClick={handleDisconnect} color="#ff6666" small>Cancel</NeonBtn>
            </div>
          </div>
        )}

        {/* ── Joining ── */}
        {modalState === 'joining' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 16, animation: 'spin 1s linear infinite', display: 'inline-block' }}>⚡</div>
            <div style={{ fontSize: 14, color: 'rgba(150,180,255,0.8)', letterSpacing: 2, marginBottom: 20 }}>{statusMsg}</div>
            <NeonBtn onClick={handleDisconnect} color="#ff6666" small>Cancel</NeonBtn>
          </div>
        )}

        {/* ── Connected ── */}
        {modalState === 'connected' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#00ff88', marginBottom: 8, letterSpacing: 2, textShadow: '0 0 15px #00ff88' }}>
              CONNECTED!
            </div>
            <div style={{ marginBottom: 20 }}>
              <LatencyBadge ms={latency} />
            </div>
            <div style={{ fontSize: 11, color: 'rgba(150,180,255,0.6)', marginBottom: 24, lineHeight: 1.8 }}>
              {webRTC.hosting
                ? '🔴 You are the HOST (left paddle)\nClick Start when both players are ready.'
                : '🔵 You are the GUEST (right paddle)\nWaiting for host to start the game...'}
            </div>
            {webRTC.hosting ? (
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <NeonBtn onClick={handleStartOnline} color="#00ff88">▶ Start Game</NeonBtn>
                <NeonBtn onClick={handleDisconnect} color="#ff6666" small>Disconnect</NeonBtn>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                <div style={{ fontSize: 12, color: 'rgba(150,180,255,0.5)', animation: 'blink 1.2s infinite', letterSpacing: 2 }}>
                  ⏳ Waiting for host...
                </div>
                <NeonBtn onClick={handleDisconnect} color="#ff6666" small>Disconnect</NeonBtn>
              </div>
            )}
          </div>
        )}

        {/* ── Error ── */}
        {modalState === 'error' && (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>❌</div>
            <div style={{ fontSize: 14, color: '#ff6666', marginBottom: 8, fontWeight: 700 }}>Connection Failed</div>
            <div style={{ fontSize: 11, color: 'rgba(200,150,150,0.6)', marginBottom: 24, lineHeight: 1.7 }}>
              {errMsg}<br/>
              <span style={{ opacity: 0.6 }}>Make sure both devices are online and the room code is correct.</span>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <NeonBtn onClick={() => setModalState('choose')} color={ACCENT}>Try Again</NeonBtn>
              <NeonBtn onClick={onClose} color="#666" small>Close</NeonBtn>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes slideUp { from { transform:translateY(20px); opacity:0 } to { transform:translateY(0); opacity:1 } }
        @keyframes pulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(0.7);opacity:0.5} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `}</style>
    </div>
  )
}
