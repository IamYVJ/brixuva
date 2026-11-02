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
const LEVELS = [
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

/* ---------- save ---------- */
let save = { unlocked: 1, best: {}, lastLevel: 1 };
try { Object.assign(save, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) {}
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) {} };
const totals = () => { const v = Object.values(save.best); return { best: Math.max(0, ...v), total: v.reduce((a, b) => a + b, 0) }; };

/* ---------- world ---------- */
const W = 400, H = 600, COLS = 8, BW = 44, BH = 20, GAP = 4, MX = 10, TOP = 40;
const PY = H - 40, PH = 10, BR = 7;
const PW = 84, PW_WIDE = 132, DROP_CHANCE = 0.2, MAX_LIVES = 5, MAX_BALLS = 6;
const POWERS = {
  W: { name: 'Wide', timed: 12 },
  S: { name: 'Slow', timed: 10 },
  M: { name: 'Multi' },
  L: { name: 'Life' },
};
const POWER_KEYS = 'WWSSMML';
const cv = $('c'), ctx = cv.getContext('2d');
let scale = 1, ox = 0, oy = 0, dpr = 1;
function resize() {
  dpr = window.devicePixelRatio || 1;
  const r = cv.getBoundingClientRect();
  cv.width = r.width * dpr; cv.height = r.height * dpr;
  scale = Math.min(r.width / W, r.height / H);
  ox = (r.width - W * scale) / 2; oy = (r.height - H * scale) / 2;
}
addEventListener('resize', resize);

let level = 1, score = 0, lives = 3, bricks = [], state = 'menu';
let paddle = { x: W / 2, w: PW }, balls = [];
let drops = [], fx = { W: 0, S: 0 };
let particles = [], keys = {}, shake = 0;

const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

