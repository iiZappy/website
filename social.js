// Klonkie's Social app logic

import { auth, db, storage } from './firebase.js';

import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  signOut,
  updateProfile,
  reload,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  collection,
  doc,
  getDoc,
  setDoc,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  where,
  getDocs,
  runTransaction,
  increment,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const C = window.MemeCore;
const $ = C?.$;

const el = {
  toast: $('#toast'),
  btnOpenAuth: $('#btn-open-auth'),
  btnLogout: $('#btn-logout'),
  btnProfile: $('#btn-profile'),
  gate: $('#gate'),
  composer: $('#composer'),
  me: $('#me'),
  postText: $('#post-text'),
  postTopic: $('#post-topic'),
  btnPost: $('#btn-post'),
  avatarFile: $('#avatar-file'),
  feed: $('#feed'),
  trending: $('#trending'),
  wire: $('#wire'),
  topics: $('#topics'),
  tabForYou: $('#tab-foryou'),
  tabLatest: $('#tab-latest'),
  tabTopic: $('#tab-topic'),
  tabs: $('#tabs'),
  btnResend: $('#btn-resend'),
  btnIveVerified: $('#btn-ive-verified'),
  btnSound: $('#btn-sound'),
  btnMute: $('#btn-mute'),
  vol: $('#vol'),
  theme: $('#theme'),
};

let meUser = null;
let currentTopic = null;
let view = 'foryou';

function toast(msg, mood='ok'){
  C?.setToast(msg, mood);
}

function fmtTime(msOrDate){
  try {
    const d = msOrDate instanceof Date ? msOrDate : new Date(msOrDate);
    return d.toLocaleString();
  } catch(_) { return '—'; }
}

function initials(name){
  const s = (name || '').trim();
  if (!s) return 'KS';
  const parts = s.split(/\s+/g);
  const a = (parts[0] || 'K')[0];
  const b = (parts[1] || parts[0] || 'S')[0];
  return (a + b).toUpperCase();
}

function setTabs(onId){
  el.tabForYou?.classList.toggle('is-on', onId === 'foryou');
  el.tabLatest?.classList.toggle('is-on', onId === 'latest');
  el.tabTopic?.classList.toggle('is-on', onId === 'topic');
}

function applyTheme(t){
  const theme = (t === 'light' || t === 'dark' || t === 'system') ? t : 'system';
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('ks_theme', theme); } catch(_) {}
  if (el.theme) el.theme.value = theme;
}

function bootTheme(){
  let saved = 'system';
  try { saved = localStorage.getItem('ks_theme') || 'system'; } catch(_) {}
  applyTheme(saved);

  el.theme?.addEventListener('change', (e) => {
    C?.sfx('tab');
    applyTheme(e.target.value);
  });
}

function setAuthStatus(text, mood='muted'){
  const s = document.getElementById('auth-status');
  if (!s) return;
  s.className = `small ${mood}`;
  s.textContent = text;
}

function setAuthBusy(busy){
  const ids = ['auth-email','auth-pass','auth-handle','auth-name','do-login','do-register'];
  ids.forEach(id => {
    const n = document.getElementById(id);
    if (!n) return;
    n.disabled = !!busy;
  });
}

