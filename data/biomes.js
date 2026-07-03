/**
 * BIOMES — selectable, decorated home scenes for the farm.
 * Each biome drives the whole background: a multi-stop sky, a sun or moon,
 * two parallax hill bands, drifting clouds or a star field, the two iso
 * tile colors, edge decorations (trees / cacti / pines), and an ambient
 * particle (snow / fireflies). Everything is data here; farm.js draws it.
 */

export const BIOMES = {
  meadow: {
    name: 'MEADOW', emoji: '🌱',
    sky: ['#6fc0e8', '#a6ddef', '#d9f2ec'],
    horizon: '#8fd07a', ground: '#4fa85f',
    hillA: '#83c56f', hillB: '#69b25a',
    tileA: { top: '#7ac86a', left: '#4a9a4a', right: '#3f8f3f' },
    tileB: { top: '#6cbe5e', left: '#3f8f3f', right: '#357f37' },
    sun: '#fff6d0', clouds: true,
    decor: 'trees', trunk: '#7a4a2a', leaf: '#4a9a4a', leaf2: '#69c46a',
    particle: null,
  },
  desert: {
    name: 'DESERT', emoji: '🏜️',
    sky: ['#f6b45c', '#ffd28a', '#ffeccb'],
    horizon: '#e8c48a', ground: '#d8a860',
    hillA: '#e4bd7c', hillB: '#d0a866',
    tileA: { top: '#e8c88a', left: '#c8a060', right: '#b88a4a' },
    tileB: { top: '#dcbc7c', left: '#b88a4a', right: '#a87a3a' },
    sun: '#fff0c0', clouds: true,
    decor: 'cacti', trunk: '#3f8a4a', leaf: '#4fa85a', leaf2: '#7cc46a',
    particle: null,
  },
  snow: {
    name: 'SNOWFIELD', emoji: '❄️',
    sky: ['#9cc0dc', '#c4dcee', '#eef6fc'],
    horizon: '#dbe8f0', ground: '#c8d8e2',
    hillA: '#d4e2ec', hillB: '#c2d2de',
    tileA: { top: '#eef4fa', left: '#c8d6e2', right: '#b6c6d6' },
    tileB: { top: '#e2ecf4', left: '#b6c6d6', right: '#a6b8ca' },
    sun: '#fdfdff', clouds: true,
    decor: 'pines', trunk: '#5a4a3a', leaf: '#3d6f5e', leaf2: '#eef6fc',
    particle: 'snow',
  },
  dusk: {
    name: 'DUSK', emoji: '🌙',
    sky: ['#221a46', '#513062', '#8a4f66'],
    horizon: '#3a3450', ground: '#26303e',
    hillA: '#342f4c', hillB: '#28243e',
    tileA: { top: '#3a4a5e', left: '#2a3648', right: '#222e3e' },
    tileB: { top: '#33435a', left: '#222e3e', right: '#1c2836' },
    moon: true, stars: true,
    decor: 'pines', trunk: '#241f34', leaf: '#26314a', leaf2: '#33436a',
    particle: 'firefly',
  },
};

export const DEFAULT_BIOME = 'meadow';
