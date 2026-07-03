/**
 * SFX — short Web Audio sound effects, synthesised (no asset files).
 *   coin()  bright two-note ding for coins / clears
 *   smack() a satisfying thump+click for whacking a cobbie
 *   bomb()  low filtered boom for hitting a bomb
 *   error() a quick buzzer (paired with the bomb / an "X")
 * All are cheap one-shots. Call resume() from a user gesture first.
 */

export function createSfx() {
  let ctx = null;

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    return ctx;
  }

  function noise(dur) {
    const n = Math.floor(ctx.sampleRate * dur);
    const b = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  function env(g, t, attack, peak, dur) {
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0006, t + dur);
  }

  function tone(type, f0, f1, t, dur, peak) {
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain(); env(g, t, 0.004, peak, dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }

  return {
    resume() { const c = ensure(); if (c && c.state === 'suspended') c.resume(); },

    coin() {
      const c = ensure(); if (!c) return; const t = c.currentTime;
      tone('square', 988, 990, t, 0.10, 0.11);
      tone('square', 1319, 1321, t + 0.07, 0.12, 0.11);
    },

    smack() {
      const c = ensure(); if (!c) return; const t = c.currentTime;
      const src = c.createBufferSource(); src.buffer = noise(0.10);
      const bp = c.createBiquadFilter(); bp.type = 'bandpass';
      bp.frequency.value = 1400; bp.Q.value = 0.7;
      const g = c.createGain(); env(g, t, 0.001, 0.28, 0.10);
      src.connect(bp); bp.connect(g); g.connect(c.destination); src.start(t);
      tone('sine', 190, 70, t, 0.11, 0.24); // body thump
    },

    // A rubber-toy squeak: a quick up-chirp then a shorter down-chirp. Paired
    // with a light thump so bonking a cobbie feels like squishing a squeaky toy.
    squeak() {
      const c = ensure(); if (!c) return; const t = c.currentTime;
      tone('square', 620, 1180, t, 0.07, 0.13);
      tone('square', 1180, 720, t + 0.055, 0.09, 0.11);
      tone('sine', 170, 90, t, 0.08, 0.14); // soft body thud under the squeak
    },

    bomb() {
      const c = ensure(); if (!c) return; const t = c.currentTime;
      const src = c.createBufferSource(); src.buffer = noise(0.5);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.setValueAtTime(1000, t);
      lp.frequency.exponentialRampToValueAtTime(120, t + 0.4);
      const g = c.createGain(); env(g, t, 0.003, 0.45, 0.5);
      src.connect(lp); lp.connect(g); g.connect(c.destination); src.start(t);
      tone('sawtooth', 150, 40, t, 0.45, 0.3);
    },

    error() {
      const c = ensure(); if (!c) return; const t = c.currentTime;
      const o = c.createOscillator(); o.type = 'square';
      o.frequency.setValueAtTime(320, t);
      o.frequency.setValueAtTime(230, t + 0.09);
      const g = c.createGain(); env(g, t, 0.003, 0.16, 0.2);
      o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 0.22);
    },
  };
}