function showAuthModal(){
  const html = `
    <div id="auth-status" class="small muted">Login or create an account. Verification email might land in spam/junk.</div>
    <div style="margin-top:10px; display:grid; gap:10px;">
      <input id="auth-email" class="input" placeholder="Email" type="email" autocomplete="email" />
      <input id="auth-pass" class="input" placeholder="Password" type="password" autocomplete="current-password" />
      <input id="auth-handle" class="input" placeholder="@handle (optional)" type="text" autocomplete="username" />
      <input id="auth-name" class="input" placeholder="Display name (optional)" type="text" autocomplete="name" />
      <div class="row row--wrap">
        <button id="do-login" class="btn btn--primary" type="button">Login</button>
        <button id="do-register" class="btn" type="button">Register</button>
      </div>
    </div>
  `;

  C?.openModal('Login / Register', html);

  setTimeout(() => {
    const email = document.getElementById('auth-email');
    const pass = document.getElementById('auth-pass');
    const handle = document.getElementById('auth-handle');
    const name = document.getElementById('auth-name');

    const login = async () => {
      C?.sfx('tab');
      setAuthStatus('Logging in…', 'muted');
      setAuthBusy(true);
      try {
        await signInWithEmailAndPassword(auth, (email.value||'').trim(), pass.value||'');
        toast('Logged in.', 'ok');
        C?.sfx('success');
        C?.closeModal?.();
      } catch (e) {
        setAuthStatus(`Login failed: ${e?.code || e?.message || e}`, 'muted');
        toast(`Login failed: ${e?.code || e?.message || e}`, 'danger');
        C?.sfx('error');
      } finally {
        setAuthBusy(false);
      }
    };

    const register = async () => {
      C?.sfx('tab');
      setAuthStatus('Creating account…', 'muted');
      setAuthBusy(true);
      try {
        const cred = await createUserWithEmailAndPassword(auth, (email.value||'').trim(), pass.value||'');
        if (name.value?.trim()) {
          await updateProfile(cred.user, { displayName: name.value.trim() });
        }

        await sendEmailVerification(cred.user);

        const uid = cred.user.uid;
        const safeHandle = (handle.value || '').trim().replace(/^@+/, '').replace(/[^a-zA-Z0-9_\.\-]/g,'').slice(0,20);

        const profile = {
          uid,
          handle: safeHandle ? `@${safeHandle}` : `@clown_${uid.slice(0,6)}`,
          displayName: name.value?.trim() || 'Klonkie User',
          photoURL: '',
          createdAt: serverTimestamp(),
        };

        await setDoc(doc(db, 'users', uid), profile, { merge: true });

        toast('Registered. Check your email (spam/junk) for verification.', 'warn');
        C?.sfx('notif');
        C?.closeModal?.();
      } catch (e) {
        setAuthStatus(`Register failed: ${e?.code || e?.message || e}`, 'muted');
        toast(`Register failed: ${e?.code || e?.message || e}`, 'danger');
        C?.sfx('error');
      } finally {
        setAuthBusy(false);
      }
    };

    document.getElementById('do-login')?.addEventListener('click', login);
    document.getElementById('do-register')?.addEventListener('click', register);

    // Enter-to-login in password field
    pass?.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') { ev.preventDefault(); login(); }
    });

  }, 20);
}

async function ensureProfile(user){
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data();

  const profile = {
    uid: user.uid,
    handle: `@clown_${user.uid.slice(0,6)}`,
    displayName: user.displayName || 'Klonkie User',
    photoURL: user.photoURL || '',
    createdAt: serverTimestamp(),
  };
  await setDoc(ref, profile, { merge: true });
  return profile;
}

function canInteract(){
  return !!(meUser && meUser.emailVerified);
}

function renderPost(p){
  const topic = (p.topics && p.topics[0]) ? p.topics[0] : 'memes';
  const name = p.authorDisplayName || 'Klonkie User';
  const handle = p.authorHandle || '@clown';
  const photo = p.authorPhotoURL || '';
  const when = p.createdAt?.toMillis ? fmtTime(p.createdAt.toMillis()) : '—';

  const wrap = document.createElement('article');
  wrap.className = 'post';
  wrap.innerHTML = `
    <div class="post__top">
      <div class="post__who">
        <div class="avatar">${photo ? `<img alt="avatar" src="${photo}" />` : `<span>${initials(name)}</span>`}</div>
        <div>
          <div class="handle">${escapeHtml(name)} <span class="muted">${escapeHtml(handle)}</span></div>
          <div class="time">${escapeHtml(when)} · <span class="topic">#${escapeHtml(topic)}</span></div>
        </div>
      </div>
      <div class="time">❤ ${Number(p.likeCount||0)}</div>
    </div>
    <div class="post__text">${escapeHtml(p.text || '')}</div>
    <div class="actions">
      <button class="act" data-act="like">Like</button>
      <button class="act" data-act="comment">Comment</button>
      <button class="act" data-act="share">Share</button>
    </div>
  `;

  const likeBtn = wrap.querySelector('[data-act="like"]');
  const commentBtn = wrap.querySelector('[data-act="comment"]');
  const shareBtn = wrap.querySelector('[data-act="share"]');

  if (!canInteract()) {
    if (likeBtn) likeBtn.disabled = true;
    if (commentBtn) commentBtn.disabled = true;
  }

  likeBtn?.addEventListener('click', async () => {
    if (!canInteract()) {
      toast('Verify your email to like posts.', 'warn');
      return;
    }
    C?.sfx('like');
    try {
      await likePost(p.id);
      toast('Liked.', 'ok');
    } catch (e) {
      toast(`Like failed: ${e?.code || e?.message || e}`, 'danger');
      C?.sfx('error');
    }
  });

  commentBtn?.addEventListener('click', async () => {
    if (!canInteract()) {
      toast('Verify your email to comment.', 'warn');
      return;
    }
    C?.sfx('comment');
    toast('Comments: next update (threads).', 'warn');
  });

  shareBtn?.addEventListener('click', async () => {
    C?.sfx('whoosh');
    try {
      await navigator.clipboard.writeText(location.href);
      toast('Link copied.', 'ok');
      C?.sfx('success');
    } catch (_) {
      toast('Copy failed.', 'danger');
      C?.sfx('error');
    }
  });

  return wrap;
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[c]));
}

