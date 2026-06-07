/* ═══════════════════════════════════════════════════════════════════
   CONNECTOR — Complete Client Script
   ═══════════════════════════════════════════════════════════════════ */

'use strict';

/* ── State ──────────────────────────────────────────────────────────── */
const STATE = {
  userId: null, username: null, avatar: '😊', avatarBg: '#7c6af5',
  theme: 'midnight', fontSize: 'medium', bubbleStyle: 'rounded',
  soundEnabled: true, notifEnabled: false, notifSound: 'pop',
  activeChannel: 'public',
  selectedMood: '😊', selectedAvatarEmoji: '😊', selectedAvatarBg: '#7c6af5',
  selectedAvatarCat: 'faces',
  onlineUsers: new Map(),        // userId → user
  dmPeers: new Map(),            // pairKey → peerUser
  messages: { public: [] },      // channel → []
  unread: {},                    // channel → count
  typingTimers: {},              // channel+userId → timeout
  typingUsers: {},               // channel → Set<username>
  pendingFrom: new Map(),        // fromUserId → user
  replyingTo: null,              // { msgId, username, text }
  ctxTarget: null,               // { msgId, userId, text, channel }
  inputHistory: {},              // channel → []
  inputHistoryIdx: {},           // channel → int
  emojiPickerTarget: 'chat',     // 'chat' | 'eruption'
  searchQuery: '',
  roomStartedAt: Date.now(),
  doodleDarkBg: false,
  doodleHistory: [],
  doodleCurrentTool: 'pen',
  doodleCurrentColor: '#000000',
  doodleCurrentSize: 2,
  mentionIndex: -1,
  glowIntensity: 60,
  ws: null, wsRetryDelay: 1000,
};

/* ── Emoji Data ─────────────────────────────────────────────────────── */
const EMOJI_DATA = {
  smileys: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥴','😵','🤯','🤠','🥳','😎','🤓','🧐','😕','😟','🙁','☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖'],
  people: ['👋','🤚','🖐','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🦵','🦶','👂','🦻','👃','🧠','🦷','👀','👁','👅','🫀','🫁','💋','💌','💘','💝','💖','💗','💓','💞','💕','💟','❣️','💔','❤️','🧡','💛','💚','💙','💜','🤎','🖤','🤍'],
  animals: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐒','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🦟','🦗','🕷','🦂','🐢','🐍','🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🐊','🐅','🐆','🦓','🦍','🦧','🐘','🦛','🦏','🐪','🐫','🦒','🦘','🐃','🐂','🐄','🐎','🐖','🐏','🐑','🦙','🐐','🦌','🐕','🐩','🦮','🐕‍🦺','🐈','🐈‍⬛','🐓','🦃','🦚','🦜'],
  food: ['🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🥑','🍆','🥦','🥬','🥒','🌶','🫑','🥕','🧅','🥔','🍠','🥐','🥯','🍞','🥖','🥨','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🌭','🍔','🍟','🍕','🫓','🥙','🥗','🫔','🌯','🥫','🍝','🍜','🍲','🍛','🍣','🍱','🥟','🦪','🍤','🍙','🍚','🍘','🍥','🥮','🍢','🧆','🥜','🌰','🍡','🍧','🍨','🍦','🥧','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','🌰','🥤','🧋','🍺','🥂'],
  travel: ['🚗','🚕','🚙','🚌','🚎','🏎','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🏍','🛵','🚲','🛴','🛹','🛼','🚏','🛣','🛤','⛽','🚨','🚥','🚦','🛑','🚧','⚓','🛥','🚢','✈️','🛩','🛫','🛬','🪂','💺','🚁','🚟','🚠','🚡','🛰','🚀','🛸','🌍','🌎','🌏','🧭','🏔','⛰','🌋','🗻','🏕','🏖','🏜','🏝','🏞','🏟','🏛','🏗','🏘','🏚','🏠','🏡','🏢','🏣','🏤','🏥','🏦','🏨','🏩','🏪','🏫','🏬','🏭','🗼','🗽','⛪','🕌','🛕','🕍','⛩','🕋','⛲','⛺','🌁','🌃','🏙','🌄','🌅','🌆','🌇','🌉','♨️'],
  objects: ['⌚','📱','📲','💻','⌨️','🖥','🖨','🖱','🖲','💽','💾','💿','📀','📷','📸','📹','🎥','📽','🎞','📞','☎️','📟','📠','📺','📻','🧭','⏱','⏲','⏰','🕰','⌛','⏳','📡','🔋','🔌','💡','🔦','🕯','🪔','🧱','💎','🔧','🔨','⚒','🛠','⛏','🔩','🪛','🔫','🪃','🏹','🛡','🪚','🔪','🗡','⚔️','🛒','🎒','🧳','🌂','☂️','🧵','🧶','👓','🥽','🌡','🧲','💊','💉','🩸','🩺','🩹','🩼','🔭','🔬','🪬','📿','💈','⚗️','🔮','🪄','🧿','🕹','🪅','🎊','🎉','🎈','🎀','🎁'],
  symbols: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☪️','🕉','✡️','🔯','🕎','☯️','☦️','🛐','⛎','♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','🆔','⚛️','🉑','☢️','☣️','📴','📳','🈶','🈚','🈸','🈺','🈷️','✴️','🆚','💮','🉐','㊙️','㊗️','🈴','🈵','🈹','🈲','🅰️','🅱️','🆎','🆑','🅾️','🆘','❌','⭕','🛑','⛔','📛','🚫','💯','💢','♨️','🚷','🚯','🚳','🚱','🔞','📵','🚭','❗','❕','❓','❔','‼️','⁉️','🔅','🔆','〽️','⚠️','🔱','♻️','✅','🈯','💹','❎','🌐','💠','Ⓜ️','🌀','💤','🏧','🚾','♿','🅿️','🛗','🈳','🈂️','🛂','🛃','🛄','🛅'],
  flags: ['🏁','🚩','🎌','🏴','🏳️','🏳️‍🌈','🏳️‍⚧️','🏴‍☠️','🇦🇫','🇦🇱','🇩🇿','🇦🇸','🇦🇩','🇦🇴','🇦🇮','🇦🇶','🇦🇬','🇦🇷','🇦🇲','🇦🇼','🇦🇺','🇦🇹','🇦🇿','🇧🇸','🇧🇭','🇧🇩','🇧🇧','🇧🇾','🇧🇪','🇧🇿','🇧🇯','🇧🇲','🇧🇹','🇧🇴','🇧🇦','🇧🇼','🇧🇷','🇧🇳','🇧🇬','🇧🇫','🇧🇮','🇨🇻','🇨🇦','🇰🇭','🇨🇲','🇨🇫','🇨🇳','🇨🇴','🇨🇷','🇨🇺','🇩🇰','🇩🇯','🇩🇲','🇩🇴','🇪🇨','🇪🇬','🇸🇻','🇬🇶','🇪🇷','🇪🇪','🇸🇿','🇪🇹','🇫🇯','🇫🇮','🇫🇷','🇬🇦','🇬🇲','🇬🇪','🇩🇪','🇬🇭','🇬🇷','🇬🇩','🇬🇹','🇬🇳','🇬🇼','🇬🇾','🇭🇹','🇭🇳','🇭🇺','🇮🇸','🇮🇳','🇮🇩','🇮🇷','🇮🇶','🇮🇪','🇮🇱','🇮🇹','🇯🇲','🇯🇵','🇯🇴','🇰🇿','🇰🇪']
};

const MOOD_EMOJIS = ['😊','😄','😎','🥳','🤔','😴','🤗','😤','🥺','😈','🔥','💯','👻','🦋','🎯','💡','⚡','🌈','🎸','🤓'];

const AVATAR_EMOJIS = {
  faces:   ['😀','😎','🤩','🥳','🤗','😇','🧐','😈','👻','💀','🤖','👽','🧙','🧝','🧜','🧚','👼','🤴','👸','🎅','🤶','🧑','👱','👴','👵','🧓','👦','👧','🧒','🧑‍🦰','🧑‍🦱','🧑‍🦳','🧑‍🦲'],
  animals: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐸','🐵','🐔','🦆','🦅','🦉','🦋','🐺','🦄','🐲','🦎','🦈','🦁','🐬','🐳','🐘','🦓','🦒','🐊'],
  fantasy: ['🧙','🧝','🧜','🧚','🧛','🧟','🧞','🧌','🐉','🦄','🧿','🔮','🌟','⚡','🔥','💫','🌈','🌙','☄️','🌊','🍄','🌺','🌸','🌼','🌻','🍀','🌿','🍁','🌾','🪄'],
  objects: ['🎸','🎹','🎺','🎻','🥁','🎤','🎧','🎮','🕹','🎲','🃏','🎯','🎳','🏆','🎖','🥇','🎁','🎀','🎪','🎨','🖌','✏️','📚','💻','🔭','🔬','💡','🔮','🧲','⚗️'],
  symbols: ['❤️','🔥','⭐','💫','✨','🌟','💥','💢','💨','💦','🌈','☁️','⚡','❄️','🌊','🍀','🌺','🌸','🌙','☀️','🌍','🚀','💎','🏅','🔑','🗝','🎯','♾️','☮️','⚜️']
};

const BG_SWATCHES = ['#7c6af5','#f43f5e','#10b981','#06b6d4','#f97316','#a855f7','#ec4899','#3b82f6','#eab308','#14b8a6','#6366f1','#84cc16'];
const DOODLE_COLORS = ['#000000','#ffffff','#ef4444','#f97316','#eab308','#22c55e','#14b8a6','#3b82f6','#8b5cf6','#ec4899','#92400e','#6b7280','#fca5a5','#fdba74','#a3e635','#67e8f9'];
const THEMES = [
  { id:'midnight', name:'Midnight', accent:'#7C6AF5', bg:'#0D0F14' },
  { id:'parchment', name:'Parchment', accent:'#D97706', bg:'#F7F4EF' },
  { id:'forest', name:'Forest', accent:'#10B981', bg:'#0A1628' },
  { id:'rose', name:'Rose', accent:'#F43F5E', bg:'#FDF2F4' },
  { id:'ocean', name:'Ocean', accent:'#06B6D4', bg:'#041824' },
  { id:'candy', name:'Candy', accent:'#A855F7', bg:'#F5F0FF' },
  { id:'graphite', name:'Graphite', accent:'#A1A1AA', bg:'#111111' },
  { id:'sunrise', name:'Sunrise', accent:'#F97316', bg:'#FFF8F0' },
  { id:'aurora', name:'Aurora', accent:'#2DD4BF', bg:'#050A14' },
  { id:'cherry', name:'Cherry', accent:'#EC4899', bg:'#1A0A0E' },
];

/* ── DOM helpers ────────────────────────────────────────────────────── */
const $  = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
function escapeHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
}
function formatDate(ts) {
  const d = new Date(ts), now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  const yesterday = new Date(now); yesterday.setDate(now.getDate()-1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month:'short', day:'numeric' });
}

/* ── Web Audio (no files) ───────────────────────────────────────────── */
let audioCtx = null;
function getAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function playTone(freq, type, duration, gainVal=0.3) {
  if (!STATE.soundEnabled) return;
  try {
    const ctx = getAudio();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = type; osc.frequency.value = freq;
    gain.gain.setValueAtTime(gainVal, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + duration);
  } catch {}
}
const SOUNDS = {
  pop:     () => { playTone(660, 'sine', 0.08); setTimeout(()=>playTone(440,'sine',0.05),40); },
  bubble:  () => { playTone(700,'sine',0.05); setTimeout(()=>playTone(600,'sine',0.05),60); setTimeout(()=>playTone(500,'sine',0.05),120); },
  chime:   () => { playTone(523,'sine',0.2); setTimeout(()=>playTone(659,'sine',0.2),200); setTimeout(()=>playTone(784,'sine',0.25),400); },
  digital: () => playTone(880,'square',0.1,0.2),
  whoosh:  () => {
    if (!STATE.soundEnabled) return;
    try {
      const ctx = getAudio();
      const buf = ctx.createBuffer(1,ctx.sampleRate*0.3,ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*((d.length-i)/d.length);
      const src = ctx.createBufferSource();
      const filt = ctx.createBiquadFilter();
      filt.type='bandpass'; filt.frequency.value=800;
      const gain = ctx.createGain();
      src.buffer=buf; src.connect(filt); filt.connect(gain); gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.3,ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.3);
      src.start();
    } catch {}
  },
  rumble:  () => {
    if (!STATE.soundEnabled) return;
    try {
      const ctx = getAudio();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type='sine'; osc.frequency.value=60;
      gain.gain.setValueAtTime(0.4,ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.6);
      osc.start(); osc.stop(ctx.currentTime+0.6);
    } catch {}
  }
};
function playSound(name) {
  if (!STATE.soundEnabled) return;
  (SOUNDS[STATE.notifSound] || SOUNDS.pop)();
}
function playNamedSound(name) {
  if (!STATE.soundEnabled) return;
  (SOUNDS[name] || SOUNDS.pop)();
}

