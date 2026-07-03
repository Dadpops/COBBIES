/**
 * HOW TO PLAY — a first-launch walkthrough of the core loop and every ranch
 * feature. Reopenable anytime via the ❓ topbar button. Each step spotlights a
 * real on-screen element while a caption explains it.
 *
 * Self-contained: it reads the player name from state, asks the farm for
 * building rects to highlight, and calls onClose() when finished/skipped.
 */

const $ = (id) => document.getElementById(id);

// Each step highlights a real element (`target`) while explaining it. Targets:
// 'critters' = the roaming band, 'play' = the PLAY button, a building id
// (nest/barn/pen/shop), 'topright' = the topbar tools, or null for a centered card.
function buildSteps(state) {
  return [
    { emoji: '👋', title: 'WELCOME!', target: null, body: () =>
      `Hi ${state.playerName || 'friend'}! <b>Cobbies</b> are cute pixel critters you collect, raise, and play with. Here's a quick guided tour of your ranch.` },
    { emoji: '🐾', title: 'YOUR COBBIES', target: 'critters', body: () =>
      `These little friends roam your ranch and greet you by name. <b>Tap any cobbie</b> to open its card — every game they play earns XP and <b>evolves</b> them into new forms.` },
    { emoji: '▶️', title: 'PLAY & EARN', target: 'play', body: () =>
      `Tap <b>PLAY</b> for minigames — one-tap <b>Runner</b> and <b>Whack-a-Cobbie</b>. Pick a star cobbie plus a <b>cheerleader buddy</b>, then rack up <b>XP + coins</b>.` },
    { emoji: '🥚', title: 'THE HATCHERY', target: 'nest', body: () =>
      `This is the <b>Nest</b>. Spend coins on a <b>random egg</b> (always someone new — with pity for legendaries) or pick an exact critter. Duplicates bank bonus XP.` },
    { emoji: '🚜', title: 'THE BARN', target: 'barn', body: () =>
      `Send cobbies to <b>work</b> at the Barn — the Berry Patch, Fishing Hole and Lookout earn coins over time, even while you're away. Collect coins to <b>expand your ranch</b>.` },
    { emoji: '📖', title: 'THE PEN', target: 'pen', body: () =>
      `Your full <b>collection</b> lives in the Pen. Browse everyone you've found, spot the locked silhouettes still to discover, and choose which cobbies roam your home ranch.` },
    { emoji: '🎩', title: 'SHOP & WARDROBE', target: 'shop', body: () =>
      `Spend coins in the <b>Shop</b> on dapper <b>hats</b> and ranch expansions — then equip hats from any critter's card and style your own avatar at the <b>Wardrobe</b>.` },
    { emoji: '⭐', title: 'DAILY CHALLENGES', target: 'topright', body: () =>
      `Up here live the <b>⭐ daily challenge</b> and long-term goals (coins + unlocks), the <b>🗺️ scene</b> picker for new backgrounds, and <b>⚙️ settings</b> for music.` },
    { emoji: '🚀', title: "YOU'RE READY!", target: null, body: () =>
      `That's the whole ranch! Collect them all and make it cozy. Tap the <b>❓</b> up top anytime to replay this tour. Have fun, ${state.playerName || 'friend'}!` },
  ];
}

/**
 * Wire the tutorial. Returns { open, render } — open() starts the tour,
 * render() re-lays-out the current step (call on resize while it's showing).
 * @param {{ state: object, persist: () => void, farm: any, onClose: () => void }} deps
 */
export function initTutorial({ state, persist, farm, onClose }) {
  const TUTORIAL = buildSteps(state);
  let tutIdx = 0;

  function open() {
    tutIdx = 0;
    const dots = $('tutDots');
    dots.innerHTML = '';
    TUTORIAL.forEach(() => dots.appendChild(document.createElement('i')));
    $('tutorialScreen').classList.add('show');
    render();
  }

  /** Page-space rect of a step's highlight target (null = centered, no spotlight). */
  function tutTargetRect(target) {
    if (!target) return null;
    if (target === 'play') return $('playBig').getBoundingClientRect();
    if (target === 'topright') return document.querySelector('.top-right').getBoundingClientRect();
    if (target === 'critters') {
      const r = $('farm').getBoundingClientRect();
      return { left: r.left + r.width * 0.15, top: r.top + r.height * 0.7, width: r.width * 0.7, height: r.height * 0.22 };
    }
    return farm.buildingRect(target); // nest / barn / pen / shop / wardrobe
  }

  function render() {
    const step = TUTORIAL[tutIdx];
    $('tutEmoji').textContent = step.emoji;
    $('tutTitle').textContent = step.title;
    $('tutBody').innerHTML = step.body();
    $('tutPrev').disabled = tutIdx === 0;
    $('tutNext').textContent = tutIdx === TUTORIAL.length - 1 ? "LET'S PLAY ▸" : 'NEXT ›';
    [...$('tutDots').children].forEach((d, i) => d.classList.toggle('on', i === tutIdx));
    positionSpotlight(tutTargetRect(step.target));
  }

  // Frame the highlighted rect with four dark panels + an accent ring, and park
  // the caption card on the opposite side so it never covers the highlight.
  function positionSpotlight(rect) {
    const spot = $('tutSpot'), card = $('tutCard');
    const app = $('app').getBoundingClientRect();
    const W = app.width, H = app.height;
    const setBox = (el, l, t, w, h) => {
      el.style.left = l + 'px'; el.style.top = t + 'px';
      el.style.width = Math.max(0, w) + 'px'; el.style.height = Math.max(0, h) + 'px';
    };
    if (!rect) {
      // no target — dim the whole screen (one panel covers all), center the card
      setBox($('tutMaskT'), 0, 0, W, H);
      [$('tutMaskB'), $('tutMaskL'), $('tutMaskR')].forEach((m) => setBox(m, 0, 0, 0, 0));
      spot.classList.add('none'); setBox(spot, W / 2, H * 0.42, 0, 0);
      card.classList.add('center'); card.style.top = ''; card.style.bottom = '';
      return;
    }
    spot.classList.remove('none'); card.classList.remove('center');
    const l = rect.left - app.left, t = rect.top - app.top, w = rect.width, h = rect.height;
    setBox($('tutMaskT'), 0, 0, W, t);
    setBox($('tutMaskB'), 0, t + h, W, H - (t + h));
    setBox($('tutMaskL'), 0, t, l, h);
    setBox($('tutMaskR'), l + w, t, W - (l + w), h);
    setBox(spot, l, t, w, h);
    // caption goes opposite the target so it never covers the highlight
    if (t + h / 2 < H * 0.5) { card.style.top = ''; card.style.bottom = '22px'; }
    else { card.style.bottom = ''; card.style.top = '18px'; }
  }

  function close() {
    $('tutorialScreen').classList.remove('show');
    if (!state.tutorialSeen) { state.tutorialSeen = true; persist(); }
    onClose();
  }

  $('tutPrev').addEventListener('click', () => { if (tutIdx > 0) { tutIdx--; render(); } });
  $('tutNext').addEventListener('click', () => {
    if (tutIdx < TUTORIAL.length - 1) { tutIdx++; render(); } else close();
  });
  $('tutSkip').addEventListener('click', close);
  $('helpbtn').addEventListener('click', open);

  return { open, render };
}