async function loadFeed(){
  if (!meUser) return;

  el.feed.innerHTML = '';
  toast('Loading feed…', 'warn');

  const postsRef = collection(db, 'posts');
  let q;

  if (view === 'latest') {
    q = query(postsRef, orderBy('createdAt', 'desc'), limit(30));
  } else if (view === 'topic' && currentTopic) {
    q = query(postsRef, where('topics', 'array-contains', currentTopic), orderBy('createdAt', 'desc'), limit(30));
  } else {
    q = query(postsRef, orderBy('createdAt', 'desc'), limit(30));
  }

  const snaps = await getDocs(q);
  const items = [];
  snaps.forEach(s => items.push({ id: s.id, ...s.data() }));

  if (!items.length) {
    el.feed.innerHTML = `<div class="card"><div class="card__title">No posts yet</div><div class="muted small">Create the first post.</div></div>`;
    toast('No posts found.', 'warn');
    return;
  }

  for (const p of items) el.feed.appendChild(renderPost(p));
  toast('Feed loaded.', 'ok');
}

async function createPost(){
  if (!canInteract()) {
    toast('Verify your email to post.', 'warn');
    return;
  }

  const text = (el.postText.value || '').trim();
  if (!text) {
    toast('Write something first.', 'warn');
    C?.sfx('error');
    return;
  }

  const topic = el.postTopic.value || 'memes';

  const profile = await ensureProfile(meUser);

  await addDoc(collection(db, 'posts'), {
    authorUid: meUser.uid,
    authorHandle: profile.handle,
    authorDisplayName: profile.displayName,
    authorPhotoURL: profile.photoURL || '',
    text,
    topics: [topic],
    likeCount: 0,
    commentCount: 0,
    createdAt: serverTimestamp(),
    kind: 'user',
  });

  el.postText.value = '';
  toast('Posted.', 'ok');
  C?.sfx('post');
  C?.spawnConfetti?.(60);

  await loadFeed();
}

async function likePost(postId){
  const postRef = doc(db, 'posts', postId);
  const likeRef = doc(db, 'posts', postId, 'likes', meUser.uid);

  await runTransaction(db, async (tx) => {
    const likeSnap = await tx.get(likeRef);
    if (likeSnap.exists()) return;
    tx.set(likeRef, { uid: meUser.uid, createdAt: serverTimestamp() });
    tx.update(postRef, { likeCount: increment(1) });
  });

  updateTrending();
}

async function uploadAvatar(file){
  if (!meUser || !file) return;

  const path = `avatars/${meUser.uid}/${Date.now()}_${file.name}`;
  const r = ref(storage, path);
  await uploadBytes(r, file);
  const url = await getDownloadURL(r);

  await updateProfile(meUser, { photoURL: url });
  await setDoc(doc(db, 'users', meUser.uid), { photoURL: url }, { merge: true });

  toast('Avatar updated.', 'ok');
  C?.sfx('success');
}

async function showProfileModal(){
  if (!meUser) return;

  const profile = await ensureProfile(meUser);

  const html = `
    <div class="muted small">Update your profile.</div>
    <div style="margin-top:10px; display:grid; gap:10px;">
      <input id="p-name" class="input" placeholder="Display name" value="${escapeHtml(profile.displayName||'')}" />
      <input id="p-handle" class="input" placeholder="@handle" value="${escapeHtml(profile.handle||'')}" />
      <div class="row row--wrap">
        <button id="p-save" class="btn btn--primary" type="button">Save</button>
      </div>
      <div class="muted small">Avatar upload is in the composer.</div>
    </div>
  `;

  C?.openModal('Profile', html);

  setTimeout(() => {
    const name = document.getElementById('p-name');
    const handle = document.getElementById('p-handle');

    document.getElementById('p-save')?.addEventListener('click', async () => {
      try {
        const newName = (name.value || '').trim().slice(0, 40) || 'Klonkie User';
        const raw = (handle.value || '').trim().replace(/^@+/, '').replace(/[^a-zA-Z0-9_\.\-]/g,'').slice(0, 20);
        const newHandle = raw ? `@${raw}` : profile.handle;

        await updateProfile(meUser, { displayName: newName });
        await setDoc(doc(db, 'users', meUser.uid), { displayName: newName, handle: newHandle }, { merge: true });

        toast('Profile saved.', 'ok');
        C?.sfx('success');
        C?.closeModal?.();

        await loadFeed();
      } catch (e) {
        toast(`Save failed: ${e?.code || e?.message || e}`, 'danger');
        C?.sfx('error');
      }
    });
  }, 40);
}