/* ── Toast ──────────────────────────────────────────────────────────── */
function toast(msg, type='info') {
  const c = $('toast-container');
  const t = el('div', `toast ${type}`);
  const m = el('span','toast-msg'); m.textContent = msg;
  const x = el('button','toast-close'); x.textContent = '✕';
  t.appendChild(m); t.appendChild(x);
  c.appendChild(t);
  let timer = setTimeout(() => dismiss(t), 3000);
  t.addEventListener('mouseenter', () => clearTimeout(timer));
  t.addEventListener('mouseleave', () => { timer = setTimeout(()=>dismiss(t), 2000); });
  x.addEventListener('click', () => dismiss(t));
  t.addEventListener('click', () => dismiss(t));
}
function dismiss(t) {
  t.classList.add('out');
  setTimeout(() => t.remove(), 350);
}

/* ── Desktop notifications ──────────────────────────────────────────── */
function requestNotifPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}
function desktopNotif(title, body) {
  if (!STATE.notifEnabled) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (!document.hidden) return;
  new Notification(title, { body, icon: '' });
}

/* ── Tab title badge ────────────────────────────────────────────────── */
function updateTabTitle() {
  const total = Object.values(STATE.unread).reduce((a,b)=>a+b,0);
  document.title = total > 0 ? `(${total}) Connector` : 'Connector';
}

/* ── Theme ──────────────────────────────────────────────────────────── */
function applyTheme(themeId) {
  STATE.theme = themeId;
  document.documentElement.setAttribute('data-theme', themeId);
  localStorage.setItem('cn_theme', themeId);
  renderThemeUIs();
}
function applyFontSize(size) {
  STATE.fontSize = size;
  document.documentElement.setAttribute('data-fontsize', size);
  localStorage.setItem('cn_fontsize', size);
}
function applyBubbleStyle(style) {
  STATE.bubbleStyle = style;
  document.documentElement.setAttribute('data-bubble', style);
  localStorage.setItem('cn_bubble', style);
}
function renderThemeUIs() {
  // Settings mini dots
  const grid = $('settings-theme-grid');
  if (grid) {
    grid.innerHTML = '';
    THEMES.forEach(t => {
      const btn = el('button','theme-dot-btn');
      btn.style.background = `linear-gradient(135deg, ${t.bg} 50%, ${t.accent} 50%)`;
      btn.title = t.name;
      if (t.id === STATE.theme) btn.classList.add('active');
      btn.addEventListener('click', () => {
        applyTheme(t.id);
        if (STATE.userId) patchProfile({ theme: t.id });
      });
      grid.appendChild(btn);
    });
  }
  // Right panel grid
  const rpGrid = $('rp-theme-grid');
  if (rpGrid) {
    rpGrid.innerHTML = '';
    THEMES.forEach(t => {
      const card = el('div','rp-theme-card');
      if (t.id === STATE.theme) card.classList.add('active');
      const swatch = el('div','rp-theme-swatch');
      swatch.style.background = `linear-gradient(135deg, ${t.bg} 50%, ${t.accent} 50%)`;
      const nameRow = el('div','rp-theme-name');
      const nameSpan = el('span'); nameSpan.textContent = t.name;
      nameRow.appendChild(nameSpan);
      if (t.id === STATE.theme) { const chk = el('span','rp-checkmark','✓'); nameRow.appendChild(chk); }
      card.appendChild(swatch); card.appendChild(nameRow);
      card.addEventListener('click', () => {
        applyTheme(t.id);
        if (STATE.userId) patchProfile({ theme: t.id });
      });
      rpGrid.appendChild(card);
    });
  }
  // Right panel active theme
  const rpActive = $('rp-active-theme');
  if (rpActive) {
    const t = THEMES.find(x => x.id === STATE.theme);
    rpActive.innerHTML = '';
    if (t) {
      const dot = el('div','rp-active-theme-dot');
      dot.style.background = t.accent;
      const name = el('span'); name.textContent = t.name;
      rpActive.appendChild(dot); rpActive.appendChild(name);
    }
  }
  // Join chips
  const chips = $('join-theme-chips');
  if (chips) {
    chips.innerHTML = '';
    THEMES.forEach(t => {
      const chip = el('div','theme-chip');
      if (t.id === STATE.theme) chip.classList.add('active');
      const dot = el('div','theme-chip-dot');
      dot.style.background = t.accent;
      const name = el('span'); name.textContent = t.name;
      chip.appendChild(dot); chip.appendChild(name);
      chip.addEventListener('click', () => {
        STATE.theme = t.id;
        applyTheme(t.id);
        $$('#join-theme-chips .theme-chip').forEach(c=>c.classList.remove('active'));
        chip.classList.add('active');
      });
      chips.appendChild(chip);
    });
  }
}

/* ── Particles on home ──────────────────────────────────────────────── */
function initParticles() {
  const cont = $('particles-container');
  if (!cont) return;
  cont.innerHTML = '';
  for (let i=0; i<18; i++) {
    const p = el('div','particle');
    const x = Math.random() * 100;
    const delay = Math.random() * 8;
    const dur = 6 + Math.random() * 8;
    const size = 2 + Math.random() * 4;
    p.style.cssText = `left:${x}%;bottom:-10px;width:${size}px;height:${size}px;animation:particleRise ${dur}s ${delay}s ease-in infinite`;
    cont.appendChild(p);
  }
  if (!document.getElementById('particle-style')) {
    const s = document.createElement('style');
    s.id = 'particle-style';
    s.textContent = `@keyframes particleRise{0%{transform:translateY(0);opacity:0.4}100%{transform:translateY(-100vh);opacity:0}}`;
    document.head.appendChild(s);
  }
}

/* ── Typewriter ─────────────────────────────────────────────────────── */
function startTypewriter() {
  const el_ = $('typewriter-text');
  if (!el_) return;
  const phrases = ['Talk. Connect. Belong.', 'Your room awaits.', 'Real people, real vibes.'];
  let pi = 0, ci = 0, deleting = false;
  setInterval(() => {
    const phrase = phrases[pi];
    if (!deleting) {
      el_.textContent = phrase.slice(0, ++ci);
      if (ci === phrase.length) { deleting = true; setTimeout(()=>{},1500); }
    } else {
      el_.textContent = phrase.slice(0, --ci);
      if (ci === 0) { deleting = false; pi = (pi+1) % phrases.length; }
    }
  }, 90);
}

/* ── Screen transitions ─────────────────────────────────────────────── */
function showScreen(id) {
  const screens = $$('.screen');
  screens.forEach(s => {
    if (s.classList.contains('active')) {
      s.classList.add('exit');
      setTimeout(() => { s.classList.remove('active','exit'); }, 400);
    }
  });
  const target = $(id);
  if (target) {
    setTimeout(() => {
      target.classList.add('active');
    }, 50);
  }
}

/* ── Join / Avatar UI ───────────────────────────────────────────────── */
function initJoinUI() {
  // Mood grid
  const mg = $('mood-grid');
  if (mg) {
    MOOD_EMOJIS.forEach(e => {
      const btn = el('button','mood-btn'); btn.textContent = e;
      btn.setAttribute('aria-label', `Mood: ${e}`);
      if (e === STATE.selectedMood) btn.classList.add('selected');
      btn.addEventListener('click', () => {
        $$('#mood-grid .mood-btn').forEach(b=>b.classList.remove('selected'));
        btn.classList.add('selected');
        STATE.selectedMood = e;
      });
      mg.appendChild(btn);
    });
  }
  // Avatar tabs
  $$('#avatar-tabs .avatar-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('#avatar-tabs .avatar-tab').forEach(t=>t.classList.remove('active'));
      tab.classList.add('active');
      STATE.selectedAvatarCat = tab.dataset.cat;
      renderAvatarEmojiGrid();
    });
  });
  renderAvatarEmojiGrid();
  // BG swatches
  const swatchCont = $('avatar-bg-swatches');
  if (swatchCont) {
    BG_SWATCHES.forEach(color => {
      const s = el('div','color-swatch');
      s.style.background = color;
      s.setAttribute('aria-label', `Background color ${color}`);
      if (color === STATE.selectedAvatarBg) s.classList.add('selected');
      s.addEventListener('click', () => {
        $$('#avatar-bg-swatches .color-swatch').forEach(x=>x.classList.remove('selected'));
        s.classList.add('selected');
        STATE.selectedAvatarBg = color;
        updateAvatarPreview();
      });
      swatchCont.appendChild(s);
    });
  }
  const customColor = $('avatar-bg-custom');
  if (customColor) {
    customColor.addEventListener('input', () => {
      STATE.selectedAvatarBg = customColor.value;
      updateAvatarPreview();
    });
  }
  updateAvatarPreview();
  // char counters
  [['join-about','about-count',160],['join-bio','bio-count',500],['join-notes','notes-count',500]].forEach(([inputId,countId,max])=>{
    const inp = $(inputId), cnt = $(countId);
    if (inp&&cnt) inp.addEventListener('input',()=>{ cnt.textContent=`${inp.value.length}/${max}`; });
  });
  // Mode ctrl
  $$('#join-mode-ctrl .seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('#join-mode-ctrl .seg-btn').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-pressed','false');});
      btn.classList.add('active'); btn.setAttribute('aria-pressed','true');
    });
  });
  // Font size ctrl
  $$('#join-fontsize-ctrl .seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('#join-fontsize-ctrl .seg-btn').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-pressed','false');});
      btn.classList.add('active'); btn.setAttribute('aria-pressed','true');
      applyFontSize(btn.dataset.val);
    });
  });
  renderThemeUIs();
}

function renderAvatarEmojiGrid() {
  const grid = $('avatar-emoji-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const list = AVATAR_EMOJIS[STATE.selectedAvatarCat] || AVATAR_EMOJIS.faces;
  list.forEach(e => {
    const btn = el('button','emoji-btn'); btn.textContent = e;
    btn.setAttribute('role','option'); btn.setAttribute('aria-label',`Avatar: ${e}`);
    if (e === STATE.selectedAvatarEmoji) btn.classList.add('selected');
    btn.addEventListener('click', () => {
      $$('#avatar-emoji-grid .emoji-btn').forEach(b=>b.classList.remove('selected'));
      btn.classList.add('selected');
      STATE.selectedAvatarEmoji = e;
      updateAvatarPreview();
    });
    grid.appendChild(btn);
  });
}

function updateAvatarPreview() {
  const p = $('avatar-preview');
  if (p) {
    p.textContent = STATE.selectedAvatarEmoji;
    p.style.background = STATE.selectedAvatarBg;
    p.style.borderColor = STATE.selectedAvatarBg;
    p.style.boxShadow = `0 0 0 6px ${STATE.selectedAvatarBg}33`;
  }
}

/* ── Submit join ────────────────────────────────────────────────────── */
async function submitJoin() {
  const username = $('join-username').value.trim();
  const errEl = $('join-error');
  if (!username) { errEl.textContent = 'Username is required.'; return; }
  if (username.length < 2) { errEl.textContent = 'Username must be at least 2 characters.'; return; }
  errEl.textContent = '';
  const btn = $('btn-join-submit');
  btn.disabled = true; btn.textContent = 'Joining…';
  try {
    const payload = {
      username,
      age: parseInt($('join-age').value)||null,
      gender: $('join-gender').value,
      pronouns: $('join-pronouns').value.trim(),
      location: $('join-location').value.trim(),
      about: $('join-about').value.trim(),
      bio: $('join-bio').value.trim(),
      notes: $('join-notes').value.trim(),
      website: $('join-website').value.trim(),
      mood: STATE.selectedMood,
      avatar: STATE.selectedAvatarEmoji,
      avatarBg: STATE.selectedAvatarBg,
      theme: STATE.theme,
      fontSize: STATE.fontSize,
      bubbleStyle: STATE.bubbleStyle,
    };
    const res = await fetch('/api/join', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Server error');
    STATE.userId = data.userId;
    STATE.username = data.username;
    STATE.avatar = STATE.selectedAvatarEmoji;
    STATE.avatarBg = STATE.selectedAvatarBg;
    localStorage.setItem('cn_userId', data.userId);
    // Seed history
    if (data.history && data.history.length) {
      STATE.messages.public = data.history;
    }
    initApp();
    showScreen('screen-app');
    connectWS();
    if (STATE.notifEnabled) requestNotifPermission();
    STATE.roomStartedAt = Date.now();
    const rpStarted = $('rp-room-started');
    if (rpStarted) rpStarted.textContent = formatTime(STATE.roomStartedAt);
  } catch(err) {
    errEl.textContent = err.message || 'Could not join. Try again.';
    btn.disabled = false; btn.textContent = 'Enter Room →';
  }
}

/* ── PATCH profile ──────────────────────────────────────────────────── */
async function patchProfile(updates) {
  if (!STATE.userId) return;
  try {
    await fetch('/api/profile', {
      method:'PATCH',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ userId: STATE.userId, ...updates })
    });
  } catch {}
}

