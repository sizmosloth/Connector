// ═══════════════════════════════════════════════════════════
//  Connector — server.js
//
//  REST endpoints consumed by script.js:
//    POST  /api/join      { username, avatar, age, gender, location, about, userId? }
//    PATCH /api/username  { userId, username, avatar, age, gender, location, about }
//
//  WebSocket messages  client → server:
//    { type: 'register', userId }
//    { type: 'message',  text }
//    { type: 'typing',   isTyping: true|false }
//
//  WebSocket messages  server → client:
//    { type: 'message',      id, userId, username, avatar, age, gender, location, about, text, time }
//    { type: 'system',       text }
//    { type: 'active-users', users: [ publicUser, … ] }
//    { type: 'typing',       userId, username, isTyping }
//    { type: 'error',        text }
// ═══════════════════════════════════════════════════════════

'use strict';

const express   = require('express');
const http      = require('http');
const WebSocket = require('ws');
const path      = require('path');
const crypto    = require('crypto');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });

// ── Middleware ────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── In-memory stores ──────────────────────────────────────
// users    Map<userId, { userId, username, avatar, age, gender, location, about, joinedAt }>
// messages Array of message objects, capped at MAX_HISTORY
// clients  Map<ws, userId>  which socket belongs to which user

const users    = new Map();
const messages = [];
const clients  = new Map();

const MAX_HISTORY = 200;

// ── Helpers ───────────────────────────────────────────────

/** Short random ID e.g. "u_3fa2c1b0" */
function makeId(prefix = 'u') {
  return `${prefix}_${crypto.randomBytes(4).toString('hex')}`;
}

/** Send JSON payload to every open client */
function broadcast(data) {
  const text = JSON.stringify(data);
  wss.clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) ws.send(text);
  });
}

/** Send JSON payload to every open client except one */
function broadcastExcept(data, skipWs) {
  const text = JSON.stringify(data);
  wss.clients.forEach(ws => {
    if (ws !== skipWs && ws.readyState === WebSocket.OPEN) ws.send(text);
  });
}

/** Send JSON to a single socket */
function sendTo(ws, data) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
}

/**
 * The subset of user data that is safe to broadcast publicly.
 * Matches exactly what script.js reads when it calls renderUserList()
 * and showUserCard(): userId, username, avatar, age, gender, location, about.
 */
function publicUser(u) {
  return {
    userId:   u.userId,
    username: u.username,
    avatar:   u.avatar   || '😎',
    age:      u.age      || '',
    gender:   u.gender   || '',
    location: u.location || '',
    about:    u.about    || '',
  };
}

/** Array of public user objects for everyone currently connected */
function activeUserList() {
  return [...clients.values()]
    .map(uid => {
      const u = users.get(uid);
      return u ? publicUser(u) : null;
    })
    .filter(Boolean);
}

// ── POST /api/join ────────────────────────────────────────
// Called by joinChat() in script.js.
// Body   : { username, avatar, age, gender, location, about, userId? }
// Returns: { userId, username, history }
app.post('/api/join', (req, res) => {
  let {
    username = '',
    avatar   = '😎',
    age      = '',
    gender   = '',
    location = '',
    about    = '',
    userId   = null,
  } = req.body;

  // Sanitise every field
  username = String(username).trim().slice(0, 24);
  avatar   = String(avatar).slice(0, 8);
  age      = String(age).slice(0, 3);
  gender   = String(gender).slice(0, 32);
  location = String(location).slice(0, 40);
  about    = String(about).slice(0, 160);

  // Default username if blank
  if (!username) {
    username = `Guest${Math.floor(Math.random() * 9000) + 1000}`;
  }

  if (userId && users.has(userId)) {
    // Returning user — update their stored profile
    const u = users.get(userId);
    u.username = username;
    u.avatar   = avatar;
    u.age      = age;
    u.gender   = gender;
    u.location = location;
    u.about    = about;
  } else {
    // Brand-new user — assign a fresh ID
    userId = makeId('u');
    users.set(userId, {
      userId,
      username,
      avatar,
      age,
      gender,
      location,
      about,
      joinedAt: Date.now(),
    });
  }

  console.log(`[join]  ${username}  (${userId})`);

  // Return last 60 messages as join history
  res.json({
    userId,
    username,
    history: messages.slice(-60),
  });
});

