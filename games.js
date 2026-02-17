/* Games page logic */

(() => {
  const C = window.MemeCore;
  if (!C) return;

  const { $, state, clamp, setToast, openModal, setMode, setVolume, sfx, spawnConfetti, spawnBubbles, spawnStars } = C;

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

  // --- Game 1: Desync Popper
  const pop = {
    running: false,
    score: 0,
    errors: 0,
    bubbles: [],
    lastSpawn: 0,
    speed: 1,
  };

  const popCanvas = $('#pop-canvas');
  let popCtx = null;

  function resizeCanvas(c){
    const r = c.getBoundingClientRect();
    c.width = Math.floor(r.width * devicePixelRatio);
    c.height = Math.floor(r.height * devicePixelRatio);
  }

  function popReset(){
    pop.score = 0;
    pop.errors = 0;
    pop.bubbles = [];
    pop.lastSpawn = 0;
    pop.speed = 1;
    $('#pop-score').textContent = '0';
    $('#pop-errors').textContent = '0';
  }

  function popSpawn(){
    if (!popCanvas) return;
    const w = popCanvas.width;
    const h = popCanvas.height;
    const r = (8 + Math.random() * 18) * devicePixelRatio;
    const x = (Math.random() * (w - r*2)) + r;
    pop.bubbles.push({ x, y: h + r, r, vy: (1.2 + Math.random()*1.6) * devicePixelRatio * pop.speed });
  }

  function popTick(t){
    if (!popCanvas || !popCtx) return;

    popCtx.clearRect(0,0,popCanvas.width,popCanvas.height);
    popCtx.fillStyle = 'rgba(0,0,0,0.12)';
    popCtx.fillRect(0,0,popCanvas.width,popCanvas.height);

    // spawn
    if (pop.running) {
      if (t - pop.lastSpawn > Math.max(180, 700 - pop.score*6)) {
        pop.lastSpawn = t;
        popSpawn();
      }
    }

    // draw+update
    const alive = [];
    for (const b of pop.bubbles){
      b.y -= b.vy;
      b.vy *= 1.0008;

      popCtx.save();
      popCtx.globalAlpha = 0.9;
      popCtx.strokeStyle = 'rgba(124,243,255,0.60)';
      popCtx.lineWidth = 2 * devicePixelRatio;
      popCtx.beginPath();
      popCtx.arc(b.x, b.y, b.r, 0, Math.PI*2);
      popCtx.stroke();
      popCtx.restore();

      if (b.y + b.r < 0) {
        if (pop.running) {
          pop.errors++;
          $('#pop-errors').textContent = String(pop.errors);
          setToast('Missed bubble → RPT error spawned.', 'warn');
          sfx('error');
          if (pop.errors % 3 === 0) spawnStars(40);
        }
      } else {
        alive.push(b);
      }
    }
    pop.bubbles = alive;

    requestAnimationFrame(popTick);
  }

  function popHit(x, y){
    for (let i=pop.bubbles.length-1; i>=0; i--){
      const b = pop.bubbles[i];
      const dx = x - b.x;
      const dy = y - b.y;
      if ((dx*dx + dy*dy) <= (b.r*b.r)) {
        pop.bubbles.splice(i,1);
        pop.score++;
        $('#pop-score').textContent = String(pop.score);
        setToast('Pop! Desync prevented (temporarily).', 'ok');
        sfx(state.mode === 'jimbo' ? 'zap' : 'bubble');
        if (pop.score % 10 === 0) { spawnConfetti(90); sfx('success'); }
        return true;
      }
    }
    return false;
  }

  function wirePopper(){
    if (!popCanvas) return;

    resizeCanvas(popCanvas);
    window.addEventListener('resize', () => resizeCanvas(popCanvas));

    popCtx = popCanvas.getContext('2d');
    requestAnimationFrame(popTick);

    $('#pop-start')?.addEventListener('click', () => {
      popReset();
      pop.running = true;
      setToast('Desync Popper started. Click bubbles.', 'warn');
      sfx('whoosh');
      spawnBubbles(18);
    });

    $('#pop-stop')?.addEventListener('click', () => {
      pop.running = false;
      setToast('Stopped. Desync will return. It always does.', 'warn');
      sfx('success');
    });

    popCanvas.addEventListener('pointerdown', (e) => {
      const r = popCanvas.getBoundingClientRect();
      const x = (e.clientX - r.left) * devicePixelRatio;
      const y = (e.clientY - r.top) * devicePixelRatio;
      if (!popHit(x,y)) {
        if (pop.running) {
          pop.errors++;
          $('#pop-errors').textContent = String(pop.errors);
          sfx('error');
        }
      }
    });
  }

  // --- Game 2: RemoteExec Firewall
  const fw = {
    running: false,
    score: 0,
    streak: 0,
    current: null,
    timer: null,
  };

  function fwPick(){
    const pool = [
      { txt: '[REQ] remoteExecCall to server, validated UID, cooldown ok', safe: true, hint: 'Server-only target + validation = usually safe.' },
      { txt: '[REQ] remoteExec to everyone (target=0), JIP=true, no checks', safe: false, hint: 'Broadcast + JIP + no validation = cursed.' },
      { txt: '[REQ] setVariable with public=true on missionNamespace, contains secrets', safe: false, hint: 'Public variables can leak/abuse.' },
      { txt: '[REQ] UI update only, local effect, no network calls', safe: true, hint: 'Local UI-only changes are usually fine.' },
      { txt: '[REQ] execVM from player-sent string (lol)', safe: false, hint: 'Never execute untrusted code.' },
      { txt: '[REQ] server spawns entity, clients receive marker only', safe: true, hint: 'Authority on server is sane.' },
    ];

    // mode flavor
    if (state.mode === 'jimbo') pool.push({ txt: '[REQ] Jimbo says: science demands target=0', safe: false, hint: 'Jimbo is not a security model.' });
    if (state.mode === 'shronk') pool.push({ txt: '[REQ] Shronk yells: “ALLOW IT HARDER”', safe: false, hint: 'Volume is not validation.' });
    if (state.mode === 'spingo') pool.push({ txt: '[REQ] Spingo patch: rename exploit to exploit2', safe: false, hint: 'Renaming does not fix.' });

    return pool[Math.floor(Math.random()*pool.length)];
  }

  function fwShow(){
    fw.current = fwPick();
    $('#fw-req').textContent = fw.current.txt;
    $('#fw-hint').textContent = fw.current.hint;
  }

  function fwStart(){
    fw.running = true;
    fw.score = 0;
    fw.streak = 0;
    $('#fw-score').textContent = '0';
    $('#fw-streak').textContent = '0';

    setToast('Firewall started. Decide fast.', 'warn');
    sfx('whoosh');
    fwShow();

    clearInterval(fw.timer);
    fw.timer = setInterval(() => {
      if (!fw.running) return;
      fw.streak = 0;
      $('#fw-streak').textContent = String(fw.streak);
      setToast('Too slow → desync wins.', 'danger');
      sfx('error');
      fwShow();
    }, 3400);
  }

  function fwStop(){
    fw.running = false;
    clearInterval(fw.timer);
    setToast('Firewall stopped. The internet is now open.', 'warn');
    sfx('success');
  }

  function fwDecide(allow){
    if (!fw.running || !fw.current) return;

    const correct = (allow === fw.current.safe);
    if (correct) {
      fw.score += 1;
      fw.streak += 1;
      $('#fw-score').textContent = String(fw.score);
      $('#fw-streak').textContent = String(fw.streak);
      setToast('Correct. You prevented a forum thread.', 'ok');
      sfx('success');
      if (fw.streak % 5 === 0) { spawnConfetti(120); sfx('laugh'); }
    } else {
      fw.streak = 0;
      $('#fw-streak').textContent = '0';
      setToast('Wrong. RemoteExec vibes intensify.', 'danger');
      sfx('error');
      spawnStars(60);
    }

    fwShow();
  }

  function wireFirewall(){
    $('#fw-start')?.addEventListener('click', () => fwStart());
    $('#fw-stop')?.addEventListener('click', () => fwStop());
    $('#fw-allow')?.addEventListener('click', () => fwDecide(true));
    $('#fw-deny')?.addEventListener('click', () => fwDecide(false));
  }

  // --- Game 3: Placement Panic
  const pp = {
    running: false,
    score: 0,
    left: 20,
    timer: null,
    pts: [],
  };

  const ppCanvas = $('#pp-canvas');
  let ppCtx = null;

  function ppReset(){
    pp.running = false;
    pp.score = 0;
    pp.left = 20;
    pp.pts = [];
    $('#pp-score').textContent = '0';
    $('#pp-time').textContent = String(pp.left);
    clearInterval(pp.timer);
  }

  function ppStart(){
    ppReset();
    pp.running = true;
    setToast('Placement Panic started. Click fast.', 'warn');
    sfx('whoosh');

    pp.timer = setInterval(() => {
      if (!pp.running) return;
      pp.left -= 1;
      $('#pp-time').textContent = String(pp.left);
      if (pp.left <= 0) {
        pp.running = false;
        clearInterval(pp.timer);
        setToast(`Time! Placed ${pp.score}. (Snap lied.)`, 'ok');
        sfx('laugh');
        spawnConfetti(160);
      }
    }, 1000);
  }

  function ppColor(){
    return state.mode === 'jimbo' ? 'rgba(154,124,255,0.95)' : (state.mode === 'shronk' ? 'rgba(168,255,203,0.95)' : 'rgba(255,242,124,0.95)');
  }

  function ppTick(){
    if (!ppCanvas || !ppCtx) return;
    ppCtx.clearRect(0,0,ppCanvas.width,ppCanvas.height);

    // grid
    const step = 38 * devicePixelRatio;
    ppCtx.strokeStyle = 'rgba(255,255,255,0.06)';
    for (let x=0; x<ppCanvas.width; x+=step){
      ppCtx.beginPath(); ppCtx.moveTo(x,0); ppCtx.lineTo(x,ppCanvas.height); ppCtx.stroke();
    }
    for (let y=0; y<ppCanvas.height; y+=step){
      ppCtx.beginPath(); ppCtx.moveTo(0,y); ppCtx.lineTo(ppCanvas.width,y); ppCtx.stroke();
    }

    for (const p of pp.pts){
      ppCtx.fillStyle = p.c;
      ppCtx.beginPath();
      ppCtx.arc(p.x, p.y, 7*devicePixelRatio, 0, Math.PI*2);
      ppCtx.fill();
    }

    requestAnimationFrame(ppTick);
  }

  function wirePlacement(){
    if (!ppCanvas) return;

    resizeCanvas(ppCanvas);
    window.addEventListener('resize', () => resizeCanvas(ppCanvas));
    ppCtx = ppCanvas.getContext('2d');
    requestAnimationFrame(ppTick);

    $('#pp-start')?.addEventListener('click', () => ppStart());
    $('#pp-reset')?.addEventListener('click', () => { ppReset(); setToast('Reset. Snap is still lying.', 'warn'); sfx('success'); });

    ppCanvas.addEventListener('pointerdown', (e) => {
      if (!pp.running) return;
      const r = ppCanvas.getBoundingClientRect();
      let x = (e.clientX - r.left) * devicePixelRatio;
      let y = (e.clientY - r.top) * devicePixelRatio;

      // fake snap (sometimes)
      const step = 38 * devicePixelRatio;
      if (Math.random() > 0.18) {
        x = Math.round(x / step) * step;
        y = Math.round(y / step) * step;
      }

      pp.pts.push({ x, y, c: ppColor() });
      pp.score += 1;
      $('#pp-score').textContent = String(pp.score);

      sfx(state.mode === 'jimbo' ? 'zap' : (state.mode === 'shronk' ? 'horn' : 'bubble'));
      if (pp.score % 12 === 0) spawnBubbles(18);
    });
  }

  // Boot
  wireToolbar();
  wirePopper();
  wireFirewall();
  wirePlacement();
  setMode('spingo');

  // Tiny disclaimer modal via Konami if user has no modal on this page
  window.addEventListener('dblclick', (e) => {
    if (!e.target.closest('.brand')) return;
    openModal('Legal-ish', '<p>No copyrighted images/audio are shipped. These are original mascots + procedural sounds.</p>');
  });
})();
