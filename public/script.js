/* ═══════════════════════════════════════════════════════════
   Connector — script.js
   Handles: join, WebSocket, messaging, profiles, themes,
            emoji picker, typing indicator, modals, toasts
   ═══════════════════════════════════════════════════════════ */

'use strict';

// ── State ──────────────────────────────────────────────────
let ws           = null;        // WebSocket instance
let myUserId     = null;        // server-assigned ID
let myUsername   = '';
let myAvatar     = '😎';
let myAge        = '';
let myGender     = '';
let myLocation   = '';
let myAbout      = '';

let selectedAvatar  = '😎';    // currently highlighted in pickers
let typingTimer     = null;
let wasTyping       = false;
let emojiOpen       = false;

// ── Audio ──────────────────────────────────────────────────
let audioCtx = null;
function playPop() {
  if (!document.getElementById('soundToggle')?.checked) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.connect(g); g.connect(audioCtx.destination);
    o.type = 'sine';
    o.frequency.setValueAtTime(700, audioCtx.currentTime);
    o.frequency.exponentialRampToValueAtTime(480, audioCtx.currentTime + 0.07);
    g.gain.setValueAtTime(0.10, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.14);
    o.start(); o.stop(audioCtx.currentTime + 0.14);
  } catch { /* silently ignore */ }
}

// ══════════════════════════════════════════════════════════
//  PREFERENCES (localStorage)
// ══════════════════════════════════════════════════════════
const PREF_KEY = 'connector_prefs';

function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(PREF_KEY)) || {}; } catch { return {}; }
}
function savePrefs(extra = {}) {
  const prefs = {
    ...loadPrefs(),
    theme:    document.documentElement.getAttribute('data-theme'),
    accent:   document.documentElement.getAttribute('data-accent'),
    sound:    document.getElementById('soundToggle')?.checked ?? false,
    username: myUsername,
    avatar:   myAvatar,
    age:      myAge,
    gender:   myGender,
    location: myLocation,
    about:    myAbout,
    userId:   myUserId,
    ...extra,
  };
  localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
}

function applyPrefs() {
  const p = loadPrefs();

  // Theme
  const theme = p.theme || 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  syncThemeUI(theme);

  // Accent
  const accent = p.accent || 'violet';
  document.documentElement.setAttribute('data-accent', accent);
  syncAccentUI(accent);

  // Sound
  const soundEl = document.getElementById('soundToggle');
  if (soundEl) soundEl.checked = p.sound ?? false;

  // Prefill join form
  if (p.username) document.getElementById('jUsername').value = p.username;
  if (p.age)      document.getElementById('jAge').value      = p.age;
  if (p.gender)   document.getElementById('jGender').value   = p.gender;
  if (p.location) document.getElementById('jLocation').value = p.location;
  if (p.about)    document.getElementById('jAbout').value    = p.about;

  // Avatar
  selectedAvatar = p.avatar || '😎';
  highlightAvatarPicker('joinAvatarPicker', selectedAvatar);
}

// ══════════════════════════════════════════════════════════
//  THEME & ACCENT
// ══════════════════════════════════════════════════════════
function setTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  syncThemeUI(t);
  savePrefs();
}

function syncThemeUI(t) {
  // Landing chips
  document.querySelectorAll('.theme-chip').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === t);
  });
  // Sidebar seg buttons
  const btnDark  = document.getElementById('btnDark');
  const btnLight = document.getElementById('btnLight');
  if (btnDark)  btnDark.classList.toggle('active',  t === 'dark');
  if (btnLight) btnLight.classList.toggle('active', t === 'light');
}

function setAccent(a) {
  document.documentElement.setAttribute('data-accent', a);
  syncAccentUI(a);
  savePrefs();
}

function syncAccentUI(a) {
  document.querySelectorAll('.ac-dot').forEach(d => {
    d.classList.toggle('active', d.dataset.ac === a);
    d.setAttribute('aria-pressed', String(d.dataset.ac === a));
  });
}

