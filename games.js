/* Meme Arcade games (meme-only, no Arma references) */

(() => {
  const C = window.MemeCore;
  if (!C) return;

  const { $, state, clamp, setToast, setMode, setVolume, sfx, primeSamples, spawnConfetti, spawnBubbles, spawnStars, spawnSlime } = C;

  // Shared toolbar
  function wireToolbar(){
    $('#btn-mode-spingo')?.addEventListener('click', () => setMode('spingo'));
    $('#btn-mode-jimbo')?.addEventListener('click', () => setMode('jimbo'));
    $('#btn-mode-shronk')?.addEventListener('click', () => setMode('shronk'));

    const btnSound = $('#btn-sound');
    const btnMute = $('#btn-mute');
    const vol = $('#vol');

    btnSound?.addEventListener('click', () => {
      state.sound = !state.sound;
      btnSound.setAttribute('aria-pressed', state.sound ? 'true' : 'false');
      btnSound.textContent = `Sound: ${state.sound ? 'On' : 'Off'}`;
      setVolume(state.volume);
      if (state.sound) primeSamples?.();
      sfx(state.sound ? 'success' : 'error');
    });

    btnMute?.addEventListener('click', () => {
      state.muted = !state.muted;
      btnMute.setAttribute('aria-pressed', state.muted ? 'true' : 'false');
      btnMute.textContent = `Mute: ${state.muted ? 'On' : 'Off'}`;
      setVolume(state.volume);
      if (!state.muted) sfx('success');
    });

    vol?.addEventListener('input', (e) => {
      const v = clamp((Number(e.target.value) || 0) / 100, 0, 1);
      setVolume(v);
    });

    setVolume(state.volume);
  }

  // Helpers
  function resizeCanvas(c){
    const r = c.getBoundingClientRect();
    c.width = Math.floor(r.width * devicePixelRatio);
    c.height = Math.floor(r.height * devicePixelRatio);
  }

  function modeHitSfx(){
    return state.mode === 'jimbo' ? 'zap' : (state.mode === 'shronk' ? 'horn' : 'bubble');
  }

  // --- Game 1: Whack-a-Meme
  const wh = {
    running: false,
    score: 0,
    misses: 0,
    targets: [],
    lastSpawn: 0,
  };

  const whCanvas = $('#whack-canvas');
  let whCtx = null;

  function whReset(){
    wh.score = 0;
    wh.misses = 0;
    wh.targets = [];
    wh.lastSpawn = 0;
    $('#whack-score').textContent = '0';
    $('#whack-miss').textContent = '0';
  }

  function whSpawn(){
    if (!whCanvas) return;
    const w = whCanvas.width;
    const h = whCanvas.height;
    const r = (18 + Math.random() * 18) * devicePixelRatio;
    const x = r + Math.random() * (w - r*2);
    const y = r + Math.random() * (h - r*2);
    const txt = ['BRUH','LOL','SUS','BONK','YEET','POG','NOPE','W','L'][Math.floor(Math.random()*9)];
    const ttl = 850 + Math.random() * 900;
    wh.targets.push({ x, y, r, txt, born: performance.now(), ttl });
  }

  function whTick(t){
    if (!whCanvas || !whCtx) return;

    whCtx.clearRect(0,0,whCanvas.width,whCanvas.height);
    whCtx.fillStyle = 'rgba(255,255,255,0.0)';
    whCtx.fillRect(0,0,whCanvas.width,whCanvas.height);

    if (wh.running) {
      const interval = Math.max(140, 650 - wh.score * 8);
      if (t - wh.lastSpawn > interval) {
        wh.lastSpawn = t;
        whSpawn();
      }
    }

    const alive = [];
    for (const o of wh.targets){
      const age = t - o.born;
      const p = 1 - clamp(age / o.ttl, 0, 1);

      if (p <= 0) {
        if (wh.running) {
          wh.misses++;
          $('#whack-miss').textContent = String(wh.misses);
          setToast('Missed. The meme escaped.', 'warn');
          sfx('error');
          if (wh.misses % 3 === 0) spawnStars(50);
        }
        continue;
      }

      alive.push(o);

      whCtx.save();
      whCtx.globalAlpha = 0.9;
      whCtx.fillStyle = 'rgba(248,249,250,0.92)';
      whCtx.strokeStyle = 'rgba(200,204,209,1)';
      whCtx.lineWidth = 2 * devicePixelRatio;
      whCtx.beginPath();
      whCtx.arc(o.x, o.y, o.r, 0, Math.PI*2);
      whCtx.fill();
      whCtx.stroke();

      // stamp
      whCtx.globalAlpha = 0.9;
      whCtx.fillStyle = 'rgba(6,69,173,0.95)';
      whCtx.font = `${Math.floor(12*devicePixelRatio)}px ui-monospace, monospace`;
      whCtx.fillText(o.txt, o.x - o.r*0.60, o.y + 4*devicePixelRatio);

      // ring
      whCtx.globalAlpha = 0.22;
      whCtx.strokeStyle = 'rgba(6,69,173,0.55)';
      whCtx.beginPath();
      whCtx.arc(o.x, o.y, o.r + (1-p) * 18 * devicePixelRatio, 0, Math.PI*2);
      whCtx.stroke();

      whCtx.restore();
    }

    wh.targets = alive;
    requestAnimationFrame(whTick);
  }

  function whHit(x, y){
    for (let i=wh.targets.length-1; i>=0; i--){
      const o = wh.targets[i];
      const dx = x - o.x;
      const dy = y - o.y;
      if ((dx*dx + dy*dy) <= (o.r*o.r)) {
        wh.targets.splice(i,1);
        wh.score++;
        $('#whack-score').textContent = String(wh.score);
        setToast('Hit! Certified meme moment.', 'ok');
        sfx(modeHitSfx());
        if (wh.score % 10 === 0) { spawnConfetti(140); sfx('laugh'); }
        return true;
      }
    }
    return false;
  }

  function wireWhack(){
    if (!whCanvas) return;

    resizeCanvas(whCanvas);
    window.addEventListener('resize', () => resizeCanvas(whCanvas));
    whCtx = whCanvas.getContext('2d');
    requestAnimationFrame(whTick);

    $('#whack-start')?.addEventListener('click', () => {
      whReset();
      wh.running = true;
      setToast('Whack-a-Meme started. Click the stamps.', 'warn');
      sfx('whoosh');
      spawnBubbles(16);
    });

    $('#whack-stop')?.addEventListener('click', () => {
      wh.running = false;
      setToast('Stopped. The memes are regrouping.', 'warn');
      sfx('success');
    });

    whCanvas.addEventListener('pointerdown', (e) => {
      const r = whCanvas.getBoundingClientRect();
      const x = (e.clientX - r.left) * devicePixelRatio;
      const y = (e.clientY - r.top) * devicePixelRatio;
      if (!whHit(x,y) && wh.running) {
        wh.misses++;
        $('#whack-miss').textContent = String(wh.misses);
        sfx('splat');
        spawnSlime(10);
      }
    });
  }

  // --- Game 2: Reaction Roulette
  const rr = {
    running: false,
    stage: 'idle', // idle | wait | now
    armedAt: 0,
    best: null,
    tries: 0,
    total: 0,
    timer: null,
  };

  function rrReset(){
    rr.running = false;
    rr.stage = 'idle';
    rr.armedAt = 0;
    rr.best = null;
    rr.tries = 0;
    rr.total = 0;
    clearTimeout(rr.timer);
    $('#rr-status').textContent = 'Press Start.';
    $('#rr-best').textContent = '—';
    $('#rr-avg').textContent = '—';
  }

  function rrStart(){
    rr.running = true;
    rr.stage = 'wait';
    $('#rr-status').textContent = 'WAIT…';
    sfx('whoosh');

    clearTimeout(rr.timer);
    rr.timer = setTimeout(() => {
      if (!rr.running) return;
      rr.stage = 'now';
      rr.armedAt = performance.now();
      $('#rr-status').textContent = 'NOW!';
      sfx('horn');
      spawnStars(50);
    }, 900 + Math.random()*2200);
  }

  function rrClick(){
    if (!rr.running) return;

    if (rr.stage === 'wait') {
      // too early
      setToast('Too early. Clowned.', 'danger');
      sfx('error');
      spawnSlime(16);
      rrStart();
      return;
    }

    if (rr.stage === 'now') {
      const ms = Math.max(0, Math.round(performance.now() - rr.armedAt));
      rr.tries++;
      rr.total += ms;
      rr.best = rr.best == null ? ms : Math.min(rr.best, ms);

      $('#rr-status').textContent = `${ms} ms`;
      $('#rr-best').textContent = `${rr.best} ms`;
      $('#rr-avg').textContent = `${Math.round(rr.total / rr.tries)} ms`;

      setToast(`Reaction: ${ms} ms.`, 'ok');
      sfx('success');
      if (ms < 220) { spawnConfetti(160); sfx('laugh'); }

      rrStart();
    }
  }

  function wireReaction(){
    rrReset();
    $('#rr-start')?.addEventListener('click', () => {
      rrReset();
      rr.running = true;
      rrStart();
      setToast('Reaction Roulette started. Don’t get baited.', 'warn');
    });

    $('#rr-stop')?.addEventListener('click', () => {
      rr.running = false;
      rr.stage = 'idle';
      clearTimeout(rr.timer);
      $('#rr-status').textContent = 'Stopped.';
      setToast('Stopped. Your nervous system thanks you.', 'warn');
      sfx('success');
    });

    $('#rr-click')?.addEventListener('click', () => rrClick());
  }

  // --- Game 3: Meme Match (memory)
  const mm = {
    locked: false,
    first: null,
    moves: 0,
    matches: 0,
    symbols: ['BRUH','SUS','LOL','BONK','YEET','POG','W','L'],
    deck: [],
  };

  function shuffle(a){
    for (let i=a.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [a[i],a[j]]=[a[j],a[i]];
    }
    return a;
  }

  function mmNew(){
    const pairs = mm.symbols.concat(mm.symbols);
    mm.deck = shuffle(pairs.map((sym, idx) => ({
      id: idx,
      sym,
      faceUp: false,
      done: false,
    })));

    mm.locked = false;
    mm.first = null;
    mm.moves = 0;
    mm.matches = 0;

    $('#mm-moves').textContent = '0';
    $('#mm-matches').textContent = '0';

    const grid = $('#mm-grid');
    grid.innerHTML = '';

    mm.deck.forEach((card, i) => {
      const b = document.createElement('button');
      b.className = 'mm-card';
      b.type = 'button';
      b.setAttribute('data-i', String(i));
      b.setAttribute('aria-label', 'Card');
      b.textContent = '?';
      grid.appendChild(b);
    });

    setToast('New Meme Match game. Remember things (optional).', 'warn');
    sfx('whoosh');
  }

  function renderCard(i){
    const grid = $('#mm-grid');
    const b = grid.querySelector(`button[data-i="${i}"]`);
    if (!b) return;
    const c = mm.deck[i];

    b.disabled = c.done;
    b.classList.toggle('is-up', c.faceUp || c.done);
    b.classList.toggle('is-done', c.done);
    b.textContent = (c.faceUp || c.done) ? c.sym : '?';
  }

  function mmFlip(i){
    if (mm.locked) return;
    const c = mm.deck[i];
    if (!c || c.done || c.faceUp) return;

    c.faceUp = true;
    renderCard(i);
    sfx(modeHitSfx());

    if (mm.first == null) {
      mm.first = i;
      return;
    }

    // second flip
    mm.moves++;
    $('#mm-moves').textContent = String(mm.moves);

    const a = mm.deck[mm.first];
    const b = c;

    if (a.sym === b.sym) {
      a.done = true;
      b.done = true;
      mm.matches++;
      $('#mm-matches').textContent = String(mm.matches);
      sfx('success');
      spawnConfetti(90);

      renderCard(mm.first);
      renderCard(i);
      mm.first = null;

      if (mm.matches >= mm.symbols.length) {
        setToast('All pairs found. Brainrot victory achieved.', 'ok');
        sfx('laugh');
        spawnConfetti(240);
      }

      return;
    }

    // mismatch
    mm.locked = true;
    sfx('error');
    setTimeout(() => {
      a.faceUp = false;
      b.faceUp = false;
      renderCard(mm.first);
      renderCard(i);
      mm.first = null;
      mm.locked = false;
    }, 650);
  }

  function wireMatch(){
    $('#mm-new')?.addEventListener('click', () => mmNew());

    $('#mm-grid')?.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-i]');
      if (!btn) return;
      const i = Number(btn.getAttribute('data-i'));
      mmFlip(i);
    });

    mmNew();
  }

  // Boot
  wireToolbar();
  wireWhack();
  wireReaction();
  wireMatch();
  setMode('spingo');
})();