/* ── WebSocket ──────────────────────────────────────────────────────── */
function connectWS() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${proto}://${location.host}`);
  STATE.ws = ws;

  ws.addEventListener('open', () => {
    STATE.wsRetryDelay = 1000;
    ws.send(JSON.stringify({ type:'register', userId: STATE.userId }));
  });

  ws.addEventListener('message', e => {
    let data; try { data = JSON.parse(e.data); } catch { return; }
    handleWS(data);
  });

  ws.addEventListener('close', () => {
    STATE.ws = null;
    toast('Connection lost. Reconnecting…','warning');
    setTimeout(() => { connectWS(); }, STATE.wsRetryDelay);
    STATE.wsRetryDelay = Math.min(STATE.wsRetryDelay * 2, 30000);
  });

  ws.addEventListener('error', () => { ws.close(); });
}

function wsSend(obj) {
  if (STATE.ws && STATE.ws.readyState === WebSocket.OPEN) {
    STATE.ws.send(JSON.stringify(obj));
  }
}

function handleWS(data) {
  switch (data.type) {
    case 'onlineUsers':
      STATE.onlineUsers.clear();
      data.users.forEach(u => STATE.onlineUsers.set(u.userId, u));
      renderPeopleList();
      updateOnlineCount();
      break;

    case 'userJoined':
      STATE.onlineUsers.set(data.user.userId, data.user);
      renderPeopleList();
      updateOnlineCount();
      appendSystemMsg('public', `${data.user.username} joined`);
      playNamedSound('pop');
      break;

    case 'userLeft':
      STATE.onlineUsers.delete(data.userId);
      renderPeopleList();
      updateOnlineCount();
      appendSystemMsg('public', `${data.username} left`);
      break;

    case 'profileUpdate':
      STATE.onlineUsers.set(data.user.userId, data.user);
      if (data.user.userId === STATE.userId) {
        STATE.username = data.user.username;
        STATE.avatar = data.user.avatar;
        STATE.avatarBg = data.user.avatarBg;
        updateMyProfileDisplay();
      }
      renderPeopleList();
      refreshOpenDMTabs();
      break;

    case 'message':
      receiveMessage(data.msg, 'public');
      break;

    case 'dm':
      receiveDM(data.msg);
      break;

    case 'eruption':
      playEruption(data.text, data.emoji);
      playNamedSound('rumble');
      break;

    case 'typing':
      handleTypingEvent(data);
      break;

    case 'chat-request':
      handleChatRequest(data.from);
      break;

    case 'chat-accepted':
      handleChatAccepted(data);
      break;

    case 'chat-declined':
      toast(`${data.byUsername} declined your chat request.`, 'info');
      break;

    case 'pendingRequests':
      data.requests.forEach(u => {
        STATE.pendingFrom.set(u.userId, u);
      });
      renderPendingRequests();
      updatePendingBadge();
      break;

    case 'seen':
      updateSeenReceipt(data.msgId, data.seenBy, data.channel);
      break;

    case 'react':
      updateReactions(data.msgId, data.reactions, data.channel);
      break;
  }
}

/* ── Init App Screen ────────────────────────────────────────────────── */
function initApp() {
  updateMyProfileDisplay();
  renderMessages('public');
  setupChatInput();
  setupSidebarTabs();
  setupSettingsControls();
  setupRightPanel();
  initDoodleCanvas();
  initEmojiPicker();
  renderThemeUIs();
  renderPeopleList();
  const rpStarted = $('rp-room-started');
  if (rpStarted) rpStarted.textContent = formatTime(STATE.roomStartedAt);

  // Copy user ID
  $('copy-id-btn').addEventListener('click', () => {
    navigator.clipboard.writeText(STATE.userId).catch(()=>{});
    const tip = $('copy-tooltip'); tip.classList.add('show');
    setTimeout(()=>tip.classList.remove('show'), 1500);
  });

  // My profile card
  $('my-profile-card').addEventListener('click', () => openOwnProfile());
  $('my-profile-card').addEventListener('keydown', e => { if(e.key==='Enter'||e.key===' ') openOwnProfile(); });

  // Scroll to bottom
  $('scroll-bottom-btn').addEventListener('click', scrollToBottom);
  $('messages-area').addEventListener('scroll', onMessagesScroll);

  // Topbar buttons
  $('btn-search-messages').addEventListener('click', toggleMsgSearch);
  $('btn-open-doodle-chat').addEventListener('click', () => openDoodle());
  $('btn-doodle-footer').addEventListener('click', () => openDoodle());
  $('btn-emoji-picker').addEventListener('click', () => { STATE.emojiPickerTarget='chat'; openEmojiPicker(); });
  $('btn-eruption').addEventListener('click', () => openEruptionModal());
  $('msg-search-close').addEventListener('click', toggleMsgSearch);
  $('msg-search-input').addEventListener('input', () => { STATE.searchQuery = $('msg-search-input').value; renderMessages(STATE.activeChannel); });

  // Context menu
  $('ctx-reply').addEventListener('click', () => { if(STATE.ctxTarget) startReply(STATE.ctxTarget); hideCtxMenu(); });
  $('ctx-react').addEventListener('click', () => { if(STATE.ctxTarget) showQuickReact(); hideCtxMenu(); });
  $('ctx-copy').addEventListener('click', () => { if(STATE.ctxTarget) { navigator.clipboard.writeText(STATE.ctxTarget.text).catch(()=>{}); toast('Copied!','success'); } hideCtxMenu(); });
  $('ctx-eruption').addEventListener('click', () => { if(STATE.ctxTarget) { $('eruption-text').value=STATE.ctxTarget.text; openEruptionModal(); } hideCtxMenu(); });
  $('ctx-delete').addEventListener('click', () => { if(STATE.ctxTarget) deleteMsg(STATE.ctxTarget.msgId, STATE.ctxTarget.channel); hideCtxMenu(); });
  document.addEventListener('click', e => {
    if (!e.target.closest('.ctx-menu')) hideCtxMenu();
    if (!e.target.closest('.quick-react-bar') && !e.target.closest('.ctx-menu')) hideQuickReact();
    if (!e.target.closest('.mention-dropdown') && !e.target.closest('.chat-input')) hideMentionDropdown();
  });

  // Quick react
  $$('#quick-react-bar .qr-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.emoji === '➕') { STATE.emojiPickerTarget='react'; openEmojiPicker(); }
      else if (STATE.ctxTarget) { sendReact(STATE.ctxTarget.msgId, btn.dataset.emoji, STATE.ctxTarget.channel, STATE.ctxTarget.toUserId); }
      hideQuickReact();
    });
  });

  // Lightbox
  $('modal-lightbox-close').addEventListener('click', () => closeModal('modal-lightbox'));

  // Profile modal
  $('modal-profile-close').addEventListener('click', () => closeModal('modal-profile'));

  // Doodle modal
  $('modal-doodle-close').addEventListener('click', () => closeModal('modal-doodle'));
  $('doodle-send-btn').addEventListener('click', sendDoodle);
  $('doodle-undo-btn').addEventListener('click', doodleUndo);
  $('doodle-clear-btn').addEventListener('click', doodleClear);
  $('doodle-bg-toggle').addEventListener('click', () => {
    STATE.doodleDarkBg = !STATE.doodleDarkBg;
    const canvas = $('doodle-canvas');
    canvas.style.background = STATE.doodleDarkBg ? '#1a1a2e' : '#ffffff';
  });

  // Eruption
  $('modal-eruption-close').addEventListener('click', () => closeModal('modal-eruption'));
  $('eruption-preview-btn').addEventListener('click', () => playEruption($('eruption-text').value, $('eruption-emoji-pick').value));
  $('eruption-send-btn').addEventListener('click', () => {
    wsSend({ type:'eruption', text:$('eruption-text').value, emoji:$('eruption-emoji-pick').value });
    closeModal('modal-eruption');
  });

  // Shortcuts modal
  $('modal-shortcuts-close').addEventListener('click', () => closeModal('modal-shortcuts'));

  // Right panel toggle
  $('right-panel-toggle').addEventListener('click', toggleRightPanel);

  // Sidebar collapse
  $('sidebar-collapse-btn').addEventListener('click', () => {
    $('sidebar').classList.add('collapsed');
    $('sidebar-expand-btn').style.display = 'flex';
    $('right-panel-toggle').style.right = '';
  });
  $('sidebar-expand-btn').addEventListener('click', () => {
    $('sidebar').classList.remove('collapsed');
    $('sidebar-expand-btn').style.display = 'none';
  });

  // Reply cancel
  $('reply-cancel-btn').addEventListener('click', cancelReply);

  // Chat list public tab
  $('chat-list-public').addEventListener('click', () => switchChannel('public'));
  $('chat-list-public').addEventListener('keydown', e => { if(e.key==='Enter') switchChannel('public'); });
  $('chat-tab-public').addEventListener('click', () => switchChannel('public'));

  // Keyboard shortcuts
  document.addEventListener('keydown', handleGlobalKey);

  // Glow slider
  const glowSlider = $('rp-glow-slider');
  if (glowSlider) {
    glowSlider.addEventListener('input', () => {
      STATE.glowIntensity = parseInt(glowSlider.value);
      const val = STATE.glowIntensity / 100;
      $$('.orb').forEach(orb => { orb.style.opacity = val * 0.12; });
    });
  }

  // Notif toggles
  $('settings-notif-toggle').addEventListener('change', () => {
    STATE.notifEnabled = $('settings-notif-toggle').checked;
    if (STATE.notifEnabled) requestNotifPermission();
  });
  $('settings-sound-toggle').addEventListener('change', () => {
    STATE.soundEnabled = $('settings-sound-toggle').checked;
  });
  $('settings-notif-sound').addEventListener('change', () => {
    STATE.notifSound = $('settings-notif-sound').value;
    playNamedSound(STATE.notifSound);
  });

  // Leave room
  $('settings-leave-btn').addEventListener('click', () => {
    if (confirm('Leave the room?')) {
      if (STATE.ws) STATE.ws.close();
      STATE.userId = null; STATE.username = null;
      STATE.messages = { public: [] };
      STATE.onlineUsers.clear();
      STATE.dmPeers.clear();
      STATE.unread = {};
      localStorage.removeItem('cn_userId');
      showScreen('screen-home');
    }
  });

  // Edit profile (settings)
  $('settings-edit-profile-btn').addEventListener('click', () => openOwnProfile());

  // IntersectionObserver for seen
  setupSeenObserver();

  // Render initial messages
  renderMessages('public');
  scrollToBottom();
}

/* ── My profile display ─────────────────────────────────────────────── */
function updateMyProfileDisplay() {
  const av = $('my-avatar-display');
  const un = $('my-username-display');
  const uid = $('my-user-id-display');
  const mood = $('my-mood-display');
  if (av) { av.textContent = STATE.avatar; av.style.background = STATE.avatarBg; }
  if (un) un.textContent = STATE.username || '—';
  if (uid) uid.textContent = STATE.userId || '—';
  if (mood) mood.textContent = STATE.selectedMood;
}

/* ── Sidebar tabs ───────────────────────────────────────────────────── */
function setupSidebarTabs() {
  $$('.sidebar-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.sidebar-tab').forEach(t=>{t.classList.remove('active');t.setAttribute('aria-selected','false');});
      $$('.sidebar-panel').forEach(p=>p.classList.remove('active'));
      tab.classList.add('active'); tab.setAttribute('aria-selected','true');
      const panel = $('sidebar-panel-'+tab.dataset.tab);
      if (panel) panel.classList.add('active');
    });
  });

  // People search
  $('people-search').addEventListener('input', () => renderPeopleList());
}

/* ── Settings controls ──────────────────────────────────────────────── */
function setupSettingsControls() {
  $$('#settings-mode-ctrl .seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('#settings-mode-ctrl .seg-btn').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-pressed','false');});
      btn.classList.add('active'); btn.setAttribute('aria-pressed','true');
    });
  });
  $$('#settings-fontsize-ctrl .seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('#settings-fontsize-ctrl .seg-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active'); applyFontSize(btn.dataset.val);
      if(STATE.userId) patchProfile({fontSize:btn.dataset.val});
    });
  });
  $$('#settings-bubble-ctrl .seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('#settings-bubble-ctrl .seg-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active'); applyBubbleStyle(btn.dataset.val);
      if(STATE.userId) patchProfile({bubbleStyle:btn.dataset.val});
      $$('#rp-bubble-row .rp-bubble-opt').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-pressed','false');});
      const rpOpt = document.querySelector(`#rp-bubble-row [data-val="${btn.dataset.val}"]`);
      if (rpOpt) { rpOpt.classList.add('active'); rpOpt.setAttribute('aria-pressed','true'); }
    });
  });
}

