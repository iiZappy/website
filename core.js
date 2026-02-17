/* Shared core: state, mode, toasts, SFX (procedural + optional samples), FX canvas, modal helpers */

(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const state = {
    sound: true,
    muted: false,
    volume: 0.7,
    mode: 'clown',
    keys: '',
    konami: [],
  };

  function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }
  function rand(arr){ return arr[Math.floor(Math.random() * arr.length)]; }

  function setToast(text, mood = 'ok'){
    const el = $('#toast') || $('#pill-status');
    if (!el) return;
    el.textContent = text;
    el.dataset.mood = mood;
  }

  function closeModal(){
    const d = $('#modal');
    if (!d) return;
    try {
      if (typeof d.close === 'function') d.close();
      else d.removeAttribute('open');
    } catch (_) {
      try { d.removeAttribute('open'); } catch(_) {}
    }
    document.body.classList.remove('modal-open');
  }

  function openModal(title, html){
    const d = $('#modal');
    if (!d) return;
    const t = $('#modal-title');
    const b = $('#modal-body');
    if (t) t.textContent = title;
    if (b) b.innerHTML = html;

    document.body.classList.add('modal-open');

    if (typeof d.showModal === 'function') {
      try { d.showModal(); } catch(_) { d.setAttribute('open',''); }
    } else {
      d.setAttribute('open','');
    }
  }

  // ensure modal-open is cleared on native close
  const modal = $('#modal');
  if (modal) {
    modal.addEventListener('close', () => document.body.classList.remove('modal-open'));
    modal.addEventListener('cancel', () => document.body.classList.remove('modal-open'));
  }

  // --- WebAudio + samples
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

  // Add as many variants as you want; we randomize WITHOUT repeating the last variant.
  const localCandidates = {
    bubble: ['assets/sfx/bubble', 'assets/sfx/ui_bubble'],
    zap: ['assets/sfx/zap', 'assets/sfx/ui_zap'],
    horn: ['assets/sfx/horn', 'assets/sfx/ui_horn'],
    whoosh: ['assets/sfx/whoosh', 'assets/sfx/ui_whoosh'],
    slap: ['assets/sfx/slap', 'assets/sfx/ui_slap'],
    splat: ['assets/sfx/splat', 'assets/sfx/ui_splat'],
    laugh: ['assets/sfx/laugh', 'assets/sfx/ui_laugh'],
    success: ['assets/sfx/success', 'assets/sfx/ui_success'],
    error: ['assets/sfx/error', 'assets/sfx/ui_error'],

    like: ['assets/sfx/like_1', 'assets/sfx/like_2', 'assets/sfx/like_3', 'assets/sfx/like_4'],
    comment: ['assets/sfx/comment_1', 'assets/sfx/comment_2', 'assets/sfx/comment_3'],
    follow: ['assets/sfx/follow_1', 'assets/sfx/follow_2', 'assets/sfx/follow_3'],
    notif: ['assets/sfx/notif_1', 'assets/sfx/notif_2', 'assets/sfx/notif_3'],
    tab: ['assets/sfx/tab_1', 'assets/sfx/tab_2', 'assets/sfx/tab_3'],
    post: ['assets/sfx/post_1', 'assets/sfx/post_2', 'assets/sfx/post_3'],
    refresh: ['assets/sfx/refresh_1', 'assets/sfx/refresh_2', 'assets/sfx/refresh_3'],
  };

  // type -> AudioBuffer[]
  const sampleCache = new Map();
  const sampleBroken = new Set();
  const sampleLoading = new Set();
  const lastVariantIndex = new Map();

  async function fetchFirstExisting(base){
    if (/\.(mp3|ogg|wav)(\?.*)?$/i.test(base)) {
      try {
        const res = await fetch(base, { cache: 'force-cache' });
        if (!res.ok) return null;
        return await res.arrayBuffer();
      } catch (_) { return null; }
    }

    const exts = ['.mp3', '.ogg', '.wav'];
    for (const ext of exts) {
      const url = `${base}${ext}`;
      try {
        const res = await fetch(url, { cache: 'force-cache' });
        if (!res.ok) continue;
        return await res.arrayBuffer();
      } catch (_) {}
    }
    return null;
  }

  async function loadSample(type){
    if (sampleBroken.has(type) || sampleLoading.has(type)) return;

    const a = audioInit();
    if (!a) return;

    const pool = localCandidates[type] || [];
    if (!pool.length) {
      sampleBroken.add(type);
      return;
    }

    sampleLoading.add(type);
    try {
      const out = [];
      for (const base of pool) {
        const buf = await fetchFirstExisting(base);
        if (!buf) continue;
        try {
          const decoded = await a.ctx.decodeAudioData(buf.slice(0));
          out.push(decoded);
        } catch (_) {}
      }

      if (!out.length) sampleBroken.add(type);
      else sampleCache.set(type, out);
    } finally {
      sampleLoading.delete(type);
    }
  }

  function pickVariant(type, arr){
    if (!arr || !arr.length) return null;
    if (arr.length === 1) return { buf: arr[0], idx: 0 };

    const last = lastVariantIndex.get(type);
    let idx = Math.floor(Math.random() * arr.length);

    if (typeof last === 'number' && arr.length > 1 && idx === last) {
      idx = (idx + 1 + Math.floor(Math.random() * (arr.length - 1))) % arr.length;
    }

    lastVariantIndex.set(type, idx);
    return { buf: arr[idx], idx };
  }

  function playSample(type){
    if (!state.sound || state.muted) return false;
    if (sampleBroken.has(type)) return false;

    const a = audioInit();
    if (!a) return false;
    if (a.ctx.state === 'suspended') a.ctx.resume().catch(() => {});
    a.master.gain.value = state.volume;

    const arr = sampleCache.get(type);
    if (!arr || !arr.length) return false;

    const v = pickVariant(type, arr);
    if (!v?.buf) return false;

    const src = a.ctx.createBufferSource();
    src.buffer = v.buf;
    src.connect(a.master);
    try { src.start(); } catch (_) {}
    return true;
  }

  function primeSamples(){
    Object.keys(localCandidates).forEach(t => loadSample(t));
  }

  // --- Procedural SFX (fallback)
  function env(g, now, a=0.006, d=0.14, peak=0.18){
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(peak, now + a);
    g.gain.exponentialRampToValueAtTime(0.0001, now + d);
  }

  function sfx(type){
    if (!state.sound || state.muted) return;

    if (playSample(type)) return;
    loadSample(type);

    const a = audioInit();
    if (!a) return;
    if (a.ctx.state === 'suspended') a.ctx.resume().catch(() => {});
    a.master.gain.value = state.volume;

    const now = a.ctx.currentTime;

    const g = () => a.ctx.createGain();

    const osc = (freq, wave='sine') => {
      const o = a.ctx.createOscillator();
      o.type = wave;
      o.frequency.setValueAtTime(freq, now);
      return o;
    };

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
      env(gg, now, 0.006, dur, peak);
      o.connect(gg);
      gg.connect(a.master);
      o.start(now);
      o.stop(now + dur + 0.02);
    };

    if (type === 'whoosh'){
      const n = noise(0.20, 0.22);
      const flt = a.ctx.createBiquadFilter();
      flt.type = 'bandpass';
      flt.frequency.setValueAtTime(280, now);
      flt.frequency.exponentialRampToValueAtTime(2400, now + 0.20);
      const gg = g();
      env(gg, now, 0.006, 0.24, 0.16);
      n.connect(flt);
      flt.connect(gg);
      gg.connect(a.master);
      n.start(now);
      n.stop(now + 0.22);
      return;
    }

    if (type === 'error'){
      blip(210, 150, 0.14, 'square', 0.18);
      blip(150, 90, 0.18, 'square', 0.18);
      return;
    }
    if (type === 'success'){
      blip(640, 960, 0.12, 'square', 0.14);
      blip(960, 1320, 0.10, 'square', 0.11);
      return;
    }
    if (type === 'notif'){
      blip(1320, 1320, 0.05, 'sine', 0.12);
      blip(1760, 1760, 0.06, 'sine', 0.10);
      return;
    }
    if (type === 'tab'){
      sfx('whoosh');
      return;
    }

    // fallback
    blip(520, 420, 0.08, 'sine', 0.10);
  }

  // --- FX canvas
  const fx = document.getElementById('fx');
  const fxc = fx ? fx.getContext('2d') : null;
  let parts = [];

  function resizeFx(){
    if (!fx) return;
    fx.width = window.innerWidth * devicePixelRatio;
    fx.height = window.innerHeight * devicePixelRatio;
  }
  window.addEventListener('resize', resizeFx);
  resizeFx();

  function spawnConfetti(count = 80){
    if (!fx) return;
    const w = fx.width;
    const h = fx.height;
    const colors = ['#1877F2', '#F02849', '#42B72A', '#F7B928', '#111111'];
    const c = prefersReduced ? Math.floor(count * 0.4) : count;
    for (let i=0;i<c;i++){
      parts.push({
        kind: 'confetti',
        x: w * (0.2 + Math.random() * 0.6),
        y: h * (0.10 + Math.random() * 0.10),
        vx: (Math.random()-0.5) * 6,
        vy: Math.random() * -6 - 2,
        g: 0.16 + Math.random() * 0.14,
        r: 2 + Math.random() * 4,
        a: 1,
        rot: Math.random() * Math.PI,
        vr: (Math.random()-0.5) * 0.25,
        c: rand(colors)
      });
    }
  }

  function spawnStars(count = 60){
    if (!fx) return;
    const w = fx.width;
    const h = fx.height;
    const c = prefersReduced ? Math.floor(count * 0.35) : count;
    for (let i=0;i<c;i++){
      parts.push({
        kind: 'star',
        x: w * (0.15 + Math.random() * 0.7),
        y: h * (0.10 + Math.random() * 0.22),
        vx: (Math.random()-0.5) * 8,
        vy: Math.random() * -8 - 2,
        g: 0.18 + Math.random() * 0.18,
        r: 3 + Math.random() * 6,
        a: 1,
        rot: Math.random() * Math.PI,
        vr: (Math.random()-0.5) * 0.35,
      });
    }
  }

  function spawnBubbles(count = 18){
    if (!fx) return;
    const w = fx.width;
    const h = fx.height;
    const c = prefersReduced ? Math.floor(count * 0.4) : count;
    for (let i=0;i<c;i++){
      parts.push({
        kind: 'bubble',
        x: w * (0.2 + Math.random() * 0.6),
        y: h * (0.75 + Math.random() * 0.18),
        vx: (Math.random()-0.5) * 1.6,
        vy: - (1.2 + Math.random() * 2.6),
        g: -0.005,
        r: 5 + Math.random() * 10,
        a: 0.85,
      });
    }
  }

  function spawnSlime(count = 14){
    if (!fx) return;
    const w = fx.width;
    const h = fx.height;
    const c = prefersReduced ? Math.floor(count * 0.45) : count;
    for (let i=0;i<c;i++){
      parts.push({
        kind: 'slime',
        x: w * (0.25 + Math.random() * 0.5),
        y: h * (0.12 + Math.random() * 0.10),
        vx: (Math.random()-0.5) * 4,
        vy: Math.random() * -3 - 1,
        g: 0.20 + Math.random() * 0.15,
        r: 4 + Math.random() * 10,
        a: 0.95,
      });
    }
  }

  function tickFx(){
    if (!fxc || !fx) {
      requestAnimationFrame(tickFx);
      return;
    }

    fxc.clearRect(0,0,fx.width,fx.height);
    parts = parts.filter(p => p.a > 0.02);

    for (const p of parts){
      p.vy += (p.g || 0);
      p.x += (p.vx || 0);
      p.y += (p.vy || 0);
      if (p.rot != null) p.rot += (p.vr || 0);
      p.a *= 0.985;

      if (p.kind === 'confetti') {
        fxc.save();
        fxc.globalAlpha = p.a;
        fxc.translate(p.x, p.y);
        fxc.rotate(p.rot || 0);
        fxc.fillStyle = p.c || '#1877F2';
        fxc.fillRect(-p.r, -p.r, p.r*2.2, p.r*2.2);
        fxc.restore();
        continue;
      }

      if (p.kind === 'star') {
        fxc.save();
        fxc.globalAlpha = p.a;
        fxc.translate(p.x, p.y);
        fxc.rotate(p.rot || 0);
        const r = p.r || 6;
        fxc.fillStyle = 'rgba(247,185,40,0.95)';
        fxc.beginPath();
        for (let i=0;i<5;i++){
          const a1 = (i * 2 * Math.PI) / 5;
          const a2 = a1 + Math.PI / 5;
          fxc.lineTo(Math.cos(a1) * r, Math.sin(a1) * r);
          fxc.lineTo(Math.cos(a2) * (r*0.45), Math.sin(a2) * (r*0.45));
        }
        fxc.closePath();
        fxc.fill();
        fxc.restore();
        continue;
      }

      if (p.kind === 'bubble') {
        fxc.save();
        fxc.globalAlpha = p.a;
        fxc.strokeStyle = 'rgba(45,136,255,0.55)';
        fxc.lineWidth = 2 * devicePixelRatio;
        fxc.beginPath();
        fxc.arc(p.x, p.y, p.r, 0, Math.PI*2);
        fxc.stroke();
        fxc.restore();
        continue;
      }

      if (p.kind === 'slime') {
        fxc.save();
        fxc.globalAlpha = p.a;
        fxc.fillStyle = 'rgba(66,183,42,0.85)';
        fxc.beginPath();
        fxc.arc(p.x, p.y, p.r, 0, Math.PI*2);
        fxc.fill();
        fxc.restore();
        continue;
      }
    }

    requestAnimationFrame(tickFx);
  }
  requestAnimationFrame(tickFx);

  function setMode(mode){
    state.mode = mode;
    document.documentElement.dataset.mode = mode;
  }

  // Export
  window.MemeCore = {
    $,
    $$,
    state,
    clamp,
    rand,
    setToast,
    openModal,
    closeModal,
    setMode,
    setVolume,
    primeSamples,
    sfx,
    spawnConfetti,
    spawnStars,
    spawnBubbles,
    spawnSlime,
  };
})();
