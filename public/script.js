// ============================================================
//  Bubble Chat — script.js
//  Handles: auth, friend requests, real-time chat via Socket.IO
// ============================================================

// ── Globals ───────────────────────────────────────────────
let me = null;         // { username, code, friends:[], requests:[] }
let socket = null;     // Socket.IO connection
let activeFriend = null; // { code, username, avatarClass }
let typingTimer = null;  // debounce timer for typing indicator

// ── Avatar colors (matched with CSS .av-N classes) ────────
const AV_COLORS = ['av-0','av-1','av-2','av-3','av-4','av-5'];
function avatarClass(code) {
  // Deterministic color from the code string
  let n = 0;
  for (const c of code) n += c.charCodeAt(0);
  return AV_COLORS[n % AV_COLORS.length];
}
function initials(username) {
  return username.slice(0,2).toUpperCase();
}

// ============================================================
//  AUTH TABS
// ============================================================
function showTab(tab) {
  document.getElementById('tabLogin').classList.toggle('active',  tab === 'login');
  document.getElementById('tabSignup').classList.toggle('active', tab === 'signup');
  document.getElementById('formLogin').classList.toggle('active', tab === 'login');
  document.getElementById('formSignup').classList.toggle('active', tab === 'signup');
  clearErrors();
}

function clearErrors() {
  document.getElementById('loginError').textContent  = '';
  document.getElementById('signupError').textContent = '';
}