// ══════════════════════════════════════════════════════════
//  AVATAR PICKERS
// ══════════════════════════════════════════════════════════
function initAvatarPickers() {
  ['joinAvatarPicker', 'peAvatarPicker'].forEach(id => {
    const picker = document.getElementById(id);
    if (!picker) return;
    picker.querySelectorAll('.av-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedAvatar = btn.dataset.av;
        highlightAvatarPicker(id, selectedAvatar);
        // Keep both pickers in sync
        ['joinAvatarPicker','peAvatarPicker'].forEach(oid => {
          if (oid !== id) highlightAvatarPicker(oid, selectedAvatar);
        });
        // Update preview in profile editor
        const peAv = document.getElementById('peAvatar');
        if (peAv) peAv.textContent = selectedAvatar;
      });
    });
  });
}

function highlightAvatarPicker(pickerId, av) {
  const picker = document.getElementById(pickerId);
  if (!picker) return;
  picker.querySelectorAll('.av-opt').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.av === av);
  });
}

// ══════════════════════════════════════════════════════════
//  JOIN
// ══════════════════════════════════════════════════════════
async function joinChat() {
  const username = document.getElementById('jUsername').value.trim();
  const errorEl  = document.getElementById('joinError');
  errorEl.textContent = '';

  if (!username) {
    errorEl.textContent = 'Please enter a username.';
    document.getElementById('jUsername').focus();
    return;
  }

  // Collect profile fields
  myUsername = username;
  myAvatar   = selectedAvatar;
  myAge      = document.getElementById('jAge').value.trim();
  myGender   = document.getElementById('jGender').value;
  myLocation = document.getElementById('jLocation').value.trim();
  myAbout    = document.getElementById('jAbout').value.trim();

  const prefs = loadPrefs();
  const storedId = prefs.userId || null;

  try {
    const res  = await fetch('/api/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username:  myUsername,
        avatar:    myAvatar,
        age:       myAge,
        gender:    myGender,
        location:  myLocation,
        about:     myAbout,
        userId:    storedId,
      }),
    });
    const data = await res.json();
    if (!res.ok) { errorEl.textContent = data.error || 'Could not join.'; return; }

    myUserId = data.userId;
    savePrefs();

    showApp(data.history || []);
  } catch {
    errorEl.textContent = 'Cannot reach server. Is it running?';
  }
}

// ══════════════════════════════════════════════════════════
//  SHOW APP
// ══════════════════════════════════════════════════════════
function showApp(history) {
  document.getElementById('joinScreen').classList.remove('active');
  document.getElementById('appScreen').classList.add('active');

  refreshMyProfileUI();

  // Render history
  document.getElementById('messages').innerHTML = '';
  if (history.length > 0) {
    appendDateChip('Earlier');
    history.forEach(m => appendMessageDOM(m, false));
  }
  scrollBottom();

  connectWS();
}

function refreshMyProfileUI() {
  document.getElementById('sidebarAvatar').textContent = myAvatar;
  document.getElementById('sidebarName').textContent   = myUsername;
  document.getElementById('topbarAvatar').textContent  = myAvatar;

  const parts = [myLocation, myAge ? `${myAge}y` : ''].filter(Boolean);
  document.getElementById('sidebarMeta').textContent = parts.join(' · ') || 'Edit profile →';
}

