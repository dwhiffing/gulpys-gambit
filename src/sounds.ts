export const eatSound = (
  ac: AudioContext,
  startFreq: number,
  endFreq: number,
  dur: number,
  vol: number,
) => {
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  const now = ac.currentTime
  osc.type = 'sine'
  osc.frequency.setValueAtTime(startFreq, now)
  osc.frequency.exponentialRampToValueAtTime(endFreq, now + dur)
  osc.connect(gain)
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(vol, now + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur)
  gain.gain.setValueAtTime(0, now + dur + 0.002)
  osc.start(now)
  osc.stop(now + dur + 0.003)
  gain.connect(ac.destination)
}

// Noise + sine sweep shared by turn and flip sounds
const swimSweep = (
  ac: AudioContext,
  dur: number,
  hpStart: number,
  hpEnd: number,
  hpQ: number,
  bpStart: number,
  bpEnd: number,
  bpQ: number,
  noiseVol: number,
  attack: number,
  oscStart: number,
  oscEnd: number,
  oscVol: number,
  oscAttack: number,
) => {
  const now = ac.currentTime
  const bufferSize = Math.ceil(ac.sampleRate * dur)
  const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1

  const source = ac.createBufferSource()
  source.buffer = buffer

  const hipass = ac.createBiquadFilter()
  hipass.type = 'highpass'
  hipass.frequency.setValueAtTime(hpStart, now)
  hipass.frequency.exponentialRampToValueAtTime(hpEnd, now + dur)
  hipass.Q.value = hpQ

  const bandpass = ac.createBiquadFilter()
  bandpass.type = 'bandpass'
  bandpass.frequency.setValueAtTime(bpStart, now)
  bandpass.frequency.exponentialRampToValueAtTime(bpEnd, now + dur)
  bandpass.Q.value = bpQ

  const noiseGain = ac.createGain()
  noiseGain.gain.setValueAtTime(0, now)
  noiseGain.gain.linearRampToValueAtTime(noiseVol, now + attack)
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + dur)

  source.connect(hipass)
  hipass.connect(bandpass)
  bandpass.connect(noiseGain)
  noiseGain.connect(ac.destination)
  source.start(now)

  const osc = ac.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(oscStart, now)
  osc.frequency.exponentialRampToValueAtTime(oscEnd, now + dur)

  const oscGain = ac.createGain()
  oscGain.gain.setValueAtTime(0, now)
  oscGain.gain.linearRampToValueAtTime(oscVol, now + oscAttack)
  oscGain.gain.exponentialRampToValueAtTime(0.0001, now + dur)

  osc.connect(oscGain)
  oscGain.connect(ac.destination)
  osc.start(now)
  osc.stop(now + dur + 0.005)
}

// Snappy, bright turn
export const turnSound = (ac: AudioContext, isFlip: boolean) => {
  if (isFlip) {
    // Slow, murky flip
    swimSweep(ac, 0.5, 500, 12, 0.8, 350, 14, 4, 0.65, 0.14, 80, 9, 0.18, 0.16)
  } else {
    // Snappy 90° turn
    swimSweep(ac, 0.35, 900, 50, 2, 600, 60, 9, 0.38, 0.03, 160, 30, 0.09, 0.04)
  }
}

// Rubber band twang — wrap around edge
const springSweep = (
  ac: AudioContext,
  f0: number,
  fPeak: number,
  fEnd: number,
  peakAt: number,
  dur: number,
  vol: number,
  vol2: number,
) => {
  const now = ac.currentTime
  const osc = ac.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(f0, now)
  osc.frequency.exponentialRampToValueAtTime(fPeak, now + peakAt)
  osc.frequency.exponentialRampToValueAtTime(fEnd, now + dur)

  const osc2 = ac.createOscillator()
  osc2.type = 'sine'
  osc2.frequency.setValueAtTime(f0 * 2, now)
  osc2.frequency.exponentialRampToValueAtTime(fPeak * 2, now + peakAt)
  osc2.frequency.exponentialRampToValueAtTime(fEnd * 2, now + dur)

  const gain = ac.createGain()
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(vol, now + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur)

  const gain2 = ac.createGain()
  gain2.gain.setValueAtTime(0, now)
  gain2.gain.linearRampToValueAtTime(vol2, now + 0.02)
  gain2.gain.exponentialRampToValueAtTime(0.0001, now + dur)

  osc.connect(gain)
  osc2.connect(gain2)
  gain.connect(ac.destination)
  gain2.connect(ac.destination)
  osc.start(now)
  osc2.start(now)
  osc.stop(now + dur + 0.005)
  osc2.stop(now + dur + 0.005)
}

