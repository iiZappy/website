/* Spingo's SQF Meme Academy interactions (desktop UI + easter eggs + procedural SFX) */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const state = {
  sound: false,
  muted: false,
  volume: 0.7,
  glitch: false,
  mode: 'spingo',
  keys: '',
  konami: [],
  brandClicks: 0,
  speak: false,
  z: 10,
};

function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }
function rand(arr){ return arr[Math.floor(Math.random() * arr.length)]; }

function setToast(text, mood = 'ok'){
  const el = $('#pill-status');
  if (!el) return;
  el.textContent = text;
  el.style.borderColor = mood === 'danger' ? 'rgba(255,143,163,0.35)' : (mood === 'warn' ? 'rgba(255,211,124,0.35)' : 'rgba(255,255,255,0.14)');
}

function setMode(mode){
  state.mode = mode;
  document.documentElement.classList.toggle('mode-spingo', mode === 'spingo');
  document.documentElement.classList.toggle('mode-jimbo', mode === 'jimbo');
  document.documentElement.classList.toggle('mode-shronk', mode === 'shronk');

  const msg = {
    spingo: 'Spingo mode enabled. Bubbles are now a design pattern.',
    jimbo: 'Jimbo mode enabled. Science is about to happen incorrectly.',
    shronk: 'Shronk mode enabled. The fix is yelling.'
  }[mode] || 'Mode set.';

  setToast(msg, 'warn');
  sfx(mode === 'jimbo' ? 'zap' : (mode === 'shronk' ? 'horn' : 'bubble'));
}

// --- WebAudio SFX (procedural)
let audio = null;

function audioInit(){
  if (audio) return audio;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;

  const ctx = new Ctx();
  const master = ctx.createGain();
  master.gain.value = 0.0;
  master.connect(ctx.destination);

  audio = { ctx, master };
  return audio;
}

function setVolume(v){
  state.volume = clamp(v, 0, 1);
  if (!audio) return;
  audio.master.gain.value = state.muted ? 0 : (state.sound ? state.volume : 0);
}

function env(g, now, a=0.008, d=0.12, peak=0.18){
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(peak, now + a);
  g.gain.exponentialRampToValueAtTime(0.0001, now + d);
}

