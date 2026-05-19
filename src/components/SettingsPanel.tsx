import { useState } from 'react'
import { useGameStore, defaultSettings, GameSettings } from '../store/gameStore'

const PANEL_BG = 'rgba(5,5,20,0.97)'
const BORDER = 'rgba(80,120,255,0.25)'
const ACCENT = '#4488ff'

// ── Reusable slider ──────────────────────────────────────────────────────────
function Slider({
  label, value, min, max, step, display, onChange, hint,
}: {
  label: string; value: number; min: number; max: number; step: number
  display?: (v: number) => string; onChange: (v: number) => void; hint?: string
}) {
  const pct = ((value - min) / (max - min)) * 100
  const txt = display ? display(value) : String(value)
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, color: 'rgba(200,220,255,0.85)', textTransform:'uppercase' }}>
          {label}
        </span>
        <span style={{ fontSize: 13, fontWeight: 800, color: ACCENT, minWidth: 44, textAlign:'right' }}>{txt}</span>
      </div>
      <div style={{ position:'relative', height: 6, background:'rgba(80,120,255,0.15)', borderRadius: 3 }}>
        <div style={{ position:'absolute', left:0, top:0, height:'100%', width:`${pct}%`, background:`linear-gradient(90deg, #2255cc, ${ACCENT})`, borderRadius:3, transition:'width 0.05s' }} />
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          style={{
            position:'absolute', inset: '-6px 0', width:'100%', height: 18,
            opacity: 0, cursor:'pointer', margin: 0,
          }}
        />
        <div style={{
          position:'absolute', top:'50%', left:`calc(${pct}% - 8px)`, transform:'translateY(-50%)',
          width: 16, height: 16, borderRadius:'50%',
          background: ACCENT, border:'2px solid #fff',
          boxShadow:`0 0 8px ${ACCENT}`,
          pointerEvents:'none', transition:'left 0.05s',
        }} />
      </div>
      {hint && <div style={{ fontSize:10, color:'rgba(120,150,200,0.5)', marginTop:5, letterSpacing:0.5 }}>{hint}</div>}
    </div>
  )
}

// ── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({ label, value, onChange }: { label:string; value:boolean; onChange:(v:boolean)=>void }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
      <span style={{ fontSize:12, fontWeight:700, letterSpacing:1.5, color:'rgba(200,220,255,0.85)', textTransform:'uppercase' }}>{label}</span>
      <button onClick={() => onChange(!value)} style={{
        width: 44, height: 24, borderRadius: 12, border:'none', cursor:'pointer',
        background: value ? ACCENT : 'rgba(255,255,255,0.12)',
        position:'relative', transition:'background 0.2s',
        boxShadow: value ? `0 0 12px ${ACCENT}88` : 'none',
      }}>
        <div style={{
          position:'absolute', top:3, left: value ? 23 : 3, width:18, height:18,
          borderRadius:'50%', background:'#fff', transition:'left 0.18s',
          boxShadow:'0 1px 4px rgba(0,0,0,0.4)',
        }} />
      </button>
    </div>
  )
}

// ── Segmented control ────────────────────────────────────────────────────────
function Segmented<T extends number | string>({
  label, value, options, labels, onChange
}: {
  label: string; value: T; options: T[]; labels?: string[]; onChange:(v:T)=>void
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize:12, fontWeight:700, letterSpacing:1.5, color:'rgba(200,220,255,0.85)', textTransform:'uppercase', marginBottom:8 }}>
        {label}
      </div>
      <div style={{ display:'flex', gap: 4 }}>
        {options.map((opt, i) => (
          <button key={String(opt)} onClick={() => onChange(opt)} style={{
            flex:1, padding:'7px 4px', borderRadius:6, border:`1px solid ${value===opt ? ACCENT : 'rgba(80,120,255,0.2)'}`,
            background: value===opt ? `${ACCENT}22` : 'transparent',
            color: value===opt ? '#fff' : 'rgba(150,180,255,0.6)',
            fontSize:12, fontWeight:700, cursor:'pointer',
            boxShadow: value===opt ? `0 0 10px ${ACCENT}44` : 'none',
            transition:'all 0.15s', fontFamily:'inherit', letterSpacing:0.5,
          }}>
            {labels?.[i] ?? String(opt)}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Section header ───────────────────────────────────────────────────────────
function Section({ title, icon }: { title:string; icon:string }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:8, marginBottom:16, marginTop:8,
      paddingBottom:8, borderBottom:`1px solid ${BORDER}`,
    }}>
      <span style={{ fontSize:16 }}>{icon}</span>
      <span style={{ fontSize:11, fontWeight:800, letterSpacing:3, color:'rgba(100,150,255,0.7)', textTransform:'uppercase' }}>{title}</span>
    </div>
  )
}

