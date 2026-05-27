// ============================================================
//  Bubble Chat — server.js
//  Backend: Express + Socket.IO | In-memory storage only
// ============================================================

const express   = require('express');
const http      = require('http');
const { Server } = require('socket.io');
const path      = require('path');

// ── App Setup ─────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);          // Wrap Express in raw http server
const io     = new Server(server);              // Attach Socket.IO to that server

app.use(express.json());                        // Parse JSON request bodies
app.use(express.static(path.join(__dirname, 'public'))); // Serve frontend files

// ── In-Memory Storage ─────────────────────────────────────
//  users  : { username → { username, password, code, friends[], requests[] } }
//  online : { userCode → socket.id }   — who is currently connected
//  history: { "codeA-codeB" → [messages] }  — chat logs (sorted key so A < B)

const users   = {};   // all registered users
const online  = {};   // code → socket.id
const history = {};   // conversation history

// ── Helper: Generate a unique 6-char user code like "AB12CD" ─
function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 6 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join('');
  } while (Object.values(users).some(u => u.code === code)); // ensure uniqueness
  return code;
}

// ── Helper: Canonical key for a conversation between two codes ─
function convKey(a, b) {
  return [a, b].sort().join('-');
}

// ── Helper: Find user by code ──────────────────────────────
function findByCode(code) {
  return Object.values(users).find(u => u.code === code) || null;
}

// =============================================================
//  REST Routes
// =============================================================

// ── POST /signup ───────────────────────────────────────────
app.post('/signup', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password)
    return res.status(400).json({ error: 'Username and password required.' });

  if (users[username])
    return res.status(409).json({ error: 'Username already taken.' });

  const code = makeCode();
  users[username] = { username, password, code, friends: [], requests: [] };

  console.log(`[signup] ${username} → code: ${code}`);
  res.json({ success: true, code });
});

// ── POST /login ────────────────────────────────────────────
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = users[username];

  if (!user || user.password !== password)
    return res.status(401).json({ error: 'Invalid username or password.' });

  const { friends, requests } = user;
  // Return safe user data (no password)
  res.json({ success: true, username, code: user.code, friends, requests });
});

// ── POST /send-request ────────────────────────────────────
//  Body: { senderCode, targetCode }
app.post('/send-request', (req, res) => {
  const { senderCode, targetCode } = req.body;

  if (senderCode === targetCode)
    return res.status(400).json({ error: "You can't add yourself." });

  const sender = findByCode(senderCode);
  const target = findByCode(targetCode);

  if (!sender || !target)
    return res.status(404).json({ error: 'User not found.' });

  // Already friends?
  if (target.friends.includes(senderCode))
    return res.status(409).json({ error: 'Already friends.' });

  // Already requested?
  if (target.requests.includes(senderCode))
    return res.status(409).json({ error: 'Request already sent.' });

  // Push request
  target.requests.push(senderCode);

  // Notify target in real-time if they're online
  const targetSocketId = online[targetCode];
  if (targetSocketId) {
    io.to(targetSocketId).emit('new-request', {
      code: senderCode,
      username: sender.username,
    });
  }

  res.json({ success: true, targetUsername: target.username });
});

// ── POST /accept-request ──────────────────────────────────
//  Body: { userCode, requesterCode, action: 'accept'|'reject' }
app.post('/accept-request', (req, res) => {
  const { userCode, requesterCode, action } = req.body;

  const user      = findByCode(userCode);
  const requester = findByCode(requesterCode);

  if (!user || !requester)
    return res.status(404).json({ error: 'User not found.' });

  // Remove from requests list regardless of action
  user.requests = user.requests.filter(c => c !== requesterCode);

  if (action === 'accept') {
    // Add each other as friends (avoid duplicates)
    if (!user.friends.includes(requesterCode))      user.friends.push(requesterCode);
    if (!requester.friends.includes(userCode))      requester.friends.push(userCode);

    // Notify the requester that they were accepted
    const reqSocketId = online[requesterCode];
    if (reqSocketId) {
      io.to(reqSocketId).emit('request-accepted', {
        code: userCode,
        username: user.username,
      });
    }

    return res.json({
      success: true,
      newFriend: { code: requesterCode, username: requester.username },
    });
  }

  // action === 'reject'
  res.json({ success: true });
});

// ── GET /history?a=CODE&b=CODE ─────────────────────────────
app.get('/history', (req, res) => {
  const { a, b } = req.query;
  const key = convKey(a, b);
  res.json(history[key] || []);
});

// =============================================================
//  Socket.IO — Real-time Events
// =============================================================
io.on('connection', (socket) => {

  // Client registers their code so we can route events
  socket.on('register', (code) => {
    online[code] = socket.id;
    socket.userCode = code;           // store on socket for cleanup
    console.log(`[online] ${code} connected (${socket.id})`);
  });

  // ── Send a chat message ────────────────────────────────
  socket.on('chat-message', ({ senderCode, receiverCode, text }) => {
    const msg = {
      senderCode,
      text,
      time: new Date().toISOString(),
    };

    // Persist in memory
    const key = convKey(senderCode, receiverCode);
    if (!history[key]) history[key] = [];
    history[key].push(msg);

    // Deliver to receiver if online
    const receiverSocket = online[receiverCode];
    if (receiverSocket) {
      io.to(receiverSocket).emit('chat-message', { ...msg, receiverCode });
    }

    // Echo back to sender so they see confirmation
    socket.emit('chat-message', { ...msg, receiverCode });
  });

  // ── Typing indicator ───────────────────────────────────
  socket.on('typing', ({ senderCode, receiverCode, isTyping }) => {
    const receiverSocket = online[receiverCode];
    if (receiverSocket) {
      io.to(receiverSocket).emit('typing', { senderCode, isTyping });
    }
  });

  // ── Cleanup on disconnect ──────────────────────────────
  socket.on('disconnect', () => {
    if (socket.userCode) {
      delete online[socket.userCode];
      console.log(`[offline] ${socket.userCode} disconnected`);
    }
  });
});

// ── Start Server ───────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🫧  Bubble Chat running → http://localhost:${PORT}\n`);
});