function sfx(type){
  if (!state.sound || state.muted) return;
  const a = audioInit();
  if (!a) return;
  if (a.ctx.state === 'suspended') a.ctx.resume().catch(() => {});
  a.master.gain.value = state.volume;

  const now = a.ctx.currentTime;

  const osc = (freq, wave='sine') => {
    const o = a.ctx.createOscillator();
    o.type = wave;
    o.frequency.setValueAtTime(freq, now);
    return o;
  };

  const g = () => a.ctx.createGain();

  const noise = (dur=0.08, amp=0.20) => {
    const len = Math.floor(a.ctx.sampleRate * dur);
    const buf = a.ctx.createBuffer(1, len, a.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i=0;i<len;i++) data[i] = (Math.random()*2-1) * amp;
    const src = a.ctx.createBufferSource();
    src.buffer = buf;
    return src;
  };

  const blip = (f0, f1, dur=0.10, wave='square', peak=0.16) => {
    const o = osc(f0, wave);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), now + dur);
    const gg = g();
    env(gg, now, 0.008, dur, peak);
    o.connect(gg);
    gg.connect(a.master);
    o.start(now);
    o.stop(now + dur + 0.02);
  };

  if (type === 'bubble'){
    blip(420 + Math.random()*160, 140 + Math.random()*60, 0.10, 'sine', 0.15);
    if (!prefersReduced) spawnBubbles(18);
    return;
  }

  if (type === 'zap'){
    blip(1500, 120, 0.12, 'sawtooth', 0.17);
    blip(300, 2400, 0.06, 'square', 0.12);
    if (!prefersReduced) spawnStars(70);
    return;
  }

  if (type === 'horn'){
    blip(120, 86, 0.22, 'triangle', 0.18);
    blip(240, 120, 0.22, 'triangle', 0.12);
    if (!prefersReduced) spawnConfetti(160);
    return;
  }

  if (type === 'whoosh'){
    const n = noise(0.18, 0.20);
    const flt = a.ctx.createBiquadFilter();
    flt.type = 'bandpass';
    flt.frequency.setValueAtTime(300, now);
    flt.frequency.exponentialRampToValueAtTime(2200, now + 0.18);
    const gg = g();
    env(gg, now, 0.006, 0.22, 0.14);
    n.connect(flt);
    flt.connect(gg);
    gg.connect(a.master);
    n.start(now);
    n.stop(now + 0.20);
    return;
  }

  if (type === 'slap'){
    const n = noise(0.06, 0.30);
    const flt = a.ctx.createBiquadFilter();
    flt.type = 'highpass';
    flt.frequency.value = 800;
    const gg = g();
    env(gg, now, 0.002, 0.09, 0.16);
    n.connect(flt);
    flt.connect(gg);
    gg.connect(a.master);
    n.start(now);
    n.stop(now + 0.08);
    return;
  }

  if (type === 'splat'){
    blip(220, 70, 0.18, 'sine', 0.16);
    const n = noise(0.10, 0.18);
    const flt = a.ctx.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.value = 600;
    const gg = g();
    env(gg, now, 0.006, 0.16, 0.10);
    n.connect(flt);
    flt.connect(gg);
    gg.connect(a.master);
    n.start(now);
    n.stop(now + 0.14);
    if (!prefersReduced) spawnSlime(18);
    return;
  }

  if (type === 'error'){
    blip(220, 160, 0.12, 'square', 0.16);
    blip(160, 90, 0.16, 'square', 0.16);
    return;
  }

  if (type === 'success'){
    blip(660, 880, 0.10, 'square', 0.14);
    blip(880, 1100, 0.10, 'square', 0.12);
    return;
  }

  if (type === 'laugh'){
    // synthetic chuckle: pitchy pulses + tiny noise
    for (let i=0;i<4;i++){
      const t = now + i * 0.09;
      const o = osc(280 + Math.random()*120, 'square');
      const gg = a.ctx.createGain();
      gg.gain.setValueAtTime(0.0001, t);
      gg.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
      gg.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      o.connect(gg);
      gg.connect(a.master);
      o.start(t);
      o.stop(t + 0.08);
    }
    const n = noise(0.20, 0.08);
    const gg = g();
    env(gg, now, 0.01, 0.22, 0.08);
    n.connect(gg);
    gg.connect(a.master);
    n.start(now);
    n.stop(now + 0.22);
    return;
  }
}

// --- Canvas FX
const fx = $('#fx');
const fxc = fx.getContext('2d');
let parts = [];

function resizeFx(){
  fx.width = window.innerWidth * devicePixelRatio;
  fx.height = window.innerHeight * devicePixelRatio;
}
window.addEventListener('resize', resizeFx);
resizeFx();

function spawnConfetti(count = 140){
  const w = fx.width;
  const h = fx.height;
  const colors = ['#7cf3ff', '#a8ffcb', '#ffd37c', '#ff8fa3', '#fff27c', '#ffffff'];
  const c = prefersReduced ? Math.floor(count * 0.4) : count;
  for (let i=0;i<c;i++){
    parts.push({
      kind: 'confetti',
      x: w * (0.25 + Math.random() * 0.5),
      y: h * (0.18 + Math.random() * 0.15),
      vx: (Math.random()-0.5) * 7,
      vy: Math.random() * -7 - 2,
      g: 0.15 + Math.random() * 0.14,
      r: 2 + Math.random() * 4,
      a: 1,
      rot: Math.random() * Math.PI,
      vr: (Math.random()-0.5) * 0.28,
      c: rand(colors)
    });
  }
}

function spawnBubbles(count = 24){
  const w = fx.width;
  const h = fx.height;
  const c = prefersReduced ? Math.floor(count * 0.4) : count;
  for (let i=0;i<c;i++){
    parts.push({
      kind: 'bubble',
      x: (Math.random() * w),
      y: h + Math.random() * h * 0.12,
      vx: (Math.random()-0.5) * 0.9,
      vy: -(1.2 + Math.random() * 2.6),
      r: 3 + Math.random() * 11,
      a: 0.9,
      c: 'rgba(124,243,255,0.55)'
    });
  }
}