async function updateTrending(){
  if (!meUser) return;

  try {
    const postsRef = collection(db, 'posts');
    const q = query(postsRef, orderBy('likeCount', 'desc'), orderBy('createdAt', 'desc'), limit(8));
    const snaps = await getDocs(q);
    const items = [];
    snaps.forEach(s => items.push({ id: s.id, ...s.data() }));

    const pick = items.length ? items[Math.floor(Math.random() * items.length)] : null;

    el.trending.innerHTML = '';

    if (!pick) {
      el.trending.innerHTML = `<div class="muted small">No trending yet.</div>`;
      return;
    }

    const node = document.createElement('div');
    node.className = 'post';
    node.innerHTML = `
      <div class="post__top">
        <div class="post__who">
          <div class="avatar">${pick.authorPhotoURL ? `<img alt="avatar" src="${pick.authorPhotoURL}" />` : `<span>${initials(pick.authorDisplayName||'K')}</span>`}</div>
          <div>
            <div class="handle">${escapeHtml(pick.authorDisplayName||'User')} <span class="muted">${escapeHtml(pick.authorHandle||'@user')}</span></div>
            <div class="time">❤ ${Number(pick.likeCount||0)} · <span class="topic">#${escapeHtml((pick.topics&&pick.topics[0])||'memes')}</span></div>
          </div>
        </div>
      </div>
      <div class="post__text">${escapeHtml((pick.text||'').slice(0,240))}${(pick.text||'').length>240?'…':''}</div>
    `;

    el.trending.appendChild(node);
  } catch (e) {
    el.trending.innerHTML = `<div class="muted small">Trending failed: ${escapeHtml(e?.code || e?.message || String(e))}</div>`;
  }
}

async function updateWire(){
  try {
    const subs = ['memes','dankmemes','RocketLeague','arma','thenetherlands'];
    const sub = subs[Math.floor(Math.random()*subs.length)];
    const res = await fetch(`https://meme-api.com/gimme/${encodeURIComponent(sub)}`);
    if (!res.ok) throw new Error(String(res.status));
    const j = await res.json();

    const card = document.createElement('div');
    card.className = 'post';
    card.innerHTML = `
      <div class="post__top">
        <div class="post__who">
          <div class="avatar"><span>EX</span></div>
          <div>
            <div class="handle">External drop <span class="muted">r/${escapeHtml(j.subreddit||sub)}</span></div>
            <div class="time"><span class="topic">#${escapeHtml((currentTopic||'memes'))}</span></div>
          </div>
        </div>
      </div>
      <div class="post__text">${escapeHtml(j.title || 'meme')}</div>
      <div class="actions">
        <a class="act" href="${escapeHtml(j.postLink || j.url || '#')}" target="_blank" rel="noopener">Open</a>
      </div>
    `;

    el.wire.prepend(card);
    while (el.wire.children.length > 6) el.wire.lastElementChild.remove();

    C?.sfx('refresh');
  } catch (_) {
    const msg = document.createElement('div');
    msg.className = 'muted small';
    msg.textContent = 'KlonkieWire: external fetch failed (network/CORS).';
    el.wire.innerHTML = '';
    el.wire.appendChild(msg);
  }
}