// ── Signup ─────────────────────────────────────────────────
async function doSignup() {
  const username = document.getElementById('signupUser').value.trim();
  const password = document.getElementById('signupPass').value;

  if (!username || !password) {
    document.getElementById('signupError').textContent = 'Fill in both fields.';
    return;
  }

  const res  = await fetch('/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();

  if (!res.ok) {
    document.getElementById('signupError').textContent = data.error;
    return;
  }

  showToast(`Welcome, ${username}! Your code: ${data.code} 🎉`);
  showTab('login');
  document.getElementById('loginUser').value = username;
}

// ── Login ──────────────────────────────────────────────────
async function doLogin() {
  const username = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value;

  if (!username || !password) {
    document.getElementById('loginError').textContent = 'Fill in both fields.';
    return;
  }

  const res  = await fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();

  if (!res.ok) {
    document.getElementById('loginError').textContent = data.error;
    return;
  }

  // Save session data
  me = { username: data.username, code: data.code, friends: data.friends, requests: data.requests };
  enterApp();
}

// ── Logout ─────────────────────────────────────────────────
function logout() {
  if (socket) socket.disconnect();
  me = null; socket = null; activeFriend = null;
  // Switch back to auth screen
  document.getElementById('appScreen').classList.remove('active');
  document.getElementById('authScreen').classList.add('active');
  document.getElementById('loginPass').value = '';
  clearErrors();
}

// ============================================================
//  ENTER APP — called right after successful login
// ============================================================
function enterApp() {
  // Switch screens
  document.getElementById('authScreen').classList.remove('active');
  document.getElementById('appScreen').classList.add('active');

  // Populate profile strip
  const av = avatarClass(me.code);
  document.getElementById('myAvatar').textContent = initials(me.username);
  document.getElementById('myAvatar').className   = `my-avatar ${av}`;
  document.getElementById('myName').textContent   = me.username;
  document.getElementById('myCode').textContent   = me.code;

  // Render initial friends & requests
  renderFriends();
  renderRequests();

  // Connect Socket.IO and register our code
  connectSocket();
}

// ============================================================
//  SOCKET.IO
// ============================================================
function connectSocket() {
  socket = io();

  // Tell the server who we are
  socket.emit('register', me.code);

  // ── Incoming friend request notification ────────────────
  socket.on('new-request', ({ code, username }) => {
    // Add to local requests array if not already there
    if (!me.requests.includes(code)) {
      me.requests.push(code);
      renderRequests();
      showToast(`Friend request from ${username} (${code}) 🔔`);
    }
  });

  // ── Friend accepted us ──────────────────────────────────
  socket.on('request-accepted', ({ code, username }) => {
    if (!me.friends.includes(code)) {
      me.friends.push(code);
      renderFriends();
      showToast(`${username} accepted your request! 🎉`);
    }
  });

  // ── Incoming chat message ───────────────────────────────
  socket.on('chat-message', (msg) => {
    const { senderCode, receiverCode, text, time } = msg;

    // Show in chat window only if the conversation is active
    const peer = senderCode === me.code ? receiverCode : senderCode;
    if (activeFriend && activeFriend.code === peer) {
      appendMessage(senderCode === me.code ? 'me' : 'them', text, time);
    } else if (senderCode !== me.code) {
      // Notify with a toast if the chat is not open
      const friend = findFriendUser(senderCode);
      showToast(`💬 ${friend ? friend.username : senderCode}: ${text.slice(0,40)}`);
    }
  });

  // ── Typing indicator ────────────────────────────────────
  socket.on('typing', ({ senderCode, isTyping }) => {
    if (activeFriend && activeFriend.code === senderCode) {
      document.getElementById('typingIndicator').style.display = isTyping ? 'flex' : 'none';
      if (isTyping) scrollToBottom();
    }
  });
}

// ============================================================
//  FRIENDS
// ============================================================

// Render the friends list in the sidebar
function renderFriends() {
  const list = document.getElementById('friendsList');
  if (me.friends.length === 0) {
    list.innerHTML = '<p class="empty-msg">No friends yet 🥲<br/>Share your code!</p>';
    return;
  }
  list.innerHTML = '';
  me.friends.forEach((code, i) => {
    const username = friendUsernameFromCode(code);
    const av       = avatarClass(code);
    const div      = document.createElement('div');
    div.className  = 'friend-item';
    div.dataset.code = code;
    div.innerHTML  = `
      <div class="friend-avatar ${av}">${initials(username)}</div>
      <div class="friend-info">
        <p class="friend-name">${username}</p>
        <p class="friend-code">${code}</p>
      </div>`;
    div.onclick = () => openChat(code, username, av);
    list.appendChild(div);
  });
}

// We don't have a local username→code map, so we store username
// in friends as "username|code" when we accept, OR just by code.
// For simplicity: after accept the server returns the username.
// We cache it in a local map.
const friendNames = {}; // code → username

function friendUsernameFromCode(code) {
  return friendNames[code] || code;
}

// Find a friend's cached info by code
function findFriendUser(code) {
  return friendNames[code] ? { username: friendNames[code], code } : null;
}

// ── Render pending requests ──────────────────────────────
function renderRequests() {
  const section = document.getElementById('requestsSection');
  const list    = document.getElementById('requestsList');

  if (me.requests.length === 0) {
    section.style.display = 'none';
    list.innerHTML = '';
    return;
  }

  section.style.display = 'block';
  list.innerHTML = '';

  me.requests.forEach(code => {
    const div = document.createElement('div');
    div.className = 'request-item';
    div.id = `req-${code}`;
    div.innerHTML = `
      <div class="friend-avatar ${avatarClass(code)}">${code.slice(0,2)}</div>
      <div class="request-info">
        <p class="request-name">${code}</p>
      </div>
      <div class="req-actions">
        <button class="req-btn accept" onclick="respondRequest('${code}','accept')">✓</button>
        <button class="req-btn reject" onclick="respondRequest('${code}','reject')">✕</button>
      </div>`;
    list.appendChild(div);
  });
}

// ── Send a friend request ─────────────────────────────────
async function sendRequest() {
  const code    = document.getElementById('addCodeInput').value.trim().toUpperCase();
  const msgEl   = document.getElementById('addMsg');
  msgEl.className = 'add-msg';

  if (code.length !== 6) { msgEl.textContent = 'Code must be 6 characters.'; msgEl.className += ' error'; return; }
  if (code === me.code)  { msgEl.textContent = "That's your own code 😅";    msgEl.className += ' error'; return; }

  const res  = await fetch('/send-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ senderCode: me.code, targetCode: code }),
  });
  const data = await res.json();

  if (!res.ok) {
    msgEl.textContent = data.error;
    msgEl.className += ' error';
    return;
  }

  msgEl.textContent = `Request sent to ${data.targetUsername}! 📨`;
  document.getElementById('addCodeInput').value = '';
}

// ── Accept or reject a request ────────────────────────────
async function respondRequest(requesterCode, action) {
  const res  = await fetch('/accept-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userCode: me.code, requesterCode, action }),
  });
  const data = await res.json();

  if (!res.ok) { showToast(data.error); return; }

  // Remove from local requests array
  me.requests = me.requests.filter(c => c !== requesterCode);

  if (action === 'accept' && data.newFriend) {
    me.friends.push(data.newFriend.code);
    friendNames[data.newFriend.code] = data.newFriend.username;
    renderFriends();
    showToast(`You're now friends with ${data.newFriend.username}! 🎉`);
  }

  renderRequests();
}

// ============================================================
//  CHAT
// ============================================================

