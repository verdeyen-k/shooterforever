// Shooter Forever: build your own gun in the Workshop, then fight waves of animals that never stop.
// Enemies drop electrocoins, and electrocoins buy gun parts.
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const show = id => { for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id; };
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];

  // ---------- Gun parts ----------
  const MAGS = [
    { n: 'Small', i: '🔹', size: 8, cost: 0, about: 'Holds 8 bullets' },
    { n: 'Medium', i: '🔷', size: 15, cost: 25, about: 'Holds 15 bullets' },
    { n: 'Big', i: '🟦', size: 25, cost: 60, about: 'Holds 25 bullets' },
    { n: 'Huge', i: '📦', size: 40, cost: 120, about: 'Holds 40 bullets' },
    { n: 'Mega drum', i: '🥁', size: 70, cost: 250, about: 'Holds 70 bullets!' },
  ];
  // A longer barrel shoots harder and faster bullets, but you can't shoot as quickly.
  const BARRELS = [
    { n: 'Stubby', i: '🔫', len: 16, cost: 0, speed: 620, dmg: 1, wait: 0.15, spread: 0.13, about: 'Shoots fast, wobbly aim' },
    { n: 'Normal', i: '📏', len: 30, cost: 30, speed: 820, dmg: 1.4, wait: 0.2, spread: 0.06, about: 'Good at everything' },
    { n: 'Long', i: '🎯', len: 48, cost: 90, speed: 1050, dmg: 2, wait: 0.3, spread: 0.025, about: 'Hits hard, shoots slower' },
    { n: 'Super long', i: '🚀', len: 72, cost: 200, speed: 1350, dmg: 3, wait: 0.42, spread: 0.01, about: 'Huge hits, very slow' },
  ];
  const SCOPES = [
    { n: 'No scope', i: '👁️', cost: 0, about: 'Just your eyes' },
    { n: 'Scope', i: '🔭', cost: 70, about: 'See further, aim line, steadier aim' },
  ];
  // The board only has plain bullets. Your gun turns them into these.
  const BULLETS = [
    { id: 'regular', n: 'Regular', i: '🟡', cost: 0, col: '#facc15', about: 'Plain old bullets' },
    { id: 'bouncy', n: 'Bouncy', i: '🟢', cost: 40, col: '#4ade80', about: 'Bounce off walls 3 times' },
    { id: 'fire', n: 'Fire', i: '🔥', cost: 70, col: '#fb923c', about: 'Set enemies on fire' },
    { id: 'freeze', n: 'Freeze', i: '🧊', cost: 90, col: '#7dd3fc', about: 'Make enemies slow' },
    { id: 'electric', n: 'Electric', i: '⚡', cost: 130, col: '#22d3ee', about: 'Zap jumps to 2 more enemies' },
    { id: 'explosive', n: 'Explosive', i: '💥', cost: 180, col: '#f87171', about: 'Boom! Hurts everything nearby' },
  ];
  const BULLET = Object.fromEntries(BULLETS.map(b => [b.id, b]));

  // ---------- Saving ----------
  const SAVE = 'shooterforever-save';
  const fresh = () => ({ coins: 0, best: 0, own: { mag: [0], barrel: [0], scope: [0], bullet: ['regular'] },
    gun: { mag: 0, barrel: 0, scope: 0, bullet: 'regular' } });
  let save = fresh();
  try { const s = JSON.parse(localStorage.getItem(SAVE)); if (s && s.own && s.gun) save = Object.assign(fresh(), s); } catch (e) { /* start fresh */ }
  const store = () => { try { localStorage.setItem(SAVE, JSON.stringify(save)); } catch (e) { /* private window: don't save */ } };
  function showCoins() { for (const e of document.querySelectorAll('.coin-count')) e.textContent = save.coins; }

  // ---------- Sound ----------
  let ac = null;
  function tone(f, len, type = 'square', vol = 0.06, slide = 0) {
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t + len);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + len);
    } catch (e) { /* no sound */ }
  }
  const sfx = {
    shoot: () => tone(rand(500, 600), 0.07, 'square', 0.04, 0.4),
    hit: () => tone(220, 0.06, 'triangle', 0.05),
    coin: () => { tone(988, 0.06, 'square', 0.035); setTimeout(() => tone(1319, 0.08, 'square', 0.035), 50); },
    hurt: () => tone(160, 0.18, 'sawtooth', 0.07, 0.5),
    boom: () => tone(120, 0.35, 'sawtooth', 0.08, 0.3),
    laser: () => tone(900, 0.3, 'sawtooth', 0.04, 0.3),
    reload: () => { tone(300, 0.05, 'square', 0.03); setTimeout(() => tone(450, 0.05, 'square', 0.03), 120); },
    poof: () => tone(400, 0.15, 'triangle', 0.06, 2),
    wave: () => { tone(523, 0.1, 'triangle', 0.07); setTimeout(() => tone(784, 0.15, 'triangle', 0.07), 110); },
    zap: () => tone(1500, 0.08, 'sawtooth', 0.03, 0.3),
  };

  // ---------- Drawing a gun ----------
  // Drawn pointing right with the handle at (0,0). Used for the Workshop picture and in the game.
  function drawGun(c, g) {
    const bar = BARRELS[g.barrel], mag = g.mag, bl = BULLET[g.bullet];
    const bodyL = 26, len = bar.len;
    // Magazine: bigger ones hang down further.
    const mh = 8 + mag * 4, mw = 8 + Math.min(mag, 3) * 2;
    c.fillStyle = '#334155'; c.strokeStyle = '#0f172a'; c.lineWidth = 1.5;
    if (mag === 4) { c.beginPath(); c.arc(10, 10, 11, 0, 7); c.fill(); c.stroke(); c.fillStyle = '#64748b'; c.beginPath(); c.arc(10, 10, 5, 0, 7); c.fill(); }
    else { c.fillRect(6, 2, mw, mh); c.strokeRect(6, 2, mw, mh); }
    // Handle
    c.fillStyle = '#7c4a1e'; c.beginPath(); c.moveTo(-6, 0); c.lineTo(2, 0); c.lineTo(-2, 14); c.lineTo(-10, 14); c.closePath(); c.fill(); c.stroke();
    // Body
    c.fillStyle = '#475569'; c.fillRect(-8, -7, bodyL, 10); c.strokeRect(-8, -7, bodyL, 10);
    // Barrel
    c.fillStyle = '#94a3b8'; c.fillRect(bodyL - 8, -5, len, 6); c.strokeRect(bodyL - 8, -5, len, 6);
    c.fillStyle = '#1e293b'; c.fillRect(bodyL - 8 + len - 3, -6, 4, 8);
    // Glowing stripe in the colour of the bullets it shoots.
    c.fillStyle = bl.col; c.fillRect(-4, -4, bodyL - 6, 3);
    // Scope on top
    if (g.scope) {
      c.fillStyle = '#0f172a'; c.fillRect(0, -15, 22, 7);
      c.fillStyle = '#38bdf8'; c.beginPath(); c.arc(22, -11.5, 3.5, 0, 7); c.fill();
      c.fillStyle = '#0f172a'; c.fillRect(6, -9, 3, 3); c.fillRect(14, -9, 3, 3);
    }
  }
  const muzzle = g => 18 + BARRELS[g.barrel].len;

  // ---------- Drawing the animals ----------
  // Each is drawn facing right, centred on (0,0), about r big.
  function drawDuck(c, r, t, charge) {
    c.fillStyle = '#facc15'; c.strokeStyle = '#a16207'; c.lineWidth = 2;
    c.beginPath(); c.ellipse(0, 4, r, r * 0.8, 0, 0, 7); c.fill(); c.stroke();
    c.beginPath(); c.arc(r * 0.45, -r * 0.55, r * 0.55, 0, 7); c.fill(); c.stroke();
    c.fillStyle = '#fde68a'; c.beginPath(); c.ellipse(-r * 0.2, 6, r * 0.5, r * 0.3, -0.3 + Math.sin(t * 10) * 0.15, 0, 7); c.fill();
    c.fillStyle = '#f97316'; c.beginPath(); c.moveTo(r * 0.85, -r * 0.6); c.lineTo(r * 1.45, -r * 0.45); c.lineTo(r * 0.85, -r * 0.3); c.closePath(); c.fill();
    // Lazer goggles
    c.fillStyle = '#111'; c.fillRect(r * 0.2, -r * 0.85, r * 0.65, r * 0.3);
    c.fillStyle = charge > 0 ? `rgba(255,${Math.floor(80 - charge * 80)},80,1)` : '#ef4444';
    c.beginPath(); c.arc(r * 0.6, -r * 0.7, r * 0.12 + charge * 4, 0, 7); c.fill();
  }
  function drawCow(c, r, t) {
    c.fillStyle = '#f8fafc'; c.strokeStyle = '#334155'; c.lineWidth = 2;
    const step = Math.sin(t * 6) * 3;
    c.fillStyle = '#334155';
    for (const lx of [-0.6, -0.25, 0.25, 0.6]) c.fillRect(lx * r - 3, r * 0.4 + (lx > 0 ? step : -step) * 0.4, 6, r * 0.45);
    c.fillStyle = '#f8fafc';
    c.beginPath(); c.ellipse(0, 0, r, r * 0.65, 0, 0, 7); c.fill(); c.stroke();
    c.fillStyle = '#1f2937';
    c.beginPath(); c.ellipse(-r * 0.35, -r * 0.15, r * 0.25, r * 0.18, 0.4, 0, 7); c.fill();
    c.beginPath(); c.ellipse(r * 0.1, r * 0.25, r * 0.2, r * 0.14, -0.2, 0, 7); c.fill();
    // Head
    c.fillStyle = '#f8fafc'; c.beginPath(); c.ellipse(r * 0.95, -r * 0.2, r * 0.38, r * 0.34, 0, 0, 7); c.fill(); c.stroke();
    c.fillStyle = '#f9a8d4'; c.beginPath(); c.ellipse(r * 1.2, -r * 0.1, r * 0.2, r * 0.16, 0, 0, 7); c.fill();
    c.fillStyle = '#111'; c.beginPath(); c.arc(r * 0.95, -r * 0.3, 3, 0, 7); c.fill();
    c.fillStyle = '#fef3c7'; c.beginPath(); c.moveTo(r * 0.8, -r * 0.5); c.lineTo(r * 0.75, -r * 0.75); c.lineTo(r * 0.9, -r * 0.52); c.fill();
    // Cannon on its back
    c.fillStyle = '#1f2937'; c.fillRect(-r * 0.3, -r * 0.95, r * 0.95, r * 0.32);
    c.beginPath(); c.arc(-r * 0.3, -r * 0.79, r * 0.2, 0, 7); c.fill();
  }
  function drawChicken(c, r, t) {
    c.strokeStyle = '#475569'; c.lineWidth = 2;
    // 5 barrels fanned out on its back
    for (let i = 0; i < 5; i++) {
      c.save(); c.rotate(-0.5 + i * 0.25); c.fillStyle = i % 2 ? '#64748b' : '#94a3b8';
      c.fillRect(-r * 0.2, -r * 0.18, r * 1.25, r * 0.22); c.strokeRect(-r * 0.2, -r * 0.18, r * 1.25, r * 0.22); c.restore();
    }
    c.fillStyle = '#ffffff';
    c.beginPath(); c.ellipse(-r * 0.1, r * 0.1, r * 0.85, r * 0.7, 0, 0, 7); c.fill(); c.stroke();
    // Cape, because it's super
    c.fillStyle = '#dc2626'; c.beginPath(); c.moveTo(-r * 0.3, -r * 0.4); c.lineTo(-r * 1.3, -r * 0.1 + Math.sin(t * 9) * 5); c.lineTo(-r * 1.1, r * 0.5 + Math.sin(t * 9 + 1) * 5); c.lineTo(-r * 0.3, r * 0.2); c.fill();
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(r * 0.45, -r * 0.45, r * 0.42, 0, 7); c.fill(); c.stroke();
    c.fillStyle = '#ef4444'; for (const k of [0, 1, 2]) { c.beginPath(); c.arc(r * (0.3 + k * 0.14), -r * 0.88, r * 0.12, 0, 7); c.fill(); }
    c.fillStyle = '#f59e0b'; c.beginPath(); c.moveTo(r * 0.82, -r * 0.5); c.lineTo(r * 1.15, -r * 0.4); c.lineTo(r * 0.82, -r * 0.3); c.fill();
    c.fillStyle = '#111'; c.beginPath(); c.arc(r * 0.55, -r * 0.55, 3, 0, 7); c.fill();
    c.fillStyle = '#2563eb'; c.font = `bold ${Math.round(r * 0.5)}px Fredoka, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('S', -r * 0.1, r * 0.15);
  }
  const DRAW = { duck: drawDuck, cow: drawCow, chicken: drawChicken };

  for (const cv of document.querySelectorAll('[data-enemy]')) {
    const c = cv.getContext('2d'); c.translate(cv.width / 2 - 8, cv.height / 2 + 8);
    DRAW[cv.dataset.enemy](c, 38, 0.3, 0);
  }

  // ---------- Workshop ----------
  const PARTS = [
    { key: 'mag', title: '🧰 Ammo', sub: 'how many bullets before you reload', list: MAGS },
    { key: 'barrel', title: '📏 Barrel', sub: 'longer hits harder, shorter shoots faster', list: BARRELS },
    { key: 'scope', title: '🔭 Scope', sub: 'see further and aim better', list: SCOPES },
    { key: 'bullet', title: '🎯 Bullets', sub: 'what comes out when you shoot', list: BULLETS },
  ];
  const idOf = (key, o, i) => key === 'bullet' ? o.id : i;
  function openShop() {
    $('parts').innerHTML = PARTS.map(p => `
      <div class="part"><h3>${p.title} <small>${p.sub}</small></h3><div class="opts">
      ${p.list.map((o, i) => {
        const id = idOf(p.key, o, i), owned = save.own[p.key].includes(id), on = save.gun[p.key] === id;
        const price = owned ? (on ? '✅ Using it' : 'Yours') : `⚡ ${o.cost}`;
        return `<button class="opt${owned ? ' owned' : ''}${on ? ' on' : ''}${!owned && save.coins < o.cost ? ' poor' : ''}" data-k="${p.key}" data-id="${id}">
          <span class="i">${o.i}</span><b>${o.n}</b><small>${o.about}</small><span class="price">${price}</span></button>`;
      }).join('')}</div></div>`).join('');
    showCoins();
    show('shop');
    drawPreview();
  }
  $('parts').onclick = e => {
    const b = e.target.closest('[data-k]');
    if (!b) return;
    const key = b.dataset.k, id = key === 'bullet' ? b.dataset.id : +b.dataset.id;
    const part = PARTS.find(p => p.key === key), o = key === 'bullet' ? BULLET[id] : part.list[id];
    if (!save.own[key].includes(id)) {
      if (save.coins < o.cost) { tone(150, 0.15, 'sawtooth', 0.05); flash(`You need ⚡ ${o.cost - save.coins} more electrocoins. Go fight some animals!`); return; }
      save.coins -= o.cost; save.own[key].push(id); sfx.coin();
    }
    save.gun[key] = id; store(); openShop();
  };
  function drawPreview() {
    const cv = $('gun-preview'), r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = r.width * dpr; cv.height = r.height * dpr;
    const c = cv.getContext('2d'), g = save.gun, total = 26 + BARRELS[g.barrel].len + 10;
    const s = Math.min(r.width * 0.8 / total, r.height / 45);
    c.setTransform(dpr * s, 0, 0, dpr * s, dpr * (r.width / 2 - (total / 2 - 8) * s), dpr * r.height * 0.45);
    drawGun(c, g);
    const bar = BARRELS[g.barrel];
    $('gun-stats').innerHTML = [
      `🧰 ${MAGS[g.mag].size} bullets`, `💪 Power ${Math.round(bar.dmg * 10)}`, `⏱️ ${(1 / bar.wait).toFixed(1)} shots a second`,
      g.scope ? '🔭 Scope' : '👁️ No scope', `${BULLET[g.bullet].i} ${BULLET[g.bullet].n} bullets`,
    ].map(t => `<span>${t}</span>`).join('');
  }
  window.addEventListener('resize', () => { if (!$('shop').hidden) drawPreview(); });

  // ---------- The world ----------
  const AW = 1800, AH = 1200;
  const CRATES = [
    [380, 260, 120, 80], [1300, 240, 90, 160], [780, 380, 160, 70], [300, 820, 80, 150], [1180, 820, 180, 80],
    [600, 980, 110, 60], [1500, 620, 70, 120], [180, 520, 70, 70], [1000, 160, 70, 70], [880, 860, 60, 110],
  ].map(([x, y, w, h]) => ({ x, y, w, h }));
  const ENEMY = {
    duck: { r: 22, hp: 30, speed: 115, coins: 3 },
    cow: { r: 30, hp: 95, speed: 52, coins: 6 },
    chicken: { r: 26, hp: 60, speed: 80, coins: 10 },
  };

  let G = null; // the game being played
  function newGame() {
    const gun = { ...save.gun };
    G = {
      gun, bar: BARRELS[gun.barrel], magSize: MAGS[gun.mag].size, bt: BULLET[gun.bullet],
      p: { x: AW / 2, y: AH / 2, r: 18, hp: 100, aim: 0, hurtT: 0, step: 0 },
      mag: MAGS[gun.mag].size, reserve: 60, reloadT: 0, shotT: 0,
      wave: 0, toSpawn: [], spawnT: 0, breakT: 2, coins: 0,
      enemies: [], shots: [], foes: [], boxes: [], drops: [], bits: [], beams: [], texts: [],
      t: 0, over: false, paused: false, cam: { x: AW / 2, y: AH / 2, s: 1 }, boxT: 0,
    };
    for (let i = 0; i < 4; i++) addBox();
    nextWave();
  }

  function freeSpot(r, awayFrom, far) {
    for (let k = 0; k < 60; k++) {
      const x = rand(60, AW - 60), y = rand(60, AH - 60);
      if (CRATES.some(c => x > c.x - r && x < c.x + c.w + r && y > c.y - r && y < c.y + c.h + r)) continue;
      if (awayFrom && Math.hypot(x - awayFrom.x, y - awayFrom.y) < far) continue;
      return { x, y };
    }
    return { x: 80, y: 80 };
  }
  function addBox() { const s = freeSpot(20, G.p, 250); G.boxes.push({ x: s.x, y: s.y, n: 15 + Math.floor(G.magSize / 3) }); }

  function nextWave() {
    G.wave++;
    const w = G.wave, list = [];
    const n = 3 + w * 2;
    for (let i = 0; i < n; i++) {
      const roll = Math.random();
      if (w >= 3 && roll < Math.min(0.3, 0.1 + w * 0.02)) list.push('chicken');
      else if (w >= 2 && roll < 0.55) list.push('cow');
      else list.push('duck');
    }
    if (w % 5 === 0) list.push('chicken', 'chicken'); // every 5th wave, extra chickens!
    G.toSpawn = list; G.spawnT = 1;
    banner(`Wave ${w}!`); sfx.wave();
  }
  function spawn(kind) {
    // Come in from the edge, away from the player.
    let x, y;
    for (let k = 0; k < 20; k++) {
      const side = Math.floor(Math.random() * 4);
      x = side === 0 ? 30 : side === 1 ? AW - 30 : rand(30, AW - 30);
      y = side === 2 ? 30 : side === 3 ? AH - 30 : rand(30, AH - 30);
      if (Math.hypot(x - G.p.x, y - G.p.y) > 500) break;
    }
    const d = ENEMY[kind], hp = Math.round(d.hp * (1 + (G.wave - 1) * 0.12));
    G.enemies.push({ kind, x, y, r: d.r, hp, max: hp, speed: d.speed, face: 1, t: rand(0, 2), fireT: rand(1.5, 3),
      charge: 0, aim: 0, burn: 0, cold: 0, flash: 0, wob: rand(0, 6) });
  }

  // ---------- Controls ----------
  const keys = new Set();
  const mouse = { x: 0, y: 0, down: false };
  const touch = { move: null, aim: null };
  addEventListener('keydown', e => {
    if ($('game').hidden) return;
    const k = e.key.toLowerCase();
    keys.add(k);
    if (k === 'r') reload();
    if (k === 'escape' || k === 'p') togglePause();
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
  });
  addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  addEventListener('blur', () => { keys.clear(); mouse.down = false; });
  const cv = $('cv'), ctx = cv.getContext('2d');
  cv.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse') { mouse.down = e.button === 0; mouse.x = e.clientX; mouse.y = e.clientY; return; }
    document.body.classList.add('touch');
    const r = cv.getBoundingClientRect();
    if (e.clientX - r.left < r.width / 2 && !touch.move) touch.move = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY };
    else if (!touch.aim) touch.aim = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY };
    cv.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  cv.addEventListener('pointermove', e => {
    if (e.pointerType === 'mouse') { mouse.x = e.clientX; mouse.y = e.clientY; return; }
    for (const t of [touch.move, touch.aim]) if (t && t.id === e.pointerId) { t.x = e.clientX; t.y = e.clientY; }
  });
  const up = e => {
    if (e.pointerType === 'mouse') { mouse.down = false; return; }
    if (touch.move && touch.move.id === e.pointerId) touch.move = null;
    if (touch.aim && touch.aim.id === e.pointerId) touch.aim = null;
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  cv.addEventListener('contextmenu', e => e.preventDefault());
  $('reload-btn').addEventListener('pointerdown', e => { e.stopPropagation(); reload(); });

  function reload() {
    if (!G || G.reloadT > 0 || G.mag >= G.magSize) return;
    if (G.reserve <= 0) { flash('No bullets left! Find a bullet box 📦'); return; }
    G.reloadT = 1.1; sfx.reload();
  }

  // ---------- Game loop ----------
  function update(dt) {
    const p = G.p;
    G.t += dt;
    // Moving
    let mx = 0, my = 0;
    if (keys.has('a') || keys.has('arrowleft')) mx--;
    if (keys.has('d') || keys.has('arrowright')) mx++;
    if (keys.has('w') || keys.has('arrowup')) my--;
    if (keys.has('s') || keys.has('arrowdown')) my++;
    if (touch.move) {
      const dx = touch.move.x - touch.move.x0, dy = touch.move.y - touch.move.y0, d = Math.hypot(dx, dy);
      if (d > 8) { mx = dx / Math.max(d, 50); my = dy / Math.max(d, 50); }
    }
    const ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }
    p.x += mx * 240 * dt; p.y += my * 240 * dt;
    if (ml) p.step += dt * 12;
    pushOut(p);

    // Aiming and shooting
    let shooting = mouse.down || keys.has(' ');
    if (touch.aim) {
      const dx = touch.aim.x - touch.aim.x0, dy = touch.aim.y - touch.aim.y0;
      if (Math.hypot(dx, dy) > 10) p.aim = Math.atan2(dy, dx);
      else { const n = nearestEnemy(p.x, p.y, 700); if (n) p.aim = Math.atan2(n.y - p.y, n.x - p.x); }
      shooting = true;
    } else if (!document.body.classList.contains('touch')) {
      const w = toWorld(mouse.x, mouse.y);
      p.aim = Math.atan2(w.y - p.y, w.x - p.x);
    }
    G.shotT -= dt;
    if (G.reloadT > 0) {
      G.reloadT -= dt;
      if (G.reloadT <= 0) { const n = Math.min(G.magSize - G.mag, G.reserve); G.mag += n; G.reserve -= n; G.reloadT = 0; }
    } else if (shooting && G.shotT <= 0) {
      if (G.mag > 0) shoot();
      else if (G.reserve > 0) reload();
      else if (G.shotT <= -1) { flash('No bullets left! Find a bullet box 📦'); G.shotT = 0; }
    }

    // Spawning waves
    if (G.toSpawn.length) {
      G.spawnT -= dt;
      if (G.spawnT <= 0) { spawn(G.toSpawn.shift()); G.spawnT = Math.max(0.35, 1.6 - G.wave * 0.08); }
    } else if (!G.enemies.length) {
      G.breakT -= dt;
      if (G.breakT <= 0) { G.breakT = 3; const bonus = G.wave * 5; addCoins(bonus); text(p.x, p.y - 40, `Wave bonus +⚡${bonus}`, '#7dd3fc'); nextWave(); }
    }

    // Bullet boxes keep turning up, so you never run out for good.
    G.boxT -= dt;
    if (G.boxes.length < 3 || (G.boxT <= 0 && G.boxes.length < 6)) { addBox(); G.boxT = 8; }
    for (let i = G.boxes.length - 1; i >= 0; i--) {
      const b = G.boxes[i];
      if (Math.hypot(b.x - p.x, b.y - p.y) < p.r + 16) {
        G.reserve += b.n; G.boxes.splice(i, 1); sfx.reload(); text(b.x, b.y - 20, `+${b.n} bullets`, '#facc15');
      }
    }

    updateShots(dt);
    updateEnemies(dt);
    updateFoeShots(dt);

    // Coins and hearts float to you.
    for (let i = G.drops.length - 1; i >= 0; i--) {
      const d = G.drops[i], dx = p.x - d.x, dy = p.y - d.y, dist = Math.hypot(dx, dy);
      d.t += dt;
      if (dist < 160 && d.t > 0.3) { d.x += dx / dist * 420 * dt; d.y += dy / dist * 420 * dt; }
      if (dist < p.r + 10) {
        if (d.kind === 'coin') { addCoins(d.n); sfx.coin(); text(d.x, d.y - 14, `+⚡${d.n}`, '#7dd3fc'); }
        else { p.hp = Math.min(100, p.hp + 25); tone(660, 0.15, 'triangle', 0.07); text(d.x, d.y - 14, '+25 ❤️', '#4ade80'); }
        G.drops.splice(i, 1);
      } else if (d.t > 25) G.drops.splice(i, 1);
    }
    for (let i = G.beams.length - 1; i >= 0; i--) if ((G.beams[i].t -= dt) <= 0) G.beams.splice(i, 1);
    for (let i = G.bits.length - 1; i >= 0; i--) {
      const b = G.bits[i]; b.x += b.vx * dt; b.y += b.vy * dt; b.vx *= 0.92; b.vy *= 0.92; b.t -= dt;
      if (b.t <= 0) G.bits.splice(i, 1);
    }
    for (let i = G.texts.length - 1; i >= 0; i--) { const t = G.texts[i]; t.y -= 30 * dt; if ((t.t -= dt) <= 0) G.texts.splice(i, 1); }
    p.hurtT = Math.max(0, p.hurtT - dt);
    if (p.hp <= 0) gameOver();
  }

  function shoot() {
    const p = G.p, b = G.bar, spread = b.spread * (G.gun.scope ? 0.4 : 1);
    const a = p.aim + rand(-spread, spread), m = muzzle(G.gun);
    G.shots.push({ x: p.x + Math.cos(p.aim) * m, y: p.y + Math.sin(p.aim) * m, vx: Math.cos(a) * b.speed, vy: Math.sin(a) * b.speed,
      t: 1.6, bounces: G.bt.id === 'bouncy' ? 3 : 0, dmg: 10 * b.dmg, hit: new Set() });
    G.mag--; G.shotT = b.wait; sfx.shoot();
    if (G.mag === 0 && G.reserve > 0) reload();
  }

  function updateShots(dt) {
    for (let i = G.shots.length - 1; i >= 0; i--) {
      const s = G.shots[i];
      s.t -= dt;
      const steps = 3;
      let dead = s.t <= 0;
      for (let k = 0; k < steps && !dead; k++) {
        const ox = s.x, oy = s.y;
        s.x += s.vx * dt / steps; s.y += s.vy * dt / steps;
        // Walls and crates
        const wall = s.x < 0 || s.x > AW || s.y < 0 || s.y > AH;
        const crate = CRATES.find(c => s.x > c.x && s.x < c.x + c.w && s.y > c.y && s.y < c.y + c.h);
        if (wall || crate) {
          if (s.bounces > 0) {
            s.bounces--;
            const hitX = wall ? (s.x < 0 || s.x > AW) : (ox <= crate.x || ox >= crate.x + crate.w);
            if (hitX) s.vx = -s.vx; else s.vy = -s.vy;
            s.x = ox; s.y = oy; tone(700, 0.04, 'square', 0.02);
          } else { if (G.bt.id === 'explosive') explode(s.x, s.y, s.dmg); else puff(s.x, s.y, G.bt.col, 4); dead = true; }
          continue;
        }
        for (const e of G.enemies) {
          if (s.hit.has(e) || Math.hypot(e.x - s.x, e.y - s.y) > e.r + 4) continue;
          s.hit.add(e);
          bulletHits(e, s);
          dead = true; break;
        }
      }
      if (dead) G.shots.splice(i, 1);
    }
  }

  function bulletHits(e, s) {
    const id = G.bt.id;
    if (id === 'explosive') { explode(s.x, s.y, s.dmg); return; }
    hurt(e, s.dmg);
    if (id === 'fire') e.burn = 3;
    if (id === 'freeze') e.cold = 3;
    if (id === 'electric') {
      let from = e; const zapped = new Set([e]);
      for (let k = 0; k < 2; k++) {
        let best = null, bd = 260;
        for (const o of G.enemies) { if (zapped.has(o)) continue; const d = Math.hypot(o.x - from.x, o.y - from.y); if (d < bd) { bd = d; best = o; } }
        if (!best) break;
        G.beams.push({ zap: true, x1: from.x, y1: from.y, x2: best.x, y2: best.y, t: 0.2 });
        hurt(best, s.dmg * 0.6); zapped.add(best); from = best;
      }
      sfx.zap();
    }
    puff(s.x, s.y, G.bt.col, 5);
  }
  function explode(x, y, dmg) {
    sfx.boom();
    puff(x, y, '#f97316', 18, 260); puff(x, y, '#facc15', 10, 160);
    G.beams.push({ boom: true, x, y, t: 0.25 });
    for (const e of [...G.enemies]) if (Math.hypot(e.x - x, e.y - y) < 90 + e.r) hurt(e, dmg * 1.3);
  }
  function hurt(e, n) {
    if (e.hp <= 0) return;
    e.hp -= n; e.flash = 0.1; sfx.hit();
    if (e.hp <= 0) {
      const d = ENEMY[e.kind];
      sfx.poof();
      puff(e.x, e.y, e.kind === 'duck' ? '#fde047' : e.kind === 'cow' ? '#f8fafc' : '#ffffff', 16, 220);
      const coins = d.coins + Math.floor(G.wave / 4);
      // Split the coins into up to 5 drops that add up to the right amount.
      const drops = Math.min(coins, 5);
      for (let k = 0; k < drops; k++)
        G.drops.push({ kind: 'coin', x: e.x + rand(-15, 15), y: e.y + rand(-15, 15), n: Math.floor(coins / drops) + (k < coins % drops ? 1 : 0), t: 0 });
      if (Math.random() < 0.09) G.drops.push({ kind: 'heart', x: e.x, y: e.y, t: 0 });
      G.enemies.splice(G.enemies.indexOf(e), 1);
    }
  }

  function updateEnemies(dt) {
    const p = G.p;
    for (const e of [...G.enemies]) {
      e.t += dt; e.flash = Math.max(0, e.flash - dt);
      if (e.burn > 0) { e.burn -= dt; e.hp -= 9 * dt; if (Math.random() < dt * 12) puff(e.x + rand(-10, 10), e.y - 10, '#fb923c', 1, 40); if (e.hp <= 0) { e.hp = 0.001; hurt(e, 1); continue; } }
      if (e.cold > 0) e.cold -= dt;
      const slow = e.cold > 0 ? 0.45 : 1;
      const dx = p.x - e.x, dy = p.y - e.y, dist = Math.hypot(dx, dy) || 1;
      e.face = dx < 0 ? -1 : 1;
      // Ducks and chickens like to keep a bit of distance. Cows just march at you.
      const want = e.kind === 'duck' ? 330 : e.kind === 'chicken' ? 240 : 0;
      let vx = 0, vy = 0;
      if (e.charge > 0) { /* stand still while charging the lazer */ }
      else if (dist > want + 30) { vx = dx / dist; vy = dy / dist; }
      else if (dist < want - 40) { vx = -dx / dist; vy = -dy / dist; }
      else { vx = -dy / dist * Math.sin(e.wob + e.t * 0.7); vy = dx / dist * Math.sin(e.wob + e.t * 0.7); }
      e.x += vx * e.speed * slow * dt; e.y += vy * e.speed * slow * dt;
      e.x = clamp(e.x, e.r, AW - e.r); e.y = clamp(e.y, e.r, AH - e.r);
      pushOut(e);
      for (const o of G.enemies) {
        if (o === e) continue;
        const ox = e.x - o.x, oy = e.y - o.y, d = Math.hypot(ox, oy), rr = e.r + o.r;
        if (d > 0 && d < rr) { e.x += ox / d * (rr - d) / 2; e.y += oy / d * (rr - d) / 2; }
      }
      // Touching an animal hurts.
      if (dist < e.r + p.r) ouch(22 * dt, true);

      // Attacks
      e.fireT -= dt * slow;
      if (e.kind === 'duck') {
        if (e.charge > 0) {
          e.charge += dt;
          if (e.charge > 0.9) {
            e.charge = 0; e.fireT = rand(2.5, 3.5); sfx.laser();
            const x2 = e.x + Math.cos(e.aim) * 900, y2 = e.y + Math.sin(e.aim) * 900;
            G.beams.push({ x1: e.x, y1: e.y, x2, y2, t: 0.25 });
            if (segDist(p.x, p.y, e.x, e.y, x2, y2) < p.r + 8) ouch(14);
          }
        } else if (e.fireT <= 0 && dist < 800) { e.charge = 0.001; e.aim = Math.atan2(dy, dx); }
      } else if (e.fireT <= 0 && dist < 750) {
        const a = Math.atan2(dy, dx);
        if (e.kind === 'cow') {
          G.foes.push({ x: e.x, y: e.y, vx: Math.cos(a) * 290, vy: Math.sin(a) * 290, r: 12, dmg: 18, t: 4, ball: true });
          tone(90, 0.25, 'sawtooth', 0.07, 0.5); e.fireT = rand(3, 4);
        } else {
          for (let k = -2; k <= 2; k++) G.foes.push({ x: e.x, y: e.y, vx: Math.cos(a + k * 0.22) * 320, vy: Math.sin(a + k * 0.22) * 320, r: 7, dmg: 7, t: 3, egg: true });
          tone(600, 0.12, 'square', 0.05, 0.6); e.fireT = rand(2, 2.8);
        }
      }
    }
  }
  function updateFoeShots(dt) {
    const p = G.p;
    for (let i = G.foes.length - 1; i >= 0; i--) {
      const f = G.foes[i];
      f.x += f.vx * dt; f.y += f.vy * dt; f.t -= dt;
      const blocked = CRATES.some(c => f.x > c.x && f.x < c.x + c.w && f.y > c.y && f.y < c.y + c.h);
      if (Math.hypot(f.x - p.x, f.y - p.y) < f.r + p.r) { ouch(f.dmg); puff(f.x, f.y, f.ball ? '#334155' : '#fef3c7', 8); G.foes.splice(i, 1); }
      else if (blocked || f.t <= 0 || f.x < 0 || f.x > AW || f.y < 0 || f.y > AH) { puff(f.x, f.y, f.ball ? '#334155' : '#fef3c7', 5); G.foes.splice(i, 1); }
    }
  }
  function ouch(n, quiet) {
    G.p.hp -= n;
    if (!quiet || G.p.hurtT <= 0) { G.p.hurtT = 0.3; sfx.hurt(); }
  }
  function addCoins(n) { G.coins += n; save.coins += n; store(); }

  function segDist(px, py, ax, ay, bx, by) {
    const ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey, u = clamp(((px - ax) * ex + (py - ay) * ey) / l2, 0, 1);
    return Math.hypot(px - ax - ex * u, py - ay - ey * u);
  }
  function pushOut(o) {
    o.x = clamp(o.x, o.r, AW - o.r); o.y = clamp(o.y, o.r, AH - o.r);
    for (const c of CRATES) {
      const nx = clamp(o.x, c.x, c.x + c.w), ny = clamp(o.y, c.y, c.y + c.h), dx = o.x - nx, dy = o.y - ny, d = Math.hypot(dx, dy);
      if (d < o.r) {
        if (d > 0) { o.x = nx + dx / d * o.r; o.y = ny + dy / d * o.r; }
        else { // centre inside the crate: pop out the nearest side
          const l = o.x - c.x, r = c.x + c.w - o.x, t = o.y - c.y, b = c.y + c.h - o.y, m = Math.min(l, r, t, b);
          if (m === l) o.x = c.x - o.r; else if (m === r) o.x = c.x + c.w + o.r; else if (m === t) o.y = c.y - o.r; else o.y = c.y + c.h + o.r;
        }
      }
    }
  }
  function nearestEnemy(x, y, max) {
    let best = null, bd = max;
    for (const e of G.enemies) { const d = Math.hypot(e.x - x, e.y - y); if (d < bd) { bd = d; best = e; } }
    return best;
  }
  function puff(x, y, col, n, sp = 120) {
    for (let k = 0; k < n; k++) { const a = rand(0, 7), v = rand(sp * 0.3, sp); G.bits.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: rand(0.3, 0.7), col, r: rand(2, 5) }); }
  }
  function text(x, y, s, col) { G.texts.push({ x, y, s, col, t: 1 }); }

  // ---------- Drawing the game ----------
  let W = 0, H = 0, dpr = 1;
  function toWorld(sx, sy) { const c = G.cam; return { x: (sx - W / 2) / c.s + c.x, y: (sy - H / 2) / c.s + c.y }; }
  function render() {
    const r = cv.getBoundingClientRect();
    dpr = Math.min(2, devicePixelRatio || 1);
    if (cv.width !== Math.round(r.width * dpr) || cv.height !== Math.round(r.height * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
    W = r.width; H = r.height;
    const p = G.p, cam = G.cam;
    // A scope lets you see further.
    cam.s = Math.min(W / 1000, H / 640) * (G.gun.scope ? 0.72 : 1);
    cam.s = Math.max(cam.s, Math.max(W / AW, H / AH));
    const hw = W / 2 / cam.s, hh = H / 2 / cam.s;
    cam.x = clamp(p.x, Math.min(hw, AW / 2), Math.max(AW - hw, AW / 2));
    cam.y = clamp(p.y, Math.min(hh, AH / 2), Math.max(AH - hh, AH / 2));
    const c = ctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = '#0b1220'; c.fillRect(0, 0, W, H);
    c.setTransform(dpr * cam.s, 0, 0, dpr * cam.s, dpr * (W / 2 - cam.x * cam.s), dpr * (H / 2 - cam.y * cam.s));
    // Ground
    c.fillStyle = '#3f7d3a'; c.fillRect(0, 0, AW, AH);
    c.fillStyle = '#4a8c43';
    for (let x = 0; x < AW; x += 100) for (let y = (x / 100) % 2 * 100; y < AH; y += 200) c.fillRect(x, y, 100, 100);
    c.strokeStyle = '#1e3a1b'; c.lineWidth = 10; c.strokeRect(0, 0, AW, AH);
    // Crates
    for (const k of CRATES) {
      c.fillStyle = '#a16207'; c.fillRect(k.x, k.y, k.w, k.h);
      c.strokeStyle = '#713f12'; c.lineWidth = 4; c.strokeRect(k.x + 2, k.y + 2, k.w - 4, k.h - 4);
      c.beginPath(); c.moveTo(k.x + 4, k.y + 4); c.lineTo(k.x + k.w - 4, k.y + k.h - 4); c.moveTo(k.x + k.w - 4, k.y + 4); c.lineTo(k.x + 4, k.y + k.h - 4); c.stroke();
    }
    // Bullet boxes: plain bullets only!
    for (const b of G.boxes) {
      const bob = Math.sin(G.t * 4 + b.x) * 2;
      c.fillStyle = '#365314'; c.fillRect(b.x - 15, b.y - 11 + bob, 30, 22);
      c.strokeStyle = '#facc15'; c.lineWidth = 2; c.strokeRect(b.x - 15, b.y - 11 + bob, 30, 22);
      c.fillStyle = '#facc15'; for (let k = -1; k <= 1; k++) { c.fillRect(b.x + k * 8 - 2, b.y - 7 + bob, 4, 10); c.beginPath(); c.arc(b.x + k * 8, b.y - 7 + bob, 2, 0, 7); c.fill(); }
    }
    // Coins and hearts
    for (const d of G.drops) {
      if (d.kind === 'coin') {
        c.fillStyle = '#38bdf8'; c.strokeStyle = '#0369a1'; c.lineWidth = 2;
        c.beginPath(); c.arc(d.x, d.y, 8, 0, 7); c.fill(); c.stroke();
        c.fillStyle = '#fef08a'; c.beginPath(); c.moveTo(d.x + 1, d.y - 6); c.lineTo(d.x - 3, d.y + 1); c.lineTo(d.x, d.y + 1); c.lineTo(d.x - 1, d.y + 6); c.lineTo(d.x + 3, d.y - 1); c.lineTo(d.x, d.y - 1); c.closePath(); c.fill();
      } else { c.font = '22px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('❤️', d.x, d.y); }
    }
    // Lazer warning lines
    for (const e of G.enemies) if (e.kind === 'duck' && e.charge > 0) {
      c.strokeStyle = `rgba(239,68,68,${0.25 + e.charge * 0.5})`; c.lineWidth = 2 + e.charge * 4; c.setLineDash([12, 10]);
      c.beginPath(); c.moveTo(e.x, e.y); c.lineTo(e.x + Math.cos(e.aim) * 900, e.y + Math.sin(e.aim) * 900); c.stroke(); c.setLineDash([]);
    }
    // Animals
    for (const e of G.enemies) {
      c.save(); c.translate(e.x, e.y); c.scale(e.face, 1);
      c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(0, e.r * 0.85, e.r, e.r * 0.3, 0, 0, 7); c.fill();
      DRAW[e.kind](c, e.r, e.t, e.charge);
      c.restore();
      if (e.cold > 0) { c.fillStyle = 'rgba(125,211,252,.35)'; c.beginPath(); c.arc(e.x, e.y, e.r + 4, 0, 7); c.fill(); }
      if (e.flash > 0) { c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.arc(e.x, e.y, e.r, 0, 7); c.fill(); }
      if (e.hp < e.max) {
        c.fillStyle = '#7f1d1d'; c.fillRect(e.x - e.r, e.y - e.r - 16, e.r * 2, 5);
        c.fillStyle = '#ef4444'; c.fillRect(e.x - e.r, e.y - e.r - 16, e.r * 2 * Math.max(0, e.hp / e.max), 5);
      }
    }
    // Enemy shots
    for (const f of G.foes) {
      if (f.ball) { c.fillStyle = '#111827'; c.beginPath(); c.arc(f.x, f.y, f.r, 0, 7); c.fill(); c.fillStyle = '#6b7280'; c.beginPath(); c.arc(f.x - 3, f.y - 3, 3, 0, 7); c.fill(); }
      else { c.fillStyle = '#fef3c7'; c.strokeStyle = '#d6d3d1'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(f.x, f.y, f.r, f.r * 1.3, Math.atan2(f.vy, f.vx) + Math.PI / 2, 0, 7); c.fill(); c.stroke(); }
    }
    // Player
    drawPlayer(c, p);
    // Your bullets
    for (const s of G.shots) {
      c.fillStyle = G.bt.col; c.strokeStyle = G.bt.col; c.lineWidth = 3;
      const a = Math.atan2(s.vy, s.vx), L = G.bt.id === 'explosive' ? 7 : 5;
      c.globalAlpha = 0.45; c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(s.x - Math.cos(a) * 18, s.y - Math.sin(a) * 18); c.stroke(); c.globalAlpha = 1;
      c.beginPath(); c.arc(s.x, s.y, L, 0, 7); c.fill();
    }
    // Lazers, zaps and booms
    for (const b of G.beams) {
      if (b.boom) { c.fillStyle = `rgba(251,146,60,${b.t * 2})`; c.beginPath(); c.arc(b.x, b.y, 90 * (1.2 - b.t * 2), 0, 7); c.fill(); continue; }
      if (b.zap) {
        c.strokeStyle = '#a5f3fc'; c.lineWidth = 3; c.beginPath(); c.moveTo(b.x1, b.y1);
        for (let k = 1; k < 6; k++) c.lineTo(b.x1 + (b.x2 - b.x1) * k / 6 + rand(-10, 10), b.y1 + (b.y2 - b.y1) * k / 6 + rand(-10, 10));
        c.lineTo(b.x2, b.y2); c.stroke(); continue;
      }
      c.strokeStyle = 'rgba(239,68,68,.55)'; c.lineWidth = 20; c.beginPath(); c.moveTo(b.x1, b.y1); c.lineTo(b.x2, b.y2); c.stroke();
      c.strokeStyle = '#fecaca'; c.lineWidth = 6; c.stroke();
    }
    for (const b of G.bits) { c.globalAlpha = Math.min(1, b.t * 2); c.fillStyle = b.col; c.beginPath(); c.arc(b.x, b.y, b.r, 0, 7); c.fill(); }
    c.globalAlpha = 1;
    c.font = '700 18px Fredoka, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const t of G.texts) { c.globalAlpha = Math.min(1, t.t * 2); c.fillStyle = '#000'; c.fillText(t.s, t.x + 1.5, t.y + 1.5); c.fillStyle = t.col; c.fillText(t.s, t.x, t.y); }
    c.globalAlpha = 1;
    // Arrow to the nearest bullet box when you're running low.
    if (G.mag + G.reserve < G.magSize && G.boxes.length) {
      let best = G.boxes[0];
      for (const b of G.boxes) if (Math.hypot(b.x - p.x, b.y - p.y) < Math.hypot(best.x - p.x, best.y - p.y)) best = b;
      const a = Math.atan2(best.y - p.y, best.x - p.x), ax = p.x + Math.cos(a) * 50, ay = p.y + Math.sin(a) * 50;
      c.save(); c.translate(ax, ay); c.rotate(a); c.fillStyle = '#facc15'; c.globalAlpha = 0.6 + Math.sin(G.t * 8) * 0.3;
      c.beginPath(); c.moveTo(10, 0); c.lineTo(-6, -8); c.lineTo(-6, 8); c.closePath(); c.fill(); c.restore();
    }
    // Touch sticks
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const t of [touch.move, touch.aim]) if (t) {
      c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 3; c.beginPath(); c.arc(t.x0, t.y0, 50, 0, 7); c.stroke();
      const dx = t.x - t.x0, dy = t.y - t.y0, d = Math.hypot(dx, dy), k = d > 50 ? 50 / d : 1;
      c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.arc(t.x0 + dx * k, t.y0 + dy * k, 22, 0, 7); c.fill();
    }
    if (p.hurtT > 0) { c.fillStyle = `rgba(239,68,68,${p.hurtT * 0.6})`; c.fillRect(0, 0, W, H); }
  }

  function drawPlayer(c, p) {
    // Aim line from the scope
    if (G.gun.scope) {
      c.strokeStyle = 'rgba(56,189,248,.45)'; c.lineWidth = 2; c.setLineDash([6, 8]);
      const m = muzzle(G.gun);
      c.beginPath(); c.moveTo(p.x + Math.cos(p.aim) * m, p.y + Math.sin(p.aim) * m); c.lineTo(p.x + Math.cos(p.aim) * 700, p.y + Math.sin(p.aim) * 700); c.stroke(); c.setLineDash([]);
    }
    const R = p.r, step = Math.sin(p.step) * 4;
    c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(p.x, p.y + R, R, 5, 0, 0, 7); c.fill();
    c.fillStyle = '#1d4ed8';
    c.beginPath(); c.ellipse(p.x - 7, p.y + R - 3 + step, 6, 4, 0, 0, 7); c.fill();
    c.beginPath(); c.ellipse(p.x + 7, p.y + R - 3 - step, 6, 4, 0, 0, 7); c.fill();
    c.fillStyle = '#3b82f6'; c.strokeStyle = '#1e3a8a'; c.lineWidth = 3;
    c.beginPath(); c.arc(p.x, p.y, R, 0, 7); c.fill(); c.stroke();
    const fx = Math.cos(p.aim) * 5, fy = Math.sin(p.aim) * 3;
    for (const s of [-1, 1]) {
      c.fillStyle = '#fff'; c.beginPath(); c.arc(p.x + s * 6 + fx, p.y - 4 + fy, 4.5, 0, 7); c.fill();
      c.fillStyle = '#111'; c.beginPath(); c.arc(p.x + s * 6 + fx * 1.4, p.y - 4 + fy * 1.4, 2.2, 0, 7); c.fill();
    }
    // Headband
    c.fillStyle = '#ef4444'; c.fillRect(p.x - R + 2, p.y - R + 4, R * 2 - 4, 4);
    // The gun you built
    c.save(); c.translate(p.x, p.y); c.rotate(p.aim);
    if (Math.cos(p.aim) < 0) c.scale(1, -1);
    c.translate(8, 6); c.scale(0.9, 0.9);
    drawGun(c, G.gun);
    c.restore();
    if (G.reloadT > 0) {
      c.strokeStyle = '#facc15'; c.lineWidth = 4;
      c.beginPath(); c.arc(p.x, p.y - R - 14, 8, -Math.PI / 2, -Math.PI / 2 + (1 - G.reloadT / 1.1) * Math.PI * 2); c.stroke();
    }
  }

  // ---------- HUD ----------
  let flashT = 0;
  function flash(s) { const m = $('msg'); m.textContent = s; m.style.opacity = 1; clearTimeout(flashT); flashT = setTimeout(() => { m.style.opacity = 0; }, 2000); }
  let bannerT = 0;
  function banner(s) { const b = $('banner'); b.textContent = s; b.style.opacity = 1; clearTimeout(bannerT); bannerT = setTimeout(() => { b.style.opacity = 0; }, 1500); }
  function hud() {
    $('hp-num').textContent = Math.max(0, Math.ceil(G.p.hp));
    $('hp-fill').style.width = Math.max(0, G.p.hp) + '%';
    $('wave').textContent = G.wave;
    $('run-coins').textContent = G.coins;
    $('mag').textContent = G.reloadT > 0 ? '…' : G.mag;
    $('reserve').textContent = G.reserve;
    $('bullet-name').textContent = `${G.bt.i} ${G.bt.n} bullets`;
  }

  // ---------- Screens ----------
  let last = 0, running = false;
  function loop(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    if (!G.paused && !G.over) update(dt);
    render(); hud();
    requestAnimationFrame(loop);
  }
  function play() {
    newGame();
    $('over').hidden = true; $('paused').hidden = true;
    show('game');
    if (!running) { running = true; last = performance.now(); requestAnimationFrame(loop); }
  }
  function stop() { running = false; }
  function togglePause() {
    if (!G || G.over) return;
    G.paused = !G.paused; $('paused').hidden = !G.paused;
    keys.clear(); mouse.down = false;
  }
  function gameOver() {
    G.over = true;
    const best = G.wave > save.best;
    if (best) { save.best = G.wave; store(); }
    $('over-wave').textContent = G.wave;
    $('over-coins').textContent = G.coins;
    $('over-best').textContent = best ? '🏆 That\'s your best ever!' : `Your best: wave ${save.best}`;
    $('over').hidden = false;
    tone(300, 0.4, 'triangle', 0.08, 0.4);
  }
  function home() {
    stop(); showCoins();
    $('best').textContent = save.best ? `🏆 Best: wave ${save.best}` : '';
    show('home');
  }
  $('m-play').onclick = play;
  $('m-shop').onclick = openShop;
  $('shop-back').onclick = home;
  $('shop-play').onclick = play;
  $('pause').onclick = togglePause;
  $('resume').onclick = togglePause;
  $('quit').onclick = home;
  $('over-shop').onclick = () => { stop(); openShop(); };
  $('over-again').onclick = play;
  addEventListener('visibilitychange', () => { if (document.hidden && G && !G.over && !G.paused && running) togglePause(); });
  home();

  if (location.hash === '#debug') window.SF = { get G() { return G; }, save: () => save, play, openShop, update, spawn };
})();