/* ── Right panel ────────────────────────────────────────────────────── */
function setupRightPanel() {
  $$('#rp-bubble-row .rp-bubble-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('#rp-bubble-row .rp-bubble-opt').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-pressed','false');});
      btn.classList.add('active'); btn.setAttribute('aria-pressed','true');
      applyBubbleStyle(btn.dataset.val);
      if(STATE.userId) patchProfile({bubbleStyle:btn.dataset.val});
    });
  });
}

function toggleRightPanel() {
  const rp = $('right-panel');
  const toggle = $('right-panel-toggle');
  const isOpen = rp.classList.toggle('open');
  toggle.classList.toggle('open', isOpen);
  toggle.textContent = isOpen ? '›' : '‹';
  toggle.setAttribute('aria-expanded', isOpen);
  $('right-panel').setAttribute('aria-hidden', !isOpen);
}

/* ── Chat input ─────────────────────────────────────────────────────── */
function setupChatInput() {
  const input = $('chat-input');
  const sendBtn = $('send-btn');
  let typingTimer = null;
  let wasTyping = false;

  input.addEventListener('input', () => {
    const val = input.value;
    sendBtn.disabled = val.trim().length === 0;
    // char count
    const countEl = $('input-char-count');
    if (val.length > 1800) { countEl.textContent = `${val.length}/2000`; countEl.style.display='block'; }
    else { countEl.style.display='none'; }
    // auto grow
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    // typing event
    if (!wasTyping) { sendTypingEvent(true); wasTyping=true; }
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => { sendTypingEvent(false); wasTyping=false; }, 2500);
    // mentions
    checkMentionTrigger(input);
  });

  input.addEventListener('keydown', e => {
    // mention navigation
    const dd = $('mention-dropdown');
    if (dd && dd.style.display !== 'none') {
      if (e.key === 'ArrowDown') { e.preventDefault(); moveMentionIndex(1); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); moveMentionIndex(-1); return; }
      if (e.key === 'Enter' || e.key === 'Tab') {
        const active = dd.querySelector('.mention-active');
        if (active) { e.preventDefault(); insertMention(active.dataset.username); return; }
      }
      if (e.key === 'Escape') { hideMentionDropdown(); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
    if (e.key === 'ArrowUp' && input.value === '') {
      recallHistory();
    }
  });

  sendBtn.addEventListener('click', sendMessage);
}

function sendTypingEvent(isTyping) {
  if (!STATE.userId) return;
  if (STATE.activeChannel === 'public') {
    wsSend({ type:'typing', channel:'public', isTyping });
  } else {
    const peer = STATE.dmPeers.get(STATE.activeChannel);
    if (peer) wsSend({ type:'typing', toUserId:peer.userId, isTyping });
  }
}

function sendMessage() {
  const input = $('chat-input');
  const text = input.value.trim();
  if (!text || !STATE.userId) return;
  const channel = STATE.activeChannel;
  const clientMsgId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);

  // save to history
  if (!STATE.inputHistory[channel]) STATE.inputHistory[channel] = [];
  STATE.inputHistory[channel].unshift(text);
  if (STATE.inputHistory[channel].length > 10) STATE.inputHistory[channel].pop();
  STATE.inputHistoryIdx[channel] = -1;

  if (channel === 'public') {
    wsSend({ type:'message', text, replyTo: STATE.replyingTo ? STATE.replyingTo.msgId : null, clientMsgId });
  } else {
    const peer = STATE.dmPeers.get(channel);
    if (peer) wsSend({ type:'dm', toUserId:peer.userId, text, replyTo: STATE.replyingTo ? STATE.replyingTo.msgId : null, clientMsgId });
  }
  input.value = '';
  input.style.height = 'auto';
  $('send-btn').disabled = true;
  const countEl = $('input-char-count'); countEl.style.display='none';
  sendTypingEvent(false);
  cancelReply();
  // pulse
  const btn = $('send-btn');
  btn.classList.add('pulse');
  setTimeout(()=>btn.classList.remove('pulse'),400);
}

/* ── Input history recall ───────────────────────────────────────────── */
function recallHistory() {
  const ch = STATE.activeChannel;
  const hist = STATE.inputHistory[ch] || [];
  if (!hist.length) return;
  STATE.inputHistoryIdx[ch] = Math.min((STATE.inputHistoryIdx[ch]||0) + 1, hist.length-1);
  const input = $('chat-input');
  input.value = hist[STATE.inputHistoryIdx[ch]] || '';
  $('send-btn').disabled = input.value.trim().length === 0;
}

/* ── Messages ───────────────────────────────────────────────────────── */
function receiveMessage(msg, channel) {
  if (!STATE.messages[channel]) STATE.messages[channel] = [];
  STATE.messages[channel].push(msg);
  if (STATE.activeChannel !== channel) {
    STATE.unread[channel] = (STATE.unread[channel]||0)+1;
    updateUnreadBadge(channel);
    updateTabTitle();
    playNamedSound('chime');
    desktopNotif(msg.username, msg.text||'Sent a doodle');
  } else {
    appendMessageToDOM(msg, channel);
    const area = $('messages-area');
    const atBottom = area.scrollHeight - area.scrollTop - area.clientHeight < 80;
    if (atBottom) scrollToBottom();
    else { $('scroll-bottom-btn').style.display='flex'; }
    if (msg.userId !== STATE.userId) playSound();
  }
  updateChatListPreview(channel, msg);
}

function receiveDM(msg) {
  const ch = msg.channel; // pairKey
  if (!STATE.messages[ch]) STATE.messages[ch] = [];
  STATE.messages[ch].push(msg);

  if (STATE.activeChannel !== ch) {
    STATE.unread[ch] = (STATE.unread[ch]||0)+1;
    updateUnreadBadge(ch);
    updateTabTitle();
    playNamedSound('bubble');
    desktopNotif(msg.username, msg.text||'Sent a doodle');
  } else {
    appendMessageToDOM(msg, ch);
    const area = $('messages-area');
    const atBottom = area.scrollHeight - area.scrollTop - area.clientHeight < 80;
    if (atBottom) scrollToBottom();
    else $('scroll-bottom-btn').style.display='flex';
    if (msg.userId !== STATE.userId) playSound();
  }
  updateChatListPreview(ch, msg);
}

function appendSystemMsg(channel, text) {
  if (!STATE.messages[channel]) STATE.messages[channel] = [];
  const msg = { id:'sys_'+Date.now(), system:true, text, channel, ts:Date.now() };
  STATE.messages[channel].push(msg);
  if (STATE.activeChannel === channel) {
    const inner = $('messages-inner');
    const row = buildSystemMsgEl(msg);
    inner.appendChild(row);
    scrollToBottomIfNear();
  }
}

/* ── Render all messages ────────────────────────────────────────────── */
function renderMessages(channel) {
  const inner = $('messages-inner');
  inner.innerHTML = '';
  const msgs = STATE.messages[channel] || [];
  let lastDate = null, lastUserId = null, lastTs = 0;
  let groupEl = null;

  const searchQ = STATE.searchQuery.toLowerCase();

  msgs.forEach((msg, idx) => {
    // date chip
    const msgDate = formatDate(msg.ts);
    if (msgDate !== lastDate) {
      lastDate = msgDate; lastUserId = null;
      const chip = el('div','date-chip');
      const inner2 = el('div','date-chip-inner',msgDate);
      chip.appendChild(inner2); inner.appendChild(chip);
    }
    if (msg.system) {
      inner.appendChild(buildSystemMsgEl(msg)); lastUserId=null; return;
    }

    // search filter
    if (searchQ && msg.text && !msg.text.toLowerCase().includes(searchQ)) {
      lastUserId = null; return;
    }

    const isMine = msg.userId === STATE.userId;
    const gapBig = (msg.ts - lastTs) > 5*60*1000;
    const newGroup = msg.userId !== lastUserId || gapBig;

    if (newGroup || !groupEl) {
      groupEl = el('div','msg-group');
      inner.appendChild(groupEl);
    }

    const row = buildMessageRow(msg, isMine, newGroup, gapBig, searchQ);
    groupEl.appendChild(row);
    lastUserId = msg.userId;
    lastTs = msg.ts;
  });

  updateSeenBadges(channel);
}

function appendMessageToDOM(msg, channel) {
  if (STATE.searchQuery) { renderMessages(channel); return; }
  if (msg.system) {
    const inner = $('messages-inner');
    inner.appendChild(buildSystemMsgEl(msg));
    return;
  }
  const msgs = STATE.messages[channel] || [];
  const idx = msgs.indexOf(msg);
  const prev = msgs[idx-1];
  const isMine = msg.userId === STATE.userId;
  const gapBig = prev ? (msg.ts - prev.ts) > 5*60*1000 : true;
  const newGroup = !prev || prev.userId !== msg.userId || gapBig;

  const inner = $('messages-inner');
  // date chip
  if (!prev || formatDate(msg.ts) !== formatDate(prev.ts)) {
    const chip = el('div','date-chip');
    chip.appendChild(el('div','date-chip-inner',formatDate(msg.ts)));
    inner.appendChild(chip);
  }

  let groupEl = inner.querySelector('.msg-group:last-child');
  if (newGroup || !groupEl || (groupEl && groupEl.querySelector('.msg-row') && groupEl.querySelector('.msg-row').dataset.userId !== msg.userId)) {
    groupEl = el('div','msg-group');
    inner.appendChild(groupEl);
  }
  const row = buildMessageRow(msg, isMine, newGroup, gapBig, '');
  groupEl.appendChild(row);
  updateSeenBadges(channel);
}

function buildSystemMsgEl(msg) {
  const row = el('div','system-msg');
  const inner = el('div','system-msg-inner'); inner.textContent = msg.text;
  row.appendChild(inner); return row;
}

function buildMessageRow(msg, isMine, showSender, gapBig, searchQ) {
  const row = el('div', `msg-row${isMine?' mine':''}`);
  row.dataset.msgId = msg.id;
  row.dataset.userId = msg.userId;
  row.dataset.channel = msg.channel;

  // Avatar
  const avatarEl = el('div', `msg-avatar${!showSender?' invisible':''}`);
  avatarEl.textContent = msg.avatar || '?';
  avatarEl.style.background = msg.avatarBg || '#7c6af5';
  avatarEl.setAttribute('aria-label', `${msg.username}'s avatar`);
  if (!isMine) {
    avatarEl.addEventListener('click', () => {
      const user = STATE.onlineUsers.get(msg.userId);
      if (user) openUserProfile(user);
    });
  }

  const content = el('div','msg-content');

  // Sender name (first in group, not mine)
  if (showSender && !isMine) {
    const senderEl = el('div','msg-sender');
    senderEl.textContent = msg.username;
    content.appendChild(senderEl);
  }

  // Bubble
  const bubble = el('div','bubble');
  // timestamp tooltip
  const tsTip = el('div','bubble-ts-tooltip', formatTime(msg.ts));
  bubble.appendChild(tsTip);

  // Reply quote
  if (msg.replyTo) {
    const allMsgs = STATE.messages[msg.channel] || [];
    const orig = allMsgs.find(m=>m.id===msg.replyTo);
    if (orig) {
      const quote = el('div','reply-quote');
      quote.textContent = `${orig.username}: ${(orig.text||'').slice(0,60)}`;
      bubble.appendChild(quote);
    }
  }

  // Text content
  if (msg.doodle) {
    const img = el('img','doodle-msg-img');
    img.src = msg.imageData;
    img.alt = 'Doodle';
    img.addEventListener('click', () => openLightbox(msg.imageData));
    bubble.appendChild(img);
    const label = el('div','doodle-label','🎨 Doodle');
    content.appendChild(bubble); content.appendChild(label);
  } else if (msg.text) {
    const textEl = el('div','bubble-text');
    let html = escapeHtml(msg.text);
    // highlight mentions
    html = html.replace(/@(\w+)/g, (m,u) => `<span class="mention-highlight">@${u}</span>`);
    // highlight search
    if (searchQ) {
      const escaped = escapeHtml(searchQ);
      html = html.replace(new RegExp(escaped,'gi'), m => `<span class="search-highlight">${m}</span>`);
    }
    textEl.innerHTML = html;
    bubble.appendChild(textEl);
  }

  // Context menu on right-click / long-press
  bubble.addEventListener('contextmenu', e => {
    e.preventDefault();
    STATE.ctxTarget = { msgId:msg.id, userId:msg.userId, text:msg.text||'', channel:msg.channel, toUserId:msg.toUserId };
    const delBtn = $('ctx-delete');
    delBtn.style.display = (msg.userId===STATE.userId) ? 'flex' : 'none';
    showCtxMenu(e.clientX, e.clientY);
  });
  let longPressTimer;
  bubble.addEventListener('touchstart', e => { longPressTimer = setTimeout(()=>{ STATE.ctxTarget={msgId:msg.id,userId:msg.userId,text:msg.text||'',channel:msg.channel,toUserId:msg.toUserId}; const t=e.touches[0]; showCtxMenu(t.clientX,t.clientY); },600); });
  bubble.addEventListener('touchend', ()=>clearTimeout(longPressTimer));

  content.appendChild(bubble);

  // Reactions
  const reactRow = el('div','reactions-row');
  reactRow.dataset.msgId = msg.id;
  if (msg.reactions) renderReactionPills(reactRow, msg.id, msg.reactions, msg.channel, msg.toUserId);
  content.appendChild(reactRow);

  // Timestamp on gap
  if (gapBig) {
    const ts = el('div','msg-timestamp',formatTime(msg.ts));
    content.appendChild(ts);
  }

  // Seen receipt placeholder
  const seenEl = el('div','seen-receipt');
  seenEl.id = `seen-${msg.id}`;
  content.appendChild(seenEl);

  if (!isMine) {
    row.appendChild(avatarEl);
    row.appendChild(content);
  } else {
    row.appendChild(content);
    row.appendChild(avatarEl);
  }
  return row;
}