// ══════════════════════════════════════════════════════════
//  WEBSOCKET
// ══════════════════════════════════════════════════════════
function connectWS() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}`);

  ws.addEventListener('open', () => {
    hideBanner();
    wsSend({ type: 'register', userId: myUserId });
  });

  ws.addEventListener('message', ({ data }) => {
    let msg;
    try { msg = JSON.parse(data); } catch { return; }

    switch (msg.type) {
      case 'message':      handleIncoming(msg);         break;
      case 'system':       appendSysMsg(msg.text);      break;
      case 'active-users': renderUserList(msg.users);   break;
      case 'typing':       handleTypingEvent(msg);      break;
      case 'error':        showToast(msg.text);         break;
    }
  });

  ws.addEventListener('close', () => {
    showBanner();
    setTimeout(connectWS, 3000);
  });

  ws.addEventListener('error', () => showBanner());
}

function wsSend(obj) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}

// ══════════════════════════════════════════════════════════
//  MESSAGES
// ══════════════════════════════════════════════════════════
function handleIncoming(msg) {
  const isMe = msg.userId === myUserId;
  appendMessageDOM(msg, true);
  if (!isMe) playPop();
}

/** Build and inject a message bubble */
function appendMessageDOM(msg, animate) {
  const isMe     = msg.userId === myUserId;
  const msgWrap  = document.getElementById('messages');

  // Remove welcome placeholder if present
  const welcome = msgWrap.querySelector('.chat-welcome');
  if (welcome) welcome.remove();

  const row = document.createElement('div');
  row.className = `msg-row ${isMe ? 'me' : 'them'}`;
  if (!animate) row.style.animation = 'none';

  // Sender name (for others)
  if (!isMe) {
    const sender = document.createElement('div');
    sender.className = 'msg-sender';
    sender.textContent = `${msg.avatar || ''} ${esc(msg.username)}`;
    sender.onclick = () => showUserCard(msg);
    row.appendChild(sender);
  }

  // Bubble wrapper (for copy button)
  const wrap = document.createElement('div');
  wrap.className = 'bubble-wrap';

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = msg.text;

  // Copy button
  const copyBtn = document.createElement('button');
  copyBtn.className = 'copy-btn';
  copyBtn.title = 'Copy';
  copyBtn.setAttribute('aria-label', 'Copy message');
  copyBtn.textContent = '⎘';
  copyBtn.onclick = () => {
    navigator.clipboard.writeText(msg.text).then(() => showToast('Copied!'));
  };

  wrap.appendChild(bubble);
  wrap.appendChild(copyBtn);
  row.appendChild(wrap);

  // Timestamp
  const time = document.createElement('div');
  time.className = 'msg-time';
  time.textContent = fmtTime(msg.time);
  row.appendChild(time);

  msgWrap.appendChild(row);
  scrollBottom();
}

function appendSysMsg(text) {
  const el = document.createElement('div');
  el.className = 'sys-msg';
  el.textContent = text;
  document.getElementById('messages').appendChild(el);
  scrollBottom();
}

function appendDateChip(label) {
  const el = document.createElement('div');
  el.className = 'date-chip';
  el.textContent = label;
  document.getElementById('messages').appendChild(el);
}

function scrollBottom() {
  const el = document.getElementById('messagesWrap');
  if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
}

// ══════════════════════════════════════════════════════════
//  SENDING
// ══════════════════════════════════════════════════════════
function sendMessage() {
  const input = document.getElementById('msgInput');
  const text  = input.value.trim();
  if (!text) return;

  wsSend({ type: 'message', text });

  if (wasTyping) { wsSend({ type: 'typing', isTyping: false }); wasTyping = false; }
  clearTimeout(typingTimer);

  input.value = '';
  input.style.height = 'auto';
  updateSendBtn();
  input.focus();

  // Close emoji picker
  if (emojiOpen) toggleEmojiPicker();
}

function handleMsgKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); return; }
  autoResize(e.target);
}

function handleTypingInput() {
  autoResize(document.getElementById('msgInput'));
  updateSendBtn();

  if (!wasTyping) { wsSend({ type: 'typing', isTyping: true }); wasTyping = true; }
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    wsSend({ type: 'typing', isTyping: false }); wasTyping = false;
  }, 2200);
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 130) + 'px';
}

function updateSendBtn() {
  const btn = document.getElementById('sendBtn');
  const val = document.getElementById('msgInput').value.trim();
  btn.disabled = !val;
  btn.style.opacity = val ? '1' : '0.38';
  btn.style.pointerEvents = val ? 'auto' : 'none';
}

// ══════════════════════════════════════════════════════════
//  TYPING INDICATOR
// ══════════════════════════════════════════════════════════
const typingUsers = new Map();

function handleTypingEvent({ userId, username, isTyping }) {
  if (isTyping) typingUsers.set(userId, username);
  else          typingUsers.delete(userId);
  renderTypingBar();
}

function renderTypingBar() {
  const bar = document.getElementById('typingBar');
  if (typingUsers.size === 0) { bar.innerHTML = ''; return; }
  const names = [...typingUsers.values()].slice(0, 3).join(', ');
  const verb  = typingUsers.size === 1 ? 'is' : 'are';
  bar.innerHTML = `
    <span class="t-dots"><span></span><span></span><span></span></span>
    ${esc(names)} ${verb} typing…`;
}

// ══════════════════════════════════════════════════════════
//  ACTIVE USERS LIST
// ══════════════════════════════════════════════════════════
function renderUserList(users) {
  document.getElementById('onlineCount').textContent = users.length;
  document.getElementById('topbarSub').textContent   = `${users.length} online`;

  const list = document.getElementById('userList');
  list.innerHTML = '';

  users.forEach((u, i) => {
    const isMe = u.userId === myUserId;
    const pill = document.createElement('div');
    pill.className = 'user-pill';
    pill.style.animationDelay = `${i * 40}ms`;
    pill.innerHTML = `
      <span class="up-dot"></span>
      <span class="up-av">${u.avatar || '👤'}</span>
      <div class="up-info">
        <p class="up-name">${esc(u.username)}</p>
        ${u.location ? `<p class="up-loc">📍 ${esc(u.location)}</p>` : ''}
      </div>
      ${isMe ? '<span class="up-you">you</span>' : ''}`;
    if (!isMe) pill.onclick = () => showUserCard(u);
    list.appendChild(pill);
  });
}

// ══════════════════════════════════════════════════════════
//  PROFILE EDITOR MODAL
// ══════════════════════════════════════════════════════════
function openProfileEditor() {
  // Populate fields
  document.getElementById('peUsername').value  = myUsername;
  document.getElementById('peAge').value       = myAge;
  document.getElementById('peGender').value    = myGender;
  document.getElementById('peLocation').value  = myLocation;
  document.getElementById('peAbout').value     = myAbout;
  document.getElementById('peAvatar').textContent = myAvatar;
  document.getElementById('peUserId').textContent = myUserId || '—';
  highlightAvatarPicker('peAvatarPicker', myAvatar);

  document.getElementById('profileModal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeProfileEditor(e) {
  if (e && e.target !== document.getElementById('profileModal')) return;
  document.getElementById('profileModal').classList.add('hidden');
  document.body.style.overflow = '';
}

async function saveProfileEdit() {
  const name = document.getElementById('peUsername').value.trim();
  if (!name) { showToast('Username cannot be empty.'); return; }

  const oldName = myUsername;
  myUsername = name;
  myAvatar   = selectedAvatar;
  myAge      = document.getElementById('peAge').value.trim();
  myGender   = document.getElementById('peGender').value;
  myLocation = document.getElementById('peLocation').value.trim();
  myAbout    = document.getElementById('peAbout').value.trim();

  try {
    await fetch('/api/username', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId:   myUserId,
        username: myUsername,
        avatar:   myAvatar,
        age:      myAge,
        gender:   myGender,
        location: myLocation,
        about:    myAbout,
      }),
    });
  } catch { /* offline — update locally only */ }

  savePrefs();
  refreshMyProfileUI();
  document.getElementById('profileModal').classList.add('hidden');
  document.body.style.overflow = '';
  showToast('Profile saved ✓');
}

function copyUserId() {
  const id = myUserId || '—';
  navigator.clipboard.writeText(id).then(() => showToast(`ID copied: ${id}`));
}

// ══════════════════════════════════════════════════════════
//  USER CARD POPUP
// ══════════════════════════════════════════════════════════
function showUserCard(user) {
  document.getElementById('ucAvatar').textContent = user.avatar || '👤';
  document.getElementById('ucName').textContent   = user.username || '—';
  document.getElementById('ucId').textContent     = user.userId   || '—';
  document.getElementById('ucAbout').textContent  = user.about    || '';

  const tags = document.getElementById('ucTags');
  tags.innerHTML = '';
  [
    user.age      ? `${user.age}y`       : null,
    user.gender   || null,
    user.location ? `📍 ${user.location}` : null,
  ].filter(Boolean).forEach(t => {
    const chip = document.createElement('span');
    chip.className = 'uc-tag';
    chip.textContent = t;
    tags.appendChild(chip);
  });

  document.getElementById('userCardModal').classList.remove('hidden');
}

function closeUserCard(e) {
  if (e && e.target !== document.getElementById('userCardModal')) return;
  document.getElementById('userCardModal').classList.add('hidden');
}

// ══════════════════════════════════════════════════════════
//  EMOJI PICKER
// ══════════════════════════════════════════════════════════
const EMOJIS = [
  '😀','😂','🥲','😍','🤩','😎','🥳','😭','😤','🤔',
  '👋','🙌','👏','🤝','🫶','❤️','🔥','✨','🎉','💯',
  '😂','🤣','😊','😇','🥰','😘','😜','🤪','😴','🤯',
  '🍕','🍔','🍜','🧋','🎂','🍣','🌮','🥗','🧁','🍩',
  '⚽','🏀','🎮','🎵','🎤','🏆','🎯','🎲','🃏','🎸',
  '🌟','💫','⭐','🌈','🌊','🌸','🌺','🍀','🦋','🐱',
  '💪','🙏','👍','👎','✌️','🤞','🫡','💀','🫠','🥹',
];

function buildEmojiGrid() {
  const grid = document.getElementById('emojiGrid');
  grid.innerHTML = '';
  EMOJIS.forEach(em => {
    const cell = document.createElement('button');
    cell.className = 'emoji-cell';
    cell.type = 'button';
    cell.textContent = em;
    cell.setAttribute('aria-label', em);
    cell.onclick = () => insertEmoji(em);
    grid.appendChild(cell);
  });
}

function insertEmoji(em) {
  const input = document.getElementById('msgInput');
  const pos   = input.selectionStart;
  const val   = input.value;
  input.value = val.slice(0, pos) + em + val.slice(pos);
  input.selectionStart = input.selectionEnd = pos + em.length;
  input.focus();
  updateSendBtn();
  autoResize(input);
}

function toggleEmojiPicker() {
  const picker = document.getElementById('emojiPicker');
  emojiOpen = !emojiOpen;
  picker.classList.toggle('hidden', !emojiOpen);
}

// Close emoji picker when clicking outside
document.addEventListener('click', (e) => {
  const picker  = document.getElementById('emojiPicker');
  const emojiBtn = document.getElementById('emojiBtn');
  if (emojiOpen && picker && !picker.contains(e.target) && !emojiBtn?.contains(e.target)) {
    emojiOpen = false;
    picker.classList.add('hidden');
  }
});

// ══════════════════════════════════════════════════════════
//  SIDEBAR (mobile)
// ══════════════════════════════════════════════════════════
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('active');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('active');
}

// ══════════════════════════════════════════════════════════
//  LEAVE ROOM
// ══════════════════════════════════════════════════════════
function leaveRoom() {
  if (ws) ws.close();
  document.getElementById('appScreen').classList.remove('active');
  document.getElementById('joinScreen').classList.add('active');
  document.getElementById('messages').innerHTML = '';
  document.getElementById('userList').innerHTML = '';
}

// ══════════════════════════════════════════════════════════
//  TOAST
// ══════════════════════════════════════════════════════════
let toastTO = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  el.classList.add('show');
  clearTimeout(toastTO);
  toastTO = setTimeout(() => el.classList.remove('show'), 2800);
}

// ══════════════════════════════════════════════════════════
//  CONNECTION BANNER
// ══════════════════════════════════════════════════════════
function showBanner() {
  const el = document.getElementById('connBanner');
  el.classList.remove('hidden');
  el.classList.add('show');
}
function hideBanner() {
  const el = document.getElementById('connBanner');
  el.classList.remove('show');
}

// ══════════════════════════════════════════════════════════
//  UTILITIES
// ══════════════════════════════════════════════════════════
/** Safely escape HTML to prevent XSS */
function esc(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str || ''));
  return d.innerHTML;
}

/** Format ISO timestamp → "9:41 AM" */
function fmtTime(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
  catch { return ''; }
}

// ══════════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════════
applyPrefs();
initAvatarPickers();
buildEmojiGrid();

// Make Enter work on join form naturally
document.getElementById('jUsername')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') joinChat();
});