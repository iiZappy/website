/* Joinky Sploinky Ventures™ interactions */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const state = {
  sound: false,
  deadline: Date.now() + 10 * 60 * 1000,
  glitch: false,
};

function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

function fmtTime(ms){
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  const mm = String(m).padStart(2, '0');
  const rr = String(r).padStart(2, '0');
  return `00:${mm}:${rr}`;
}

function rand(arr){ return arr[Math.floor(Math.random() * arr.length)]; }

function buzz(freq = 520, dur = 0.07){
  if (!state.sound) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = freq;
    g.gain.value = 0.04;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    setTimeout(() => { o.stop(); ctx.close(); }, dur * 1000);
  } catch {
    // ignore
  }
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
  // tiny mood signal via emoji-less wording
  if (mood === 'warn') {
    el.style.borderColor = 'rgba(255,211,124,0.35)';
  } else if (mood === 'danger') {
    el.style.borderColor = 'rgba(255,143,163,0.35)';
  } else {
    el.style.borderColor = 'rgba(255,255,255,0.14)';
  }
}

// Confetti canvas
const fx = $('#fx');
const fxc = fx.getContext('2d');
let confetti = [];

function resizeFx(){
  fx.width = window.innerWidth * devicePixelRatio;
  fx.height = window.innerHeight * devicePixelRatio;
}
window.addEventListener('resize', resizeFx);
resizeFx();