function renderReactionPills(container, msgId, reactions, channel, toUserId) {
  container.innerHTML = '';
  Object.entries(reactions||{}).forEach(([emoji, userIds]) => {
    if (!userIds.length) return;
    const pill = el('div','reaction-pill');
    if (userIds.includes(STATE.userId)) pill.classList.add('reacted');
    const emojiSpan = el('span'); emojiSpan.textContent = emoji;
    const count = el('span','reaction-count', userIds.length);
    pill.appendChild(emojiSpan); pill.appendChild(count);
    pill.addEventListener('click', () => sendReact(msgId, emoji, channel, toUserId));
    container.appendChild(pill);
  });
}

function updateReactions(msgId, reactions, channel) {
  const msgs = STATE.messages[channel] || [];
  const msg = msgs.find(m=>m.id===msgId);
  if (msg) msg.reactions = reactions;
  const container = document.querySelector(`.reactions-row[data-msg-id="${msgId}"]`);
  if (container) {
    const msg2 = msgs.find(m=>m.id===msgId);
    renderReactionPills(container, msgId, reactions, channel, msg2?msg2.toUserId:null);
  }
}

function sendReact(msgId, emoji, channel, toUserId) {
  wsSend({ type:'react', msgId, emoji, channel, toUserId });
}

/* ── Seen ───────────────────────────────────────────────────────────── */
let seenObserver = null;
function setupSeenObserver() {
  seenObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const row = entry.target;
        const msgId = row.dataset.msgId;
        const channel = row.dataset.channel || STATE.activeChannel;
        if (msgId) {
          const msgs = STATE.messages[channel] || [];
          const msg = msgs.find(m=>m.id===msgId);
          if (msg && msg.userId !== STATE.userId) {
            wsSend({ type:'seen', msgId, channel, toUserId: msg.toUserId });
            seenObserver.unobserve(row);
          }
        }
      }
    });
  }, { threshold: 0.5 });
}
function observeMessages() {
  $$('.msg-row').forEach(row => { if (seenObserver) seenObserver.observe(row); });
}
function updateSeenReceipt(msgId, seenBy, channel) {
  // Clear old seen receipts in this channel first
  const msgs = STATE.messages[channel] || [];
  msgs.forEach(m => {
    if (m.userId === STATE.userId) {
      const old = $(`seen-${m.id}`);
      if (old) old.textContent = '';
    }
  });
  // Show on the specific message
  const el_ = $(`seen-${msgId}`);
  if (el_) el_.textContent = `${seenBy.username}`;
}
function updateSeenBadges(channel) { setTimeout(observeMessages, 100); }

/* ── Scroll helpers ─────────────────────────────────────────────────── */
function scrollToBottom() {
  const area = $('messages-area');
  area.scrollTop = area.scrollHeight;
  $('scroll-bottom-btn').style.display = 'none';
}
function scrollToBottomIfNear() {
  const area = $('messages-area');
  if (area.scrollHeight - area.scrollTop - area.clientHeight < 100) scrollToBottom();
}
function onMessagesScroll() {
  const area = $('messages-area');
  const atBottom = area.scrollHeight - area.scrollTop - area.clientHeight < 80;
  $('scroll-bottom-btn').style.display = atBottom ? 'none' : 'flex';
}

/* ── Message search ─────────────────────────────────────────────────── */
function toggleMsgSearch() {
  const bar = $('msg-search-bar');
  const isHidden = bar.style.display === 'none' || bar.style.display === '';
  bar.style.display = isHidden ? 'flex' : 'none';
  if (isHidden) { $('msg-search-input').focus(); }
  else { STATE.searchQuery=''; $('msg-search-input').value=''; renderMessages(STATE.activeChannel); }
}

/* ── Channel switching ──────────────────────────────────────────────── */
function switchChannel(channel) {
  STATE.activeChannel = channel;
  STATE.unread[channel] = 0;
  updateUnreadBadge(channel);
  updateTabTitle();

  // Update active states
  $$('.chat-list-item').forEach(i=>i.classList.remove('active'));
  $$('.chat-tab').forEach(t=>t.classList.remove('active'));

  const listItem = document.querySelector(`.chat-list-item[data-channel="${channel}"]`);
  if (listItem) listItem.classList.add('active');
  const tabEl = document.querySelector(`.chat-tab[data-channel="${channel}"]`);
  if (tabEl) tabEl.classList.add('active');

  // Update topbar
  if (channel === 'public') {
    $('chat-channel-name').textContent = 'Public Room';
    $('chat-channel-avatar').textContent = '🌐';
    $('chat-channel-status').textContent = '';
  } else {
    const peer = STATE.dmPeers.get(channel);
    if (peer) {
      $('chat-channel-name').textContent = peer.username;
      $('chat-channel-avatar').textContent = peer.avatar;
      $('chat-channel-avatar').style.background = peer.avatarBg;
      const peerOnline = STATE.onlineUsers.has(peer.userId);
      $('chat-channel-status').innerHTML = `<span style="color:${peerOnline?'#10b981':'var(--text3)'}">●</span> ${peerOnline?'Online':'Offline'} ${peer.mood||''}`;
    }
  }

  renderMessages(channel);
  scrollToBottom();
  cancelReply();
}

function updateChatListPreview(channel, msg) {
  const el_ = document.querySelector(`.chat-list-item[data-channel="${channel}"] .chat-item-preview`);
  if (el_) el_.textContent = msg.doodle ? '🎨 Doodle' : (msg.text||'').slice(0,40);
  if (channel === 'public') {
    const prev = $('public-last-preview');
    if (prev) prev.textContent = msg.doodle ? '🎨 Doodle' : (msg.text||'').slice(0,40);
  }
}
function updateUnreadBadge(channel) {
  const count = STATE.unread[channel] || 0;
  if (channel === 'public') {
    const b = $('badge-public');
    if (b) { b.textContent=count; b.style.display=count>0?'flex':'none'; }
  } else {
    const b = document.querySelector(`.chat-list-item[data-channel="${channel}"] .chat-badge`);
    if (b) { b.textContent=count; b.style.display=count>0?'flex':'none'; }
  }
}
function updateOnlineCount() {
  const count = STATE.onlineUsers.size;
  const el_ = $('online-count'); if (el_) el_.textContent = `● ${count} online`;
  const rp = $('rp-online-count'); if (rp) rp.textContent = count;
}

/* ── People list ────────────────────────────────────────────────────── */
function renderPeopleList() {
  const list = $('people-list');
  if (!list) return;
  const query = ($('people-search')||{}).value?.toLowerCase() || '';
  list.innerHTML = '';
  STATE.onlineUsers.forEach(user => {
    if (query && !user.username.toLowerCase().includes(query)) return;
    const item = el('div','person-item');
    item.setAttribute('role','listitem');
    const avatarWrap = el('div','person-avatar-wrap');
    const avatarEl = el('div','person-avatar'); avatarEl.textContent = user.avatar; avatarEl.style.background = user.avatarBg;
    const dot = el('div','person-online-dot');
    avatarWrap.appendChild(avatarEl); avatarWrap.appendChild(dot);
    const info = el('div','person-info');
    const nameRow = el('div','person-name');
    const nameSpan = el('span'); nameSpan.textContent = user.username;
    nameRow.appendChild(nameSpan);
    if (user.userId === STATE.userId) { const you = el('span','you-label','you'); nameRow.appendChild(you); }
    const meta = el('div','person-meta');
    const mood = el('span','person-mood'); mood.textContent = user.mood || '';
    meta.appendChild(mood);
    if (user.location) { const loc = el('span'); loc.textContent = user.location; meta.appendChild(loc); }
    if (user.status) { const st = el('span'); st.textContent = user.status; meta.appendChild(st); }
    info.appendChild(nameRow); info.appendChild(meta);
    item.appendChild(avatarWrap); item.appendChild(info);
    if (user.userId !== STATE.userId) {
      item.addEventListener('click', () => openUserProfile(user));
    }
    list.appendChild(item);
  });
}

function updatePendingBadge() {
  const badge = $('pending-badge');
  const count = STATE.pendingFrom.size;
  if (badge) { badge.textContent=count; badge.style.display=count>0?'flex':'none'; }
}

function renderPendingRequests() {
  const section = $('pending-requests-section');
  const list = $('pending-requests-list');
  if (!section||!list) return;
  list.innerHTML = '';
  section.style.display = STATE.pendingFrom.size > 0 ? 'block' : 'none';
  STATE.pendingFrom.forEach(user => {
    const item = el('div','pending-request-item');
    const avatarEl = el('div','msg-avatar'); avatarEl.textContent=user.avatar; avatarEl.style.background=user.avatarBg;
    const name = el('div','pending-request-name'); name.textContent=user.username;
    const acceptBtn = el('button','accept-btn','Accept');
    const declineBtn = el('button','decline-btn','Decline');
    acceptBtn.addEventListener('click', () => respondChatRequest(user.userId, true));
    declineBtn.addEventListener('click', () => respondChatRequest(user.userId, false));
    item.appendChild(avatarEl); item.appendChild(name); item.appendChild(acceptBtn); item.appendChild(declineBtn);
    list.appendChild(item);
  });
}

/* ── Chat request flow ──────────────────────────────────────────────── */
function sendChatRequest(toUserId) {
  wsSend({ type:'chat-request', toUserId });
}
function respondChatRequest(fromUserId, accepted) {
  wsSend({ type:'chat-response', fromUserId, accepted });
  STATE.pendingFrom.delete(fromUserId);
  renderPendingRequests();
  updatePendingBadge();
}
function handleChatRequest(fromUser) {
  STATE.pendingFrom.set(fromUser.userId, fromUser);
  renderPendingRequests();
  updatePendingBadge();
  // Switch to people tab to show
  const peopleTab = $('tab-people');
  if (peopleTab) { }
  // Toast with accept/decline
  const toastEl = el('div','toast info');
  toastEl.style.cursor='default';
  const msg = el('span','toast-msg'); msg.textContent = `${fromUser.avatar} ${fromUser.username} wants to chat`;
  const acceptBtn = el('button','accept-btn'); acceptBtn.textContent='Accept'; acceptBtn.style.marginLeft='8px';
  const decBtn = el('button','decline-btn'); decBtn.textContent='Decline';
  acceptBtn.addEventListener('click', () => { respondChatRequest(fromUser.userId, true); dismiss(toastEl); });
  decBtn.addEventListener('click', () => { respondChatRequest(fromUser.userId, false); dismiss(toastEl); });
  toastEl.appendChild(msg); toastEl.appendChild(acceptBtn); toastEl.appendChild(decBtn);
  $('toast-container').appendChild(toastEl);
  setTimeout(()=>dismiss(toastEl),8000);
  playNamedSound('bubble');
}

async function handleChatAccepted(data) {
  const { peerId, peer, history } = data;
  const key = [STATE.userId, peerId].sort().join('_');
  STATE.dmPeers.set(key, peer);
  STATE.messages[key] = history || [];
  openDMTab(key, peer);
  toast(`You can now chat with ${peer.username}!`, 'success');
  playNamedSound('chime');
}

