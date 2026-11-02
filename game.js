(() => {
'use strict';
const VERSION = (document.querySelector('meta[name=app-version]').content || 'dev');
const KEY = 'brixuva.save.v1';
const $ = id => document.getElementById(id);

/* ---------- cache / version check ---------- */
(async function checkVersion() {
  $('vTxt').textContent = VERSION;
  try {
    const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
    const latest = (await r.json()).version;
    if (latest && latest !== VERSION && VERSION !== '__VERSION__') {
      if (sessionStorage.getItem('brixuva.reloaded') === latest) return; // avoid loops
      sessionStorage.setItem('brixuva.reloaded', latest);
      if ('caches' in window) for (const k of await caches.keys()) await caches.delete(k);
      if (navigator.serviceWorker) for (const s of await navigator.serviceWorker.getRegistrations()) await s.unregister();
      const u = new URL(location.href); u.searchParams.set('v', latest);
      location.replace(u.toString());
      return;
    }
  } catch (e) { /* offline: keep running */ }
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();

/* ---------- levels (8 columns; digits = hits, # = solid) ---------- */
const CLASSIC = [
  ['........','11111111','11111111','11111111'],
  ['........','1.1.1.1.','.1.1.1.1','1.1.1.1.','.1.1.1.1'],
  ['...11...','..1111..','.111111.','11111111'],
  ['22222222','11111111','22222222','11111111'],
  ['1......1','11....11','111..111','11111111','.111111.'],
  ['........','2.2.2.2.','11111111','.2.2.2.2','11111111'],
  ['11111111','1......1','1.2222.1','1.2..2.1','1.2222.1','1......1','11111111'],
  ['#......#','22222222','........','11111111','33333333'],
  ['1.2.3.2.','.1.2.3.2','1.2.3.2.','.1.2.3.2','1.2.3.2.','.1.2.3.2'],
  ['33....33','23....32','12.##.21','.12..21.','..1221..','...11...'],
  ['#2222222','1#333331','11#44411','111#2111','1111#111','11111#11'],
  ['33333333','3#.##.#3','3.2222.3','3.2##2.3','3.2222.3','3#.##.#3','33333333'],
  ['#.####.#','22222222','........','33333333','........','11111111'],
  ['.22..22.','23322332','23333332','.233332.','..2332..','...22...'],
  ['1#1#1#1#','22222222','3#3#3#3#','22222222','1#1#1#1#'],
  ['44444444','4......4','4.3333.4','4.3..3.4','4.3333.4','4......4','44444444'],
  ['..2..2..','...22...','..2222..','.22.22.2','22222222','2.2222.2','2.2..2.2','...22...'],
  ['4#....#4','3#2222#3','3#2##2#3','3#2..2#3','3#2222#3','4#....#4'],
  ['44444444','3#3333#3','33#33#33','333##333','33#33#33','3#3333#3','44444444'],
  ['44444444','4#3333#4','43222234','43211234','43222234','4#3333#4','44444444'],
];
const NAMES = ['Warm Up', 'Checker', 'Peak', 'Layers', 'Valley', 'Weave', 'Frame', 'Gates', 'Diagonals', 'Fortress',
  'Slant Wall', 'Vault', 'Pillars', 'Heart', 'Posts', 'Core', 'Invader', 'Courtyard', 'Lattice', 'Citadel'];

/* Extra boards. Options: cols (default 8), slide {rows, amp, speed} moves whole rows side to side,
   descend (px/s) makes the board creep towards the paddle. 'e' = explosive brick, '#' = solid. */
const EXTRA = [
  { name: 'Drift', slide: { rows: [0, 2, 4], amp: 44, speed: 1.1 },
    rows: ['..1111..', '........', '..2222..', '........', '..1111..'] },
  { name: 'Pendulum', slide: { rows: [0, 2, 4, 6], amp: 40, speed: 1.6 },
    rows: ['.222222.', '........', '.111111.', '........', '.222222.', '........', '.111111.'] },
  { name: 'Fuse',
    rows: ['11e11e11', '1e1111e1', 'e111111e', '11e11e11', '1e1111e1'] },
  { name: 'Powder Keg',
    rows: ['22222222', '2eeeeee2', '2e1111e2', '2eeeeee2', '22222222'] },
  { name: 'Wide Load', cols: 6,
    rows: ['222222', '1....1', '1.33.1', '1....1', '222222'] },
  { name: 'Dense', cols: 12,
    rows: ['#1111111111#', '122222222221', '#1111111111#', '122222222221', '#1111111111#'] },
  { name: 'Descent', descend: 3,
    rows: ['11111111', '22222222', '11111111', '22222222'] },
  { name: 'Skyfall', cols: 10, descend: 2.5,
    rows: ['1111111111', '1.1.1.1.1.', '.1.1.1.1.1', '2222222222'] },
  { name: 'Columns', cols: 9,
    rows: ['2.3.4.3.2', '2.3.4.3.2', '2.3.4.3.2', '2.3.4.3.2', '2.3.4.3.2', '#########'] },
  { name: 'Orbit', slide: { rows: [1, 3], amp: 30, speed: 1.3 },
    rows: ['...ee...', '..1111..', '.222222.', '..1111..', '...ee...'] },
  { name: 'Zigzag', cols: 10,
    rows: ['1111......', '.2222.....', '..3333....', '...4444...', '....3333..', '.....2222.', '......1111'] },
  { name: 'Hourglass',
    rows: ['44444444', '.333333.', '..2222..', '...11...', '...11...', '..2222..', '.333333.', '44444444'] },
  { name: 'Bunker',
    rows: ['########', '#e2222e#', '#2.##.2#', '#2.##.2#', '#e2222e#', '###..###'] },
  { name: 'Tide', descend: 3, slide: { rows: [0, 1, 2], amp: 44, speed: 1 },
    rows: ['.111111.', '.222222.', '.111111.'] },
  { name: 'Chain Reaction', cols: 10,
    rows: ['1e1e1e1e1e', 'e1e1e1e1e1', '1e1e1e1e1e', 'e1e1e1e1e1'] },
  { name: 'Eclipse', cols: 10,
    rows: ['...2222...', '..2....2..', '.2..33..2.', '.2.3##3.2.', '.2.3##3.2.', '.2..33..2.', '..2....2..', '...2222...'] },
  { name: 'Gauntlet', slide: { rows: [0, 2, 4], amp: 40, speed: 1.4 },
    rows: ['#.1111.#', '........', '#.2222.#', '........', '#.3333.#'] },
  { name: 'Avalanche', cols: 10, descend: 3.5,
    rows: ['1111111111', '2222222222', '1111111111', '2222222222'] },
  { name: 'Onion', cols: 10,
    rows: ['3333333333', '3........3', '3.222222.3', '3.2....2.3', '3.2.11.2.3', '3.2....2.3', '3.222222.3'] },
  { name: 'Final Hour', descend: 2.5,
    rows: ['4#4444#4', '3e3333e3', '2.2222.2', '1.1ee1.1', '1.1111.1'] },
];
const LEVELS = CLASSIC.map((rows, i) => ({ name: NAMES[i], rows })).concat(EXTRA);

/* ---------- save ---------- */
let save = { unlocked: 1, best: {}, lastLevel: 1 };
try { Object.assign(save, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) {}
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) {} };

/* ---------- sound (synthesised, no audio files) ---------- */
const sfx = (() => {
  let ac = null, muted = !!save.muted, lastWall = 0;
  const ctxOf = () => {
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  };
  function tone(f, d, type, v, slide, delay) {
    if (muted) return;
    const a = ctxOf(); if (!a) return;
    const t = a.currentTime + (delay || 0), o = a.createOscillator(), g = a.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
    g.gain.setValueAtTime(v || 0.1, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + d + 0.02);
  }
  const seq = (notes, type, v, gap) => notes.forEach((f, i) => tone(f, 0.16, type, v, 0, i * gap));
  return {
    get muted() { return muted; },
    setMuted(m) { muted = m; save.muted = m; persist(); },
    unlock() { if (!muted) ctxOf(); },
    launch: () => tone(440, 0.07, 'triangle', 0.1, 120),
    paddle: () => tone(220, 0.08, 'triangle', 0.16, -40),
    wall() { const n = performance.now(); if (n - lastWall > 60) { lastWall = n; tone(330, 0.04, 'sine', 0.05); } },
    hit: hp => tone(420 + hp * 70, 0.06, 'square', 0.05),
    pop: () => tone(620 + Math.random() * 160, 0.1, 'square', 0.06, -260),
    boom: () => { tone(110, 0.3, 'sawtooth', 0.12, -70); tone(70, 0.35, 'square', 0.08, -30); },
    laser: () => tone(900, 0.07, 'square', 0.03, -520),
    power: () => seq([523, 784, 1047], 'triangle', 0.09, 0.07),
    lost: () => tone(300, 0.4, 'sawtooth', 0.1, -230),
    win: () => seq([523, 659, 784, 1047], 'triangle', 0.1, 0.1),
    over: () => seq([392, 330, 262], 'sawtooth', 0.07, 0.16),
  };
})();
const totals = () => { const v = Object.values(save.best); return { best: Math.max(0, ...v), total: v.reduce((a, b) => a + b, 0) }; };

/* ---------- world ---------- */
const W = 400, BH = 20, GAP = 4, MX = 10, TOP = 40;
const PH = 10, BR = 7;
let H = 600, PY = H - 40; // world height adapts to the screen (see resize)
const PW = 84, PW_WIDE = 132, DROP_CHANCE = 0.2, MAX_LIVES = 5, MAX_BALLS = 6;
const POWERS = {
  W: { name: 'Wide', timed: 12 },
  S: { name: 'Slow', timed: 10 },
  Z: { name: 'Laser', timed: 10 },
  T: { name: 'Sticky', timed: 12 },
  F: { name: 'Fire', timed: 8 },
  M: { name: 'Multi' },
  L: { name: 'Life' },
};
const POWER_KEYS = 'WWSSMMLZTF';
const FX_KEYS = ['W', 'S', 'Z', 'T', 'F'];
const freshFx = () => ({ W: 0, S: 0, Z: 0, T: 0, F: 0 });
const cv = $('c'), ctx = cv.getContext('2d');
let scale = 1, ox = 0, oy = 0, dpr = 1;
function resize() {
  dpr = window.devicePixelRatio || 1;
  const r = cv.getBoundingClientRect();
  if (!r.width || !r.height) return;
  cv.width = r.width * dpr; cv.height = r.height * dpr;
  // keep width fixed and stretch the world height to the screen shape, within sane limits
  H = Math.max(480, Math.min(800, Math.round(r.height * W / r.width)));
  scale = Math.min(r.width / W, r.height / H);
  ox = (r.width - W * scale) / 2; oy = (r.height - H * scale) / 2;
  PY = H - 40;
  for (const b of balls) if (!b.stuck) b.y = Math.min(b.y, PY - 20);
  for (const d of drops) d.y = Math.min(d.y, PY - 30);
}
new ResizeObserver(resize).observe(cv);

let level = 1, score = 0, lives = 3, bricks = [], state = 'menu';
let paddle = { x: W / 2, w: PW }, balls = [];
let drops = [], bullets = [], laserCd = 0, fx = freshFx();
let particles = [], keys = {}, shake = 0, cur = LEVELS[0], T = 0;

const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

function load(n) {
  level = n; save.lastLevel = n; persist();
  bricks = []; cur = LEVELS[n - 1]; T = 0;
  const cols = cur.cols || 8, bw = (W - 2 * MX - (cols - 1) * GAP) / cols;
  cur.rows.forEach((row, r) => [...row].forEach((ch, c) => {
    if (ch === '.') return;
    const solid = ch === '#', boom = ch === 'e', hp = solid ? 99 : boom ? 1 : +ch, x = MX + c * (bw + GAP);
    bricks.push({ x, x0: x, y: TOP + r * (BH + GAP), row: r, w: bw, hp, max: hp, solid, boom });
  }));
  score = 0; lives = 3; paddle.x = W / 2; paddle.w = PW; particles = []; drops = []; bullets = []; fx = freshFx();
  resetBall(); hud(); show(null); state = 'ready';
  $('hint').innerHTML = '<b>' + cur.name + '</b>Tap or press space to launch'; $('hint').classList.remove('hide');
}
const newBall = () => ({ x: paddle.x, y: PY - BR - 1, vx: 0, vy: 0, stuck: true });
function resetBall() { balls = [newBall()]; fx = freshFx(); }
function launch() {
  if (balls.some(b => b.stuck)) sfx.launch();
  if (state === 'ready') { state = 'play'; $('hint').classList.add('hide'); }
  for (const b of balls) {
    if (!b.stuck) continue;
    const sp = speed();
    // a ball caught by the sticky paddle leaves at the angle of where it landed
    const t = b.off === undefined ? 0 : Math.max(-1, Math.min(1, b.off / (paddle.w / 2)));
    const a = (b.off === undefined ? -90 + (Math.random() * 30 - 15) : -90 + t * 62) * Math.PI / 180;
    b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp; b.stuck = false; delete b.off;
  }
}
const speed = () => (330 + level * 12) * (fx.S > 0 ? 0.75 : 1);

function hud() {
  $('hLevel').textContent = level; $('hScore').textContent = score;
  $('hLives').textContent = '•'.repeat(Math.max(lives, 0)) || '–';
}
function show(id) {
  if (id) $('hint').classList.add('hide');
  for (const s of document.querySelectorAll('.screen')) s.classList.toggle('show', s.id === id);
}
function burst(x, y, n, col) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.28, s = 40 + Math.random() * 140;
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, col });
  }
}