function spawnStars(count = 60){
  const w = fx.width;
  const h = fx.height;
  const c = prefersReduced ? Math.floor(count * 0.4) : count;
  for (let i=0;i<c;i++){
    parts.push({
      kind: 'star',
      x: w * 0.5 + (Math.random()-0.5) * w * 0.55,
      y: h * 0.28 + (Math.random()-0.5) * h * 0.18,
      vx: (Math.random()-0.5) * 10,
      vy: (Math.random()-0.5) * 10,
      r: 1 + Math.random() * 2.8,
      a: 1,
      c: rand(['#7cf3ff', '#fff27c', '#ffffff'])
    });
  }
}

function spawnSlime(count = 18){
  const w = fx.width;
  const h = fx.height;
  const c = prefersReduced ? Math.floor(count * 0.4) : count;
  for (let i=0;i<c;i++){
    parts.push({
      kind: 'slime',
      x: w * 0.5 + (Math.random()-0.5) * w * 0.45,
      y: h * 0.35 + (Math.random()-0.5) * h * 0.18,
      vx: (Math.random()-0.5) * 6,
      vy: (Math.random()-0.5) * 2,
      r: 4 + Math.random() * 12,
      a: 0.85,
      c: 'rgba(168,255,203,0.45)'
    });
  }
}

function tickFx(){
  fxc.clearRect(0,0,fx.width,fx.height);
  parts = parts.filter(p => p.a > 0.02);

  for (const p of parts){
    if (p.kind === 'confetti'){
      p.vy += p.g;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.a *= 0.985;

      fxc.save();
      fxc.globalAlpha = p.a;
      fxc.translate(p.x, p.y);
      fxc.rotate(p.rot);
      fxc.fillStyle = p.c;
      fxc.fillRect(-p.r, -p.r, p.r*2.2, p.r*2.2);
      fxc.restore();
      continue;
    }

    if (p.kind === 'bubble'){
      p.x += p.vx;
      p.y += p.vy;
      p.a *= 0.992;

      fxc.save();
      fxc.globalAlpha = p.a;
      fxc.strokeStyle = p.c;
      fxc.lineWidth = 2 * devicePixelRatio;
      fxc.beginPath();
      fxc.arc(p.x, p.y, p.r * devicePixelRatio, 0, Math.PI * 2);
      fxc.stroke();
      fxc.restore();
      continue;
    }

    if (p.kind === 'star'){
      p.x += p.vx;
      p.y += p.vy;
      p.a *= 0.965;

      fxc.save();
      fxc.globalAlpha = p.a;
      fxc.fillStyle = p.c;
      fxc.beginPath();
      fxc.arc(p.x, p.y, p.r * devicePixelRatio, 0, Math.PI * 2);
      fxc.fill();
      fxc.restore();
      continue;
    }

    if (p.kind === 'slime'){
      p.x += p.vx;
      p.y += p.vy;
      p.a *= 0.975;

      fxc.save();
      fxc.globalAlpha = p.a;
      fxc.fillStyle = p.c;
      fxc.beginPath();
      fxc.arc(p.x, p.y, p.r * devicePixelRatio, 0, Math.PI * 2);
      fxc.fill();
      fxc.restore();
      continue;
    }
  }

  requestAnimationFrame(tickFx);
}
requestAnimationFrame(tickFx);

// --- Content
const snippets = {
  vars: {
    bad: `// SPINGO ADVICE (WRONG)
myVar = 123; // global, no private, no context
hint str myVar;

// If it breaks, rename it to myVar2 until it works.`,
    fix: `// SANE FIX
private _myVar = 123;
hint str _myVar;

// Use private vars inside functions.
// Use missionNamespace/setVariable when you actually need globals.`
  },
  mp: {
    bad: `// JIMBO ADVICE (WRONG)
[] spawn {
  while {true} do {
    // Run on every client, every frame.
    player setDamage 0;
  };
};`,
    fix: `// SANE FIX
// Decide authority (usually server). Replicate state intentionally.
if (isServer) then {
  // server-side logic
};

// Keep clients focused on UI + presentation when possible.`
  },
  ui: {
    bad: `// SHRONK ADVICE (WRONG)
[] spawn {
  while {true} do {
    createDialog "RscDisplayInventory";
  };
};`,
    fix: `// SANE FIX
// Create dialogs on demand and close them properly.
createDialog "MyDialog";

// For HUD: use RscTitles and avoid tight onEachFrame spam.`
  },
  rex: {
    bad: `// SPINGO ADVICE (WRONG)
[player] remoteExec ["my_fnc_doTheThing", 0, true];
// Broadcast to everyone. Security is a vibe.`,
    fix: `// SANE FIX
// Target remoteExec and validate on server (remoteExecutedOwner, cooldowns, distance, etc).
// Example idea:
// [player] remoteExecCall ["srv_fnc_request", 2];`
  }
};

