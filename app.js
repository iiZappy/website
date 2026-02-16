/* Spingo's SQF Academy interactions */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const state = {
  sound: false,
  muted: false,
  volume: 0.7,
  deadline: Date.now() + 10 * 60 * 1000,
  glitch: false,
  mode: 'spingo',
  keys: '',
  konami: [],
  brandClicks: 0,
};

function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }
function rand(arr){ return arr[Math.floor(Math.random() * arr.length)]; }

function fmtTime(ms){
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  const mm = String(m).padStart(2, '0');
  const rr = String(r).padStart(2, '0');
  return `00:${mm}:${rr}`;
}

function openModal(title, html){
  const d = $('#modal');
  $('#modal-title').textContent = title;
  $('#modal-body').innerHTML = html;
  if (typeof d.showModal === 'function') d.showModal();
}

function setPill(text, mood = 'ok'){
  const el = $('#pill-status');
  el.textContent = text;
  el.classList.remove('wiggle');
  if (mood === 'warn') {
    el.style.borderColor = 'rgba(255,211,124,0.35)';
  } else if (mood === 'danger') {
    el.style.borderColor = 'rgba(255,143,163,0.35)';
  } else {
    el.style.borderColor = 'rgba(255,255,255,0.14)';
  }
}

function setMode(mode){
  state.mode = mode;
  document.documentElement.classList.toggle('mode-spingo', mode === 'spingo');
  document.documentElement.classList.toggle('mode-jimbo', mode === 'jimbo');
  document.documentElement.classList.toggle('mode-shronk', mode === 'shronk');

  const msg = {
    spingo: 'Spingo mode enabled. Bubbles are now considered documentation.',
    jimbo: 'Jimbo mode enabled. Your brain is about to do something questionable.',
    shronk: 'Shronk mode enabled. The tutorial will yell correct-sounding nonsense.'
  }[mode] || 'Mode set.';

  setPill(msg, 'warn');
  if (mode === 'spingo') sfx('bubble');
  if (mode === 'jimbo') sfx('zap');
  if (mode === 'shronk') sfx('horn');

  $('#gen-out').textContent = `Mode: ${mode}. Type “spingo”, “jimbo”, or “shronk”.`;
}

// --- WebAudio SFX (procedural; no external assets)
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