function wireUI(){
  // audio controls
  el.btnSound?.addEventListener('click', () => {
    C.state.sound = !C.state.sound;
    el.btnSound.setAttribute('aria-pressed', C.state.sound ? 'true' : 'false');
    C.setVolume(C.state.volume);
    if (C.state.sound) C.primeSamples?.();
    C.sfx(C.state.sound ? 'success' : 'error');
  });

  el.btnMute?.addEventListener('click', () => {
    C.state.muted = !C.state.muted;
    el.btnMute.setAttribute('aria-pressed', C.state.muted ? 'true' : 'false');
    C.setVolume(C.state.volume);
    if (!C.state.muted) C.sfx('success');
  });

  el.vol?.addEventListener('input', (e) => {
    const v = C.clamp((Number(e.target.value) || 0) / 100, 0, 1);
    C.setVolume(v);
  });

  C.setVolume(C.state.volume);
  C.primeSamples?.();

  el.btnOpenAuth?.addEventListener('click', () => {
    C?.sfx('tab');
    showAuthModal();
  });

  el.btnLogout?.addEventListener('click', async () => {
    C?.sfx('tab');
    await signOut(auth);
  });

  el.btnProfile?.addEventListener('click', () => {
    C?.sfx('tab');
    showProfileModal();
  });

  el.btnPost?.addEventListener('click', async () => {
    C?.sfx('tab');
    await createPost();
  });

  el.avatarFile?.addEventListener('change', async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      await uploadAvatar(f);
    } catch (err) {
      toast(`Avatar upload failed: ${err?.code || err?.message || err}`, 'danger');
      C?.sfx('error');
    }
  });

  el.tabForYou?.addEventListener('click', async () => {
    view = 'foryou';
    setTabs('foryou');
    C?.sfx('tab');
    await loadFeed();
  });

  el.tabLatest?.addEventListener('click', async () => {
    view = 'latest';
    setTabs('latest');
    C?.sfx('tab');
    await loadFeed();
  });

  el.tabTopic?.addEventListener('click', async () => {
    view = 'topic';
    setTabs('topic');
    C?.sfx('tab');
    await loadFeed();
  });

  el.topics?.addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-topic]');
    if (!b) return;
    const t = b.getAttribute('data-topic');
    currentTopic = t;

    [...el.topics.querySelectorAll('button[data-topic]')].forEach(x => x.classList.toggle('is-on', x === b));

    view = 'topic';
    setTabs('topic');
    C?.sfx('tab');

    await loadFeed();
  });

  el.btnResend?.addEventListener('click', async () => {
    if (!meUser) return;
    try {
      await sendEmailVerification(meUser);
      toast('Verification email sent again (check spam/junk).', 'ok');
      C?.sfx('notif');
    } catch (e) {
      toast(`Resend failed: ${e?.code || e?.message || e}`, 'danger');
      C?.sfx('error');
    }
  });

  el.btnIveVerified?.addEventListener('click', async () => {
    if (!meUser) return;
    try {
      await reload(meUser);
      if (meUser.emailVerified) {
        toast('Verified. Welcome.', 'ok');
        C?.sfx('success');
        el.gate.hidden = true;
        el.composer.hidden = false;
        el.tabs.hidden = false;
        await loadFeed();
      } else {
        toast('Still not verified. Check your email (spam/junk).', 'warn');
        C?.sfx('error');
      }
    } catch (e) {
      toast(`Refresh failed: ${e?.code || e?.message || e}`, 'danger');
      C?.sfx('error');
    }
  });
}

function bootAuth(){
  onAuthStateChanged(auth, async (user) => {
    meUser = user;

    if (!user) {
      toast('Logged out. Login to enter.', 'warn');
      el.btnLogout.hidden = true;
      el.btnProfile.hidden = true;
      el.btnOpenAuth.hidden = false;
      el.gate.hidden = true;
      el.composer.hidden = true;
      el.tabs.hidden = true;
      el.feed.innerHTML = `<div class="card"><div class="card__title">Login required</div><div class="muted small">Login/register to see the feed.</div></div>`;
      return;
    }

    el.btnLogout.hidden = false;
    el.btnProfile.hidden = false;
    el.btnOpenAuth.hidden = true;

    const profile = await ensureProfile(user);
    el.me.textContent = `${profile.displayName} (${profile.handle})`;

    // Unverified: allow reading the feed, but disable interactions.
    if (!user.emailVerified) {
      toast('Verify email to post/like/comment. You can browse meanwhile.', 'warn');
      el.gate.hidden = false;
      el.composer.hidden = true;
      el.tabs.hidden = false;
      await loadFeed();
      await updateTrending();
      return;
    }

    el.gate.hidden = true;
    el.composer.hidden = false;
    el.tabs.hidden = false;

    toast('Welcome. Feed loading…', 'ok');
    C?.sfx('success');

    await loadFeed();
    await updateTrending();
  });
}

function startLoops(){
  setInterval(() => {
    if (!meUser) return;
    updateTrending();
  }, 10_000);

  setInterval(() => {
    updateWire();
  }, 10_000);

  updateWire();
}

bootTheme();
wireUI();
setTabs('foryou');
bootAuth();
startLoops();

toast('Ready.', 'ok');