function spawnConfetti(count = 140){
  const w = fx.width;
  const h = fx.height;
  const colors = ['#7cf3ff', '#a8ffcb', '#ffd37c', '#ff8fa3', '#ffffff'];
  const cx = w * 0.5;
  const cy = h * 0.22;
  for (let i=0;i<count;i++){
    confetti.push({
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

function tickFx(){
  fxc.clearRect(0,0,fx.width,fx.height);
  confetti = confetti.filter(p => p.a > 0.02);
  for (const p of confetti){
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
  }
  requestAnimationFrame(tickFx);
}
requestAnimationFrame(tickFx);

function spinWheelOutcome(){
  const outcomes = [
    { title: 'WINNER', text: 'You won 1,000 Joinkies. (In spirit.)', vibe: 'ok', confetti: 1 },
    { title: 'ALSO WINNER', text: 'You won a Sploinky. It is invisible and extremely expensive.', vibe: 'ok', confetti: 1 },
    { title: 'AUDIT', text: 'The Vibe Authority audited your aura. You passed, but they looked disappointed.', vibe: 'warn', confetti: 0 },
    { title: 'REFUND', text: 'Refund approved. Amount refunded: $0.00. Processing time: 1–3 vibes.', vibe: 'ok', confetti: 0 },
    { title: 'UNLUCKY', text: 'Wheel landed on “Read the Terms”. The wheel is cruel but fair.', vibe: 'danger', confetti: 0 },
  ];
  return rand(outcomes);
}

function genJoinky(){
  const openers = ['Breaking:', 'Alert:', 'Update:', 'Good news:', 'Absolutely normal behavior:', 'Investor bulletin:'];
  const nouns = ['joinky', 'sploinky', 'vibe', 'badge', 'aura', 'sigma plan', 'enterprise vibe cluster'];
  const verbs = ['minted', 'validated', 'approved', 'certified', 'sploinkified', 'triple-verified'];
  const extras = [
    'via blockchain (trust me).',
    'with 0% fees* (*emotional fees apply).',
    'under the supervision of an imaginary lawyer.',
    'in compliance with ISO-Probably.',
    'and it feels… suspiciously premium.',
    'using cutting-edge nonsense-as-a-service.'
  ];
  const n = rand(nouns);
  return `${rand(openers)} Your ${n} has been ${rand(verbs)} ${rand(extras)}`;
}

function setRiskText(v){
  const t = $('#risk-text');
  const vv = clamp(Number(v) || 0, 0, 100);
  const labels = [
    { max: 20, txt: `${vv}% smooth (honest vibes)` },
    { max: 45, txt: `${vv}% smooth (professional-ish)` },
    { max: 70, txt: `${vv}% smooth (suspiciously polished)` },
    { max: 90, txt: `${vv}% smooth (fortune 500 scam energy)` },
    { max: 100, txt: `${vv}% smooth (cosmic joinky sploinky)` },
  ];
  t.textContent = labels.find(x => vv <= x.max).txt;
}

function copyReferral(){
  const code = `JOINKY-${Math.random().toString(16).slice(2, 6).toUpperCase()}-${Math.random().toString(16).slice(2, 6).toUpperCase()}`;
  const status = $('#copy-status');
  status.textContent = '';

  const done = () => {
    status.textContent = `Copied: ${code}`;
    buzz(660, 0.06);
    setTimeout(() => { status.textContent = ''; }, 2400);
  };

  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(code).then(done).catch(() => {
      status.textContent = `Referral code: ${code}`;
    });
  } else {
    status.textContent = `Referral code: ${code}`;
  }
}

function setGlitch(on){
  state.glitch = on;
  document.documentElement.classList.toggle('glitch', on);
}

function appendTerminal(line){
  const el = $('#terminal');
  el.textContent = `${el.textContent.trimEnd()}\n${line}\n`;
}

function clearTerminal(){
  const el = $('#terminal');
  el.textContent = '$ ./joinky_sploinky.sh --mint --confidence=unreasonable\n';
}

// Init

$('#btn-sound').addEventListener('click', () => {
  state.sound = !state.sound;
  $('#btn-sound').setAttribute('aria-pressed', state.sound ? 'true' : 'false');
  $('#btn-sound').textContent = `Sound: ${state.sound ? 'On' : 'Off'}`;
  buzz(state.sound ? 740 : 260, 0.08);
});

$('#risk').addEventListener('input', (e) => {
  setRiskText(e.target.value);
  if (Number(e.target.value) % 10 === 0) buzz(480 + Number(e.target.value) * 4, 0.03);
});
setRiskText($('#risk').value);

function resetCountdown(){
  state.deadline = Date.now() + 10 * 60 * 1000;
}

setInterval(() => {
  const left = state.deadline - Date.now();
  if (left <= 0) resetCountdown();
  $('#countdown').textContent = fmtTime(state.deadline - Date.now());
}, 200);

$('#btn-claim').addEventListener('click', () => {
  setPill('Claim request received. Processing vibes…', 'ok');
  buzz(600, 0.05);
  openModal('Claim Initiated', `
    <p><strong>Good news:</strong> your Joinky claim is approved.</p>
    <p><em>Bad news:</em> it’s a parody site, so your payout is measured in feelings.</p>
    <p class="muted">Tip: Try “Spin the Wheel” or “Run a Live Scam Demo”.</p>
  `);
});

$('#btn-spin').addEventListener('click', () => {
  const out = spinWheelOutcome();
  setPill(`Wheel outcome: ${out.title}.`, out.vibe);
  buzz(820, 0.04);
  openModal('Wheel of Totally Legit', `
    <p><strong>${out.title}:</strong> ${out.text}</p>
    <p class="muted">This is satire. Your bank account remains tragically safe.</p>
  `);
  if (out.confetti) spawnConfetti(170);
});

$('#btn-demo').addEventListener('click', async () => {
  setPill('Launching scam demo (harmless)…', 'warn');
  appendTerminal('[ok] contacting the Vibe-Chain…');
  buzz(520, 0.05);

  const steps = [
    '[ok] uploading confidence…',
    '[ok] downloading accountability… (404)',
    '[warn] detected too much common sense',
    '[ok] converting common sense into joinkies',
    '[done] demo complete. nobody was financially harmed'
  ];

  for (const s of steps){
    await new Promise(r => setTimeout(r, 520 + Math.random() * 420));
    appendTerminal(s);
    buzz(420 + Math.random() * 420, 0.03);
  }

  spawnConfetti(130);
});

$('#btn-checkout').addEventListener('click', () => {
  const plan = $('input[name="plan"]:checked')?.value || 'starter';
  const email = $('#email').value.trim();
  const risk = Number($('#risk').value) || 0;

  const planNames = {
    starter: 'Starter',
    sigma: 'Sigma',
    enterprise: 'Enterprise'
  };

  setPill('Checkout confirmed. $0 charged. Ego slightly charged.', 'ok');
  buzz(720, 0.06);

  openModal('Zero-Dollar Checkout', `
    <p><strong>Success:</strong> You checked out with <strong>${planNames[plan] || plan}</strong>.</p>
    <p>Charged amount: <strong>$0.00</strong>.</p>
    <p>Provided email: <strong>${email ? email.replaceAll('<','&lt;') : '(none)'}</strong> (ignored respectfully).</p>
    <p>Scam smoothness: <strong>${risk}%</strong> (emotionally significant).</p>
    <hr />
    <p class="muted">Reminder: parody site. No payments. No tracking. Just vibes.</p>
  `);

  spawnConfetti(90);
});

$('#btn-generate').addEventListener('click', () => {
  const out = genJoinky();
  $('#gen-out').textContent = out;
  $('#gen-out').classList.remove('wiggle');
  void $('#gen-out').offsetWidth; // reflow to retrigger
  $('#gen-out').classList.add('wiggle');
  buzz(560, 0.04);
});

$('#btn-terms').addEventListener('click', () => {
  buzz(300, 0.05);
  openModal('Terms of Extremely Serious Business', `
    <p><strong>1.</strong> This is satire. If you try to wire money, the money will simply not go anywhere.</p>
    <p><strong>2.</strong> Joinkies and Sploinkies are imaginary units of comedic value.</p>
    <p><strong>3.</strong> Any resemblance to real scams is intentional mockery.</p>
    <p><strong>4.</strong> By continuing, you agree to maintain a healthy level of skepticism.</p>
  `);
});

$('#btn-copy').addEventListener('click', () => copyReferral());

$('#btn-confetti').addEventListener('click', (e) => {
  e.preventDefault();
  spawnConfetti(180);
  buzz(880, 0.05);
});

$('#btn-glitch').addEventListener('click', () => {
  setGlitch(!state.glitch);
  appendTerminal(state.glitch ? '[warn] glitch mode enabled (purely cosmetic)' : '[ok] glitch mode disabled');
  buzz(state.glitch ? 240 : 640, 0.06);
});

$('#btn-clear').addEventListener('click', () => {
  clearTerminal();
  buzz(360, 0.04);
});

for (const [i, id] of ['#cert-1', '#cert-2', '#cert-3'].entries()){
  $(id).addEventListener('click', () => {
    const titles = ['Vibe Compliance', 'License to Sploink', 'Anti-Scam Scam Permit'];
    const lines = [
      'This certificate is printed on 100% renewable confidence.',
      'Approved by the Council of Joinky Sploinkies (self-appointed).',
      'Valid in all jurisdictions where vibes are legally recognized.'
    ];
    buzz(520 + i * 90, 0.05);
    openModal(titles[i], `<p><strong>Certificate:</strong> ${lines[i]}</p><p class="muted">You may now look serious while being silly.</p>`);
  });
}

$$('.chk').forEach((c, idx) => {
  c.addEventListener('change', () => {
    const checked = $$('.chk').filter(x => x.checked).length;
    const msg = [
      'Due diligence initiated. The vibes are watching.',
      'Compliance level rising. Your aura is becoming corporate.',
      'You are now legally allowed to say “synergy”.',
      'Checklist complete. Congratulations: you are unstoppable and mildly cringe.'
    ][clamp(checked - 1, 0, 3)];
    setPill(msg, checked === 4 ? 'ok' : 'warn');
    if (checked === 4) spawnConfetti(120);
    buzz(460 + idx * 30, 0.03);
  });
});

$('#btn-easter').addEventListener('click', () => {
  const spells = [
    'joinky sploinky',
    'joinky. sploinky. enterprise.',
    'sploinky joinky (reverse)',
    'ultra joinky sploinky deluxe'
  ];
  const spell = rand(spells);
  setPill(`Summoning: “${spell}”…`, 'warn');
  appendTerminal(`[ok] casting spell: ${spell}`);
  spawnConfetti(160);
  buzz(980, 0.06);
});

// Close modal with Escape is native to <dialog>. Provide a safety fallback.
$('#modal').addEventListener('click', (e) => {
  const d = $('#modal');
  if (e.target === d) d.close();
});