/* ── DM tabs ────────────────────────────────────────────────────────── */
function openDMTab(pairKey, peer) {
  // Add to chat list
  let listItem = document.querySelector(`.chat-list-item[data-channel="${pairKey}"]`);
  if (!listItem) {
    listItem = el('div','chat-list-item');
    listItem.dataset.channel = pairKey;
    listItem.setAttribute('role','button'); listItem.tabIndex=0;
    listItem.setAttribute('aria-label', `DM with ${peer.username}`);
    const av = el('div','chat-item-avatar'); av.textContent=peer.avatar; av.style.background=peer.avatarBg;
    const info = el('div','chat-item-info');
    const name = el('div','chat-item-name',peer.username);
    const preview = el('div','chat-item-preview','—');
    const badge = el('span','chat-badge'); badge.style.display='none'; badge.textContent='0';
    info.appendChild(name); info.appendChild(preview);
    listItem.appendChild(av); listItem.appendChild(info); listItem.appendChild(badge);
    listItem.addEventListener('click', () => switchChannel(pairKey));
    listItem.addEventListener('keydown', e => { if(e.key==='Enter') switchChannel(pairKey); });
    $('chat-list').appendChild(listItem);
  }
  // Add tab
  let tabEl = document.querySelector(`.chat-tab[data-channel="${pairKey}"]`);
  if (!tabEl) {
    tabEl = el('div','chat-tab');
    tabEl.dataset.channel = pairKey;
    tabEl.setAttribute('role','tab');
    tabEl.textContent = `${peer.avatar} ${peer.username}`;
    const closeBtn = el('button','tab-close-btn','×');
    closeBtn.setAttribute('aria-label',`Close DM with ${peer.username}`);
    closeBtn.addEventListener('click', e => { e.stopPropagation(); closeDMTab(pairKey); });
    tabEl.appendChild(closeBtn);
    tabEl.addEventListener('click', () => switchChannel(pairKey));
    $('chat-tabs-bar').appendChild(tabEl);
  }
  switchChannel(pairKey);
}

function closeDMTab(pairKey) {
  const tabEl = document.querySelector(`.chat-tab[data-channel="${pairKey}"]`);
  if (tabEl) tabEl.remove();
  const listItem = document.querySelector(`.chat-list-item[data-channel="${pairKey}"]`);
  if (listItem) listItem.remove();
  if (STATE.activeChannel === pairKey) switchChannel('public');
}

function refreshOpenDMTabs() {
  STATE.dmPeers.forEach((peer, key) => {
    const updated = STATE.onlineUsers.get(peer.userId);
    if (updated) STATE.dmPeers.set(key, updated);
    const listItem = document.querySelector(`.chat-list-item[data-channel="${key}"] .chat-item-name`);
    if (listItem && updated) listItem.textContent = updated.username;
    const tabEl = document.querySelector(`.chat-tab[data-channel="${key}"]`);
    if (tabEl && updated) {
      const close = tabEl.querySelector('.tab-close-btn');
      tabEl.textContent = `${updated.avatar} ${updated.username}`;
      if (close) tabEl.appendChild(close);
    }
  });
}

/* ── Typing indicator ───────────────────────────────────────────────── */
function handleTypingEvent(data) {
  const { userId, username, channel, isTyping } = data;
  if (userId === STATE.userId) return;
  if (!STATE.typingUsers[channel]) STATE.typingUsers[channel] = new Set();
  const key = `${channel}_${userId}`;
  clearTimeout(STATE.typingTimers[key]);
  if (isTyping) {
    STATE.typingUsers[channel].add(username);
    STATE.typingTimers[key] = setTimeout(() => {
      if (STATE.typingUsers[channel]) STATE.typingUsers[channel].delete(username);
      updateTypingIndicator();
    }, 4000);
  } else {
    STATE.typingUsers[channel].delete(username);
  }
  updateTypingIndicator();
}
function updateTypingIndicator() {
  const ind = $('typing-indicator');
  const text = $('typing-text');
  const users = STATE.typingUsers[STATE.activeChannel];
  if (!users || users.size === 0) { ind.style.display='none'; return; }
  const arr = [...users];
  let msg;
  if (arr.length === 1) msg = `${arr[0]} is typing…`;
  else if (arr.length === 2) msg = `${arr[0]} and ${arr[1]} are typing…`;
  else msg = `${arr[0]} and ${arr.length-1} others are typing…`;
  text.textContent = msg; ind.style.display='flex';
}

/* ── Reply ──────────────────────────────────────────────────────────── */
function startReply(ctxTarget) {
  STATE.replyingTo = { msgId: ctxTarget.msgId, username: ctxTarget.username||'', text: ctxTarget.text };
  const bar = $('reply-bar'); bar.style.display='flex';
  $('reply-to-name').textContent = ctxTarget.username||'';
  $('reply-to-preview').textContent = (ctxTarget.text||'').slice(0,60);
  $('chat-input').focus();
}
function cancelReply() {
  STATE.replyingTo = null;
  $('reply-bar').style.display='none';
}

/* ── Context menu ───────────────────────────────────────────────────── */
function showCtxMenu(x, y) {
  const menu = $('ctx-menu');
  menu.style.display = 'block';
  menu.style.left = Math.min(x, window.innerWidth-170) + 'px';
  menu.style.top  = Math.min(y, window.innerHeight-200) + 'px';
}
function hideCtxMenu() { $('ctx-menu').style.display='none'; }

function showQuickReact() {
  const bar = $('quick-react-bar');
  const menu = $('ctx-menu');
  const menuRect = menu.getBoundingClientRect();
  bar.style.display='flex';
  bar.style.left = menuRect.left+'px';
  bar.style.top  = (menuRect.top-50)+'px';
}
function hideQuickReact() { $('quick-react-bar').style.display='none'; }

function deleteMsg(msgId, channel) {
  const msgs = STATE.messages[channel] || [];
  const idx = msgs.findIndex(m=>m.id===msgId);
  if (idx !== -1) msgs.splice(idx,1);
  renderMessages(channel);
}

/* ── Profile modals ─────────────────────────────────────────────────── */
function openUserProfile(user) {
  const content = $('profile-modal-content');
  content.innerHTML = '';
  const av = el('div','pm-avatar'); av.textContent=user.avatar; av.style.background=user.avatarBg;
  const name = el('div','pm-username'); name.id='modal-profile-username'; name.textContent=user.username;
  const pronouns = el('div','pm-pronouns'); pronouns.textContent=user.pronouns||'';
  const moodRow = el('div','pm-mood-row');
  const moodEmoji = el('span'); moodEmoji.textContent=user.mood||'';
  moodRow.appendChild(moodEmoji);
  const tags = el('div','pm-tags');
  if (user.age) { const t=el('div','pm-tag'); t.textContent=user.age+'y'; tags.appendChild(t); }
  if (user.gender) { const t=el('div','pm-tag'); t.textContent=user.gender; tags.appendChild(t); }
  if (user.location) { const t=el('div','pm-tag'); t.textContent='📍'+user.location; tags.appendChild(t); }
  content.appendChild(av); content.appendChild(name); content.appendChild(pronouns); content.appendChild(moodRow); content.appendChild(tags);
  if (user.about) {
    const sec=el('div','pm-section'); const lbl=el('div','pm-section-label','About'); const txt=el('div','pm-text'); txt.textContent=user.about; sec.appendChild(lbl); sec.appendChild(txt); content.appendChild(sec);
  }
  if (user.bio) {
    const sec=el('div','pm-section'); const lbl=el('div','pm-section-label','Bio'); const txt=el('div','pm-text'); txt.textContent=user.bio; sec.appendChild(lbl); sec.appendChild(txt); content.appendChild(sec);
  }
  if (user.website) {
    const sec=el('div','pm-section'); const lbl=el('div','pm-section-label','Website'); const link=el('a','pm-website'); link.href=user.website; link.textContent=user.website; link.target='_blank'; link.rel='noopener'; sec.appendChild(lbl); sec.appendChild(link); content.appendChild(sec);
  }
  // Action button
  const key = [STATE.userId, user.userId].sort().join('_');
  const actionDiv = el('div','pm-action');
  if (STATE.dmPeers.has(key)) {
    const btn = el('button','cta-btn','💬 Open DM'); btn.addEventListener('click',()=>{ switchChannel(key); closeModal('modal-profile'); }); actionDiv.appendChild(btn);
  } else if (STATE.pendingFrom.has(user.userId) || isPendingOutgoing(user.userId)) {
    const p=el('div','pm-pending','Pending…'); actionDiv.appendChild(p);
  } else {
    const btn=el('button','cta-btn','✉️ Send Chat Request');
    btn.addEventListener('click',()=>{ sendChatRequest(user.userId); btn.textContent='Pending…'; btn.disabled=true; toast(`Chat request sent to ${user.username}!`,'info'); });
    actionDiv.appendChild(btn);
  }
  content.appendChild(actionDiv);
  openModal('modal-profile');
}

let _pendingOutgoing = new Set();
function isPendingOutgoing(toUserId) { return _pendingOutgoing.has(toUserId); }

function openOwnProfile() {
  const content = $('profile-modal-content');
  content.innerHTML = '';
  // Build edit form
  const form = el('div','pm-edit-form');
  const title = el('h3','modal-title','✏️ Edit Profile'); title.style.marginBottom='16px'; form.appendChild(title);

  const fields = [
    ['username','Username',STATE.username,'text'],
    ['mood','Mood',STATE.selectedMood,'text'],
    ['about','About Me',null,'textarea'],
    ['bio','Bio',null,'textarea'],
    ['location','Location',null,'text'],
    ['website','Website',null,'text'],
    ['status','Status',null,'text'],
    ['notes','🔒 Private Notes',null,'textarea'],
  ];
  const user = STATE.onlineUsers.get(STATE.userId) || {};
  const inputs = {};
  fields.forEach(([key,label,def,type]) => {
    const row = el('div','form-row');
    const lbl = el('label','form-label',label); lbl.htmlFor='edit-'+key;
    const val = def !== null ? def : (user[key]||'');
    let inp;
    if (type==='textarea') { inp=el('textarea','form-input form-textarea'); inp.rows=2; }
    else { inp=el('input','form-input'); inp.type='text'; }
    inp.id='edit-'+key; inp.value=val;
    row.appendChild(lbl); row.appendChild(inp); form.appendChild(row);
    inputs[key]=inp;
  });
  // Avatar preview row
  const avRow = el('div','form-row');
  const avPrev = el('div','my-avatar'); avPrev.textContent=STATE.avatar; avPrev.style.background=STATE.avatarBg; avPrev.style.fontSize='32px'; avPrev.style.width='48px'; avPrev.style.height='48px'; avPrev.style.borderRadius='50%';
  avRow.appendChild(avPrev); form.appendChild(avRow);

  const saveBtn = el('button','cta-btn','Save Changes'); saveBtn.style.width='100%'; saveBtn.style.justifyContent='center';
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled=true; saveBtn.textContent='Saving…';
    const updates = {};
    Object.entries(inputs).forEach(([k,inp])=>{ if(inp.value.trim()) updates[k]=inp.value.trim(); });
    STATE.selectedMood = inputs.mood ? inputs.mood.value : STATE.selectedMood;
    await patchProfile(updates);
    if (updates.username) { STATE.username=updates.username; updateMyProfileDisplay(); }
    toast('Profile updated!','success');
    closeModal('modal-profile');
  });
  form.appendChild(saveBtn);
  content.appendChild(form);
  openModal('modal-profile');
}

/* ── Modals ─────────────────────────────────────────────────────────── */
function openModal(id) {
  const overlay = $(id);
  if (overlay) { overlay.style.display='flex'; }
}
function closeModal(id) {
  const overlay = $(id);
  if (overlay) { overlay.style.display='none'; }
}