// ── PATCH /api/username ───────────────────────────────────
// Called by saveProfileEdit() in script.js.
// Body   : { userId, username, avatar, age, gender, location, about }
// Returns: { ok: true, username }
app.patch('/api/username', (req, res) => {
  const {
    userId,
    username = '',
    avatar   = '😎',
    age      = '',
    gender   = '',
    location = '',
    about    = '',
  } = req.body;

  const cleanName = String(username).trim().slice(0, 24);
  if (!cleanName) {
    return res.status(400).json({ error: 'Username cannot be empty.' });
  }

  const u = users.get(userId);
  if (!u) {
    return res.status(404).json({ error: 'User not found.' });
  }

  const oldName = u.username;

  // Apply all profile changes
  u.username = cleanName;
  u.avatar   = String(avatar).slice(0, 8);
  u.age      = String(age).slice(0, 3);
  u.gender   = String(gender).slice(0, 32);
  u.location = String(location).slice(0, 40);
  u.about    = String(about).slice(0, 160);

  // Broadcast rename notice + refreshed user list
  if (oldName !== cleanName) {
    broadcast({ type: 'system', text: `✏️  ${oldName} is now ${cleanName}` });
  }
  broadcast({ type: 'active-users', users: activeUserList() });

  res.json({ ok: true, username: cleanName });
});

// ── WebSocket connection ──────────────────────────────────
wss.on('connection', (ws) => {
  console.log('[ws]  new connection');

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {

      // ── register ────────────────────────────────────
      // script.js sends this as the very first message after
      // the socket opens, passing the userId from /api/join.
      case 'register': {
        const user = users.get(msg.userId);
        if (!user) {
          sendTo(ws, { type: 'error', text: 'Unknown user — please refresh the page.' });
          return;
        }

        clients.set(ws, msg.userId);
        ws.userId = msg.userId;

        // Welcome message visible only to the joining user
        sendTo(ws, {
          type: 'system',
          text: `Welcome, ${user.username}! 👋  Say hello to everyone.`,
        });

        // Announce join to everyone else
        broadcastExcept({
          type: 'system',
          text: `${user.username} joined the room 🟢`,
        }, ws);

        // Push updated online list to ALL clients (including the new one)
        broadcast({ type: 'active-users', users: activeUserList() });
        break;
      }

      // ── message ─────────────────────────────────────
      case 'message': {
        const uid  = clients.get(ws);
        const user = uid ? users.get(uid) : null;
        if (!user) return;

        const text = String(msg.text || '').trim().slice(0, 2000);
        if (!text) return;

        // Build the full entry — includes all profile fields so that
        // script.js can display avatar + sender name in the bubble and
        // show the full card when a user's name is clicked.
        const entry = {
          id:       makeId('m'),
          userId:   user.userId,
          username: user.username,
          avatar:   user.avatar   || '😎',
          age:      user.age      || '',
          gender:   user.gender   || '',
          location: user.location || '',
          about:    user.about    || '',
          text,
          time:     new Date().toISOString(),
        };

        // Persist and cap
        messages.push(entry);
        if (messages.length > MAX_HISTORY) messages.shift();

        // Fan out to everyone including the sender
        broadcast({ type: 'message', ...entry });
        break;
      }

      // ── typing ──────────────────────────────────────
      case 'typing': {
        const uid  = clients.get(ws);
        const user = uid ? users.get(uid) : null;
        if (!user) return;

        // Relay to everyone except the sender
        broadcastExcept({
          type:     'typing',
          userId:   user.userId,
          username: user.username,
          isTyping: !!msg.isTyping,
        }, ws);
        break;
      }

      default:
        break;
    }
  });

  // ── Disconnect ────────────────────────────────────────
  ws.on('close', () => {
    const uid  = clients.get(ws);
    const user = uid ? users.get(uid) : null;
    clients.delete(ws);

    if (user) {
      console.log(`[ws]  ${user.username} disconnected`);
      broadcast({ type: 'system',       text:  `${user.username} left the room 🔴` });
      broadcast({ type: 'active-users', users: activeUserList() });
    }
  });

  ws.on('error', (err) => {
    console.error('[ws error]', err.message);
  });
});

// ── Start ─────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n⚡  Connector  →  http://localhost:${PORT}\n`);
});