function sfx(type){
  if (!state.sound || state.muted) return;
  const a = audioInit();
  if (!a) return;

  // Some browsers start suspended; resume on user gesture.
  if (a.ctx.state === 'suspended') {
    a.ctx.resume().catch(() => {});
  }

  // Keep master in sync.
  a.master.gain.value = state.volume;

  const now = a.ctx.currentTime;

  const osc = (freq, wave = 'sine') => {
    const o = a.ctx.createOscillator();
    o.type = wave;
    o.frequency.setValueAtTime(freq, now);
    return o;
  };

  const envGain = () => {
    const g = a.ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    return g;
  };

  const blip = (f0, f1, dur, wave = 'square') => {
    const o = osc(f0, wave);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), now + dur);
    const g = envGain();
    g.gain.exponentialRampToValueAtTime(0.16, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.connect(g);
    g.connect(a.master);
    o.start(now);
    o.stop(now + dur + 0.02);
  };

  const noise = (dur, color = 'white') => {
    const len = Math.floor(a.ctx.sampleRate * dur);
    const buf = a.ctx.createBuffer(1, len, a.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i=0;i<len;i++){
      const w = (Math.random() * 2 - 1);
      if (color === 'pink') {
        data[i] = w * 0.35 * (1 - i / len);
      } else {
        data[i] = w * 0.30;
      }
    }
    const src = a.ctx.createBufferSource();
    src.buffer = buf;
    return src;
  };

  if (type === 'bubble'){
    blip(420 + Math.random()*140, 120 + Math.random()*60, 0.10, 'sine');
    if (!prefersReduced) spawnBubbles(20);
    return;
  }

  if (type === 'zap'){
    blip(1200, 160, 0.12, 'sawtooth');
    blip(600, 2400, 0.06, 'square');
    if (!prefersReduced) spawnStars(60);
    return;
  }

  if (type === 'horn'){
    blip(110, 78, 0.20, 'triangle');
    blip(220, 110, 0.22, 'triangle');
    if (!prefersReduced) spawnConfetti(160);
    return;
  }

  if (type === 'boing'){
    blip(500, 140, 0.18, 'sine');
    return;
  }

  if (type === 'honk'){
    blip(260, 180, 0.22, 'square');
    const n = noise(0.08, 'white');
    const g = envGain();
    g.gain.exponentialRampToValueAtTime(0.11, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
    n.connect(g);
    g.connect(a.master);
    n.start(now);
    n.stop(now + 0.10);
    return;
  }

  if (type === 'beep'){
    blip(880, 740, 0.10, 'square');
    blip(740, 660, 0.08, 'square');
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
  const cx = w * 0.5;
  const cy = h * 0.22;
  const c = prefersReduced ? Math.floor(count * 0.4) : count;
  for (let i=0;i<c;i++){
    parts.push({
      kind: 'confetti',
      x: cx + (Math.random()-0.5) * w * 0.35,
      y: cy + (Math.random()-0.5) * h * 0.10,
      vx: (Math.random()-0.5) * 6.5,
      vy: Math.random() * -6.5 - 2.5,
      g: 0.14 + Math.random() * 0.12,
      r: 2 + Math.random() * 4,
      a: 1,
      rot: Math.random() * Math.PI,
      vr: (Math.random()-0.5) * 0.25,
      c: rand(colors)
    });
  }
}

function spawnBubbles(count = 30){
  const w = fx.width;
  const h = fx.height;
  const c = prefersReduced ? Math.floor(count * 0.4) : count;
  for (let i=0;i<c;i++){
    parts.push({
      kind: 'bubble',
      x: (Math.random() * w),
      y: h + Math.random() * h * 0.15,
      vx: (Math.random()-0.5) * 0.8,
      vy: -(1.2 + Math.random() * 2.4),
      r: 3 + Math.random() * 10,
      a: 0.85,
      c: 'rgba(124,243,255,0.55)'
    });
  }
}

function spawnStars(count = 50){
  const w = fx.width;
  const h = fx.height;
  const c = prefersReduced ? Math.floor(count * 0.4) : count;
  for (let i=0;i<c;i++){
    parts.push({
      kind: 'star',
      x: w * 0.5 + (Math.random()-0.5) * w * 0.45,
      y: h * 0.26 + (Math.random()-0.5) * h * 0.18,
      vx: (Math.random()-0.5) * 10,
      vy: (Math.random()-0.5) * 10,
      r: 1 + Math.random() * 2.5,
      a: 1,
      c: rand(['#7cf3ff', '#fff27c', '#ffffff'])
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
  }

  requestAnimationFrame(tickFx);
}
requestAnimationFrame(tickFx);

// --- Tutorial content (bad advice vs fix)
const snippets = {
  vars: {
    bad: `// SPINGO ADVICE (WRONG)
myVar = 123; // global, no private, no context
hint str myVar;

// If it breaks, rename it to myVar2 until it works.`,
    fix: `// DO THIS INSTEAD (SANE)
private _myVar = 123;
hint str _myVar;

// Use private vars inside functions.
// Use missionNamespace/setVariable when you *actually* need globals.`
  },
  mp: {
    bad: `// JIMBO ADVICE (WRONG)
[] spawn {
  while {true} do {
    // Run on every client, every frame. What could go wrong?
    player setDamage 0;
  };
};`,
    fix: `// DO THIS INSTEAD (SANE)
// Put authority on the server, and replicate with setVariable/remoteExec intentionally.
if (isServer) then {
  // server-side state changes
};

// Client uses events/remoteExec handlers to update UI, not the whole game loop.`
  },
  ui: {
    bad: `// SHRONK ADVICE (WRONG)
[] spawn {
  while {true} do {
    createDialog "RscDisplayInventory";
  };
};`,
    fix: `// DO THIS INSTEAD (SANE)
// Create dialogs on demand (button/action), and close them properly.
createDialog "MyDialog";

// For HUD: use RscTitles + onEachFrame carefully (or scheduled loops with uiSleep).`
  },
  rex: {
    bad: `// SPINGO ADVICE (WRONG)
// Broadcast everything to everyone. Security is a vibe.
[player] remoteExec ["my_fnc_doTheThing", 0, true];`,
    fix: `// DO THIS INSTEAD (SANE)
// Use targeted remoteExec and validate caller on server.
// Example idea:
// - client requests: [player] remoteExecCall ["srv_fnc_request", 2];
// - server checks owner UID/remoteExecutedOwner, proximity, cooldowns, etc.`
  }
};

function showSnippet(id, kind){
  const el = $(`#code-${id}`);
  if (!el) return;
  el.textContent = (snippets[id] && snippets[id][kind]) ? snippets[id][kind] : 'Missing snippet.';
  if (kind === 'bad') {
    setPill(`${id.toUpperCase()}: Spingo/Jimbo/Shronk advice loaded. Please do not deploy this.`, 'danger');
    sfx(state.mode === 'jimbo' ? 'zap' : (state.mode === 'shronk' ? 'horn' : 'bubble'));
  } else {
    setPill(`${id.toUpperCase()}: Actual sane alternative loaded. Your server thanks you.`, 'ok');
    sfx('beep');
  }
}

// --- Random advice generator
function randomAdvice(){
  const openers = ['Hot take:', 'Pro tip:', 'Advanced technique:', 'Certified advice:', 'MP-safe rumor:', 'Forum wisdom:'];
  const lines = [
    'If it desyncs, increase confidence by 12%.',
    'Add more sleep. If it still lags, add less sleep.',
    'Never test on a dedicated server. It ruins the mystery.',
    'Variables are like feelings: best shared globally without warning.',
    'If your UI flickers, it is just the game blinking in Morse code.',
    'RemoteExec to everyone to build community.',
    'If it works once, ship it and write a tutorial immediately.',
    'Rename the function until the bug gets tired and leaves.'
  ];

  const fix = [
    'Reality check: define scope, validate remote calls, and measure performance.',
    'Reality check: do server authority where needed; keep clients UI-only.',
    'Reality check: avoid tight loops; prefer events and rate-limited polling.',
    'Reality check: use private variables and namespaces intentionally.'
  ];

  return `${rand(openers)} ${rand(lines)}\n\nActually: ${rand(fix)}`;
}

function appendTerminal(line){
  const el = $('#terminal');
  el.textContent = `${el.textContent.trimEnd()}\n${line}\n`;
}

function clearTerminal(){
  $('#terminal').textContent = '$ execVM "spingo_tutorial.sqf";\n';
}

function copyText(text){
  const status = $('#copy-status');
  status.textContent = '';

  const done = () => {
    status.textContent = 'Copied.';
    setTimeout(() => { status.textContent = ''; }, 1600);
  };

  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => {
      status.textContent = 'Copy failed (browser said no).';
    });
  } else {
    status.textContent = 'Clipboard API unavailable.';
  }
}

// --- Init controls

$('#btn-sound').addEventListener('click', () => {
  state.sound = !state.sound;
  $('#btn-sound').setAttribute('aria-pressed', state.sound ? 'true' : 'false');
  $('#btn-sound').textContent = `Sound: ${state.sound ? 'On' : 'Off'}`;
  setVolume(state.volume);
  sfx(state.sound ? 'beep' : 'boing');
});

$('#btn-mute').addEventListener('click', () => {
  state.muted = !state.muted;
  $('#btn-mute').setAttribute('aria-pressed', state.muted ? 'true' : 'false');
  $('#btn-mute').textContent = `Mute: ${state.muted ? 'On' : 'Off'}`;
  setVolume(state.volume);
  if (!state.muted) sfx('beep');
});

$('#vol').addEventListener('input', (e) => {
  const v = clamp((Number(e.target.value) || 0) / 100, 0, 1);
  setVolume(v);
});
setVolume(state.volume);

$('#risk').addEventListener('input', (e) => {
  const vv = clamp(Number(e.target.value) || 0, 0, 100);
  const t = $('#risk-text');
  const labels = [
    { max: 20, txt: `${vv}% confident (harmless)` },
    { max: 45, txt: `${vv}% confident (dangerous)` },
    { max: 70, txt: `${vv}% confident (forum-ready)` },
    { max: 90, txt: `${vv}% confident (dedicated server trembling)` },
    { max: 100, txt: `${vv}% confident (cosmic desync)` },
  ];
  t.textContent = labels.find(x => vv <= x.max).txt;
  if (vv % 25 === 0) sfx('beep');
});

function resetCountdown(){ state.deadline = Date.now() + 10 * 60 * 1000; }
setInterval(() => {
  const left = state.deadline - Date.now();
  if (left <= 0) resetCountdown();
  $('#countdown').textContent = fmtTime(state.deadline - Date.now());
}, 200);

$('#btn-terms').addEventListener('click', () => {
  sfx('beep');
  openModal('Best Practices (Written by Spingo)', `
    <p><strong>1.</strong> Use <em>private</em> variables unless you enjoy haunted scripts.</p>
    <p><strong>2.</strong> In MP: decide who is authoritative (usually server), then replicate intentionally.</p>
    <p><strong>3.</strong> Rate-limit loops. Events are your friend.</p>
    <p><strong>4.</strong> If Shronk says “spawn it every frame”, do not.</p>
  `);
});

$('#btn-copy').addEventListener('click', () => {
  copyText('CERTIFIED SQF EXPERT (self-declared) — Spingo-approved.');
  sfx('bubble');
});

$('#btn-random').addEventListener('click', () => {
  const out = randomAdvice();
  $('#gen-out').textContent = out;
  $('#gen-out').classList.remove('wiggle');
  void $('#gen-out').offsetWidth;
  $('#gen-out').classList.add('wiggle');
  sfx(state.mode === 'jimbo' ? 'zap' : 'bubble');
});

$('#btn-live').addEventListener('click', async () => {
  setPill('Running MP test… (fake) (dramatic)', 'warn');
  appendTerminal('[ok] connecting to dedicated server…');
  sfx('beep');

  const steps = [
    '[ok] spawning 64 AI… (why?)',
    '[warn] remoteExec vibes detected',
    '[ok] converting errors into confidence',
    '[warn] desync probability rising',
    '[done] MP test complete: results are emotionally positive'
  ];

  for (const s of steps){
    await new Promise(r => setTimeout(r, 520 + Math.random() * 420));
    appendTerminal(s);
    sfx(state.mode === 'jimbo' ? 'zap' : 'beep');
  }

  spawnConfetti(130);
});

$('#btn-compile').addEventListener('click', () => {
  const plan = $('input[name="plan"]:checked')?.value || 'spingo';
  const mission = ($('#mission').value || '').trim();
  const risk = Number($('#risk').value) || 0;

  setMode(plan);

  setPill('Tutorial published. Source: vibes. QA: none.', 'ok');
  openModal('Tutorial Published', `
    <p><strong>Published:</strong> ${plan.toUpperCase()} tutorial pack.</p>
    <p>Mission: <strong>${mission ? mission.replaceAll('<','&lt;') : '(none)'}</strong> (ignored respectfully).</p>
    <p>Confidence: <strong>${risk}%</strong>.</p>
    <hr />
    <p class="muted">No uploads happened. Your browser is safe. Your ego is not.</p>
  `);

  spawnConfetti(90);
  sfx('horn');
});

$('#btn-panic').addEventListener('click', () => {
  const n = Number($('#stat-errors').textContent) || 0;
  $('#stat-errors').textContent = String(n + 1);
  setPill('Panic button pressed. Blaming the engine…', 'danger');
  appendTerminal('[panic] DESYNC DETECTED: applying bubble patch');
  spawnBubbles(42);
  sfx('honk');
});

$('#btn-glitch').addEventListener('click', () => {
  state.glitch = !state.glitch;
  document.documentElement.classList.toggle('glitch', state.glitch);
  appendTerminal(state.glitch ? '[warn] glitch mode enabled (cosmetic)' : '[ok] glitch mode disabled');
  sfx(state.glitch ? 'zap' : 'beep');
});

$('#btn-clear').addEventListener('click', () => {
  clearTerminal();
  sfx('boing');
});

$('#btn-confetti').addEventListener('click', (e) => {
  e.preventDefault();
  spawnConfetti(180);
  sfx('horn');
});

$('#btn-easter').addEventListener('click', () => {
  const hotfixes = [
    'hotfix_01: removed bug (introduced 7 new ones)',
    'hotfix_02: optimized by deleting the feature',
    'hotfix_03: fixed MP by turning it off',
    'hotfix_04: improved UI by blaming the player'
  ];
  const pick = rand(hotfixes);
  setPill(`Deploying ${pick}…`, 'warn');
  appendTerminal(`[deploy] ${pick}`);
  spawnConfetti(120);
  sfx('beep');
});

// Soundboard buttons
$('#soundboard').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-sfx]');
  if (!btn) return;
  const t = btn.getAttribute('data-sfx');
  sfx(t);
});

