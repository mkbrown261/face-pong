// Web Audio API Engine for Face Pong

class AudioEngine {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private ambientOsc: OscillatorNode | null = null
  private ambientGain: GainNode | null = null
  private initialized = false

  init() {
    if (this.initialized) return
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      this.masterGain = this.ctx.createGain()
      this.masterGain.gain.value = 0.7
      this.masterGain.connect(this.ctx.destination)
      this.startAmbient()
      this.initialized = true
    } catch (e) {
      console.warn('Audio not available:', e)
    }
  }

  resume() {
    if (this.ctx?.state === 'suspended') {
      this.ctx.resume()
    }
  }

  private startAmbient() {
    if (!this.ctx || !this.masterGain) return
    
    // Subtle drone
    this.ambientGain = this.ctx.createGain()
    this.ambientGain.gain.value = 0.03
    this.ambientGain.connect(this.masterGain)

    this.ambientOsc = this.ctx.createOscillator()
    this.ambientOsc.type = 'sine'
    this.ambientOsc.frequency.value = 60
    this.ambientOsc.connect(this.ambientGain)
    this.ambientOsc.start()

    // Second harmonic
    const osc2 = this.ctx.createOscillator()
    osc2.type = 'sine'
    osc2.frequency.value = 90
    const g2 = this.ctx.createGain()
    g2.gain.value = 0.015
    osc2.connect(g2)
    g2.connect(this.masterGain)
    osc2.start()
  }

  playHit(combo: number, speedTier: number) {
    if (!this.ctx || !this.masterGain) return
    this.resume()

    const now = this.ctx.currentTime
    const baseFreq = 200 + combo * 40 + speedTier * 80
    
    // Synth hit
    const osc = this.ctx.createOscillator()
    const gainNode = this.ctx.createGain()
    const filter = this.ctx.createBiquadFilter()
    
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(baseFreq * 2, now)
    osc.frequency.exponentialRampToValueAtTime(baseFreq, now + 0.05)
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.5, now + 0.15)
    
    filter.type = 'bandpass'
    filter.frequency.value = baseFreq * 3
    filter.Q.value = 5
    
    gainNode.gain.setValueAtTime(0, now)
    gainNode.gain.linearRampToValueAtTime(0.4 + speedTier * 0.1, now + 0.005)
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.2)
    
    osc.connect(filter)
    filter.connect(gainNode)
    gainNode.connect(this.masterGain)
    
    osc.start(now)
    osc.stop(now + 0.25)

    // Sub bass hit
    const sub = this.ctx.createOscillator()
    const subGain = this.ctx.createGain()
    sub.type = 'sine'
    sub.frequency.value = 80 + speedTier * 20
    subGain.gain.setValueAtTime(0, now)
    subGain.gain.linearRampToValueAtTime(0.5, now + 0.01)
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1)
    sub.connect(subGain)
    subGain.connect(this.masterGain)
    sub.start(now)
    sub.stop(now + 0.15)

    // Noise burst
    const bufSize = this.ctx.sampleRate * 0.08
    const buffer = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1
    
    const noise = this.ctx.createBufferSource()
    const noiseFilter = this.ctx.createBiquadFilter()
    const noiseGain = this.ctx.createGain()
    
    noise.buffer = buffer
    noiseFilter.type = 'highpass'
    noiseFilter.frequency.value = 2000
    noiseGain.gain.setValueAtTime(0.15, now)
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08)
    
    noise.connect(noiseFilter)
    noiseFilter.connect(noiseGain)
    noiseGain.connect(this.masterGain)
    noise.start(now)
  }

  playScore() {
    if (!this.ctx || !this.masterGain) return
    this.resume()

    const now = this.ctx.currentTime
    const notes = [523, 659, 784, 1047]
    
    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator()
      const gain = this.ctx!.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, now + i * 0.08)
      gain.gain.linearRampToValueAtTime(0.3, now + i * 0.08 + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.3)
      osc.connect(gain)
      gain.connect(this.masterGain!)
      osc.start(now + i * 0.08)
      osc.stop(now + i * 0.08 + 0.35)
    })
  }

  playWhoosh() {
    if (!this.ctx || !this.masterGain) return
    this.resume()

    const now = this.ctx.currentTime
    const bufSize = this.ctx.sampleRate * 0.3
    const buffer = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1
    
    const noise = this.ctx.createBufferSource()
    const filter = this.ctx.createBiquadFilter()
    const gain = this.ctx.createGain()
    
    noise.buffer = buffer
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(8000, now)
    filter.frequency.exponentialRampToValueAtTime(400, now + 0.3)
    filter.Q.value = 3
    
    gain.gain.setValueAtTime(0.1, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3)
    
    noise.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain)
    noise.start(now)
  }

  playRoundStart() {
    if (!this.ctx || !this.masterGain) return
    this.resume()

    const now = this.ctx.currentTime
    const freqs = [261, 329, 392, 523, 784]
    
    freqs.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator()
      const gain = this.ctx!.createGain()
      osc.type = i < 3 ? 'square' : 'sawtooth'
      osc.frequency.value = freq
      const t = now + i * 0.12
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.25, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4)
      osc.connect(gain)
      gain.connect(this.masterGain!)
      osc.start(t)
      osc.stop(t + 0.45)
    })
  }

  playFinalSeconds() {
    if (!this.ctx || !this.masterGain) return
    this.resume()

    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'square'
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.08, now + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15)
    osc.connect(gain)
    gain.connect(this.masterGain)
    osc.start(now)
    osc.stop(now + 0.2)
  }

  setAmbientIntensity(intensity: number) {
    if (!this.ambientGain) return
    const val = 0.03 + intensity * 0.05
    this.ambientGain.gain.setTargetAtTime(val, this.ctx!.currentTime, 0.3)
  }
}

export const audioEngine = new AudioEngine()
