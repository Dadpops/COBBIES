/**
 * RHYTHM MUSIC — the backing track for the Rhythm minigame. Layers:
 *   - a continuous ARP melody + drone pad, routed through `melodyGain` so it
 *     can be ducked. It plays through your hits and only cuts out on a MISS
 *     (miss()), recovering over ~0.8s.
 *   - a KICK + walking BASS fired by the game on every landed note (hit()),
 *     routed straight to master so the low end lands on your taps (the coins).
 * Plays ONLY during Rhythm. Own AudioContext; start() must follow a gesture.
 */

const SCALE = [0, 3, 5, 7, 10]; // C minor pentatonic
const ROOT = 130.81;            // C3
const ARP = [7, 9, 12, 9, 7, 10, 7, 5, 7, 9, 11, 9, 7, 5, 4, 5]; // flowing lead
const BASS = [0, 0, 3, 2, 0, 4, 3, 1];
const ARP_STEP = 0.26;          // seconds between arp notes

export function createRhythmMusic() {
  let ctx = null, master = null, melodyGain = null, running = false, volume = 0.7;
  let pad = [], timer = 0, arpStep = 0, bassStep = 0, nextTime = 0;

  function ensure() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    melodyGain = ctx.createGain(); melodyGain.gain.value = 1; melodyGain.connect(master);
    return true;
  }

  function hz(step) {
    const n = SCALE.length;
    const deg = SCALE[((step % n) + n) % n];
    const oct = Math.floor(step / n);
    return ROOT * Math.pow(2, (deg + 12 * oct) / 12);
  }

  function startPad() {
    stopPad();
    [ROOT / 2, ROOT * 0.75].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.value = f; o.detune.value = (i ? 6 : -6);
      const g = ctx.createGain(); g.gain.value = 0.035;
      o.connect(g); g.connect(melodyGain); o.start(); pad.push(o);
    });
  }
  function stopPad() { pad.forEach((o) => { try { o.stop(); } catch { /* already stopped */ } }); pad = []; }

  function pluck(t, freq, type, peak, dur, dest) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.02);
  }
  function kick(t) {
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.12);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.6, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.18);
  }

  // Continuous arp melody — routed through melodyGain so miss() can duck it.
  function scheduler() {
    if (!running) return;
    while (nextTime < ctx.currentTime + 0.25) {
      pluck(nextTime, hz(ARP[arpStep % ARP.length]), 'triangle', 0.09, 0.40, melodyGain);
      if (arpStep % 4 === 0) pluck(nextTime, hz(ARP[arpStep % ARP.length]) * 2, 'sine', 0.035, 0.3, melodyGain); // octave sparkle
      arpStep++;
      nextTime += ARP_STEP;
    }
  }

  return {
    start() {
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume();
      running = true; arpStep = 0; bassStep = 0; nextTime = ctx.currentTime + 0.1;
      melodyGain.gain.cancelScheduledValues(ctx.currentTime); melodyGain.gain.setValueAtTime(1, ctx.currentTime);
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(0, ctx.currentTime);
      master.gain.linearRampToValueAtTime(0.5 * volume, ctx.currentTime + 0.4);
      startPad();
      clearInterval(timer); timer = setInterval(scheduler, 60);
    },
    /** On a landed note: kick + walking bass, locked to the player's tap. Melody unaffected. */
    hit(combo) {
      if (!running || !ctx) return;
      const t = ctx.currentTime + 0.01;
      kick(t);
      pluck(t, hz(BASS[bassStep % BASS.length]) / 2, 'square', 0.16, 0.26, master);
      bassStep++;
      pluck(t, hz(7 + ((combo || 0) % 6)), 'triangle', 0.10, 0.22, master); // accent climbs with combo
    },
    /** On a miss: duck the melody out, then let it fade back in over ~0.8s. */
    miss() {
      if (!running || !ctx) return;
      const now = ctx.currentTime;
      melodyGain.gain.cancelScheduledValues(now);
      melodyGain.gain.setValueAtTime(melodyGain.gain.value, now);
      melodyGain.gain.linearRampToValueAtTime(0, now + 0.06);
      melodyGain.gain.linearRampToValueAtTime(1, now + 0.85);
    },
    setVolume(v) {
      volume = Math.max(0, Math.min(1, v));
      if (running && master) master.gain.setTargetAtTime(0.5 * volume, ctx.currentTime, 0.1);
    },
    stop() {
      running = false; clearInterval(timer); timer = 0;
      if (ctx && master) {
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
        master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
      }
      setTimeout(stopPad, 500);
    },
  };
}
