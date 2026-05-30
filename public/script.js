// ═══════════════════════════════════════════════════════════
//  Sora Chat — script.js
//  Handles: join flow, WebSocket lifecycle, messaging,
//           username editing, theme/accent/sound prefs,
//           active users, typing indicator
// ═══════════════════════════════════════════════════════════

// ── State ─────────────────────────────────────────────────
let ws        = null;       // WebSocket connection
let myUserId  = null;       // assigned by server
let myUsername= '';         // current display name
let typingTO  = null;       // debounce timer for typing events
let wasTyping = false;      // track last typing state sent

// ── Audio (soft pop for incoming messages) ────────────────
// Created lazily on first interaction to comply with browser autoplay policy
let audioCtx = null;

function playPop() {
  try {
    if (!document.getElementById('soundToggle')?.checked) return;
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type    = 'sine';
    osc.frequency.setValueAtTime(660, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
  } catch { /* silence audio errors */ }
}

// ══════════════════════════════════════════════════════════
//  PREFERENCES  (localStorage)
// ══════════════════════════════════════════════════════════
const PREF_KEY = 'sora_prefs';

function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(PREF_KEY)) || {}; } catch { return {}; }
}
function savePrefs(patch) {
  const prefs = { ...loadPrefs(), ...patch };
  localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
}

/** Call whenever a setting widget changes — reads current UI state and persists */
function savePref() {
  savePrefs({
    sound: document.getElementById('soundToggle')?.checked ?? false,
  });
}

/** Apply all saved prefs to the DOM on page load */
function applyPrefs() {
  const p = loadPrefs();

  // Stored username / userId
  if (p.username) document.getElementById('joinUsername').value = p.username;

  // Theme
  const theme = p.theme || 'light';
  document.documentElement.setAttribute('data-theme', theme);
  syncThemeButtons(theme);

  // Accent
  const accent = p.accent || 'sage';
  document.documentElement.setAttribute('data-accent', accent);
  syncAccentDots(accent);

  // Sound
  const soundEl = document.getElementById('soundToggle');
  if (soundEl) soundEl.checked = p.sound ?? false;
}

// ══════════════════════════════════════════════════════════
//  THEME TOGGLE
// ══════════════════════════════════════════════════════════
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next    = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  syncThemeButtons(next);
  savePrefs({ theme: next });
}

function syncThemeButtons(theme) {
  const label = theme === 'dark' ? '☀︎  Light' : '☽  Dark';
  const moon  = theme === 'dark' ? '☀︎' : '☽';
  const el = document.getElementById('themeBtn');
  if (el) el.textContent = label;
  const lb = document.getElementById('landingThemeBtn');
  if (lb) lb.textContent = moon;
}

// ══════════════════════════════════════════════════════════
//  ACCENT
// ══════════════════════════════════════════════════════════
function setAccent(name) {
  document.documentElement.setAttribute('data-accent', name);
  syncAccentDots(name);
  savePrefs({ accent: name });
}

function syncAccentDots(active) {
  document.querySelectorAll('.dot').forEach(d => {
    const match = d.classList.contains(`dot-${active}`);
    d.classList.toggle('active', match);
    d.setAttribute('aria-pressed', String(match));
  });
}

// ══════════════════════════════════════════════════════════
//  JOIN FLOW
// ══════════════════════════════════════════════════════════
async function joinChat() {
  const input    = document.getElementById('joinUsername');
  const errorEl  = document.getElementById('joinError');
  const username = input.value.trim();

  errorEl.textContent = '';
  if (!username) { errorEl.textContent = 'Please enter your name.'; input.focus(); return; }

  // Retrieve a previously assigned userId (so the server can recognise a reconnect)
  const prefs  = loadPrefs();
  const stored = prefs.userId || null;

  try {
    const res  = await fetch('/api/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, userId: stored }),
    });
    const data = await res.json();
    if (!res.ok) { errorEl.textContent = data.error || 'Something went wrong.'; return; }

    myUserId   = data.userId;
    myUsername = data.username;

    savePrefs({ userId: myUserId, username: myUsername });

    // Switch to app screen
    showApp(data.history || []);
  } catch {
    errorEl.textContent = 'Could not connect. Is the server running?';
  }
}

// ══════════════════════════════════════════════════════════
//  SHOW APP — called once after join
// ══════════════════════════════════════════════════════════
function showApp(history) {
  document.getElementById('landingScreen').classList.remove('active');
  document.getElementById('appScreen').classList.add('active');

  // Populate profile strip
  document.getElementById('usernameText').textContent = myUsername;
  document.getElementById('userIdText').textContent   = myUserId;
  document.getElementById('profileAvatar').textContent = myUsername.charAt(0).toUpperCase();

  // Render history
  const msgs = document.getElementById('messages');
  msgs.innerHTML = '';
  if (history.length > 0) {
    appendDateChip('Earlier');
    history.forEach(m => appendMessage(m, false));
  }
  scrollToBottom();

  // Open WebSocket
  connectWebSocket();
}

