/**
 * WebRTC Peer-to-Peer multiplayer for Face Pong
 *
 * Architecture:
 *  - Uses a simple HTTP-polling signaling relay hosted on Cloudflare Pages Functions
 *  - Host creates a room (random 6-char code) and polls for guest SDP answer
 *  - Guest looks up the room code, gets host's offer, sends back answer
 *  - Once ICE completes, data channel carries game state at ~60fps
 *
 * Message protocol (JSON over RTCDataChannel):
 *  { type:'paddle', y:number }         — paddle Y position update
 *  { type:'ball',   x,y,vx,vy }       — authoritative ball state (host only)
 *  { type:'score',  left,right }       — score update (host only)
 *  { type:'ping',   t:number }         — latency probe
 *  { type:'pong',   t:number }         — latency reply
 *  { type:'settings', settings:{...} } — settings sync (host→guest)
 *  { type:'start' }                    — host signals round start
 *  { type:'roundEnd', scores:{...} }   — host signals round end
 */

import { useGameStore } from '../store/gameStore'

// Public STUN servers (no cost)
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
]

// Signaling base URL — points to our Cloudflare Pages Functions
const SIG_BASE = '/api/signal'

type MsgType = 'paddle' | 'ball' | 'score' | 'ping' | 'pong' | 'settings' | 'start' | 'roundEnd' | 'ready'

export interface NetMsg {
  type: MsgType
  [key: string]: any
}

type OnMsg = (msg: NetMsg) => void
type OnStatus = (status: 'connecting' | 'connected' | 'disconnected' | 'error', detail?: string) => void

export class WebRTCManager {
  private pc: RTCPeerConnection | null = null
  private dc: RTCDataChannel | null = null
  private roomCode = ''
  private isHost = false
  private pollTimer: ReturnType<typeof setTimeout> | null = null
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private lastPingTime = 0

  onMessage: OnMsg = () => {}
  onStatus: OnStatus = () => {}
  onLatency: (ms: number) => void = () => {}

  // ── Room code helpers ────────────────────────────────────────────────────
  static genCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
  }

  get code() { return this.roomCode }
  get hosting() { return this.isHost }

  // ── Signaling helpers ────────────────────────────────────────────────────
  private async sigPost(path: string, body: object) {
    const res = await fetch(`${SIG_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`Signal error ${res.status}`)
    return res.json()
  }

  private async sigGet(path: string) {
    const res = await fetch(`${SIG_BASE}${path}`)
    if (!res.ok) throw new Error(`Signal error ${res.status}`)
    return res.json()
  }

  // ── Create PC + wiring ───────────────────────────────────────────────────
  private createPC() {
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

    this.pc.oniceconnectionstatechange = () => {
      const st = this.pc?.iceConnectionState
      if (st === 'connected' || st === 'completed') {
        this.onStatus('connected')
        this.startPing()
      }
      if (st === 'disconnected' || st === 'failed' || st === 'closed') {
        this.onStatus('disconnected')
        this.cleanup()
      }
    }
    return this.pc
  }

  private wireDataChannel(dc: RTCDataChannel) {
    this.dc = dc
    dc.binaryType = 'arraybuffer'
    dc.bufferedAmountLowThreshold = 4096

    dc.onopen  = () => { this.onStatus('connected') }
    dc.onclose = () => { this.onStatus('disconnected') }
    dc.onerror = (e) => { this.onStatus('error', String(e)) }
    dc.onmessage = (e) => {
      try {
        const msg: NetMsg = JSON.parse(e.data)
        if (msg.type === 'ping') {
          this.send({ type: 'pong', t: msg.t })
        } else if (msg.type === 'pong') {
          this.onLatency(performance.now() - msg.t)
        } else {
          this.onMessage(msg)
        }
      } catch (_) {}
    }
  }

  // ── Ping / latency ───────────────────────────────────────────────────────
  private startPing() {
    this.pingTimer = setInterval(() => {
      this.send({ type: 'ping', t: performance.now() })
    }, 2000)
  }

  // ── HOST flow ─────────────────────────────────────────────────────────────
  async createRoom(): Promise<string> {
    this.roomCode = WebRTCManager.genCode()
    this.isHost = true
    this.onStatus('connecting')

    const pc = this.createPC()

    // Host creates the data channel
    const dc = pc.createDataChannel('game', {
      ordered: false, maxRetransmits: 0,  // UDP-like for low latency
    })
    this.wireDataChannel(dc)

    // Gather ICE and create offer
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)

    // Wait for ICE gathering to complete (or timeout)
    await new Promise<void>(resolve => {
      if (pc.iceGatheringState === 'complete') { resolve(); return }
      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === 'complete') resolve()
      }
      setTimeout(resolve, 5000)
    })

    // Post offer to signaling
    await this.sigPost(`/offer/${this.roomCode}`, {
      sdp: pc.localDescription
    })

    // Poll for guest answer
    this.pollForAnswer()
    return this.roomCode
  }

  private pollForAnswer() {
    const poll = async () => {
      if (!this.pc || this.pc.signalingState === 'stable') return
      try {
        const data = await this.sigGet(`/answer/${this.roomCode}`)
        if (data?.sdp) {
          await this.pc.setRemoteDescription(new RTCSessionDescription(data.sdp))
          return  // done
        }
      } catch (_) {}
      // Try again in 1.5s
      this.pollTimer = setTimeout(poll, 1500)
    }
    poll()
  }

  // ── GUEST flow ────────────────────────────────────────────────────────────
  async joinRoom(code: string): Promise<void> {
    this.roomCode = code.toUpperCase()
    this.isHost = false
    this.onStatus('connecting')

    const pc = this.createPC()

    // Guest receives data channel
    pc.ondatachannel = (e) => { this.wireDataChannel(e.channel) }

    // Fetch host offer
    let offerData: any
    for (let i = 0; i < 10; i++) {
      try {
        offerData = await this.sigGet(`/offer/${this.roomCode}`)
        if (offerData?.sdp) break
      } catch (_) {}
      await new Promise(r => setTimeout(r, 1200))
    }
    if (!offerData?.sdp) throw new Error('Room not found or expired')

    await pc.setRemoteDescription(new RTCSessionDescription(offerData.sdp))
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    await new Promise<void>(resolve => {
      if (pc.iceGatheringState === 'complete') { resolve(); return }
      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === 'complete') resolve()
      }
      setTimeout(resolve, 5000)
    })

    await this.sigPost(`/answer/${this.roomCode}`, {
      sdp: pc.localDescription
    })
  }

  // ── Send ──────────────────────────────────────────────────────────────────
  send(msg: NetMsg) {
    if (!this.dc || this.dc.readyState !== 'open') return
    if (this.dc.bufferedAmount > 16384) return  // skip if backed up
    try { this.dc.send(JSON.stringify(msg)) } catch (_) {}
  }

  // Throttled paddle send — don't flood channel
  private lastPaddleSend = 0
  sendPaddle(y: number) {
    const now = performance.now()
    if (now - this.lastPaddleSend < 16) return  // max ~60fps
    this.lastPaddleSend = now
    this.send({ type: 'paddle', y })
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────
  cleanup() {
    if (this.pollTimer) clearTimeout(this.pollTimer)
    if (this.pingTimer) clearInterval(this.pingTimer)
    this.dc?.close()
    this.pc?.close()
    this.dc = null; this.pc = null
  }

  get isConnected() {
    return this.dc?.readyState === 'open'
  }
}

export const webRTC = new WebRTCManager()
