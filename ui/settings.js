/**
 * SETTINGS — music track / volume / dynamic-tempo / on-off. Reached from the
 * ⚙️ topbar button and the hub's "SOUND OPTIONS" row.
 *
 * The panel mutates state.settings and drives the music controller. Because
 * music start-up is gated by a one-shot flag owned by main, the caller passes
 * a tiny `audio` shim ({ startOnce, stop, reset }) so this panel can restart
 * playback without knowing how the flag works.
 */

const $ = (id) => document.getElementById(id);

/**
 * @param {{ state: object, persist: () => void, music: any, TRACKS: {name:string}[],
 *           audio: { startOnce: () => void, stop: () => void, reset: () => void } }} deps
 */
export function initSettings({ state, persist, music, TRACKS, audio }) {
  function open() { render(); $('settingsScreen').classList.add('show'); }

  function render() {
    const b = $('settingsBody');
    b.innerHTML = '';
    b.appendChild(toggleRow('MUSIC', state.settings.musicOn, () => {
      state.settings.musicOn = !state.settings.musicOn; persist();
      if (state.settings.musicOn) { audio.reset(); audio.startOnce(); }
      else { audio.stop(); audio.reset(); }
      render();
    }));
    b.appendChild(chipRow('TRACK', TRACKS.map((t) => t.name), state.settings.track, (i) => {
      state.settings.track = i; persist(); music.setTrack(i);
      if (state.settings.musicOn) audio.startOnce();
      render();
    }));
    const vr = document.createElement('div'); vr.className = 'set-row';
    vr.innerHTML = '<span class="set-label">VOLUME</span>';
    const slider = document.createElement('input');
    slider.type = 'range'; slider.min = '0'; slider.max = '100'; slider.className = 'set-vol';
    slider.value = Math.round(state.settings.volume * 100);
    slider.addEventListener('input', () => { state.settings.volume = slider.value / 100; music.setVolume(state.settings.volume); });
    slider.addEventListener('change', persist);
    vr.appendChild(slider); b.appendChild(vr);
    b.appendChild(toggleRow('SPEED-UP IN GAMES', state.settings.musicDynamic, () => {
      state.settings.musicDynamic = !state.settings.musicDynamic; persist();
      music.setDynamic(state.settings.musicDynamic); render();
    }));
  }

  function toggleRow(label, on, onClick) {
    const row = document.createElement('div'); row.className = 'set-row';
    row.innerHTML = `<span class="set-label">${label}</span>`;
    const opts = document.createElement('div'); opts.className = 'set-opts';
    ['ON', 'OFF'].forEach((t, i) => {
      const active = (i === 0) === on;
      const btn = document.createElement('button');
      btn.className = 'av-chip' + (active ? ' on' : '');
      btn.textContent = t;
      btn.addEventListener('click', () => { if (!active) onClick(); });
      opts.appendChild(btn);
    });
    row.appendChild(opts); return row;
  }
  function chipRow(label, names, sel, onPick) {
    const row = document.createElement('div'); row.className = 'set-row';
    row.innerHTML = `<span class="set-label">${label}</span>`;
    const opts = document.createElement('div'); opts.className = 'set-opts';
    names.forEach((n, i) => {
      const btn = document.createElement('button');
      btn.className = 'av-chip' + (sel === i ? ' on' : '');
      btn.textContent = n;
      btn.addEventListener('click', () => onPick(i));
      opts.appendChild(btn);
    });
    row.appendChild(opts); return row;
  }

  $('settingsbtn').addEventListener('click', open);
  $('musicToggle').addEventListener('click', open);
  $('settingsBack').addEventListener('click', () => $('settingsScreen').classList.remove('show'));

  return { open };
}