// ══════════════════════════════════════════════════════════
//  WEBSOCKET
// ══════════════════════════════════════════════════════════
function connectWebSocket() {
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${protocol}://${location.host}`);

  ws.addEventListener('open', () => {
    hideConnToast();
    // Register this socket as our user
    wsSend({ type: 'register', userId: myUserId });
  });

  ws.addEventListener('message', ({ data }) => {
    let msg;
    try { msg = JSON.parse(data); } catch { return; }

    switch (msg.type) {
      case 'message':      handleIncoming(msg);   break;
      case 'system':       appendSystemMsg(msg.text); break;
      case 'active-users': renderActiveUsers(msg.users); break;
      case 'typing':       handleTypingEvent(msg); break;
      case 'error':        showConnToast(msg.text); break;
    }
  });

  ws.addEventListener('close', () => {
    showConnToast('Disconnected. Reconnecting…');
    setTimeout(connectWebSocket, 3000);
  });

  ws.addEventListener('error', () => {
    showConnToast('Connection error. Retrying…');
  });
}

/** Safe send — only if socket is open */
function wsSend(obj) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}

// ══════════════════════════════════════════════════════════
//  MESSAGE HANDLING
// ══════════════════════════════════════════════════════════

/** A new chat message arrived from the server */
function handleIncoming(msg) {
  const isMe = msg.userId === myUserId;
  appendMessage(msg, true);
  if (!isMe) playPop();
}

/** Build and insert a message bubble */
function appendMessage(msg, animate = true) {
  const isMe    = msg.userId === myUserId;
  const msgWrap = document.getElementById('messages');

  // Create row
  const row = document.createElement('div');
  row.className = `msg-row ${isMe ? 'me' : 'them'}`;
  if (!animate) row.style.animation = 'none';

  // Sender label (only for others)
  if (!isMe) {
    const sender = document.createElement('div');
    sender.className = 'msg-sender';
    sender.textContent = escapeHTML(msg.username);
    row.appendChild(sender);
  }

  // Bubble
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = msg.text;   // textContent is safe (no XSS)
  row.appendChild(bubble);

  // Timestamp
  const time = document.createElement('div');
  time.className = 'msg-time';
  time.textContent = formatTime(msg.time);
  row.appendChild(time);

  msgWrap.appendChild(row);
  scrollToBottom();
}

/** System message (join/leave/rename) */
function appendSystemMsg(text) {
  const chip = document.createElement('div');
  chip.className = 'msg-system';
  chip.textContent = text;
  document.getElementById('messages').appendChild(chip);
  scrollToBottom();
}

/** Date separator chip */
function appendDateChip(label) {
  const chip = document.createElement('div');
  chip.className = 'msg-date';
  chip.textContent = label;
  document.getElementById('messages').appendChild(chip);
}

/** Smooth-scroll to latest message */
function scrollToBottom() {
  const el = document.getElementById('messagesWrap');
  el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
}

// ══════════════════════════════════════════════════════════
//  SENDING MESSAGES
// ══════════════════════════════════════════════════════════
function sendMessage() {
  const input = document.getElementById('msgInput');
  const text  = input.value.trim();
  if (!text) return;

  wsSend({ type: 'message', text });

  // Stop typing indicator
  if (wasTyping) {
    wsSend({ type: 'typing', isTyping: false });
    wasTyping = false;
  }

  input.value = '';
  input.style.height = 'auto';
  updateSendBtn();
  updateCharCount('');
  input.focus();
}

function handleMsgKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
  autoResize(e.target);
}

function handleTypingInput() {
  const input = document.getElementById('msgInput');
  autoResize(input);
  updateSendBtn();
  updateCharCount(input.value);

  // Emit typing: true (debounced — stop after 2s of no typing)
  if (!wasTyping) {
    wsSend({ type: 'typing', isTyping: true });
    wasTyping = true;
  }
  clearTimeout(typingTO);
  typingTO = setTimeout(() => {
    wsSend({ type: 'typing', isTyping: false });
    wasTyping = false;
  }, 2000);
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 140) + 'px';
}

function updateSendBtn() {
  const btn = document.getElementById('sendBtn');
  const val = document.getElementById('msgInput').value.trim();
  btn.disabled = !val;
}

function updateCharCount(val) {
  const el = document.getElementById('charCount');
  if (val.length > 1800) {
    el.textContent = `${val.length} / 2000`;
  } else {
    el.textContent = '';
  }
}

// ══════════════════════════════════════════════════════════
//  TYPING INDICATOR
// ══════════════════════════════════════════════════════════
const typingUsers = new Map(); // userId → username
let typingClearTO = null;

