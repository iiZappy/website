/* Shared core: state, mode, sample-first audio, procedural fallback, FX canvas, toast + modal helpers */

(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const state = {
    sound: false,
    muted: false,
    volume: 0.7,
    mode: 'spingo',
    keys: '',
    konami: [],
    brandClicks: 0,
  };

  function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }
  function rand(arr){ return arr[Math.floor(Math.random() * arr.length)]; }

  function setToast(text, mood = 'ok'){
    const el = $('#toast') || $('#pill-status');
    if (!el) return;
    el.textContent = text;
    el.style.borderColor = mood === 'danger' ? 'rgba(255,143,163,0.55)' : (mood === 'warn' ? 'rgba(255,211,124,0.60)' : 'rgba(200,204,209,0.95)');
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

  // --- WebAudio init
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

  // --- Sample-first SFX
  const sampleMap = {
    bubble: 'assets/sfx/bubble',
    zap: 'assets/sfx/zap',
    horn: 'assets/sfx/horn',
    whoosh: 'assets/sfx/whoosh',
    slap: 'assets/sfx/slap',
    splat: 'assets/sfx/splat',
    laugh: 'assets/sfx/laugh',
    success: 'assets/sfx/success',
    error: 'assets/sfx/error',
  };

  const sampleCache = new Map(); // type -> AudioBuffer
  const sampleBroken = new Set();
  const sampleLoading = new Set();

  async function fetchFirstExisting(base){
    // Try common extensions; first that exists wins.
    const exts = ['.mp3', '.ogg', '.wav'];
    for (const ext of exts) {
      const url = `${base}${ext}`;
      try {
        const res = await fetch(url, { cache: 'force-cache' });
        if (!res.ok) continue;
        const buf = await res.arrayBuffer();
        return { url, buf };
      } catch (_) {
        // try next
      }
    }
    return null;
  }

  async function loadSample(type){
    if (sampleBroken.has(type) || sampleCache.has(type) || sampleLoading.has(type)) return;
    const base = sampleMap[type];
    if (!base) return;

    const a = audioInit();
    if (!a) return;

    sampleLoading.add(type);
    try {
      const got = await fetchFirstExisting(base);
      if (!got) {
        sampleBroken.add(type);
        return;
      }

      const decoded = await a.ctx.decodeAudioData(got.buf.slice(0));
      sampleCache.set(type, decoded);
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
    // fire-and-forget preload
    Object.keys(sampleMap).forEach(t => loadSample(t));
  }

  function env(g, now, a=0.008, d=0.12, peak=0.18){
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(peak, now + a);
    g.gain.exponentialRampToValueAtTime(0.0001, now + d);
  }

  function sfx(type){
    // if sample exists -> use it; otherwise preload + procedural fallback
    if (!state.sound || state.muted) return;

    if (playSample(type)) return;
    loadSample(type); // try to load for next time

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

  function spawnConfetti(count = 140){
    if (!fx) return;
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
        c: 'rgba(124,243,255,0.55)'
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
    if (!fx) return;
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
    document.documentElement.classList.toggle('mode-spingo', mode === 'spingo');
    document.documentElement.classList.toggle('mode-jimbo', mode === 'jimbo');
    document.documentElement.classList.toggle('mode-shronk', mode === 'shronk');

    const msg = {
      spingo: 'Spingo mode: bubble logic enabled.',
      jimbo: 'Jimbo mode: science vibes engaged.',
      shronk: 'Shronk mode: swamp confidence enabled.'
    }[mode] || 'Mode set.';

    setToast(msg, 'warn');
    sfx(mode === 'jimbo' ? 'zap' : (mode === 'shronk' ? 'horn' : 'bubble'));
  }

  const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];

  window.addEventListener('keydown', (e) => {
    const k = e.key;

    state.konami.push(k);
    if (state.konami.length > KONAMI.length) state.konami.shift();
    if (state.konami.join('|').toLowerCase() === KONAMI.join('|').toLowerCase()) {
      setMode('shronk');
      document.documentElement.classList.add('glitch');
      setTimeout(() => document.documentElement.classList.remove('glitch'), 900);
      spawnConfetti(220);
      sfx('laugh');
      openModal('Konami Unlocked', '<p><strong>Unlocked:</strong> MEGA MEME MODE.</p><p>Reality is optional now.</p>');
    }

    if (k.length === 1) {
      state.keys = (state.keys + k.toLowerCase()).slice(-48);

      if (state.keys.includes('spingo')) setMode('spingo');
      if (state.keys.includes('jimbo')) setMode('jimbo');
      if (state.keys.includes('shronk')) setMode('shronk');

      // aliases requested by user
      if (state.keys.includes('spongebon')) setMode('spingo');
      if (state.keys.includes('jimmyneutron')) setMode('jimbo');
      if (state.keys.includes('shrek')) setMode('shronk');
    }
  });

  // Close modal on backdrop click
  const modal = document.getElementById('modal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.close();
    });
  }

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
    sfx,
    primeSamples,
    spawnConfetti,
    spawnBubbles,
    spawnStars,
    spawnSlime,
  };
})();