// Rubber band twang (variant 4)
export const wrapSound = (ac: AudioContext) => {
  springSweep(ac, 220, 660, 80, 0.06, 0.45, 0.14, 0.07)
}

// Deep thud-spring (variant 2) — used for dash
export const dashSound = (ac: AudioContext) => {
  springSweep(ac, 90, 280, 70, 0.1, 0.4, 0.18, 0.08)
}

// Deep pulse: low rumble noise + slow sine swell (variant 2)
export const powerDotSound = (ac: AudioContext) => {
  const now = ac.currentTime
  const dur = 0.7

  const bufferSize = Math.ceil(ac.sampleRate * dur)
  const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1

  const source = ac.createBufferSource()
  source.buffer = buffer
  const bandpass = ac.createBiquadFilter()
  bandpass.type = 'bandpass'
  bandpass.frequency.value = 280
  bandpass.Q.value = 5
  const noiseGain = ac.createGain()
  noiseGain.gain.setValueAtTime(0, now)
  noiseGain.gain.linearRampToValueAtTime(0.14, now + 0.03)
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + dur)
  source.connect(bandpass)
  bandpass.connect(noiseGain)
  noiseGain.connect(ac.destination)
  source.start(now)

  const osc = ac.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(95, now)
  osc.frequency.exponentialRampToValueAtTime(220, now + 0.2)
  osc.frequency.exponentialRampToValueAtTime(80, now + dur)
  const gain = ac.createGain()
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(0.22, now + 0.025)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur)
  osc.connect(gain)
  gain.connect(ac.destination)
  osc.start(now)
  osc.stop(now + dur + 0.005)

  const osc2 = ac.createOscillator()
  osc2.type = 'sine'
  osc2.frequency.setValueAtTime(120, now)
  osc2.frequency.exponentialRampToValueAtTime(275, now + 0.2)
  osc2.frequency.exponentialRampToValueAtTime(99, now + dur)
  const gain2 = ac.createGain()
  gain2.gain.setValueAtTime(0, now)
  gain2.gain.linearRampToValueAtTime(0.08, now + 0.025)
  gain2.gain.exponentialRampToValueAtTime(0.0001, now + dur)
  osc2.connect(gain2)
  gain2.connect(ac.destination)
  osc2.start(now)
  osc2.stop(now + dur + 0.005)
}

// Rising sweep: slow glide low→high with noise shimmer (variant 4)
export const beatLevelSound = (ac: AudioContext) => {
  const now = ac.currentTime
  const dur = 1.5
  const notes: [number, number, number][] = [
    [120, 0.0, 1.4],
    [240, 0.2, 1.1],
    [480, 0.5, 0.85],
  ]
  for (const [freq, offset, noteDur] of notes) {
    const osc = ac.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, now + offset)
    osc.frequency.exponentialRampToValueAtTime(
      freq * 1.06,
      now + offset + noteDur,
    )
    const gain = ac.createGain()
    gain.gain.setValueAtTime(0, now + offset)
    gain.gain.linearRampToValueAtTime(0.13, now + offset + 0.018)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + noteDur)
    gain.gain.setValueAtTime(0, now + offset + noteDur + 0.002)
    osc.connect(gain)
    gain.connect(ac.destination)
    osc.start(now + offset)
    osc.stop(now + offset + noteDur + 0.005)
  }

  const bufferSize = Math.ceil(ac.sampleRate * dur)
  const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1
  const source = ac.createBufferSource()
  source.buffer = buffer
  const bp = ac.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.setValueAtTime(800, now)
  bp.frequency.exponentialRampToValueAtTime(2400, now + dur)
  bp.Q.value = 6
  const noiseGain = ac.createGain()
  noiseGain.gain.setValueAtTime(0, now)
  noiseGain.gain.linearRampToValueAtTime(0.08, now + 0.05)
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + dur)
  source.connect(bp)
  bp.connect(noiseGain)
  noiseGain.connect(ac.destination)
  source.start(now)
}

