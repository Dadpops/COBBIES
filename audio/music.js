/**
 * MUSIC — relaxing generative synth on the Web Audio API, now with:
 *   - 4 selectable TRACKS (different scale / pattern / timbre / mood)
 *   - VOLUME control (0..1)
 *   - a DYNAMIC toggle: when off, tempo stays constant (no speed-up)
 *
 * It's meant to play continuously across the whole game; only the *tempo*
 * responds to intensity during minigames, and only while dynamic is on.
 * Call start() from a user gesture (browser autoplay policy).
 */

export const TRACKS = [
  { name: 'MEADOW', root: 220, scale: [0, 2, 4, 7, 9],  pattern: [0, 2, 4, 2, 3, 4, 2, 1], wave: 'triangle', padWave: 'sine',     cutoff: 1500, slow: 0.50, fast: 0.30 },
  { name: 'DUSK',   root: 174, scale: [0, 3, 5, 7, 10], pattern: [0, 2, 4, 3, 2, 1, 3, 2], wave: 'sine',     padWave: 'sine',     cutoff: 1100, slow: 0.56, fast: 0.34 },
  { name: 'ARCADE', root: 262, scale: [0, 2, 4, 5, 7],  pattern: [0, 1, 2, 3, 4, 3, 2, 1], wave: 'square',   padWave: 'triangle', cutoff: 2200, slow: 0.42, fast: 0.24 },
  { name: 'LO-FI',  root: 196, scale: [0, 3, 5, 7, 10], pattern: [0, 4, 2, 5, 3, 2, 4, 1], wave: 'triangle', padWave: 'sine',     cutoff: 900,  slow: 0.62, fast: 0.42 },
  // A warmer, more melodic lo-fi tune — a 7-note dorian scale + a longer,
  // wandering phrase and a muffled cutoff make it feel distinct from the rest.
  { name: 'COZY',   root: 155.56, scale: [0, 2, 3, 5, 7, 9, 10], pattern: [0, 2, 4, 3, 5, 4, 6, 4, 3, 1, 2, 4, 3, 2, 0, 4], wave: 'sine', padWave: 'triangle', cutoff: 860, slow: 0.60, fast: 0.40 },
];

export function createMusic() {
  let ctx = null, master = null, filter = null, delay = null, padGain = null, padOscs = [];
  let running = false, dynamic = true, intensity = 0, volume = 0.7;
  let step = 0, nextTime = 0, timer = 0, trackIdx = 0;

  const T = () => TRACKS[trackIdx];

  function hz(scaleStep) {
    const sc = T().scale;
    const oct = Math.floor(scaleStep / sc.length);
    const deg = sc[((scaleStep % sc.length) + sc.length) % sc.length];
    return T().root * Math.pow(2, (deg + 12 * oct) / 12);
  }

  function ensure() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0;
    filter = ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = T().cutoff; filter.Q.value = 0.5;
    delay = ctx.createDelay(); delay.delayTime.value = 0.34;
    const fb = ctx.createGain(); fb.gain.value = 0.24;
    delay.connect(fb); fb.connect(delay);
    filter.connect(master); delay.connect(filter); master.connect(ctx.destination);
    padGain = ctx.createGain(); padGain.gain.value = 0.05; padGain.connect(filter);
    buildPad();
    return true;
  }

  function buildPad() {
    padOscs.forEach((o) => { try { o.stop(); } catch { /* already stopped */ } });
    padOscs = [];
    const f = T().root;
    [f / 2, f * 0.75].forEach((fr, i) => {
      const o = ctx.createOscillator();
      o.type = T().padWave; o.frequency.value = fr; o.detune.value = i ? 4 : -4;
      o.connect(padGain); o.start(); padOscs.push(o);
    });
  }

  function playNote(time) {
    const p = T().pattern;
    const base = p[step % p.length];
    const oct = (step % 16 === 8) ? T().scale.length : 0;
    const o = ctx.createOscillator();
    o.type = T().wave; o.frequency.value = hz(base + oct);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(0.12, time + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0008, time + 0.5);
    o.connect(g); g.connect(filter); g.connect(delay);
    o.start(time); o.stop(time + 0.55);
    step++;
  }

  const eff = () => (dynamic ? Math.max(0, Math.min(1, intensity)) : 0.1);
  const interval = () => { const t = T(); return t.slow - (t.slow - t.fast) * eff(); };

  function scheduler() {
    if (!running) return;
    while (nextTime < ctx.currentTime + 0.25) { playNote(nextTime); nextTime += interval(); }
  }

  function applyVolume() {
    if (!master) return;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(0.5 * volume, ctx.currentTime, 0.2);
  }

  return {
    start() {
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume();
      if (running) { applyVolume(); return; }
      running = true; step = 0; nextTime = ctx.currentTime + 0.08;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(0, ctx.currentTime);
      master.gain.linearRampToValueAtTime(0.5 * volume, ctx.currentTime + 1.0);
      clearInterval(timer); timer = setInterval(scheduler, 60);
    },
    stop() {
      running = false; clearInterval(timer); timer = 0;
      if (ctx && master) {
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
        master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
      }
    },
    setIntensity(v) { intensity = v; },
    setDynamic(b) { dynamic = b; },
    setVolume(v) { volume = Math.max(0, Math.min(1, v)); if (running) applyVolume(); },
    setTrack(i) {
      trackIdx = ((i % TRACKS.length) + TRACKS.length) % TRACKS.length;
      if (ctx) { filter.frequency.setTargetAtTime(T().cutoff, ctx.currentTime, 0.2); buildPad(); }
    },
    trackIndex() { return trackIdx; },
    isPlaying() { return running; },
  };
}