/* ---------- power-ups ---------- */
function applyPower(t) {
  sfx.power();
  if (POWERS[t].timed) fx[t] = POWERS[t].timed;
  else if (t === 'L') { lives = Math.min(MAX_LIVES, lives + 1); hud(); }
  else if (t === 'M') {
    const src = balls.filter(b => !b.stuck);
    for (const b of src) for (const rot of [-0.35, 0.35]) {
      if (balls.length >= MAX_BALLS) break;
      const c = Math.cos(rot), s = Math.sin(rot);
      balls.push({ x: b.x, y: b.y, vx: b.vx * c - b.vy * s, vy: b.vx * s + b.vy * c, stuck: false });
    }
  }
  score += 50; hud();
}

/* ---------- update ---------- */
function step(dt) {
  T += dt;
  if (cur.slide) for (const b of bricks) {
    if (!b.solid && cur.slide.rows.includes(b.row)) {
      b.x = Math.max(MX, Math.min(W - MX - b.w, b.x0 + Math.sin(T * cur.slide.speed + b.row * Math.PI) * cur.slide.amp));
    }
  }
  if (cur.descend && state === 'play') {
    for (const b of bricks) b.y += cur.descend * dt;
    if (bricks.some(b => b.hp > 0 && b.y + BH >= PY - 20)) { lives = 0; hud(); return lose(); }
  }
  const k = (keys.ArrowRight || keys.d ? 1 : 0) - (keys.ArrowLeft || keys.a ? 1 : 0);
  if (k) paddle.x += k * 460 * dt;
  const wasSticky = fx.T > 0;
  for (const t of FX_KEYS) fx[t] = Math.max(0, fx[t] - dt);
  if (wasSticky && fx.T <= 0 && state === 'play') launch(); // let go of anything still held
  paddle.w += ((fx.W > 0 ? PW_WIDE : PW) - paddle.w) * Math.min(1, dt * 10);
  paddle.x = Math.max(paddle.w / 2, Math.min(W - paddle.w / 2, paddle.x));

  // falling capsules
  for (const d of drops) {
    d.y += 120 * dt;
    if (!d.done && d.y + 9 >= PY && d.y - 9 <= PY + PH && Math.abs(d.x - paddle.x) <= paddle.w / 2 + 14) {
      d.done = true; applyPower(d.t); burst(d.x, d.y, 10, css('--accent'));
    }
  }
  drops = drops.filter(d => !d.done && d.y < H + 20);

  // laser bolts
  if (fx.Z > 0 && state === 'play') {
    laserCd -= dt;
    if (laserCd <= 0) {
      laserCd = 0.35; sfx.laser();
      for (const side of [-1, 1]) bullets.push({ x: paddle.x + side * (paddle.w / 2 - 8), y: PY });
    }
  }
  for (const bl of bullets) {
    bl.y -= 540 * dt;
    for (const b of bricks) {
      if (b.hp <= 0 || bl.x < b.x || bl.x > b.x + b.w || bl.y > b.y + BH || bl.y < b.y) continue;
      bl.dead = true;
      if (!b.solid) hitBrick(b, 1);
      break;
    }
  }
  bullets = bullets.filter(bl => !bl.dead && bl.y > -10);

  const target = speed();
  for (const ball of balls) {
    if (ball.stuck) { ball.x = paddle.x + (ball.off || 0); ball.y = PY - BR - 1; continue; }
    const cur = Math.hypot(ball.vx, ball.vy);
    if (Math.abs(cur - target) > 1) { const f = 1 + (target / cur - 1) * Math.min(1, dt * 8); ball.vx *= f; ball.vy *= f; }
    stepBall(ball, dt);
  }
  balls = balls.filter(b => b.y - BR <= H);
  if (!bricks.some(b => !b.solid && b.hp > 0)) return win();
  if (!balls.length) {
    lives--; shake = 6; hud(); sfx.lost();
    if (lives <= 0) return lose();
    resetBall();
  }
}