// ── Open a chat with a friend ─────────────────────────────
async function openChat(code, username, av) {
  activeFriend = { code, username, avatarClass: av };

  // Update sidebar active state
  document.querySelectorAll('.friend-item').forEach(el => {
    el.classList.toggle('active', el.dataset.code === code);
  });

  // Update chat header
  document.getElementById('peerAvatar').textContent = initials(username);
  document.getElementById('peerAvatar').className   = `peer-avatar ${av}`;
  document.getElementById('peerName').textContent   = username;
  document.getElementById('peerCode').textContent   = code;

  // Show chat panel
  document.getElementById('chatEmpty').style.display  = 'none';
  document.getElementById('chatActive').style.display = 'flex';
  document.getElementById('typingIndicator').style.display = 'none';

  // Load history
  const messages = document.getElementById('messages');
  messages.innerHTML = '';
  const res  = await fetch(`/history?a=${me.code}&b=${code}`);
  const history = await res.json();

  if (history.length > 0) {
    messages.innerHTML += `<div class="date-sep">Earlier</div>`;
    history.forEach(m => appendMessage(m.senderCode === me.code ? 'me' : 'them', m.text, m.time, true));
  }

  scrollToBottom();
  document.getElementById('msgInput').focus();
}

// ── Append a bubble to the messages area ─────────────────
function appendMessage(side, text, isoTime, skipAnim = false) {
  const messages = document.getElementById('messages');
  const div      = document.createElement('div');
  div.className  = `msg ${side}` + (skipAnim ? ' no-anim' : '');

  const timeStr = isoTime
    ? new Date(isoTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  div.innerHTML = `
    <div class="bubble">${escapeHTML(text)}</div>
    <span class="msg-time">${timeStr}</span>`;

  messages.appendChild(div);
  scrollToBottom();
}

// ── Send a chat message ───────────────────────────────────
function sendMessage() {
  const input = document.getElementById('msgInput');
  const text  = input.value.trim();
  if (!text || !activeFriend) return;

  // Emit to server (server echoes back to us AND delivers to receiver)
  socket.emit('chat-message', {
    senderCode:   me.code,
    receiverCode: activeFriend.code,
    text,
  });

  // Stop typing indicator
  socket.emit('typing', { senderCode: me.code, receiverCode: activeFriend.code, isTyping: false });

  input.value = '';
  input.style.height = 'auto';
}

// ── Handle Enter key in textarea ─────────────────────────
function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
  // Auto-resize textarea
  const ta = document.getElementById('msgInput');
  ta.style.height = 'auto';
  ta.style.height = ta.scrollHeight + 'px';
}

// ── Typing indicator emission ─────────────────────────────
function handleTyping() {
  // Auto-resize textarea
  const ta = document.getElementById('msgInput');
  ta.style.height = 'auto';
  ta.style.height = ta.scrollHeight + 'px';

  if (!activeFriend) return;
  socket.emit('typing', { senderCode: me.code, receiverCode: activeFriend.code, isTyping: true });

  // Clear typing after 2s of no input
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    socket.emit('typing', { senderCode: me.code, receiverCode: activeFriend.code, isTyping: false });
  }, 2000);
}

// ── Smooth scroll to bottom of messages ──────────────────
function scrollToBottom() {
  const el = document.getElementById('messages');
  el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
}

// ── Escape HTML to prevent XSS ───────────────────────────
function escapeHTML(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str));
  return d.innerHTML;
}

// ============================================================
//  UTILITIES
// ============================================================

// ── Copy user code to clipboard ───────────────────────────
function copyCode() {
  navigator.clipboard.writeText(me.code).then(() => showToast(`Copied ${me.code} to clipboard! 📋`));
}

// ── Toast notification ─────────────────────────────────────
let toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

// ── Dark / Light theme toggle ─────────────────────────────
function toggleTheme() {
  const html    = document.documentElement;
  const current = html.getAttribute('data-theme');
  const next    = current === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('bubble-theme', next);
  document.getElementById('themeBtn').textContent = next === 'dark' ? '☀︎' : '☽';
}

// Restore saved theme on load
(function initTheme() {
  const saved = localStorage.getItem('bubble-theme');
  if (saved) {
    document.documentElement.setAttribute('data-theme', saved);
    // Wait for DOM to be ready before updating button
    window.addEventListener('DOMContentLoaded', () => {
      const btn = document.getElementById('themeBtn');
      if (btn) btn.textContent = saved === 'dark' ? '☀︎' : '☽';
    });
  }
})();