// Lessons
$$('[data-lesson]').forEach(b => {
  b.addEventListener('click', () => showSnippet(b.getAttribute('data-lesson'), 'bad'));
});
$$('[data-fix]').forEach(b => {
  b.addEventListener('click', () => showSnippet(b.getAttribute('data-fix'), 'fix'));
});

// Copy buttons
$$('.copybtn').forEach(b => {
  b.addEventListener('click', () => {
    const id = b.getAttribute('data-copy');
    const el = document.getElementById(id);
    if (el) copyText(el.textContent || '');
    sfx('bubble');
  });
});

// Summon buttons
$('#btn-spingo').addEventListener('click', () => {
  setMode('spingo');
  appendTerminal('[spingo] i love global variables');
  spawnBubbles(36);
});
$('#btn-jimbo').addEventListener('click', () => {
  setMode('jimbo');
  appendTerminal('[jimbo] brain moment detected: remoteExec everything');
  spawnStars(80);
});
$('#btn-shronk').addEventListener('click', () => {
  setMode('shronk');
  appendTerminal('[shronk] UI IS EASY. JUST SPAWN IT HARDER.');
  spawnConfetti(140);
});

// Checklist reacts
$$('.chk').forEach((c, idx) => {
  c.addEventListener('change', () => {
    const checked = $$('.chk').filter(x => x.checked).length;
    const msg = [
      'Checklist started. The server is already sweating.',
      'MP test skipped successfully.',
      'Blame assigned: engine.',
      'Shipped. Congratulations: you are now a tradition.'
    ][clamp(checked - 1, 0, 3)];
    setPill(msg, checked === 4 ? 'ok' : 'warn');
    if (checked === 4) spawnConfetti(120);
    sfx(checked === 4 ? 'horn' : 'beep');
  });
});

