/* Shared core: state, mode, pro-ish toasts, SFX (procedural + optional samples), FX canvas */

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

  function openModal(title, html){
    const d = $('#modal');
    if (!d) return;
    const t = $('#modal-title');
    const b = $('#modal-body');
    if (t) t.textContent = title;
    if (b) b.innerHTML = html;
    if (typeof d.showModal === 'function') d.showModal();
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

    like: ['assets/sfx/like_1', 'assets/sfx/like_2', 'assets/sfx/like_3'],
    comment: ['assets/sfx/comment_1', 'assets/sfx/comment_2'],
    follow: ['assets/sfx/follow_1', 'assets/sfx/follow_2'],
    notif: ['assets/sfx/notif_1', 'assets/sfx/notif_2'],
    tab: ['assets/sfx/tab_1', 'assets/sfx/tab_2'],
    post: ['assets/sfx/post_1', 'assets/sfx/post_2'],
    refresh: ['assets/sfx/refresh_1', 'assets/sfx/refresh_2'],
  };

  const sampleCache = new Map();
  const sampleBroken = new Set();
  const sampleLoading = new Set();

  async function fetchFirstExisting(base){
    // If base already includes an extension, fetch it directly.
    if (/\.(mp3|ogg|wav)(\?.*)?$/i.test(base)) {
      try {
        const res = await fetch(base, { cache: 'force-cache' });
        if (!res.ok) return null;
        return await res.arrayBuffer();
      } catch (_) { return null; }
    }

    // Otherwise try common extensions.
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
    if (sampleBroken.has(type) || sampleCache.has(type) || sampleLoading.has(type)) return;
    const a = audioInit();
    if (!a) return;

    const pool = localCandidates[type] || [];
    if (!pool.length) {
      sampleBroken.add(type);
      return;
    }

    sampleLoading.add(type);
    try {
      // try all candidates until one loads
      for (const base of pool) {
        const buf = await fetchFirstExisting(base);
        if (!buf) continue;
        const decoded = await a.ctx.decodeAudioData(buf.slice(0));
        sampleCache.set(type, decoded);
        sampleLoading.delete(type);
        return;
      }

      sampleBroken.add(type);
    } catch (_) {
      sampleBroken.add(type);
    } finally {
      sampleLoading.delete(type);
    }
  }

  function playSample(type){
    if (!state.sound || state.muted) return false;
    if (sampleBroken.has(type)) return false;

    const a = audioInit();
    if (!a) return false;
    if (a.ctx.state === 'suspended') a.ctx.resume().catch(() => {});
    a.master.gain.value = state.volume;

    const buf = sampleCache.get(type);
    if (!buf) return false;

    const src = a.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(a.master);
    try { src.start(); } catch (_) {}
    return true;
  }

  function primeSamples(){
    Object.keys(localCandidates).forEach(t => loadSample(t));
  }

  // --- Procedural SFX (less "pling", more "clown UI")
  function env(g, now, a=0.006, d=0.14, peak=0.18){
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(peak, now + a);
    g.gain.exponentialRampToValueAtTime(0.0001, now + d);
  }

  function sfx(type){
    if (!state.sound || state.muted) return;

    // Try local sample first.
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

    // Old types
    if (type === 'bubble'){
      blip(520 + Math.random()*160, 180 + Math.random()*60, 0.10, 'sine', 0.16);
      if (!prefersReduced) spawnBubbles(14);
      return;
    }
    if (type === 'zap'){
      blip(1600, 140, 0.12, 'sawtooth', 0.18);
      blip(260, 2200, 0.06, 'square', 0.12);
      if (!prefersReduced) spawnStars(60);
      return;
    }
    if (type === 'horn'){
      blip(120, 92, 0.24, 'triangle', 0.18);
      blip(240, 120, 0.24, 'triangle', 0.12);
      if (!prefersReduced) spawnConfetti(140);
      return;
    }
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
    if (type === 'slap'){
      const n = noise(0.06, 0.34);
      const flt = a.ctx.createBiquadFilter();
      flt.type = 'highpass';
      flt.frequency.value = 900;
      const gg = g();
      env(gg, now, 0.002, 0.10, 0.18);
      n.connect(flt);
      flt.connect(gg);
      gg.connect(a.master);
      n.start(now);
      n.stop(now + 0.09);
      return;
    }
    if (type === 'splat'){
      blip(210, 60, 0.18, 'sine', 0.16);
      const n = noise(0.11, 0.20);
      const flt = a.ctx.createBiquadFilter();
      flt.type = 'lowpass';
      flt.frequency.value = 700;
      const gg = g();
      env(gg, now, 0.006, 0.18, 0.12);
      n.connect(flt);
      flt.connect(gg);
      gg.connect(a.master);
      n.start(now);
      n.stop(now + 0.16);
      if (!prefersReduced) spawnSlime(14);
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
    if (type === 'laugh'){
      for (let i=0;i<4;i++){
        const t = now + i * 0.085;
        const o = a.ctx.createOscillator();
        o.type = 'square';
        o.frequency.setValueAtTime(260 + Math.random()*160, t);
        const gg = a.ctx.createGain();
        gg.gain.setValueAtTime(0.0001, t);
        gg.gain.exponentialRampToValueAtTime(0.14, t + 0.012);
        gg.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
        o.connect(gg);
        gg.connect(a.master);
        o.start(t);
        o.stop(t + 0.08);
      }
      const n = noise(0.22, 0.09);
      const gg = g();
      env(gg, now, 0.01, 0.24, 0.10);
      n.connect(gg);
      gg.connect(a.master);
      n.start(now);
      n.stop(now + 0.24);
      return;
    }

    // New UI types
    if (type === 'like'){
      blip(880 + Math.random()*120, 420, 0.08, 'sine', 0.16);
      if (!prefersReduced) spawnStars(28);
      return;
    }
    if (type === 'comment'){
      blip(620, 980, 0.07, 'square', 0.11);
      return;
    }
    if (type === 'follow'){
      blip(520, 1040, 0.12, 'triangle', 0.12);
      blip(1040, 1520, 0.10, 'triangle', 0.08);
      if (!prefersReduced) spawnConfetti(60);
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
    if (type === 'post'){
      blip(380, 820, 0.16, 'sawtooth', 0.12);
      if (!prefersReduced) spawnBubbles(10);
      return;
    }
    if (type === 'refresh'){
      sfx('whoosh');
      blip(2200, 600, 0.10, 'square', 0.08);
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

  function spawnConfetti(count = 120){
    if (!fx) return;
    const w = fx.width;
    const h = fx.height;
    const colors = ['#ff5c8a', '#ffd37c', '#7cf3ff', '#a8ffcb', '#fff27c', '#111111'];
    const c = prefersReduced ? Math.floor(count * 0.4) : count;
    for (let i=0;i<c;i++){
      parts.push({
        kind: 'confetti',
        x: w * (0.2 + Math.random() * 0.6),
        y: h * (0.12 + Math.random() * 0.15),
        vx: (Math.random()-0.5) * 7,
        vy: Math.random() * -7 - 2,
        g: 0.16 + Math.random() * 0.14,
        r: 2 + Math.random() * 4,
        a: 1,
        rot: Math.random() * Math.PI,
        vr: (Math.random()-0.5) * 0.28,
        c: rand(colors)
      });
    }
  }

  function spawnBubbles(count = 22){
    if (!fx) return;
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
        c: 'rgba(124,243,255,0.62)'
      });
    }
  }

  function spawnStars(count = 60){
    if (!fx) return;
    const w = fx.width;
    const h = fx.height;
    const c = prefersReduced ? Math.floor(count * 0.4) : count;
    for (let i=0;i<c;i++){
      parts.push({
        kind: 'star',
        x: w * 0.5 + (Math.random()-0.5) * w * 0.60,
        y: h * 0.22 + (Math.random()-0.5) * h * 0.22,
        vx: (Math.random()-0.5) * 10,
        vy: (Math.random()-0.5) * 10,
        r: 1 + Math.random() * 2.8,
        a: 1,
        c: rand(['#7cf3ff', '#fff27c', '#ffffff', '#ff5c8a'])
      });
    }
  }

  function spawnSlime(count = 18){
    if (!fx) return;
    const w = fx.width;
    const h = fx.height;
    const c = prefersReduced ? Math.floor(count * 0.4) : count;
    for (let i=0;i<c;i++){
      parts.push({
        kind: 'slime',
        x: w * 0.5 + (Math.random()-0.5) * w * 0.45,
        y: h * 0.30 + (Math.random()-0.5) * h * 0.24,
        vx: (Math.random()-0.5) * 6,
        vy: (Math.random()-0.5) * 2,
        r: 4 + Math.random() * 12,
        a: 0.85,
        c: 'rgba(168,255,203,0.50)'
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
    setMode,
    setVolume,
    primeSamples,
    sfx,
    spawnConfetti,
    spawnBubbles,
    spawnStars,
    spawnSlime,
  };
})();