function showSnippet(id, kind){
  const el = document.getElementById(`code-${id}`);
  if (!el) return;
  el.textContent = snippets[id]?.[kind] || 'Missing snippet.';

  if (kind === 'bad'){
    setToast(`${id.toUpperCase()}: Loaded bad advice. Do not deploy this.`, 'danger');
    sfx(state.mode === 'jimbo' ? 'zap' : (state.mode === 'shronk' ? 'horn' : 'bubble'));
  } else {
    setToast(`${id.toUpperCase()}: Loaded sane fix. Your server breathes again.`, 'ok');
    sfx('success');
  }
}

function randomBadAdvice(){
  const openers = ['Hot take:', 'Pro tip:', 'Advanced technique:', 'Certified advice:', 'MP-safe rumor:', 'Forum wisdom:'];
  const lines = [
    'If it desyncs, increase confidence by 12%.',
    'Never test on a dedicated server. It ruins the mystery.',
    'Variables are like feelings: best shared globally without warning.',
    'remoteExec to everyone to build community.',
    'If it works once, write a tutorial immediately.'
  ];
  return `${rand(openers)} ${rand(lines)}`;
}

function randomSaneFix(){
  const fixes = [
    'Use private variables and clear scope.',
    'Give authority to server; replicate intentionally.',
    'Avoid tight loops; rate-limit and prefer events.',
    'Validate remote calls; never trust clients.'
  ];
  return `Reality check: ${rand(fixes)}`;
}

function setAdvice(text){
  const el = $('#advice-out');
  el.textContent = text;
}

function copyText(text){
  if (!text) return;
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      setToast('Copied to clipboard.', 'ok');
      sfx('bubble');
    }).catch(() => {
      setToast('Copy failed (browser said no).', 'warn');
      sfx('error');
    });
  } else {
    setToast('Clipboard API unavailable.', 'warn');
  }
}

function speak(text){
  if (!state.speak) return;
  if (!('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05;
    u.pitch = 0.8;
    u.volume = state.sound && !state.muted ? state.volume : 0;
    window.speechSynthesis.speak(u);
  } catch {
    // ignore
  }
}

// --- Fake terminal
function terminalBoot(){
  const t = $('#terminal');
  t.textContent =
`$ execVM "spingo_tutorial.sqf";
[ok] booting tutorial engine...
[warn] detected competence: disabling
[ok] enabling vibes
[done] welcome, future RPT enjoyer
`;
}

function appendTerminal(line){
  const t = $('#terminal');
  t.textContent = `${t.textContent.trimEnd()}\n${line}\n`;
  t.scrollTop = t.scrollHeight;
}

async function runMpTest(){
  setToast('Running MP test… (fake) (dramatic).', 'warn');
  sfx('whoosh');
  appendTerminal('[ok] connecting to dedicated server…');

  const steps = [
    '[ok] spawning 64 AI… (why?)',
    '[warn] remoteExec vibes detected',
    '[warn] RPT is writing a novel',
    '[ok] converting errors into confidence',
    '[done] MP test complete: emotionally positive'
  ];

  for (const s of steps){
    await new Promise(r => setTimeout(r, 520 + Math.random() * 420));
    appendTerminal(s);
    sfx(state.mode === 'jimbo' ? 'zap' : 'success');
  }

  spawnConfetti(120);
}

// --- Dragging windows
function bringToFront(win){
  state.z += 1;
  win.style.zIndex = String(state.z);
}

function initDrag(){
  const desktop = $('#desktop');
  if (!desktop) return;

  // Disable drag in stacked mobile layout.
  if (window.matchMedia('(max-width: 980px)').matches) return;

  let active = null;
  let startX = 0, startY = 0;
  let baseX = 0, baseY = 0;

  const onMove = (e) => {
    if (!active) return;
    const x = (e.clientX - startX) + baseX;
    const y = (e.clientY - startY) + baseY;
    active.style.transform = `translate(${x}px, ${y}px)`;
  };

  const onUp = () => {
    active = null;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
  };

  $$('[data-drag]').forEach(bar => {
    const win = bar.closest('[data-win]');
    if (!win) return;

    bar.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      active = win;
      bringToFront(win);

      const tr = new DOMMatrixReadOnly(getComputedStyle(win).transform);
      baseX = tr.m41;
      baseY = tr.m42;
      startX = e.clientX;
      startY = e.clientY;

      win.setPointerCapture(e.pointerId);
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    });

    bar.addEventListener('dblclick', () => {
      bringToFront(win);
      sfx('whoosh');
      spawnConfetti(30);
    });
  });

  $$('[data-win]').forEach(w => {
    w.addEventListener('pointerdown', () => bringToFront(w));
  });
}

