const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const crypto = require('crypto');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── In-memory stores ──────────────────────────────────────────────────────────
const users       = new Map(); // userId → fullUserObject
const globalMsgs  = [];        // capped at 200
const dmStore     = new Map(); // pairKey → []  capped at 200
const clients     = new Map(); // ws → userId
const pendingReqs = new Map(); // toUserId → Set<fromUserId>
const acceptedPairs = new Set(); // pairKey

function pairKey(a, b) { return [a, b].sort().join('_'); }

function publicUser(u) {
  const { notes, ...pub } = u;
  return pub;
}

function broadcast(data, excludeWs = null) {
  const msg = JSON.stringify(data);
  clients.forEach((uid, ws) => {
    if (ws !== excludeWs && ws.readyState === 1) ws.send(msg);
  });
}

function sendTo(userId, data) {
  const msg = JSON.stringify(data);
  clients.forEach((uid, ws) => {
    if (uid === userId && ws.readyState === 1) ws.send(msg);
  });
}

function capArray(arr, max) {
  if (arr.length > max) arr.splice(0, arr.length - max);
}

// ── REST endpoints ────────────────────────────────────────────────────────────

// POST /api/join
app.post('/api/join', (req, res) => {
  const { username, avatar, avatarBg, age, gender, pronouns,
          location, about, bio, mood, website, notes, theme, fontSize, bubbleStyle } = req.body;
  if (!username || typeof username !== 'string') {
    return res.status(400).json({ error: 'username required' });
  }
  const userId = crypto.randomBytes(8).toString('hex');
  const user = {
    userId, username: username.trim(), avatar: avatar || '😊', avatarBg: avatarBg || '#7c6af5',
    age: age || null, gender: gender || '', pronouns: pronouns || '',
    location: location || '', about: about || '', bio: bio || '',
    mood: mood || '😊', website: website || '', notes: notes || '',
    status: '', joinedAt: Date.now(), theme: theme || 'midnight',
    fontSize: fontSize || 'medium', bubbleStyle: bubbleStyle || 'rounded'
  };
  users.set(userId, user);
  res.json({ userId, username: user.username, history: globalMsgs.map(m => ({ ...m })) });
});

// PATCH /api/profile
app.patch('/api/profile', (req, res) => {
  const { userId, ...updates } = req.body;
  if (!userId || !users.has(userId)) return res.status(404).json({ error: 'user not found' });
  const user = users.get(userId);
  const allowed = ['username','avatar','avatarBg','age','gender','pronouns',
                   'location','about','bio','mood','website','notes','status',
                   'theme','fontSize','bubbleStyle'];
  allowed.forEach(k => { if (updates[k] !== undefined) user[k] = updates[k]; });
  users.set(userId, user);

  // broadcast rename / profile update
  broadcast({ type: 'profileUpdate', user: publicUser(user) });
  res.json({ ok: true, username: user.username });
});

// GET /api/dm-history
app.get('/api/dm-history', (req, res) => {
  const { userId, peerId } = req.query;
  if (!userId || !peerId) return res.status(400).json({ error: 'userId and peerId required' });
  const key = pairKey(userId, peerId);
  res.json({ messages: dmStore.get(key) || [] });
});

// GET /api/users
app.get('/api/users', (req, res) => {
  const list = [];
  users.forEach(u => list.push(publicUser(u)));
  res.json({ users: list });
});