/* ── Emoji picker ───────────────────────────────────────────────────── */
let recentEmojis = JSON.parse(localStorage.getItem('cn_recent_emojis')||'[]');
function initEmojiPicker() {
  $$('#emoji-cats .emoji-cat').forEach(cat => {
    cat.addEventListener('click', () => {
      $$('#emoji-cats .emoji-cat').forEach(c=>{c.classList.remove('active');c.setAttribute('aria-selected','false');});
      cat.classList.add('active'); cat.setAttribute('aria-selected','true');
      renderEmojiGrid(cat.dataset.cat);
    });
  });
  $('emoji-search').addEventListener('input', () => {
    const q = $('emoji-search').value.toLowerCase();
    if (q) renderEmojiGridSearch(q);
    else renderEmojiGrid('smileys');
  });
}
function openEmojiPicker() {
  renderEmojiGrid('smileys');
  openModal('modal-emoji');
  $('emoji-search').focus();
}
function renderEmojiGrid(cat) {
  const grid = $('emoji-grid-picker');
  grid.innerHTML = '';
  let list = [];
  if (cat==='recent') list=recentEmojis;
  else list=EMOJI_DATA[cat]||[];
  list.forEach(e => {
    const btn = el('button','emoji-pick-btn'); btn.textContent=e;
    btn.addEventListener('click', () => pickEmoji(e));
    grid.appendChild(btn);
  });
}
function renderEmojiGridSearch(q) {
  const grid = $('emoji-grid-picker');
  grid.innerHTML = '';
  const all = Object.values(EMOJI_DATA).flat();
  all.forEach(e => {
    const btn = el('button','emoji-pick-btn'); btn.textContent=e;
    btn.addEventListener('click', () => pickEmoji(e));
    grid.appendChild(btn);
  });
}
function pickEmoji(emoji) {
  // update recent
  recentEmojis = [emoji, ...recentEmojis.filter(e=>e!==emoji)].slice(0,20);
  localStorage.setItem('cn_recent_emojis', JSON.stringify(recentEmojis));
  if (STATE.emojiPickerTarget==='chat') {
    const input = $('chat-input');
    const start = input.selectionStart, end = input.selectionEnd;
    input.value = input.value.slice(0,start) + emoji + input.value.slice(end);
    input.selectionStart = input.selectionEnd = start + emoji.length;
    input.focus(); input.dispatchEvent(new Event('input'));
  } else if (STATE.emojiPickerTarget==='react' && STATE.ctxTarget) {
    sendReact(STATE.ctxTarget.msgId, emoji, STATE.ctxTarget.channel, STATE.ctxTarget.toUserId);
  }
  closeModal('modal-emoji');
}

/* ── Eruption ───────────────────────────────────────────────────────── */
const ERUPTION_QUICK_EMOJIS = ['🌋','🔥','💥','⚡','🎉','🎊','✨','💫','🌈','❤️','😂','🤯','👏','🚀','💯','🥳','😍','🤩','💀','👻','🎸','⭐','🌊','🍀','🎯','👑','🦋','🌸','🍕','🎮'];
function openEruptionModal() {
  openModal('modal-eruption');
  // Build emoji grid once
  const grid = $('eruption-emoji-grid');
  if (grid && !grid._built) {
    grid._built = true;
    ERUPTION_QUICK_EMOJIS.forEach(emoji => {
      const btn = el('button','eruption-emoji-btn'); btn.textContent = emoji;
      btn.addEventListener('click', () => {
        $('eruption-emoji-pick').value = emoji;
        $('eruption-emoji-preview').textContent = emoji;
        grid.classList.remove('open');
      });
      grid.appendChild(btn);
    });
  }
  $('eruption-emoji-open-btn').onclick = () => grid.classList.toggle('open');
  $('eruption-text').focus();
}
function playEruption(text, emoji) {
  const overlay = $('eruption-overlay');
  overlay.innerHTML = '';

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  overlay.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const W  = canvas.width;
  const H  = canvas.height;

  // ── Config ────────────────────────────────────────────────────
  const e      = (emoji || '🌋').trim();
  const label  = (text  || '').trim();
  const accent = getComputedStyle(document.documentElement)
    .getPropertyValue('--accent').trim() || '#7c6af5';

  // Convert hex accent to rgb for reuse
  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return {r,g,b};
  }
  const rgb = hexToRgb(accent.startsWith('#') ? accent : '#7c6af5');
  const accentRgb = `${rgb.r},${rgb.g},${rgb.b}`;

  // Launch from bottom-centre
  const LAUNCH_X = W / 2;
  const LAUNCH_Y = H;

  // Burst happens at a random height between 25%–55% from top
  const BURST_Y  = H * (0.25 + Math.random() * 0.30);
  const BURST_X  = LAUNCH_X + (Math.random() - 0.5) * 80;

  // ── Colour palette for particles (vivid, varied) ─────────────
  const COLORS = [
    accent,
    '#ffffff',
    '#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff',
    '#ff922b', '#cc5de8', '#f06595', '#74c0fc',
  ];

  // Text/emoji variants displayed on label particles
  const variants = label
    ? [e, label, `${e}${label}`, e, label, e, label, e, `${e}${label}`, e]
    : [e, e, e, e, e, e, e, e, e, e];

  // ── State ─────────────────────────────────────────────────────
  let phase    = 'rocket';   // 'rocket' → 'burst'
  let startTs  = null;
  let burstTs  = null;
  let raf;

  // ── Rocket (the rising shell before burst) ───────────────────
  const rocket = {
    x: LAUNCH_X, y: LAUNCH_Y,
    trail: [],               // {x,y,alpha} trail points
    done: false,
  };
  // Speed so rocket reaches BURST_Y in ~0.55s
  const rocketSpeed = (LAUNCH_Y - BURST_Y) / 0.55; // px/s

  // ── Particles (created at burst) ────────────────────────────
  const particles = [];

  // ── Ripple rings (created at burst) ─────────────────────────
  const rings = [];

  // ── Text labels that float up slowly after burst ─────────────
  const textLabels = [];

  function createBurst() {
    phase   = 'burst';
    burstTs = null; // will be set on first burst frame

    // 3 expanding ripple rings
    for (let r = 0; r < 3; r++) {
      rings.push({
        x: BURST_X, y: BURST_Y,
        radius: 0,
        maxR:   60 + r * 55,
        alpha:  0.9 - r * 0.2,
        delay:  r * 60,    // ms stagger
        born:   0,
      });
    }

    // ── Burst particles: 3 types ──────────────────────────────

    // Type 1: Fast streaks — radial, all directions, 360°
    for (let i = 0; i < 80; i++) {
      const angle  = (i / 80) * Math.PI * 2;
      const speed  = 180 + Math.random() * 320;
      const color  = COLORS[Math.floor(Math.random() * COLORS.length)];
      particles.push({
        type:  'streak',
        x: BURST_X, y: BURST_Y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        ay: 160,          // gravity
        friction: 0.985,  // air resistance
        size: 2 + Math.random() * 2.5,
        color,
        alpha: 1,
        trail: [],
        maxTrail: 6,
        maxLife: 1200 + Math.random() * 600,
        born: 0,
        delay: Math.random() * 80,
      });
    }

    // Type 2: Glitter sparks — slower, more spread, twinkle
    for (let i = 0; i < 55; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 180;
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      particles.push({
        type:  'glitter',
        x: BURST_X, y: BURST_Y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        ay: 120,
        friction: 0.970,
        size: 1.5 + Math.random() * 3,
        color,
        alpha: 1,
        twinkle: Math.random() * Math.PI * 2, // phase offset
        maxLife: 1600 + Math.random() * 800,
        born: 0,
        delay: 40 + Math.random() * 120,
      });
    }

    // Type 3: Text/emoji labels — fewer, float upward, readable
    const LABEL_COUNT = 14;
    for (let i = 0; i < LABEL_COUNT; i++) {
      const angle = (i / LABEL_COUNT) * Math.PI * 2;
      const speed = 100 + Math.random() * 140;
      const size  = 16 + Math.round((1 - Math.abs(Math.cos(angle))) * 10) + Math.random() * 8;
      textLabels.push({
        x: BURST_X + (Math.random()-0.5)*40,
        y: BURST_Y + (Math.random()-0.5)*40,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30,   // slight upward bias
        ay: 55,                              // very low gravity so text floats
        friction: 0.975,
        size,
        label: variants[i % variants.length],
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        alpha: 0,
        angle: (Math.random()-0.5) * 0.4,
        spin:  (Math.random()-0.5) * 0.8,
        maxLife: 2200 + Math.random() * 600,
        born: 0,
        delay: 60 + Math.random() * 100,   // labels appear just after streaks
      });
    }
  }

  // ── Draw helpers ─────────────────────────────────────────────
  function drawRocketTrail() {
    if (rocket.trail.length < 2) return;
    for (let i = 1; i < rocket.trail.length; i++) {
      const t0 = rocket.trail[i-1];
      const t1 = rocket.trail[i];
      ctx.beginPath();
      ctx.moveTo(t0.x, t0.y);
      ctx.lineTo(t1.x, t1.y);
      ctx.strokeStyle = `rgba(${accentRgb},${t1.alpha * 0.7})`;
      ctx.lineWidth   = 3 * t1.alpha;
      ctx.lineCap     = 'round';
      ctx.stroke();
    }
    // Rocket head — bright dot
    ctx.beginPath();
    ctx.arc(rocket.x, rocket.y, 4, 0, Math.PI*2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    // Small bright halo around head
    ctx.beginPath();
    ctx.arc(rocket.x, rocket.y, 7, 0, Math.PI*2);
    ctx.fillStyle = `rgba(${accentRgb},0.3)`;
    ctx.fill();
  }

  function drawRings(elapsed) {
    for (const ring of rings) {
      const age = elapsed - ring.delay;
      if (age < 0) continue;
      const prog = Math.min(age / 500, 1);         // expand over 500ms
      ring.radius = ring.maxR * easeOut(prog);
      ring.alpha  = (1 - prog) * (ring.alpha);

      if (ring.alpha <= 0) continue;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI*2);
      ctx.strokeStyle = `rgba(${accentRgb},${ring.alpha * 0.8})`;
      ctx.lineWidth   = 2.5 * (1 - prog * 0.7);
      ctx.stroke();
    }
  }

  function drawParticles(elapsed) {
    const dt = 1/60;
    for (const p of particles) {
      const age  = elapsed - p.delay;
      if (age < 0) continue;
      const prog = age / p.maxLife;
      if (prog >= 1) continue;

      p.x  += p.vx * dt;
      p.y  += p.vy * dt;
      p.vy += p.ay * dt;
      p.vx *= p.friction;
      p.vy *= p.friction;

      // Alpha: instant on, fade out last 40%
      p.alpha = prog < 0.60 ? 1 : 1 - (prog - 0.60) / 0.40;
      p.alpha = Math.max(0, p.alpha);

      if (p.type === 'streak') {
        // Add to trail
        p.trail.push({x: p.x, y: p.y});
        if (p.trail.length > p.maxTrail) p.trail.shift();

        // Draw trail
        for (let i = 1; i < p.trail.length; i++) {
          const ta = (i / p.trail.length) * p.alpha;
          ctx.beginPath();
          ctx.moveTo(p.trail[i-1].x, p.trail[i-1].y);
          ctx.lineTo(p.trail[i].x, p.trail[i].y);
          ctx.strokeStyle = p.color;
          ctx.globalAlpha = ta * 0.8;
          ctx.lineWidth   = p.size * (i / p.trail.length);
          ctx.lineCap     = 'round';
          ctx.stroke();
        }
        // Dot at head
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
        ctx.fillStyle   = '#ffffff';
        ctx.globalAlpha = p.alpha;
        ctx.fill();

      } else if (p.type === 'glitter') {
        // Twinkle: sine wave on alpha
        p.twinkle += 0.18;
        const twinkleAlpha = p.alpha * (0.5 + 0.5 * Math.sin(p.twinkle));
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
        ctx.fillStyle   = p.color;
        ctx.globalAlpha = twinkleAlpha;
        ctx.fill();
        // tiny bright centre
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.4, 0, Math.PI*2);
        ctx.fillStyle   = '#ffffff';
        ctx.globalAlpha = twinkleAlpha * 0.9;
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawTextLabels(elapsed) {
    const dt = 1/60;
    for (const p of textLabels) {
      const age  = elapsed - p.delay;
      if (age < 0) continue;
      const prog = age / p.maxLife;
      if (prog >= 1) continue;

      p.x     += p.vx * dt;
      p.y     += p.vy * dt;
      p.vy    += p.ay * dt;
      p.vx    *= p.friction;
      p.vy    *= p.friction;
      p.angle += p.spin * dt;

      // Fade in first 8%, hold, fade out last 25%
      p.alpha = prog < 0.08
        ? prog / 0.08
        : prog < 0.75
          ? 1
          : 1 - (prog - 0.75) / 0.25;
      p.alpha = Math.max(0, p.alpha);

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.font         = `800 ${p.size}px 'Plus Jakarta Sans',sans-serif`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      // Coloured text — readable, no blur
      ctx.fillStyle = p.color;
      ctx.fillText(p.label, 0, 0);
      // White outline for legibility on any bg
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth   = 2;
      ctx.strokeText(p.label, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // ── Easing ───────────────────────────────────────────────────
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  // ── Main loop ────────────────────────────────────────────────
  function frame(now) {
    if (!startTs) startTs = now;
    const elapsed = now - startTs;

    ctx.clearRect(0, 0, W, H);

    if (phase === 'rocket') {
      // Move rocket upward
      const dist  = LAUNCH_Y - BURST_Y;
      const tSec  = elapsed / 1000;
      rocket.y    = LAUNCH_Y - rocketSpeed * tSec;
      rocket.x    = LAUNCH_X + Math.sin(tSec * 6) * 4; // tiny wobble

      // Build trail
      rocket.trail.push({ x: rocket.x, y: rocket.y, alpha: 1 });
      // Fade old trail points
      for (const pt of rocket.trail) pt.alpha *= 0.82;
      if (rocket.trail.length > 18) rocket.trail.shift();

      drawRocketTrail();

      // Reached burst height?
      if (rocket.y <= BURST_Y) {
        createBurst();
      }
    } else {
      // Burst phase
      if (!burstTs) burstTs = now;
      const bElapsed = now - burstTs;

      drawRings(bElapsed);
      drawParticles(bElapsed);
      drawTextLabels(bElapsed);

      // Flash — bright white circle at burst point, frame 0 only
      if (bElapsed < 80) {
        const flashR = 50 * (1 - bElapsed/80);
        ctx.beginPath();
        ctx.arc(BURST_X, BURST_Y, flashR, 0, Math.PI*2);
        ctx.fillStyle = `rgba(255,255,255,${0.9 * (1 - bElapsed/80)})`;
        ctx.fill();
      }

      // Stop when all particles done (~3.2s max)
      if (bElapsed > 3400) {
        cancelAnimationFrame(raf);
        canvas.remove();
        return;
      }
    }

    raf = requestAnimationFrame(frame);
  }

  raf = requestAnimationFrame(frame);

  // Hard safety timeout
  setTimeout(() => { cancelAnimationFrame(raf); canvas.remove(); }, 5000);
}

/* ── Doodle ─────────────────────────────────────────────────────────── */
let doodleCtx = null;
let isDrawing = false;
let lastX = 0, lastY = 0;
const DOODLE_MAX_HISTORY = 20;

function initDoodleCanvas() {
  // Colors
  const colorCont = $('doodle-colors');
  if (colorCont) {
    DOODLE_COLORS.forEach(color => {
      const s = el('div','doodle-color-swatch');
      s.style.background = color;
      s.setAttribute('aria-label',`Color ${color}`);
      if (color === STATE.doodleCurrentColor) s.classList.add('selected');
      s.addEventListener('click', () => {
        $$('.doodle-color-swatch').forEach(x=>x.classList.remove('selected'));
        s.classList.add('selected'); STATE.doodleCurrentColor=color;
      });
      colorCont.appendChild(s);
    });
  }
  const customColor = $('doodle-custom-color');
  if (customColor) {
    customColor.addEventListener('input', () => {
      STATE.doodleCurrentColor = customColor.value;
      $$('.doodle-color-swatch').forEach(x=>x.classList.remove('selected'));
    });
  }
  // Tools
  $$('.doodle-tool').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.doodle-tool').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-pressed','false');});
      btn.classList.add('active'); btn.setAttribute('aria-pressed','true');
      STATE.doodleCurrentTool = btn.dataset.tool;
    });
  });
  // Sizes
  $$('.doodle-size').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.doodle-size').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-pressed','false');});
      btn.classList.add('active'); btn.setAttribute('aria-pressed','true');
      STATE.doodleCurrentSize = parseInt(btn.dataset.size);
    });
  });
}