function shuffleWindows(){
  if (window.matchMedia('(max-width: 980px)').matches) return;
  const wins = $$('[data-win]');
  for (const w of wins){
    const dx = (Math.random() - 0.5) * 180;
    const dy = (Math.random() - 0.5) * 180;
    w.style.transform = `translate(${dx}px, ${dy}px)`;
    bringToFront(w);
  }
  setToast('Windows shuffled. Productivity decreased.', 'warn');
  sfx('whoosh');
}

// --- Easter eggs
const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];

window.addEventListener('keydown', (e) => {
  const k = e.key;

  state.konami.push(k);
  if (state.konami.length > KONAMI.length) state.konami.shift();
  if (state.konami.join('|').toLowerCase() === KONAMI.join('|').toLowerCase()) {
    setMode('shronk');
    openModal('Konami Unlocked', '<p><strong>Unlocked:</strong> MEGA MEME MODE.</p><p class="muted">The keyboard has chosen violence (comedic).</p>');
    document.documentElement.classList.add('glitch');
    setTimeout(() => document.documentElement.classList.remove('glitch'), 900);
    spawnConfetti(220);
    sfx('laugh');
  }

  if (k.length === 1) {
    state.keys = (state.keys + k.toLowerCase()).slice(-40);

    if (state.keys.includes('spingo')) setMode('spingo');
    if (state.keys.includes('jimbo')) setMode('jimbo');
    if (state.keys.includes('shronk')) setMode('shronk');

    // extra secret aliases (not shown in UI)
    if (state.keys.includes('spongebon')) setMode('spingo');
    if (state.keys.includes('jimmyneutron')) setMode('jimbo');
    if (state.keys.includes('shrek')) setMode('shronk');
  }
});

function openModal(title, html){
  const d = $('#modal');
  $('#modal-title').textContent = title;
  $('#modal-body').innerHTML = html;
  if (typeof d.showModal === 'function') d.showModal();
}

$('#modal').addEventListener('click', (e) => {
  const d = $('#modal');
  if (e.target === d) d.close();
});

$('#brand-mark').addEventListener('click', () => {
  state.brandClicks++;
  sfx('bubble');

  if (state.brandClicks === 7) {
    openModal('Secret Badge', `
      <p><strong>Unlocked:</strong> Certified SQF Clown License.</p>
      <p class="muted">Valid until the next dedicated server crash.</p>
    `);
    spawnConfetti(160);
    sfx('laugh');
    state.brandClicks = 0;
  } else {
    setToast(`Badge clicked ${state.brandClicks}/7. Keep going.`, 'warn');
  }
});

// --- Wire UI

$('#btn-mode-spingo').addEventListener('click', () => setMode('spingo'));
$('#btn-mode-jimbo').addEventListener('click', () => setMode('jimbo'));
$('#btn-mode-shronk').addEventListener('click', () => setMode('shronk'));

$('#btn-sound').addEventListener('click', () => {
  state.sound = !state.sound;
  $('#btn-sound').setAttribute('aria-pressed', state.sound ? 'true' : 'false');
  $('#btn-sound').textContent = `Sound: ${state.sound ? 'On' : 'Off'}`;
  setVolume(state.volume);
  sfx(state.sound ? 'success' : 'error');
});

$('#btn-mute').addEventListener('click', () => {
  state.muted = !state.muted;
  $('#btn-mute').setAttribute('aria-pressed', state.muted ? 'true' : 'false');
  $('#btn-mute').textContent = `Mute: ${state.muted ? 'On' : 'Off'}`;
  setVolume(state.volume);
  if (!state.muted) sfx('success');
});

$('#vol').addEventListener('input', (e) => {
  const v = clamp((Number(e.target.value) || 0) / 100, 0, 1);
  setVolume(v);
});