function load(n) {
  level = n; save.lastLevel = n; persist();
  bricks = [];
  LEVELS[n - 1].forEach((row, r) => [...row].forEach((ch, c) => {
    if (ch === '.') return;
    const solid = ch === '#';
    bricks.push({ x: MX + c * (BW + GAP), y: TOP + r * (BH + GAP), hp: solid ? 99 : +ch, max: solid ? 99 : +ch, solid });
  }));
  score = 0; lives = 3; paddle.x = W / 2; paddle.w = PW; particles = []; drops = []; fx = { W: 0, S: 0 };
  resetBall(); hud(); show(null); state = 'ready'; $('hint').classList.remove('hide');
}
const newBall = () => ({ x: paddle.x, y: PY - BR - 1, vx: 0, vy: 0, stuck: true });
function resetBall() { balls = [newBall()]; fx = { W: 0, S: 0 }; }
function launch() {
  if (state === 'ready') { state = 'play'; $('hint').classList.add('hide'); }
  for (const b of balls) {
    if (!b.stuck) continue;
    const sp = speed(), a = (-90 + (Math.random() * 30 - 15)) * Math.PI / 180;
    b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp; b.stuck = false;
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
  if (t === 'W') fx.W = POWERS.W.timed;
  else if (t === 'S') fx.S = POWERS.S.timed;
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
  const k = (keys.ArrowRight || keys.d ? 1 : 0) - (keys.ArrowLeft || keys.a ? 1 : 0);
  if (k) paddle.x += k * 460 * dt;
  for (const t of ['W', 'S']) fx[t] = Math.max(0, fx[t] - dt);
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

  const target = speed();
  for (const ball of balls) {
    if (ball.stuck) { ball.x = paddle.x; ball.y = PY - BR - 1; continue; }
    const cur = Math.hypot(ball.vx, ball.vy);
    if (Math.abs(cur - target) > 1) { const f = 1 + (target / cur - 1) * Math.min(1, dt * 8); ball.vx *= f; ball.vy *= f; }
    stepBall(ball, dt);
  }
  balls = balls.filter(b => b.y - BR <= H);
  if (!bricks.some(b => !b.solid && b.hp > 0)) return win();
  if (!balls.length) {
    lives--; shake = 6; hud();
    if (lives <= 0) return lose();
    resetBall();
  }
}

function stepBall(ball, dt) {
  const n = Math.ceil(Math.hypot(ball.vx, ball.vy) * dt / 4);
  for (let i = 0; i < n; i++) {
    ball.x += ball.vx * dt / n; ball.y += ball.vy * dt / n;
    if (ball.x < BR) { ball.x = BR; ball.vx = Math.abs(ball.vx); }
    if (ball.x > W - BR) { ball.x = W - BR; ball.vx = -Math.abs(ball.vx); }
    if (ball.y < BR) { ball.y = BR; ball.vy = Math.abs(ball.vy); }

    // paddle
    if (ball.vy > 0 && ball.y + BR >= PY && ball.y + BR <= PY + PH + 6 &&
        Math.abs(ball.x - paddle.x) <= paddle.w / 2 + BR) {
      const t = Math.max(-1, Math.min(1, (ball.x - paddle.x) / (paddle.w / 2)));
      const a = (-90 + t * 62) * Math.PI / 180, sp = speed();
      ball.vx = Math.cos(a) * sp; ball.vy = Math.sin(a) * sp; ball.y = PY - BR;
    }
    // bricks
    for (const b of bricks) {
      if (b.hp <= 0) continue;
      const cx = Math.max(b.x, Math.min(ball.x, b.x + BW)), cy = Math.max(b.y, Math.min(ball.y, b.y + BH));
      const dx = ball.x - cx, dy = ball.y - cy;
      if (dx * dx + dy * dy > BR * BR) continue;
      if (Math.abs(dx) > Math.abs(dy)) { ball.vx = dx > 0 ? Math.abs(ball.vx) : -Math.abs(ball.vx); ball.x += dx > 0 ? 1 : -1; }
      else { ball.vy = dy > 0 ? Math.abs(ball.vy) : -Math.abs(ball.vy); ball.y += dy > 0 ? 1 : -1; }
      if (!b.solid) {
        b.hp--; score += 10 * b.max; shake = 2;
        if (b.hp <= 0) {
          burst(b.x + BW / 2, b.y + BH / 2, 8, css('--fg'));
          if (Math.random() < DROP_CHANCE) drops.push({ x: b.x + BW / 2, y: b.y + BH / 2, t: POWER_KEYS[Math.floor(Math.random() * POWER_KEYS.length)] });
        }
        hud();
      }
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

  for (const b of bricks) {
    if (b.hp <= 0) continue;
    ctx.fillStyle = b.solid ? line : fg;
    ctx.globalAlpha = b.solid ? 1 : Math.min(1, 0.28 + 0.72 * (b.hp / 3));
    rr(b.x, b.y, BW, BH, 4); ctx.fill();
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
  ctx.fillStyle = fg; rr(paddle.x - paddle.w / 2, PY, paddle.w, PH, 5); ctx.fill();
  ctx.fillStyle = ac;
  for (const ball of balls) { ctx.beginPath(); ctx.arc(ball.x, ball.y, BR, 0, 6.283); ctx.fill(); }

  // active effects
  ctx.textAlign = 'left'; ctx.fillStyle = dim; ctx.font = '600 10px "Helvetica Neue",system-ui,sans-serif';
  let ty = H - 10;
  for (const t of ['W', 'S']) if (fx[t] > 0) { ctx.fillText((POWERS[t].name + ' ' + Math.ceil(fx[t]) + 's').toUpperCase(), 6, ty); ty -= 14; }
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
});
addEventListener('keyup', e => { keys[e.key] = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') pause(); });

function pause() {
  if (state === 'play') { state = 'paused'; $('btnPause').textContent = '▶'; }
  else if (state === 'paused') { state = 'play'; $('btnPause').textContent = 'II'; }
}
$('btnPause').onclick = pause;

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

resize(); menu(); requestAnimationFrame(frame);
})();