function openDoodle() {
  const canvas = $('doodle-canvas');
  doodleCtx = canvas.getContext('2d');
  if (!doodleCtx._initialized) {
    doodleCtx.fillStyle = '#ffffff';
    doodleCtx.fillRect(0,0,canvas.width,canvas.height);
    doodleCtx._initialized = true;
  }
  STATE.doodleHistory = [];
  setupDoodleEvents(canvas);
  openModal('modal-doodle');
}

function setupDoodleEvents(canvas) {
  canvas.onmousedown = e => { isDrawing=true; [lastX,lastY]=getCanvasPos(canvas,e.clientX,e.clientY); doodleSaveHistory(); };
  canvas.onmousemove = e => { if (!isDrawing) return; const [x,y]=getCanvasPos(canvas,e.clientX,e.clientY); doodleDraw(lastX,lastY,x,y); [lastX,lastY]=[x,y]; };
  canvas.onmouseup = canvas.onmouseleave = () => { isDrawing=false; };
  canvas.ontouchstart = e => { e.preventDefault(); isDrawing=true; const t=e.touches[0]; [lastX,lastY]=getCanvasPos(canvas,t.clientX,t.clientY); doodleSaveHistory(); };
  canvas.ontouchmove = e => { e.preventDefault(); if(!isDrawing)return; const t=e.touches[0]; const [x,y]=getCanvasPos(canvas,t.clientX,t.clientY); doodleDraw(lastX,lastY,x,y); [lastX,lastY]=[x,y]; };
  canvas.ontouchend = () => { isDrawing=false; };
}

function getCanvasPos(canvas, cx, cy) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return [(cx-rect.left)*scaleX, (cy-rect.top)*scaleY];
}

function doodleDraw(x1,y1,x2,y2) {
  if (!doodleCtx) return;
  const ctx = doodleCtx;
  const tool = STATE.doodleCurrentTool;
  ctx.beginPath();
  ctx.moveTo(x1,y1);
  ctx.lineTo(x2,y2);
  if (tool==='eraser') { ctx.globalCompositeOperation='destination-out'; ctx.lineWidth=20; }
  else { ctx.globalCompositeOperation='source-over'; ctx.lineWidth=STATE.doodleCurrentSize; }
  if (tool==='highlighter') { ctx.globalAlpha=0.3; }
  else { ctx.globalAlpha=1; }
  ctx.strokeStyle = tool==='eraser' ? 'rgba(0,0,0,1)' : STATE.doodleCurrentColor;
  ctx.lineCap='round'; ctx.lineJoin='round';
  ctx.stroke();
  ctx.globalCompositeOperation='source-over'; ctx.globalAlpha=1;
}

function doodleSaveHistory() {
  const canvas = $('doodle-canvas');
  if (!canvas||!doodleCtx) return;
  STATE.doodleHistory.push(doodleCtx.getImageData(0,0,canvas.width,canvas.height));
  if (STATE.doodleHistory.length > DOODLE_MAX_HISTORY) STATE.doodleHistory.shift();
}
function doodleUndo() {
  if (!STATE.doodleHistory.length||!doodleCtx) return;
  const data = STATE.doodleHistory.pop();
  doodleCtx.putImageData(data,0,0);
}
function doodleClear() {
  const canvas = $('doodle-canvas');
  if (!canvas||!doodleCtx) return;
  doodleSaveHistory();
  doodleCtx.clearRect(0,0,canvas.width,canvas.height);
  doodleCtx.fillStyle = STATE.doodleDarkBg ? '#1a1a2e' : '#ffffff';
  doodleCtx.fillRect(0,0,canvas.width,canvas.height);
}
function sendDoodle() {
  const canvas = $('doodle-canvas');
  if (!canvas) return;
  const imageData = canvas.toDataURL('image/png');
  if (STATE.activeChannel === 'public') {
    wsSend({ type:'doodle', imageData, channel:'public' });
  } else {
    const peer = STATE.dmPeers.get(STATE.activeChannel);
    if (peer) wsSend({ type:'doodle', imageData, channel:STATE.activeChannel, toUserId:peer.userId });
  }
  closeModal('modal-doodle');
  doodleCtx._initialized = false;
}

/* ── Lightbox ───────────────────────────────────────────────────────── */
function openLightbox(src) {
  $('lightbox-img').src = src;
  openModal('modal-lightbox');
}

/* ── Mentions ───────────────────────────────────────────────────────── */
function checkMentionTrigger(input) {
  const val = input.value;
  const cursorPos = input.selectionStart;
  const textBefore = val.slice(0, cursorPos);
  const match = textBefore.match(/@(\w*)$/);
  if (match) {
    const query = match[1].toLowerCase();
    const suggestions = [];
    STATE.onlineUsers.forEach(user => {
      if (user.userId !== STATE.userId && user.username.toLowerCase().startsWith(query)) {
        suggestions.push(user);
      }
    });
    if (suggestions.length) {
      showMentionDropdown(suggestions, input);
    } else { hideMentionDropdown(); }
  } else { hideMentionDropdown(); }
}

function showMentionDropdown(users, input) {
  const dd = $('mention-dropdown');
  dd.innerHTML = '';
  STATE.mentionIndex = -1;
  users.slice(0,8).forEach((user, idx) => {
    const item = el('div','mention-item');
    item.dataset.username = user.username;
    const av = el('span','mention-item-avatar'); av.textContent=user.avatar;
    const name = el('span'); name.textContent=user.username;
    item.appendChild(av); item.appendChild(name);
    item.addEventListener('click', () => insertMention(user.username));
    dd.appendChild(item);
  });
  // Position above input
  const rect = input.getBoundingClientRect();
  dd.style.left = rect.left+'px';
  dd.style.top  = (rect.top - dd.offsetHeight - 4)+'px';
  dd.style.display = 'block';
  // re-position after render
  requestAnimationFrame(() => {
    dd.style.top = (rect.top - dd.offsetHeight - 4)+'px';
  });
}
function hideMentionDropdown() { $('mention-dropdown').style.display='none'; STATE.mentionIndex=-1; }
function moveMentionIndex(dir) {
  const items = $$('#mention-dropdown .mention-item');
  if (!items.length) return;
  $$('#mention-dropdown .mention-item').forEach(i=>i.classList.remove('mention-active'));
  STATE.mentionIndex = Math.max(0, Math.min(items.length-1, STATE.mentionIndex+dir));
  items[STATE.mentionIndex].classList.add('mention-active');
}
function insertMention(username) {
  const input = $('chat-input');
  const val = input.value;
  const cursor = input.selectionStart;
  const before = val.slice(0,cursor);
  const after = val.slice(cursor);
  const replaced = before.replace(/@(\w*)$/, `@${username} `);
  input.value = replaced + after;
  input.selectionStart = input.selectionEnd = replaced.length;
  input.focus();
  hideMentionDropdown();
  input.dispatchEvent(new Event('input'));
}

/* ── Global keyboard shortcuts ──────────────────────────────────────── */
function handleGlobalKey(e) {
  // Close modals on Escape
  if (e.key === 'Escape') {
    const openModals = ['modal-profile','modal-doodle','modal-emoji','modal-eruption','modal-lightbox','modal-shortcuts'];
    for (const id of openModals) {
      const m = $(id);
      if (m && m.style.display !== 'none') { closeModal(id); return; }
    }
    hideCtxMenu(); hideQuickReact(); hideMentionDropdown();
    return;
  }
  const active = document.activeElement;
  const inInput = active && (active.tagName==='INPUT'||active.tagName==='TEXTAREA');
  if (e.key === '?' && !inInput) { e.preventDefault(); openModal('modal-shortcuts'); return; }
  if (e.key === '/' && !inInput) { e.preventDefault(); $('chat-input').focus(); return; }
  if ((e.ctrlKey||e.metaKey) && e.key==='k') { e.preventDefault(); STATE.emojiPickerTarget='chat'; openEmojiPicker(); return; }
}

/* ── Message search highlight nav ───────────────────────────────────── */
function scrollToMsg(msgId) {
  const row = document.querySelector(`.msg-row[data-msg-id="${msgId}"]`);
  if (row) {
    row.scrollIntoView({ behavior:'smooth', block:'center' });
    row.classList.add('msg-flash');
    setTimeout(()=>row.classList.remove('msg-flash'),1500);
  }
}

/* ── Home screen setup ──────────────────────────────────────────────── */
function initHome() {
  startTypewriter();
  initParticles();
  $('btn-enter-room').addEventListener('click', () => {
    showScreen('screen-join');
    setTimeout(initJoinUI, 100);
  });
  $('home-theme-toggle').addEventListener('click', () => {
    // simple dark/light cycle
    const lightThemes = ['parchment','rose','candy','sunrise'];
    const isLight = lightThemes.includes(STATE.theme);
    applyTheme(isLight ? 'midnight' : 'parchment');
    $('home-theme-toggle').textContent = isLight ? '🌙' : '☀️';
  });
}

/* ── Back to home ───────────────────────────────────────────────────── */
function initJoinNav() {
  $('btn-back-home').addEventListener('click', () => showScreen('screen-home'));
  $('btn-join-submit').addEventListener('click', submitJoin);
}

/* ── Load saved prefs ───────────────────────────────────────────────── */
function loadPrefs() {
  const theme = localStorage.getItem('cn_theme');
  const fontSize = localStorage.getItem('cn_fontsize');
  const bubble = localStorage.getItem('cn_bubble');
  if (theme) applyTheme(theme);
  if (fontSize) applyFontSize(fontSize);
  if (bubble) applyBubbleStyle(bubble);
}

/* ════════════════════════════════════════════════════════════════════
   BOOT
════════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  loadPrefs();
  renderThemeUIs();
  initHome();
  initJoinNav();
});