// Secret typing + Konami code
const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];

window.addEventListener('keydown', (e) => {
  const k = e.key;

  // Konami tracking
  state.konami.push(k);
  if (state.konami.length > KONAMI.length) state.konami.shift();
  if (state.konami.join('|').toLowerCase() === KONAMI.join('|').toLowerCase()) {
    setMode('shronk');
    openModal('Konami Unlocked', '<p><strong>Unlocked:</strong> SHRONK MODE.</p><p class="muted">Your keyboard has chosen chaos.</p>');
    spawnConfetti(200);
    sfx('horn');
  }

  // Typing buffer
  if (k.length === 1) {
    state.keys = (state.keys + k.toLowerCase()).slice(-24);
    if (state.keys.includes('spingo')) setMode('spingo');
    if (state.keys.includes('jimbo')) setMode('jimbo');
    if (state.keys.includes('shronk')) setMode('shronk');
  }
});

// Brand click easter egg
$('#brand-mark').addEventListener('click', () => {
  state.brandClicks++;
  sfx('bubble');
  if (state.brandClicks === 7) {
    openModal('Secret Certification', `
      <p><strong>Congratulations:</strong> you unlocked the <strong>Certified SQF Clown License</strong>.</p>
      <p class="muted">Valid until your next dedicated server crash.</p>
    `);
    spawnConfetti(160);
    sfx('honk');
    state.brandClicks = 0;
  } else {
    setPill(`Brand clicked ${state.brandClicks}/7. Keep going.`, 'warn');
  }
});

// Close modal on backdrop click
$('#modal').addEventListener('click', (e) => {
  const d = $('#modal');
  if (e.target === d) d.close();
});

// Boot
setMode('spingo');
showSnippet('vars', 'bad');
showSnippet('mp', 'bad');
showSnippet('ui', 'bad');
showSnippet('rex', 'bad');