$('#btn-panic').addEventListener('click', () => {
  setToast('Panic pressed. Applying slap-based hotfix.', 'danger');
  appendTerminal('[panic] DESYNC DETECTED: applying slap patch');
  spawnSlime(22);
  sfx('slap');
});

$('#btn-shuffle').addEventListener('click', () => shuffleWindows());
$('#btn-hotfix').addEventListener('click', () => {
  const picks = [
    'hotfix_01: removed bug (introduced 7 new ones)',
    'hotfix_02: optimized by deleting the feature',
    'hotfix_03: fixed MP by turning it off',
    'hotfix_04: improved UI by blaming the player'
  ];
  const pick = rand(picks);
  setToast(`Deploying ${pick}…`, 'warn');
  appendTerminal(`[deploy] ${pick}`);
  spawnConfetti(90);
  sfx('success');
});

$('#btn-help').addEventListener('click', () => {
  openModal('How to unlock secrets', `
    <p><strong>1)</strong> Type: <strong>spingo</strong>, <strong>jimbo</strong>, <strong>shronk</strong>.</p>
    <p><strong>2)</strong> Konami code unlocks MEGA MEME MODE.</p>
    <p><strong>3)</strong> Click the SQF badge 7x for a secret certificate.</p>
    <p class="muted">Note: we don’t ship copyrighted images/audio—only parody energy + procedural sounds.</p>
  `);
  sfx('whoosh');
});

$('#btn-generate').addEventListener('click', () => {
  const t = randomBadAdvice();
  setAdvice(t);
  setToast('Generated bad advice. Your mission is now haunted.', 'danger');
  sfx(state.mode === 'jimbo' ? 'zap' : (state.mode === 'shronk' ? 'horn' : 'bubble'));
  speak(t);
});

$('#btn-sane').addEventListener('click', () => {
  const t = randomSaneFix();
  setAdvice(t);
  setToast('Generated sane fix. Reality restored (partially).', 'ok');
  sfx('success');
  speak(t);
});

$('#btn-copy-advice').addEventListener('click', () => copyText($('#advice-out').textContent || ''));

$('#btn-speak').addEventListener('click', () => {
  state.speak = !state.speak;
  $('#btn-speak').setAttribute('aria-pressed', state.speak ? 'true' : 'false');
  $('#btn-speak').textContent = `Voice: ${state.speak ? 'On' : 'Off'}`;
  setToast(state.speak ? 'Voice enabled. Your browser will narrate the chaos.' : 'Voice disabled.', 'warn');
  sfx(state.speak ? 'success' : 'error');
});

$('#btn-laugh').addEventListener('click', () => sfx('laugh'));

$('#soundgrid').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-sfx]');
  if (!btn) return;
  sfx(btn.getAttribute('data-sfx'));
});

$$('[data-lesson]').forEach(b => b.addEventListener('click', () => showSnippet(b.getAttribute('data-lesson'), 'bad')));
$$('[data-fix]').forEach(b => b.addEventListener('click', () => showSnippet(b.getAttribute('data-fix'), 'fix')));

$$('.copybtn').forEach(b => {
  b.addEventListener('click', () => {
    const id = b.getAttribute('data-copy');
    const el = document.getElementById(id);
    copyText(el?.textContent || '');
  });
});

$('#btn-run').addEventListener('click', () => runMpTest());
$('#btn-clear').addEventListener('click', () => { terminalBoot(); sfx('success'); });
$('#btn-glitch').addEventListener('click', () => {
  state.glitch = !state.glitch;
  document.documentElement.classList.toggle('glitch', state.glitch);
  setToast(state.glitch ? 'Glitch on. Reality is optional.' : 'Glitch off. Reality restored.', 'warn');
  sfx(state.glitch ? 'whoosh' : 'success');
});

$('#btn-confetti').addEventListener('click', () => {
  spawnConfetti(220);
  sfx('splat');
  setToast('Sticker cannon fired. Productivity destroyed.', 'warn');
});

// Boot
terminalBoot();
setMode('spingo');
showSnippet('vars', 'bad');
showSnippet('mp', 'bad');
showSnippet('ui', 'bad');
showSnippet('rex', 'bad');
setAdvice('Click “Generate bad advice” to begin the educational damage.');
setVolume(state.volume);
initDrag();