export function SettingsPanel() {
  const open = useGameStore(s => s.settingsOpen)
  const settings = useGameStore(s => s.settings)
  const setSettings = useGameStore(s => s.setSettings)
  const setSettingsOpen = useGameStore(s => s.setSettingsOpen)
  const phase = useGameStore(s => s.phase)
  const [hoverClose, setHoverClose] = useState(false)

  if (!open) return null

  const s = settings
  const set = (k: keyof GameSettings) => (v: any) => setSettings({ [k]: v })

  return (
    <div style={{
      position:'fixed', inset:0, zIndex: 100,
      display:'flex', alignItems:'center', justifyContent:'center',
      background:'rgba(0,0,10,0.7)',
      backdropFilter:'blur(6px)',
      animation:'fadeIn 0.2s ease-out',
    }}>
      <div style={{
        background: PANEL_BG,
        border:`1px solid ${BORDER}`,
        borderRadius:16,
        width: 'min(520px, 95vw)',
        maxHeight:'88vh',
        overflowY:'auto',
        padding: '28px 28px',
        boxShadow:`0 0 60px rgba(40,80,255,0.2), 0 0 0 1px ${BORDER}`,
        animation:'slideUp 0.25s ease-out',
        scrollbarWidth:'thin',
        scrollbarColor:`${ACCENT}44 transparent`,
      }}>
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
          <div>
            <div style={{ fontSize:18, fontWeight:900, color:'#fff', letterSpacing:2 }}>⚙️ SETTINGS</div>
            <div style={{ fontSize:10, color:'rgba(100,150,255,0.5)', letterSpacing:2, marginTop:3 }}>
              {phase === 'playing' ? 'CHANGES APPLY IMMEDIATELY' : 'CONFIGURE YOUR GAME'}
            </div>
          </div>
          <button
            onClick={() => setSettingsOpen(false)}
            onMouseEnter={() => setHoverClose(true)}
            onMouseLeave={() => setHoverClose(false)}
            style={{
              width:32, height:32, borderRadius:'50%', border:'none',
              background: hoverClose ? 'rgba(255,60,60,0.3)' : 'rgba(255,255,255,0.08)',
              color:'#fff', fontSize:16, cursor:'pointer', transition:'all 0.15s',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>✕</button>
        </div>

        {/* ── Face Tracking ── */}
        <Section title="Face Tracking" icon="👁️" />

        <Slider
          label="Sensitivity"
          value={s.sensitivity}
          min={0.4} max={2.5} step={0.05}
          display={v => `${v.toFixed(2)}×`}
          onChange={set('sensitivity')}
          hint="How much your head movement maps to paddle movement. Increase if paddle doesn't travel far enough."
        />
        <Slider
          label="Smoothing"
          value={s.smoothing}
          min={1} max={12} step={1}
          display={v => v === 1 ? 'None' : v <= 3 ? 'Low' : v <= 6 ? 'Medium' : v <= 9 ? 'High' : 'Max'}
          onChange={set('smoothing')}
          hint="Lower = more responsive but jittery. Higher = silky smooth but slight lag. Recommended: 4–6."
        />
        <Slider
          label="Deadzone"
          value={s.deadzone}
          min={0} max={0.04} step={0.002}
          display={v => v === 0 ? 'Off' : `${(v*100).toFixed(1)}%`}
          onChange={set('deadzone')}
          hint="Filters out tiny head tremors. Increase if paddle shakes when you hold still."
        />

        {/* ── Gameplay ── */}
        <Section title="Gameplay" icon="🎮" />

        <Slider
          label="Paddle Size"
          value={s.paddleSize}
          min={0.5} max={2.0} step={0.1}
          display={v => `${Math.round(v*100)}%`}
          onChange={set('paddleSize')}
          hint="Bigger paddle = easier to hit, smaller = more challenging."
        />
        <Slider
          label="Speed Intensity"
          value={s.speedIntensity}
          min={0.4} max={2.5} step={0.1}
          display={v => v < 0.8 ? 'Easy' : v < 1.2 ? 'Normal' : v < 1.8 ? 'Hard' : 'Insane'}
          onChange={set('speedIntensity')}
          hint="How fast the ball accelerates after each hit."
        />
        <Segmented
          label="Round Duration"
          value={s.roundDuration}
          options={[30, 60, 90, 120]}
          labels={['30s', '60s', '90s', '2min']}
          onChange={set('roundDuration')}
        />
        <Segmented
          label="Rounds"
          value={s.maxRounds}
          options={[1, 3, 5]}
          labels={['1', '3', '5']}
          onChange={set('maxRounds')}
        />

        {/* ── Visual ── */}
        <Section title="Visual Effects" icon="✨" />
        <Toggle label="Particles" value={s.particles} onChange={set('particles')} />
        <Toggle label="Screen Shake" value={s.screenShake} onChange={set('screenShake')} />

        {/* ── Reset ── */}
        <div style={{ marginTop:8, paddingTop:16, borderTop:`1px solid ${BORDER}` }}>
          <button
            onClick={() => setSettings({ ...defaultSettings })}
            style={{
              width:'100%', padding:'10px 0',
              background:'rgba(255,80,80,0.08)',
              border:'1px solid rgba(255,80,80,0.25)',
              borderRadius:8, color:'rgba(255,120,120,0.8)',
              fontSize:12, fontWeight:700, letterSpacing:2,
              cursor:'pointer', transition:'all 0.15s', fontFamily:'inherit',
              textTransform:'uppercase',
            }}
            onMouseEnter={e => (e.currentTarget.style.background='rgba(255,80,80,0.18)')}
            onMouseLeave={e => (e.currentTarget.style.background='rgba(255,80,80,0.08)')}
          >
            ↺ Reset to Defaults
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes slideUp { from { transform:translateY(20px); opacity:0 } to { transform:translateY(0); opacity:1 } }
      `}</style>
    </div>
  )
}