function handleTypingEvent({ userId, username, isTyping }) {
  if (isTyping) {
    typingUsers.set(userId, username);
  } else {
    typingUsers.delete(userId);
  }
  renderTypingBar();
}

function renderTypingBar() {
  const bar = document.getElementById('typingBar');
  if (typingUsers.size === 0) { bar.innerHTML = ''; return; }

  const names = [...typingUsers.values()].slice(0, 3).join(', ');
  const verb  = typingUsers.size === 1 ? 'is' : 'are';
  bar.innerHTML = `
    <span class="typing-dots">
      <span></span><span></span><span></span>
    </span>
    ${escapeHTML(names)} ${verb} typing…`;
}

// ══════════════════════════════════════════════════════════
//  ACTIVE USERS
// ══════════════════════════════════════════════════════════
function renderActiveUsers(users) {
  const list  = document.getElementById('activeUserList');
  const count = users.length;

  document.getElementById('onlineCount').textContent  = count;
  document.getElementById('topbarCount').textContent  = count;

  list.innerHTML = '';
  users.forEach(u => {
    const pill = document.createElement('div');
    pill.className = 'user-pill';
    const isMe = u.userId === myUserId;
    pill.innerHTML = `
      <div class="user-pill-dot"></div>
      <span class="user-pill-name">${escapeHTML(u.username)}</span>
      ${isMe ? '<span class="user-pill-you">(you)</span>' : ''}`;
    list.appendChild(pill);
  });
}

// ══════════════════════════════════════════════════════════
//  USERNAME EDITING
// ══════════════════════════════════════════════════════════
function startEditUsername() {
  const display = document.getElementById('usernameDisplay');
  const edit    = document.getElementById('usernameEdit');
  const input   = document.getElementById('usernameInput');

  display.classList.add('hidden');
  edit.classList.remove('hidden');
  input.value = myUsername;
  input.focus();
  input.select();
}

function handleUsernameKey(e) {
  if (e.key === 'Enter')  { e.preventDefault(); saveUsername(); }
  if (e.key === 'Escape') { cancelEdit(); }
}

function cancelEdit() {
  document.getElementById('usernameDisplay').classList.remove('hidden');
  document.getElementById('usernameEdit').classList.add('hidden');
}

async function saveUsername() {
  const input = document.getElementById('usernameInput');
  const name  = input.value.trim();
  if (!name) return;

  try {
    const res  = await fetch('/api/username', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: myUserId, username: name }),
    });
    const data = await res.json();
    if (!res.ok) { showConnToast(data.error || 'Could not rename.'); return; }

    myUsername = data.username;
    document.getElementById('usernameText').textContent  = myUsername;
    document.getElementById('profileAvatar').textContent = myUsername.charAt(0).toUpperCase();
    savePrefs({ username: myUsername });
    cancelEdit();
  } catch {
    showConnToast('Rename failed.');
  }
}

// ══════════════════════════════════════════════════════════
//  SIDEBAR TOGGLE (mobile)
// ══════════════════════════════════════════════════════════
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// Close sidebar when clicking outside on mobile
document.addEventListener('click', (e) => {
  const sidebar = document.getElementById('sidebar');
  const toggle  = document.querySelector('.sidebar-toggle');
  if (sidebar?.classList.contains('open') && !sidebar.contains(e.target) && !toggle?.contains(e.target)) {
    sidebar.classList.remove('open');
  }
});

// ══════════════════════════════════════════════════════════
//  LEAVE
// ══════════════════════════════════════════════════════════
function leaveChat() {
  if (ws) ws.close();
  document.getElementById('appScreen').classList.remove('active');
  document.getElementById('landingScreen').classList.add('active');
  document.getElementById('messages').innerHTML = '';
}

// ══════════════════════════════════════════════════════════
//  CONNECTION TOAST
// ══════════════════════════════════════════════════════════
let connToastTO = null;
function showConnToast(msg) {
  const el = document.getElementById('connToast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(connToastTO);
  connToastTO = setTimeout(hideConnToast, 4000);
}
function hideConnToast() {
  document.getElementById('connToast')?.classList.remove('show');
}

// ══════════════════════════════════════════════════════════
//  UTILITIES
// ══════════════════════════════════════════════════════════
/** Prevent XSS when inserting user content as HTML */
function escapeHTML(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str || ''));
  return d.innerHTML;
}

/** Format ISO timestamp → "9:41 AM" */
function formatTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch { return ''; }
}

// ══════════════════════════════════════════════════════════
//  INIT — runs on page load
// ══════════════════════════════════════════════════════════
applyPrefs();

// Pre-fill name field from prefs so returning users just hit Enter
const prefs = loadPrefs();
if (prefs.username) {
  document.getElementById('joinUsername').value = prefs.username;
}