function hitBrick(b, dmg) {
  b.hp -= dmg; score += 10 * b.max; shake = 2;
  if (b.hp <= 0) {
    burst(b.x + b.w / 2, b.y + BH / 2, 8, css('--fg'));
    if (b.boom) explode(b); else sfx.pop();
    if (Math.random() < DROP_CHANCE) drops.push({ x: b.x + b.w / 2, y: b.y + BH / 2, t: POWER_KEYS[Math.floor(Math.random() * POWER_KEYS.length)] });
  } else sfx.hit(b.hp);
  hud();
}
function explode(b) {
  const cx = b.x + b.w / 2, cy = b.y + BH / 2, R = (b.w + GAP) * 1.6;
  shake = 8; sfx.boom(); burst(cx, cy, 24, css('--accent'));
  for (const n of bricks) {
    if (n === b || n.hp <= 0 || n.solid) continue;
    const dx = n.x + n.w / 2 - cx, dy = n.y + BH / 2 - cy;
    if (dx * dx + dy * dy <= R * R) hitBrick(n, n.hp);
  }
}

function stepBall(ball, dt) {
  const n = Math.ceil(Math.hypot(ball.vx, ball.vy) * dt / 4);
  for (let i = 0; i < n; i++) {
    ball.x += ball.vx * dt / n; ball.y += ball.vy * dt / n;
    if (ball.x < BR) { ball.x = BR; ball.vx = Math.abs(ball.vx); sfx.wall(); }
    if (ball.x > W - BR) { ball.x = W - BR; ball.vx = -Math.abs(ball.vx); sfx.wall(); }
    if (ball.y < BR) { ball.y = BR; ball.vy = Math.abs(ball.vy); sfx.wall(); }

    // paddle
    if (ball.vy > 0 && ball.y + BR >= PY && ball.y + BR <= PY + PH + 6 &&
        Math.abs(ball.x - paddle.x) <= paddle.w / 2 + BR) {
      const t = Math.max(-1, Math.min(1, (ball.x - paddle.x) / (paddle.w / 2)));
      const a = (-90 + t * 62) * Math.PI / 180, sp = speed();
      ball.vx = Math.cos(a) * sp; ball.vy = Math.sin(a) * sp; ball.y = PY - BR; sfx.paddle();
      if (fx.T > 0) { // sticky: hold the ball where it landed
        ball.stuck = true; ball.off = ball.x - paddle.x; ball.vx = ball.vy = 0; ball.y = PY - BR - 1;
        return;
      }
    }
    // bricks
    for (const b of bricks) {
      if (b.hp <= 0) continue;
      const cx = Math.max(b.x, Math.min(ball.x, b.x + b.w)), cy = Math.max(b.y, Math.min(ball.y, b.y + BH));
      const dx = ball.x - cx, dy = ball.y - cy;
      if (dx * dx + dy * dy > BR * BR) continue;
      if (fx.F > 0 && !b.solid) { hitBrick(b, b.hp); continue; } // fireball: smash straight through
      if (Math.abs(dx) > Math.abs(dy)) { ball.vx = dx > 0 ? Math.abs(ball.vx) : -Math.abs(ball.vx); ball.x += dx > 0 ? 1 : -1; }
      else { ball.vy = dy > 0 ? Math.abs(ball.vy) : -Math.abs(ball.vy); ball.y += dy > 0 ? 1 : -1; }
      if (!b.solid) hitBrick(b, 1);
      break;
    }
  }
}

