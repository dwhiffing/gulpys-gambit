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

// snappy, bright (turn) / slow, murky (dash)
const TURN_PARAMS = {
  dur: [0.35, 0.22],
  hpStart: [900, 1200],
  hpEnd: 50,
  hpQ: 2,
  bpStart: [600, 800],
  bpEnd: 60,
  bpQ: 9,
  noiseVol: [0.5, 0.38],
  attack: 0.03,
  oscStart: [120, 160],
  oscEnd: 30,
  oscVol: [0.14, 0.09],
  oscAttack: 0.04,
}
const DASH_PARAMS = {
  dur: [0.7, 0.55],
  hpStart: [220, 330],
  hpEnd: 12,
  hpQ: 0.8,
  bpStart: [150, 220],
  bpEnd: 14,
  bpQ: 4,
  noiseVol: [0.65, 0.48],
  attack: 0.14,
  oscStart: [42, 55],
  oscEnd: 9,
  oscVol: [0.25, 0.17],
  oscAttack: 0.16,
}

export const turnSound = (ac: AudioContext, isFlip: boolean, variant = 3) => {
  const p = variant === 5 ? DASH_PARAMS : TURN_PARAMS
  const f = isFlip ? 0 : 1
  const dur = p.dur[f]
  const now = ac.currentTime

  const bufferSize = Math.ceil(ac.sampleRate * dur)
  const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1

  const source = ac.createBufferSource()
  source.buffer = buffer

  const hipass = ac.createBiquadFilter()
  hipass.type = 'highpass'
  hipass.frequency.setValueAtTime(p.hpStart[f], now)
  hipass.frequency.exponentialRampToValueAtTime(p.hpEnd, now + dur)
  hipass.Q.value = p.hpQ

  const bandpass = ac.createBiquadFilter()
  bandpass.type = 'bandpass'
  bandpass.frequency.setValueAtTime(p.bpStart[f], now)
  bandpass.frequency.exponentialRampToValueAtTime(p.bpEnd, now + dur)
  bandpass.Q.value = p.bpQ

  const noiseGain = ac.createGain()
  noiseGain.gain.setValueAtTime(0, now)
  noiseGain.gain.linearRampToValueAtTime(p.noiseVol[f], now + p.attack)
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + dur)

  source.connect(hipass)
  hipass.connect(bandpass)
  bandpass.connect(noiseGain)
  noiseGain.connect(ac.destination)
  source.start(now)

  const osc = ac.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(p.oscStart[f], now)
  osc.frequency.exponentialRampToValueAtTime(p.oscEnd, now + dur)

  const oscGain = ac.createGain()
  oscGain.gain.setValueAtTime(0, now)
  oscGain.gain.linearRampToValueAtTime(p.oscVol[f], now + p.oscAttack)
  oscGain.gain.exponentialRampToValueAtTime(0.0001, now + dur)

  osc.connect(oscGain)
  oscGain.connect(ac.destination)
  osc.start(now)
  osc.stop(now + dur + 0.005)
}