// ── WebSocket server ──────────────────────────────────────────────────────────
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    let data;
    try { data = JSON.parse(raw); } catch { return; }
    const { type } = data;

    // ── register ──
    if (type === 'register') {
      const { userId } = data;
      if (!users.has(userId)) return ws.send(JSON.stringify({ type: 'error', message: 'unknown user' }));
      clients.set(ws, userId);
      const user = users.get(userId);
      // broadcast join
      broadcast({ type: 'userJoined', user: publicUser(user) }, ws);
      // send current online users to newcomer
      const online = [];
      clients.forEach((uid) => { if (users.has(uid)) online.push(publicUser(users.get(uid))); });
      ws.send(JSON.stringify({ type: 'onlineUsers', users: online }));
      // send pending requests
      const pending = pendingReqs.get(userId);
      if (pending && pending.size > 0) {
        const reqs = [];
        pending.forEach(fid => { if (users.has(fid)) reqs.push(publicUser(users.get(fid))); });
        ws.send(JSON.stringify({ type: 'pendingRequests', requests: reqs }));
      }
      return;
    }

    const userId = clients.get(ws);
    if (!userId) return;
    const user = users.get(userId);
    if (!user) return;

    // ── message (public) ──
    if (type === 'message') {
      const { text, replyTo, clientMsgId } = data;
      if (!text || typeof text !== 'string' || text.trim().length === 0) return;
      const msg = {
        id: crypto.randomBytes(8).toString('hex'),
        clientMsgId: clientMsgId || null,
        userId, username: user.username,
        avatar: user.avatar, avatarBg: user.avatarBg,
        text: text.trim().slice(0, 2000),
        replyTo: replyTo || null,
        reactions: {},
        channel: 'public',
        ts: Date.now()
      };
      globalMsgs.push(msg);
      capArray(globalMsgs, 200);
      broadcast({ type: 'message', msg });
      return;
    }

    // ── dm ──
    if (type === 'dm') {
      const { toUserId, text, replyTo, clientMsgId } = data;
      if (!toUserId || !text) return;
      const key = pairKey(userId, toUserId);
      if (!acceptedPairs.has(key)) return;
      const msg = {
        id: crypto.randomBytes(8).toString('hex'),
        clientMsgId: clientMsgId || null,
        userId, username: user.username,
        avatar: user.avatar, avatarBg: user.avatarBg,
        text: text.trim().slice(0, 2000),
        replyTo: replyTo || null,
        reactions: {},
        channel: key,
        toUserId,
        ts: Date.now()
      };
      if (!dmStore.has(key)) dmStore.set(key, []);
      const arr = dmStore.get(key);
      arr.push(msg);
      capArray(arr, 200);
      broadcast({ type: 'dm', msg });
      return;
    }

    // ── doodle ──
    if (type === 'doodle') {
      const { imageData, channel, toUserId } = data;
      if (!imageData) return;
      const msg = {
        id: crypto.randomBytes(8).toString('hex'),
        userId, username: user.username,
        avatar: user.avatar, avatarBg: user.avatarBg,
        doodle: true, imageData,
        reactions: {},
        channel: channel || 'public',
        ts: Date.now()
      };
      if (channel === 'public') {
        globalMsgs.push(msg);
        capArray(globalMsgs, 200);
        broadcast({ type: 'message', msg });
      } else if (toUserId) {
        const key = pairKey(userId, toUserId);
        if (!acceptedPairs.has(key)) return;
        msg.channel = key;
        msg.toUserId = toUserId;
        if (!dmStore.has(key)) dmStore.set(key, []);
        dmStore.get(key).push(msg);
        capArray(dmStore.get(key), 200);
        broadcast({ type: 'dm', msg });
      }
      return;
    }

    // ── eruption ──
    if (type === 'eruption') {
      const { text, emoji } = data;
      broadcast({ type: 'eruption', text: (text || '').slice(0, 100), emoji: emoji || '🌋', userId, username: user.username });
      return;
    }

    // ── typing ──
    if (type === 'typing') {
      const { channel, toUserId, isTyping } = data;
      if (channel === 'public') {
        broadcast({ type: 'typing', userId, username: user.username, channel: 'public', isTyping }, ws);
      } else if (toUserId) {
        sendTo(toUserId, { type: 'typing', userId, username: user.username, channel: pairKey(userId, toUserId), isTyping });
      }
      return;
    }

    // ── chat-request ──
    if (type === 'chat-request') {
      const { toUserId } = data;
      if (!toUserId || !users.has(toUserId)) return;
      const key = pairKey(userId, toUserId);
      if (acceptedPairs.has(key)) return;
      if (!pendingReqs.has(toUserId)) pendingReqs.set(toUserId, new Set());
      pendingReqs.get(toUserId).add(userId);
      sendTo(toUserId, { type: 'chat-request', from: publicUser(user) });
      return;
    }

    // ── chat-response ──
    if (type === 'chat-response') {
      const { fromUserId, accepted } = data;
      if (!fromUserId || !users.has(fromUserId)) return;
      const key = pairKey(userId, fromUserId);
      const pending = pendingReqs.get(userId);
      if (pending) pending.delete(fromUserId);
      if (accepted) {
        acceptedPairs.add(key);
        const sysMsg = { id: crypto.randomBytes(8).toString('hex'), system: true, text: 'You can now chat!', channel: key, ts: Date.now() };
        if (!dmStore.has(key)) dmStore.set(key, []);
        dmStore.get(key).push(sysMsg);
        sendTo(userId, { type: 'chat-accepted', peerId: fromUserId, peer: publicUser(users.get(fromUserId)), history: dmStore.get(key) });
        sendTo(fromUserId, { type: 'chat-accepted', peerId: userId, peer: publicUser(user), history: dmStore.get(key) });
      } else {
        sendTo(fromUserId, { type: 'chat-declined', byUserId: userId, byUsername: user.username });
      }
      return;
    }

    // ── seen ──
    if (type === 'seen') {
      const { msgId, channel, toUserId } = data;
      if (channel === 'public') {
        broadcast({ type: 'seen', msgId, seenBy: publicUser(user), channel: 'public' }, ws);
      } else if (toUserId) {
        sendTo(toUserId, { type: 'seen', msgId, seenBy: publicUser(user), channel: pairKey(userId, toUserId) });
      }
      return;
    }

    // ── react ──
    if (type === 'react') {
      const { msgId, emoji, channel, toUserId } = data;
      if (!msgId || !emoji) return;
      let msg = null;
      if (channel === 'public') {
        msg = globalMsgs.find(m => m.id === msgId);
      } else {
        const key = pairKey(userId, toUserId || '');
        const arr = dmStore.get(key);
        if (arr) msg = arr.find(m => m.id === msgId);
      }
      if (msg) {
        if (!msg.reactions) msg.reactions = {};
        if (!msg.reactions[emoji]) msg.reactions[emoji] = [];
        const idx = msg.reactions[emoji].indexOf(userId);
        if (idx === -1) msg.reactions[emoji].push(userId);
        else msg.reactions[emoji].splice(idx, 1);
        if (msg.reactions[emoji].length === 0) delete msg.reactions[emoji];
        broadcast({ type: 'react', msgId, reactions: msg.reactions, channel: msg.channel });
      }
      return;
    }
  });

  ws.on('close', () => {
    const userId = clients.get(ws);
    clients.delete(ws);
    if (userId) {
      // Check if user has other connections
      let stillOnline = false;
      clients.forEach((uid) => { if (uid === userId) stillOnline = true; });
      if (!stillOnline) {
        const user = users.get(userId);
        if (user) {
          broadcast({ type: 'userLeft', userId, username: user.username });
          users.delete(userId);
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Connector running on http://localhost:${PORT}`));