function end(title, sub, btn) {
  state = 'over';
  $('oTitle').textContent = title; $('oScore').textContent = score; $('oSub').textContent = sub;
  $('btnNext').textContent = btn; show('overlay');
}
function win() {
  sfx.win();
  score += lives * 100;
  const prev = save.best[level] || 0;
  if (score > prev) save.best[level] = score;
  if (level < LEVELS.length) save.unlocked = Math.max(save.unlocked, level + 1);
  persist(); hud();
  const last = level === LEVELS.length;
  end(last ? 'Complete' : 'Cleared', score > prev ? 'New best' : 'Best ' + prev, last ? 'Replay' : 'Next level');
  $('btnNext').dataset.go = last ? level : level + 1;
}
function lose() {
  sfx.over();
  end('Game over', 'Level ' + level, 'Retry');
  $('btnNext').dataset.go = level;
}

/* ---------- render ---------- */
function draw() {
  const fg = css('--fg'), dim = css('--dim'), line = css('--line'), ac = css('--accent'), bg = css('--bg');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cv.width, cv.height);
  const sx = shake ? (Math.random() - .5) * shake : 0, sy = shake ? (Math.random() - .5) * shake : 0;
  ctx.translate(ox + sx, oy + sy); ctx.scale(scale, scale);

  if (cur.descend) { // the line the bricks must not cross
    ctx.strokeStyle = ac; ctx.globalAlpha = 0.35; ctx.lineWidth = 1; ctx.setLineDash([4, 6]);
    ctx.beginPath(); ctx.moveTo(0, PY - 20); ctx.lineTo(W, PY - 20); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
  }
  for (const b of bricks) {
    if (b.hp <= 0) continue;
    ctx.fillStyle = b.solid ? line : b.boom ? ac : fg;
    ctx.globalAlpha = b.solid || b.boom ? 1 : Math.min(1, 0.28 + 0.72 * (b.hp / 3));
    rr(b.x, b.y, b.w, BH, 4); ctx.fill();
    if (b.solid) { ctx.strokeStyle = dim; ctx.globalAlpha = .6; ctx.lineWidth = 1; ctx.stroke(); }
  }
  ctx.globalAlpha = 1;
  for (const p of particles) { ctx.globalAlpha = Math.max(p.life, 0); ctx.fillStyle = p.col; ctx.fillRect(p.x, p.y, 2.5, 2.5); }
  ctx.globalAlpha = 1;

  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const d of drops) {
    ctx.fillStyle = ac; rr(d.x - 14, d.y - 9, 28, 18, 9); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '600 11px "Helvetica Neue",system-ui,sans-serif'; ctx.fillText(d.t, d.x, d.y + 1);
  }
  ctx.fillStyle = ac;
  for (const bl of bullets) { rr(bl.x - 1.5, bl.y - 6, 3, 12, 1.5); ctx.fill(); }
  ctx.fillStyle = fg; rr(paddle.x - paddle.w / 2, PY, paddle.w, PH, 5); ctx.fill();
  ctx.fillStyle = ac;
  if (fx.T > 0) { rr(paddle.x - paddle.w / 2 + 6, PY, paddle.w - 12, 3, 1.5); ctx.fill(); }
  if (fx.Z > 0) for (const side of [-1, 1]) { rr(paddle.x + side * (paddle.w / 2 - 8) - 2, PY - 4, 4, 6, 1); ctx.fill(); }
  if (fx.F > 0) { ctx.shadowColor = ac; ctx.shadowBlur = 16; }
  for (const ball of balls) { ctx.beginPath(); ctx.arc(ball.x, ball.y, BR, 0, 6.283); ctx.fill(); }
  ctx.shadowBlur = 0;

  // active effects
  ctx.textAlign = 'left'; ctx.fillStyle = dim; ctx.font = '600 10px "Helvetica Neue",system-ui,sans-serif';
  let ty = H - 10;
  for (const t of FX_KEYS) if (fx[t] > 0) { ctx.fillText((POWERS[t].name + ' ' + Math.ceil(fx[t]) + 's').toUpperCase(), 6, ty); ty -= 14; }
}
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }

let last = 0;
function frame(t) {
  const dt = Math.min((t - last) / 1000 || 0, 0.033); last = t;
  if (state === 'play' || state === 'ready') step(dt);
  for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * 1.8; }
  particles = particles.filter(p => p.life > 0);
  shake = Math.max(0, shake - dt * 30);
  draw(); requestAnimationFrame(frame);
}

/* ---------- input ---------- */
function movePointer(e) {
  const r = cv.getBoundingClientRect();
  paddle.x = ((e.clientX - r.left) - ox) / scale;
}
cv.addEventListener('pointermove', movePointer);
cv.addEventListener('pointerdown', e => { movePointer(e); if (state === 'ready' || state === 'play') launch(); });
addEventListener('keydown', e => {
  keys[e.key] = true;
  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (state === 'ready' || state === 'play') launch(); else if (state === 'paused') pause(); }
  if (e.key === 'p' || e.key === 'Escape') pause();
  if (e.key === 'm') toggleMute();
});
addEventListener('keyup', e => { keys[e.key] = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') pause(); });

function pause() {
  if (state === 'play') { state = 'paused'; $('btnPause').textContent = '▶'; }
  else if (state === 'paused') { state = 'play'; $('btnPause').textContent = 'II'; }
}
$('btnPause').onclick = pause;
function toggleMute() {
  sfx.setMuted(!sfx.muted); paintMute();
  if (!sfx.muted) sfx.launch();
}
function paintMute() {
  $('btnMute').classList.toggle('off', sfx.muted);
  $('btnMute').setAttribute('aria-pressed', String(sfx.muted));
}
$('btnMute').onclick = toggleMute;
addEventListener('pointerdown', () => sfx.unlock());

function menu() {
  state = 'menu'; const t = totals();
  $('mBest').textContent = t.best; $('mTotal').textContent = t.total;
  $('btnPlay').textContent = save.best[1] || save.unlocked > 1 ? 'Continue' : 'Play';
  show('menu');
}
function levels() {
  const g = $('grid'); g.innerHTML = '';
  LEVELS.forEach((_, i) => {
    const n = i + 1, b = document.createElement('button');
    b.innerHTML = n + '<small>' + (save.best[n] || '—') + '</small>';
    b.disabled = n > save.unlocked; if (n === save.unlocked) b.className = 'cur';
    b.onclick = () => load(n); g.appendChild(b);
  });
  show('levels');
}
$('btnPlay').onclick = () => load(Math.min(save.unlocked, LEVELS.length));
$('btnLevels').onclick = levels;
$('btnBack').onclick = menu;
$('btnMenu').onclick = menu;
$('btnNext').onclick = () => load(+$('btnNext').dataset.go);

paintMute(); resize(); menu(); requestAnimationFrame(frame);
})();
