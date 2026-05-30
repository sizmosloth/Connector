// ═══════════════════════════════════════════════════════════
//  Sora Chat — server.js
//  Express HTTP server + native WebSocket (ws library)
//  In-memory storage: users, messages, active connections
// ═══════════════════════════════════════════════════════════

const express   = require('express');
const http      = require('http');
const WebSocket = require('ws');
const path      = require('path');
const crypto    = require('crypto');

const app    = express();
const server = http.createServer(app);

// Attach WebSocket server to the same HTTP server
const wss = new WebSocket.Server({ server });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── In-memory stores ──────────────────────────────────────
// users   : Map<userId, { userId, username, joinedAt }>
// messages: Array<{ id, userId, username, text, time }>
// clients : Map<ws, userId>   ← which socket belongs to which user

const users    = new Map();   // registered/active users
const messages = [];          // chat history (last 200 kept)
const clients  = new Map();   // ws → userId

const MAX_HISTORY = 200;

// ── Helpers ───────────────────────────────────────────────
// Generate a short random ID like "u_4f2a"
function makeId(prefix = 'u') {
  return `${prefix}_${crypto.randomBytes(3).toString('hex')}`;
}

// Broadcast a JSON payload to ALL connected clients
function broadcast(data) {
  const text = JSON.stringify(data);
  wss.clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) ws.send(text);
  });
}

// Broadcast to everyone EXCEPT one specific socket
function broadcastExcept(data, excludeWs) {
  const text = JSON.stringify(data);
  wss.clients.forEach(ws => {
    if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) ws.send(text);
  });
}

// Send JSON to a single socket
function send(ws, data) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
}

// Return a list of active users (safe, no sensitive data)
function activeUserList() {
  return [...clients.entries()].map(([, uid]) => {
    const u = users.get(uid);
    return u ? { userId: u.userId, username: u.username } : null;
  }).filter(Boolean);
}

// ── REST: Join (create or resume a session) ───────────────
// POST /api/join  { username? }  → { userId, username, history }
app.post('/api/join', (req, res) => {
  let { username, userId } = req.body;

  // Validate / sanitise username
  username = (username || '').trim().slice(0, 24) || `Guest${Math.floor(Math.random() * 9000) + 1000}`;

  // If the client is rejoining with a known ID, update their name
  if (userId && users.has(userId)) {
    users.get(userId).username = username;
  } else {
    userId = makeId('u');
    users.set(userId, { userId, username, joinedAt: Date.now() });
  }

  console.log(`[join] ${username} (${userId})`);

  res.json({
    userId,
    username,
    history: messages.slice(-60), // last 60 messages on join
  });
});

// REST: Update username mid-session
// PATCH /api/username  { userId, username }
app.patch('/api/username', (req, res) => {
  const { userId, username } = req.body;
  const clean = (username || '').trim().slice(0, 24);
  if (!clean) return res.status(400).json({ error: 'Empty username.' });
  if (!users.has(userId)) return res.status(404).json({ error: 'User not found.' });

  const old = users.get(userId).username;
  users.get(userId).username = clean;

  // Tell everyone about the rename
  broadcast({ type: 'system', text: `✏️ ${old} is now ${clean}` });
  broadcast({ type: 'active-users', users: activeUserList() });

  res.json({ ok: true, username: clean });
});

// ── WebSocket Connection ──────────────────────────────────
wss.on('connection', (ws, req) => {
  console.log('[ws] new connection');

  // ── Incoming message handler ───────────────────────────
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {

      // Client identifies themselves after connecting
      case 'register': {
        const user = users.get(msg.userId);
        if (!user) { send(ws, { type: 'error', text: 'Unknown user. Please refresh.' }); return; }

        clients.set(ws, msg.userId);
        ws.userId = msg.userId;

        // Welcome this client
        send(ws, { type: 'system', text: `Welcome back, ${user.username}! 👋` });

        // Tell everyone they joined
        broadcastExcept({ type: 'system', text: `${user.username} joined the chat 🌿` }, ws);

        // Push current active users to everyone
        broadcast({ type: 'active-users', users: activeUserList() });
        break;
      }

      // Chat message
      case 'message': {
        const user = clients.has(ws) ? users.get(clients.get(ws)) : null;
        if (!user) return;

        const text = (msg.text || '').trim().slice(0, 2000);
        if (!text) return;

        const entry = {
          id:       makeId('m'),
          userId:   user.userId,
          username: user.username,
          text,
          time:     new Date().toISOString(),
        };

        messages.push(entry);
        if (messages.length > MAX_HISTORY) messages.shift(); // keep rolling window

        broadcast({ type: 'message', ...entry });
        break;
      }

      // Typing indicator
      case 'typing': {
        const user = clients.has(ws) ? users.get(clients.get(ws)) : null;
        if (!user) return;
        broadcastExcept({ type: 'typing', userId: user.userId, username: user.username, isTyping: msg.isTyping }, ws);
        break;
      }

      default:
        break;
    }
  });

  // ── Client disconnected ────────────────────────────────
  ws.on('close', () => {
    const uid  = clients.get(ws);
    const user = uid ? users.get(uid) : null;
    clients.delete(ws);

    if (user) {
      console.log(`[ws] ${user.username} disconnected`);
      broadcast({ type: 'system', text: `${user.username} left the chat 👋` });
      broadcast({ type: 'active-users', users: activeUserList() });
    }
  });

  ws.on('error', (err) => console.error('[ws error]', err.message));
});

// ── Start ─────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🌿  Sora Chat running → http://localhost:${PORT}\n`);
});