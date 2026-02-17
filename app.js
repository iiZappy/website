/* Editor page logic (Eden-ish parody) */

(() => {
  const C = window.MemeCore;
  if (!C) return;

  const { $, $$, state, clamp, setToast, openModal, setMode, setVolume, sfx, spawnConfetti, spawnSlime } = C;

  // Controls
  function wireAudioUi(){
    const btnSound = $('#btn-sound');
    const btnMute = $('#btn-mute');
    const vol = $('#vol');

    if (btnSound) {
      btnSound.addEventListener('click', () => {
        state.sound = !state.sound;
        btnSound.setAttribute('aria-pressed', state.sound ? 'true' : 'false');
        btnSound.textContent = `Sound: ${state.sound ? 'On' : 'Off'}`;
        setVolume(state.volume);
        sfx(state.sound ? 'success' : 'error');
      });
    }

    if (btnMute) {
      btnMute.addEventListener('click', () => {
        state.muted = !state.muted;
        btnMute.setAttribute('aria-pressed', state.muted ? 'true' : 'false');
        btnMute.textContent = `Mute: ${state.muted ? 'On' : 'Off'}`;
        setVolume(state.volume);
        if (!state.muted) sfx('success');
      });
    }

    if (vol) {
      vol.addEventListener('input', (e) => {
        const v = clamp((Number(e.target.value) || 0) / 100, 0, 1);
        setVolume(v);
      });
    }

    setVolume(state.volume);
  }

  // Tabs
  function wireTabs(){
    const tabs = $$('.tab');
    const views = $$('[data-tabview]');
    tabs.forEach(t => {
      t.addEventListener('click', () => {
        const key = t.getAttribute('data-tab');
        tabs.forEach(x => x.classList.toggle('is-active', x === t));
        views.forEach(v => v.classList.toggle('is-hidden', v.getAttribute('data-tabview') !== key));
        sfx('whoosh');
      });
    });
  }

  // Console
  const terminal = $('#terminal');
  function bootConsole(){
    if (!terminal) return;
    terminal.textContent =
`$ openEditor "spingo_eden.parody";
[ok] loading UI...
[warn] competence detected: disabling
[ok] enabling vibes
[done] editor ready
`;
  }

  function append(line){
    if (!terminal) return;
    terminal.textContent = `${terminal.textContent.trimEnd()}\n${line}\n`;
    terminal.scrollTop = terminal.scrollHeight;
  }

  async function runMpTest(){
    setToast('Running MP test… (fake).', 'warn');
    sfx('whoosh');
    append('[ok] connecting to dedicated server…');

    const steps = [
      '[ok] spawning 64 AI… (why?)',
      '[warn] remoteExec vibes detected',
      '[warn] RPT is writing a novel',
      '[ok] converting errors into confidence',
      '[done] MP test complete: emotionally positive'
    ];

    for (const s of steps){
      await new Promise(r => setTimeout(r, 500 + Math.random() * 420));
      append(s);
      sfx(state.mode === 'jimbo' ? 'zap' : 'success');
    }

    spawnConfetti(120);
  }

  // Mode buttons
  function wireModes(){
    $('#btn-mode-spingo')?.addEventListener('click', () => setMode('spingo'));
    $('#btn-mode-jimbo')?.addEventListener('click', () => setMode('jimbo'));
    $('#btn-mode-shronk')?.addEventListener('click', () => setMode('shronk'));

    // mascot stickers also change mode
    $$('[data-mascot]').forEach(b => {
      b.addEventListener('click', () => {
        const m = b.getAttribute('data-mascot');
        setMode(m);
        append(`[mascot] ${m} spawned (in your head).`);
        spawnConfetti(60);
      });
    });
  }

  // Secret badge clicks
  function wireBadge(){
    const mark = $('#brand-mark');
    if (!mark) return;

    mark.addEventListener('click', () => {
      state.brandClicks++;
      sfx('bubble');

      if (state.brandClicks === 7) {
        openModal('Secret Badge', `
          <p><strong>Unlocked:</strong> Certified Mission Editor Goblin License.</p>
          <p class="muted">Valid until the next dedicated server crash.</p>
        `);
        spawnConfetti(160);
        sfx('laugh');
        state.brandClicks = 0;
      } else {
        setToast(`Badge clicked ${state.brandClicks}/7. Keep going.`, 'warn');
      }
    });
  }

  // Properties panel
  function wireProperties(){
    const risk = $('#prop-risk');
    const label = $('#prop-risk-label');

    const riskText = (vv) => {
      const labels = [
        { max: 20, txt: `${vv}% confident (harmless)` },
        { max: 45, txt: `${vv}% confident (dangerous)` },
        { max: 70, txt: `${vv}% confident (forum-ready)` },
        { max: 90, txt: `${vv}% confident (dedicated server trembling)` },
        { max: 100, txt: `${vv}% confident (cosmic desync)` },
      ];
      return labels.find(x => vv <= x.max).txt;
    };

    risk?.addEventListener('input', (e) => {
      const vv = clamp(Number(e.target.value) || 0, 0, 100);
      if (label) label.textContent = riskText(vv);
      if (vv % 25 === 0) sfx('success');
    });

    $('#btn-compile')?.addEventListener('click', () => {
      const name = ($('#prop-name')?.value || '').trim() || 'UntitledMission';
      const vv = clamp(Number(risk?.value) || 0, 0, 100);
      setToast('Exported mission. (It is emotionally correct.)', 'ok');
      append(`[export] name="${name}" confidence=${vv}%`);
      append('[export] writing mission.sqm... (imaginary)');
      spawnConfetti(90);
      sfx('success');
    });

    $('#btn-validate')?.addEventListener('click', () => {
      setToast('Validate complete: 0 errors (ignored).', 'warn');
      append('[validate] ok (probably)');
      sfx('whoosh');
    });
  }

  // Entity selection
  const entityMeta = {
    soldier: { name: 'Infantry', cls: 'C_Man_1 (meme)' },
    vehicle: { name: 'Vehicle', cls: 'C_Offroad_01_F (suspicious)' },
    crate: { name: 'Crate', cls: 'Box_NATO_Ammo_F (contains vibes)' },
    marker: { name: 'Marker', cls: 'mil_dot (lies)' },
    trigger: { name: 'Trigger', cls: 'EmptyDetector (haunted)' },
    logic: { name: 'Logic', cls: 'Logic (jimbo science)' },
  };

  let selectedEntity = 'soldier';

  function wireEntityList(){
    const list = $('#entity-list');
    if (!list) return;

    list.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-entity]');
      if (!btn) return;
      selectedEntity = btn.getAttribute('data-entity');

      $$('#entity-list .list__item').forEach(b => b.classList.toggle('is-selected', b === btn));

      const m = entityMeta[selectedEntity] || { name: selectedEntity, cls: 'unknown' };
      $('#prop-selected').textContent = m.name;
      $('#prop-class').textContent = m.cls;

      setToast(`Selected: ${m.name}.`, 'ok');
      sfx('whoosh');
    });
  }

  // Viewport canvas (grid + placements)
  const vp = $('#vp');
  const statusline = $('#statusline');
  let placements = [];
  let showGrid = true;
  let snap = true;

  function resizeVp(){
    if (!vp) return;
    const r = vp.getBoundingClientRect();
    vp.width = Math.floor(r.width * devicePixelRatio);
    vp.height = Math.floor(r.height * devicePixelRatio);
  }
  window.addEventListener('resize', resizeVp);

  function colorForMode(){
    return state.mode === 'jimbo' ? 'rgba(154,124,255,0.95)' : (state.mode === 'shronk' ? 'rgba(168,255,203,0.95)' : 'rgba(255,242,124,0.95)');
  }

  function drawVp(){
    if (!vp) return;
    const ctx = vp.getContext('2d');
    const w = vp.width;
    const h = vp.height;

    ctx.clearRect(0,0,w,h);

    // background
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    ctx.fillRect(0,0,w,h);

    // grid
    if (showGrid) {
      const step = Math.floor(36 * devicePixelRatio);
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      for (let x=0; x<w; x+=step){
        ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke();
      }
      for (let y=0; y<h; y+=step){
        ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke();
      }

      // bold center cross
      ctx.strokeStyle = 'rgba(124,243,255,0.12)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(w*0.5, 0); ctx.lineTo(w*0.5, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, h*0.5); ctx.lineTo(w, h*0.5); ctx.stroke();
    }

    // placements
    for (const p of placements){
      ctx.save();
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = p.c;
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2 * devicePixelRatio;

      ctx.beginPath();
      ctx.arc(p.x, p.y, 8 * devicePixelRatio, 0, Math.PI*2);
      ctx.fill();
      ctx.stroke();

      // tiny label
      ctx.fillStyle = 'rgba(245,247,255,0.90)';
      ctx.font = `${12 * devicePixelRatio}px ui-monospace, monospace`;
      ctx.fillText(p.label, p.x + 12*devicePixelRatio, p.y - 10*devicePixelRatio);
      ctx.restore();
    }

    requestAnimationFrame(drawVp);
  }

  function placeAt(clientX, clientY){
    if (!vp) return;
    const r = vp.getBoundingClientRect();
    let x = (clientX - r.left) * devicePixelRatio;
    let y = (clientY - r.top) * devicePixelRatio;

    if (snap) {
      const step = 36 * devicePixelRatio;
      x = Math.round(x / step) * step;
      y = Math.round(y / step) * step;
    }

    const m = entityMeta[selectedEntity] || { name: selectedEntity };
    const label = m.name.slice(0, 3).toUpperCase();

    placements.push({ x, y, label, c: colorForMode(), e: selectedEntity });

    const msg = rand([
      `Placed ${m.name}. (It will desync later.)`,
      `Placed ${m.name}. (Editor approved.)`,
      `Placed ${m.name}. (Confidence rising.)`,
      `Placed ${m.name}. (RPT sweating.)`
    ]);

    if (statusline) statusline.textContent = msg;
    append(`[place] ${selectedEntity} @ ${Math.round(x)} ${Math.round(y)}`);

    if (state.mode === 'jimbo') sfx('zap');
    else if (state.mode === 'shronk') sfx('horn');
    else sfx('bubble');

    if (selectedEntity === 'trigger') {
      spawnSlime(16);
      sfx('splat');
      append('[warn] trigger is haunted');
    }
  }

  function rand(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

  function wireViewport(){
    if (!vp) return;

    resizeVp();
    requestAnimationFrame(drawVp);

    vp.addEventListener('pointerdown', (e) => {
      placeAt(e.clientX, e.clientY);
    });

    $('#btn-grid')?.addEventListener('click', (e) => {
      showGrid = !showGrid;
      e.target.setAttribute('aria-pressed', showGrid ? 'true' : 'false');
      setToast(`Grid: ${showGrid ? 'On' : 'Off'}`, 'warn');
      sfx('whoosh');
    });

    $('#btn-snap')?.addEventListener('click', (e) => {
      snap = !snap;
      e.target.setAttribute('aria-pressed', snap ? 'true' : 'false');
      setToast(`Snap: ${snap ? 'On' : 'Off'} (lies anyway)`, 'warn');
      sfx('whoosh');
    });

    $('#btn-confetti')?.addEventListener('click', () => {
      spawnConfetti(240);
      sfx('splat');
      append('[fx] sticker cannon fired');
      setToast('Sticker cannon fired. Productivity destroyed.', 'warn');
    });
  }

  // Topbar panic + console buttons
  function wireButtons(){
    $('#btn-panic')?.addEventListener('click', () => {
      setToast('PANIC pressed. Applying slap-based hotfix.', 'danger');
      append('[panic] DESYNC DETECTED: applying slap patch');
      spawnSlime(22);
      sfx('slap');
    });

    $('#btn-run')?.addEventListener('click', () => runMpTest());
    $('#btn-clear')?.addEventListener('click', () => { bootConsole(); sfx('success'); });
    $('#btn-glitch')?.addEventListener('click', () => {
      document.documentElement.classList.toggle('glitch');
      const on = document.documentElement.classList.contains('glitch');
      setToast(on ? 'Glitch on. Reality is optional.' : 'Glitch off. Reality restored.', 'warn');
      sfx(on ? 'whoosh' : 'success');
      append(on ? '[warn] glitch enabled' : '[ok] glitch disabled');
    });
  }

  // Boot
  wireAudioUi();
  wireTabs();
  wireModes();
  wireBadge();
  wireProperties();
  wireEntityList();
  wireViewport();
  wireButtons();
  bootConsole();
  setMode('spingo');

  // Hint modal: only if user clicks validate without placing anything
  $('#btn-validate')?.addEventListener('dblclick', () => {
    openModal('No copyrighted stuff', '<p>We do not ship copyrighted images/audio. Mascots are original. Sounds are procedural.</p>');
  });
})();
