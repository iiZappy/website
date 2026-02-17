/* SpingoWiki logic (wiki layout) */

(() => {
  const C = window.MemeCore;
  if (!C) return;

  const { $, $$, state, clamp, setToast, openModal, setMode, setVolume, sfx, spawnConfetti, spawnStars, spawnSlime } = C;

  // Audio UI
  function wireAudio(){
    const btnSound = $('#btn-sound');
    const btnMute = $('#btn-mute');
    const vol = $('#vol');

    btnSound?.addEventListener('click', () => {
      state.sound = !state.sound;
      btnSound.setAttribute('aria-pressed', state.sound ? 'true' : 'false');
      btnSound.textContent = `Sound: ${state.sound ? 'On' : 'Off'}`;
      setVolume(state.volume);
      sfx(state.sound ? 'success' : 'error');
      setToast(state.sound ? 'Sound enabled. Your browser now regrets this.' : 'Sound disabled. Peace achieved.', 'warn');
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

  // Modes
  function wireModes(){
    $('#btn-mode-spingo')?.addEventListener('click', () => setMode('spingo'));
    $('#btn-mode-jimbo')?.addEventListener('click', () => setMode('jimbo'));
    $('#btn-mode-shronk')?.addEventListener('click', () => setMode('shronk'));

    $$('[data-mascot]').forEach(b => {
      b.addEventListener('click', () => {
        const m = b.getAttribute('data-mascot');
        setMode(m);
        spawnConfetti(120);
        setToast(`Switched vibe to ${m}.`, 'ok');
      });
    });
  }

  // Soundboard
  function wireSfxButtons(){
    $$('[data-sfx]').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = btn.getAttribute('data-sfx');
        if (t === 'splat') spawnSlime(14);
        if (t === 'zap') spawnStars(50);
        sfx(t);
        setToast(`SFX fired: ${t}.`, 'ok');
      });
    });

    $('#btn-panic')?.addEventListener('click', () => {
      setToast('PANIC pressed. Applying slap-based hotfix.', 'danger');
      spawnSlime(22);
      sfx('slap');
      sfx('error');
    });
  }

  // Random article (scroll)
  function wireRandom(){
    const btn = $('#btn-random');
    if (!btn) return;

    const ids = ['characters', 'meme-tools', 'games', 'faq'];
    btn.addEventListener('click', () => {
      const pick = ids[Math.floor(Math.random() * ids.length)];
      document.getElementById(pick)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setToast(`Random article: #${pick}.`, 'warn');
      sfx('whoosh');
    });
  }

  // Fake search
  function wireSearch(){
    const box = $('#search');
    if (!box) return;

    box.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const q = (box.value || '').trim();
      if (!q) return;

      const msg = `
        <p><strong>Search results for:</strong> <code>${escapeHtml(q)}</code></p>
        <p class="mw-note">0 results found (truth-based system). Try clicking a mascot instead.</p>
      `;

      openModal('Search', msg);
      sfx('whoosh');
    });
  }

  function escapeHtml(s){
    return s.replace(/[&<>"']/g, (c) => ({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#39;'
    }[c]));
  }

  // Badge secrets
  function wireBadge(){
    const mark = $('#brand-mark');
    if (!mark) return;

    mark.addEventListener('click', () => {
      state.brandClicks++;
      sfx('bubble');
      if (state.brandClicks === 7) {
        openModal('Secret unlocked', `
          <p><strong>Unlocked:</strong> Editor Goblin Wiki Administrator.</p>
          <p class="mw-note">You are now allowed to “fix” pages by adding more stamps.</p>
        `);
        spawnConfetti(220);
        sfx('laugh');
        state.brandClicks = 0;
      } else {
        setToast(`Badge clicked ${state.brandClicks}/7.`, 'warn');
      }
    });
  }

  // Featured error rotation
  function wireFeatured(){
    const el = $('#featured-error');
    if (!el) return;
    const pool = [
      'Error: remoteExec called with target=0 (confidence: 100%).',
      'Warning: desync approaching (distance: 0m).',
      'Undefined variable: <code>competence</code>.',
      'Config: “this is fine” not found.',
      'RPT: writing a sequel trilogy.'
    ];

    let i = 0;
    setInterval(() => {
      i = (i + 1) % pool.length;
      el.innerHTML = pool[i];
    }, 4200);
  }

  // Boot
  wireAudio();
  wireModes();
  wireSfxButtons();
  wireRandom();
  wireSearch();
  wireBadge();
  wireFeatured();
  setMode('spingo');
})();