// Wobbly descend: sine with LFO vibrato warbling downward (variant 5)
export const dieSound = (ac: AudioContext) => {
  const now = ac.currentTime
  const dur = 1.1

  const osc = ac.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(290, now)
  osc.frequency.exponentialRampToValueAtTime(38, now + dur)

  const lfo = ac.createOscillator()
  lfo.type = 'sine'
  lfo.frequency.setValueAtTime(11, now)
  lfo.frequency.exponentialRampToValueAtTime(3.3, now + dur)
  const lfoGain = ac.createGain()
  lfoGain.gain.setValueAtTime(18, now)
  lfoGain.gain.exponentialRampToValueAtTime(1, now + dur)
  lfo.connect(lfoGain)
  lfoGain.connect(osc.frequency)
  lfo.start(now)
  lfo.stop(now + dur + 0.005)

  const oscGain = ac.createGain()
  oscGain.gain.setValueAtTime(0, now)
  oscGain.gain.linearRampToValueAtTime(0.16, now + 0.02)
  oscGain.gain.exponentialRampToValueAtTime(0.0001, now + dur)
  osc.connect(oscGain)
  oscGain.connect(ac.destination)
  osc.start(now)
  osc.stop(now + dur + 0.005)

  const bufferSize = Math.ceil(ac.sampleRate * dur)
  const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1
  const source = ac.createBufferSource()
  source.buffer = buffer
  const hipass = ac.createBiquadFilter()
  hipass.type = 'highpass'
  hipass.frequency.setValueAtTime(300, now)
  hipass.frequency.exponentialRampToValueAtTime(25, now + dur)
  const bandpass = ac.createBiquadFilter()
  bandpass.type = 'bandpass'
  bandpass.frequency.setValueAtTime(180, now)
  bandpass.Q.value = 6
  const noiseGain = ac.createGain()
  noiseGain.gain.setValueAtTime(0, now)
  noiseGain.gain.linearRampToValueAtTime(0.08, now + 0.04)
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + dur)
  source.connect(hipass)
  hipass.connect(bandpass)
  bandpass.connect(noiseGain)
  noiseGain.connect(ac.destination)
  source.start(now)
}

// Pressure-drop whoosh: noise sweeps high to low, oscillator dives (variant 5)
export const timeOutSound = (ac: AudioContext) => {
  const now = ac.currentTime
  const dur = 1.1

  const bufferSize = Math.ceil(ac.sampleRate * dur)
  const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1
  const noiseSrc = ac.createBufferSource()
  noiseSrc.buffer = buffer
  const bp = ac.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.setValueAtTime(1200, now)
  bp.frequency.exponentialRampToValueAtTime(30, now + dur)
  bp.Q.value = 1
  const noiseGain = ac.createGain()
  noiseGain.gain.setValueAtTime(0, now)
  noiseGain.gain.linearRampToValueAtTime(0.2, now + 0.04)
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + dur)
  noiseSrc.connect(bp)
  bp.connect(noiseGain)
  noiseGain.connect(ac.destination)
  noiseSrc.start(now)

  const osc = ac.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(320, now)
  osc.frequency.exponentialRampToValueAtTime(40, now + dur)
  const g = ac.createGain()
  g.gain.setValueAtTime(0, now)
  g.gain.linearRampToValueAtTime(0.1, now + 0.025)
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur)
  osc.connect(g)
  g.connect(ac.destination)
  osc.start(now)
  osc.stop(now + dur + 0.005)
}
