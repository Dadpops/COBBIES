/**
 * MUSIC — a relaxing, generative synth loop built on the Web Audio API.
 *
 * A soft triangle-wave arpeggio over a minor-pentatonic scale, run through a
 * gentle low-pass filter and a little feedback delay for space, plus a warm
 * sustained pad underneath. It's calm by design; the only thing that changes
 * with intensity is TEMPO — notes start slow and speed up as a match heats
 * up, but the pace is clamped so it never turns frantic or harsh.
 *
 *   const music = createMusic();
 *   music.start();                 // resumes the audio context (needs a gesture)
 *   music.setIntensity(0..1);      // 0 = slowest, 1 = fastest (capped)
 *   music.stop();
 */

export function createMusic() {
  let ctx = null, master = null, filter = null, delay = null, pad = null;
  let running = false, intensity = 0, step = 0, nextTime = 0, timer = 0;

  const SCALE = [0, 3, 5, 7, 10];        // minor pentatonic (semitones)
  const ROOT = 220;                       // A3
  const PATTERN = [0, 2, 4, 2, 1, 3, 5, 3]; // gentle rolling arpeggio (scale steps)

  const SLOW = 0.46, FAST = 0.26;         // seconds/note — gentle clamped range

  function hz(scaleStep) {
    const oct = Math.floor(scaleStep / SCALE.length);
    const deg = SCALE[((scaleStep % SCALE.length) + SCALE.length) % SCALE.length];
    return ROOT * Math.pow(2, (deg + 12 * oct) / 12);
  }

  function ensure() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0;

    filter = ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 1500; filter.Q.value = 0.5;

    delay = ctx.createDelay(); delay.delayTime.value = 0.34;
    const fb = ctx.createGain(); fb.gain.value = 0.26;
    delay.connect(fb); fb.connect(delay);

    filter.connect(master);
    delay.connect(filter);
    master.connect(ctx.destination);

    // warm pad: two slightly detuned sines on root + fifth, very quiet
    pad = ctx.createGain(); pad.gain.value = 0.05;
    pad.connect(filter);
    [ROOT / 2, ROOT * 0.75].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.value = f; o.detune.value = i ? 4 : -4;
      o.connect(pad); o.start();
    });
    return true;
  }

  function playNote(time) {
    const measurePos = step % PATTERN.length;
    const base = PATTERN[measurePos];
    // drift up an octave now and then for a twinkle
    const oct = (step % 16 === 8) ? SCALE.length : 0;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = hz(base + oct);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(0.13, time + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0008, time + 0.5);
    o.connect(g); g.connect(filter); g.connect(delay);
    o.start(time); o.stop(time + 0.55);
    step++;
  }

  function noteInterval() {
    return SLOW - (SLOW - FAST) * Math.max(0, Math.min(1, intensity));
  }

  function scheduler() {
    if (!running) return;
    while (nextTime < ctx.currentTime + 0.25) {
      playNote(nextTime);
      nextTime += noteInterval();
    }
  }

  return {
    start() {
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume();
      running = true; step = 0; nextTime = ctx.currentTime + 0.08;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
      master.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 1.2); // fade in
      clearInterval(timer);
      timer = setInterval(scheduler, 60);
    },
    setIntensity(v) { intensity = v; },
    stop() {
      running = false;
      clearInterval(timer); timer = 0;
      if (ctx && master) {
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
        master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6); // fade out
      }
    },
  };
}
