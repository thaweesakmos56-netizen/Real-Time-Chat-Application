/**
 * NexChat – chat.js
 * Auth, Socket.io, Rooms, Messages, Typing indicator
 */

const API      = 'http://localhost:3000';
const AV_COLORS= ['#f59e0b','#60a5fa','#34d399','#f87171','#a78bfa','#fb923c','#38bdf8','#4ade80'];
const AV_CLS   = ['av0','av1','av2','av3','av4','av5','av6','av7'];

let socket      = null;
let token       = localStorage.getItem('nc_token')    || '';
let curUser     = localStorage.getItem('nc_user')     || '';
let curUserId   = localStorage.getItem('nc_uid')      || '';
let currentRoom = 'general';
let typingTimer = null;
let isTyping    = false;

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    token && curUser ? bootChat() : showPage('login-page');
});

// ============================================================
// PAGE ROUTER
// ============================================================
function showPage(id) {
    ['login-page','register-page','chat-app'].forEach(p => {
        const el = document.getElementById(p);
        if (!el) return;
        el.classList.remove('show');
        el.style.display = 'none';
    });
    const target = document.getElementById(id);
    if (!target) return;
    target.style.display = (id === 'chat-app') ? 'flex' : 'flex';
    requestAnimationFrame(() => target.classList.add('show'));
}

// ============================================================
// AUTH
// ============================================================
async function doRegister() {
    hideAlert('reg-alert');
    const user = val('reg-user'), pass = val('reg-pass'), pass2 = val('reg-pass2');
    if (!user || !pass)        return alert2('reg-alert','กรุณากรอกข้อมูลให้ครบ','err');
    if (user.length < 3)       return alert2('reg-alert','Username ต้องมีอย่างน้อย 3 ตัว','err');
    if (pass.length < 4)       return alert2('reg-alert','Password ต้องมีอย่างน้อย 4 ตัว','err');
    if (pass !== pass2)        return alert2('reg-alert','Password ไม่ตรงกัน','err');

    const r = await post('/register', { username: user, password: pass });
    if (r.success) {
        alert2('reg-alert', '✅ สมัครสมาชิกสำเร็จ! กรุณาเข้าสู่ระบบ', 'ok');
        setTimeout(() => showPage('login-page'), 1600);
    } else {
        alert2('reg-alert', r.message, 'err');
    }
}

async function doLogin() {
    hideAlert('login-alert');
    const user = val('login-user'), pass = val('login-pass');
    if (!user || !pass) return alert2('login-alert','กรุณากรอกข้อมูลให้ครบ','err');

    const r = await post('/login', { username: user, password: pass });
    if (r.success) {
        token = r.token; curUser = r.username; curUserId = r.id;
        localStorage.setItem('nc_token', token);
        localStorage.setItem('nc_user',  curUser);
        localStorage.setItem('nc_uid',   curUserId);
        bootChat();
    } else {
        alert2('login-alert', r.message, 'err');
    }
}

function doLogout() {
    socket?.disconnect();
    ['nc_token','nc_user','nc_uid'].forEach(k => localStorage.removeItem(k));
    token = curUser = curUserId = '';
    showPage('login-page');
}

function bootChat() {
    showPage('chat-app');
    setText('tb-username', curUser);
    setAvEl(document.getElementById('tb-avatar'), curUser);
    connectSocket();
    loadRooms().then(() => joinRoom('general'));
}

// ============================================================
// SOCKET
// ============================================================
function connectSocket() {
    socket = io(API, { transports: ['websocket','polling'] });

    socket.on('connect', () => {
        socket.emit('join_room', { room: currentRoom, username: curUser, userId: curUserId });
    });

    socket.on('receive_message', msg => {
        appendMsg(msg);
        scrollBottom();
    });

    socket.on('online_users', users => renderOnline(users));

    socket.on('user_joined', ({ username }) => appendSys(`${username} เข้าร่วมห้อง 👋`));
    socket.on('user_left',   ({ username }) => appendSys(`${username} ออกจากห้อง`));

    socket.on('user_typing', ({ username, isTyping: t }) => {
        const el = document.getElementById('typing-bar');
        if (!el) return;
        el.innerHTML = t
            ? `<span>${username} กำลังพิมพ์</span><span class="t-dots"><i></i><i></i><i></i></span>`
            : '';
    });

    socket.on('error_msg', m => toast(m, 'err'));
}

// ============================================================
// ROOMS
// ============================================================
async function loadRooms() {
    const r = await get('/rooms');
    if (!r.success) return;
    const list = document.getElementById('room-list');
    list.innerHTML = '';
    r.rooms.forEach(room => {
        const d = document.createElement('div');
        d.className = 'room-item' + (room.name === currentRoom ? ' active' : '');
        d.innerHTML = `<span class="room-hash">#</span> ${esc(room.name)}`;
        d.onclick   = () => joinRoom(room.name);
        list.appendChild(d);
    });
}

function joinRoom(room) {
    currentRoom = room;
    setText('current-room', room);
    setAttr('msg-input', 'placeholder', `ส่งข้อความใน #${room}`);
    socket?.emit('join_room', { room, username: curUser, userId: curUserId });
    document.querySelectorAll('.room-item').forEach(el => {
        el.classList.toggle('active', el.textContent.trim().replace('# ','') === room);
    });
    loadHistory(room);
}

async function createRoom() {
    const input = document.getElementById('new-room');
    const name  = input.value.trim();
    if (!name) return;
    const r = await post('/rooms', { name }, true);
    if (r.success) {
        input.value = '';
        await loadRooms();
        joinRoom(r.room);
        toast(`สร้างห้อง #${r.room} สำเร็จ ✅`, 'ok');
    } else {
        toast(r.message, 'err');
    }
}

// ============================================================
// MESSAGES
// ============================================================
async function loadHistory(room) {
    const container = document.getElementById('messages');
    container.innerHTML = '<div class="msg-sys">⏳ กำลังโหลด...</div>';

    const r = await get(`/messages?room=${encodeURIComponent(room)}&limit=50`);
    container.innerHTML = '';

    if (!r.success || !r.messages.length) {
        container.innerHTML = '<div class="msg-sys">ยังไม่มีข้อความ เริ่มสนทนาได้เลย! 👋</div>';
        return;
    }

    let lastDate = '';
    r.messages.forEach(m => {
        const d = new Date(m.created_at).toLocaleDateString('th-TH');
        if (d !== lastDate) { appendDateSep(d); lastDate = d; }
        appendMsg({ username: m.username, userId: m.user_id, message: m.message, created_at: m.created_at });
    });
    scrollBottom();
}

function appendMsg({ username, userId, message, created_at }) {
    const me   = username === curUser;
    const time = new Date(created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    const ci   = hashIdx(username);

    const g    = document.createElement('div');
    g.className= 'msg-group' + (me ? ' me' : '');
    g.innerHTML= `
        <div class="msg-head">
            <div class="msg-av ${AV_CLS[ci]}">${username.charAt(0).toUpperCase()}</div>
            <span class="msg-user" style="color:${AV_COLORS[ci]}">${esc(username)}</span>
            <span class="msg-time">${time}</span>
        </div>
        <div class="msg-text">${esc(message)}</div>`;
    document.getElementById('messages').appendChild(g);
}

function appendSys(text) {
    const d = document.createElement('div');
    d.className = 'msg-sys'; d.textContent = text;
    document.getElementById('messages').appendChild(d);
    scrollBottom();
}

function appendDateSep(date) {
    const d = document.createElement('div');
    d.className = 'date-sep'; d.textContent = date;
    document.getElementById('messages').appendChild(d);
}

// ============================================================
// SEND + TYPING
// ============================================================
function sendMessage() {
    const input = document.getElementById('msg-input');
    const msg   = input.value.trim();
    if (!msg || !socket?.connected) return;
    socket.emit('send_message', { message: msg, room: currentRoom, token });
    input.value = '';
    stopTyping();
}

function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); return; }
    if (!isTyping) {
        isTyping = true;
        socket?.emit('typing', { room: currentRoom, username: curUser, isTyping: true });
    }
    clearTimeout(typingTimer);
    typingTimer = setTimeout(stopTyping, 1500);
}

function stopTyping() {
    if (!isTyping) return;
    isTyping = false;
    socket?.emit('typing', { room: currentRoom, username: curUser, isTyping: false });
}

// ============================================================
// ONLINE USERS
// ============================================================
function renderOnline(users) {
    const list = document.getElementById('online-list');
    const cnt  = document.getElementById('online-count');
    if (!list) return;
    list.innerHTML = users.map(u => `
        <div class="online-item">
            <div class="o-dot"></div>
            <span>${esc(u)}</span>
        </div>`).join('');
    if (cnt) cnt.textContent = users.length;
}

// ============================================================
// HELPERS
// ============================================================
function hashIdx(s) {
    let h = 0;
    for (const c of s) h = (h * 31 + c.charCodeAt(0)) & 0xffffff;
    return Math.abs(h) % AV_COLORS.length;
}
function setAvEl(el, name) {
    if (!el) return;
    const i = hashIdx(name);
    el.className = `msg-av ${AV_CLS[i]}`;
    el.style.cssText = 'width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.72rem;font-weight:700;color:#090c14';
    el.textContent = name.charAt(0).toUpperCase();
}
function val(id) { return document.getElementById(id)?.value.trim() || ''; }
function setText(id, t) { const e = document.getElementById(id); if (e) e.textContent = t; }
function setAttr(id, a, v) { const e = document.getElementById(id); if (e) e.setAttribute(a, v); }
function scrollBottom() { const e = document.getElementById('messages'); if (e) e.scrollTop = e.scrollHeight; }
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function alert2(id, msg, type) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.className   = `alert alert-${type} show`;
}
function hideAlert(id) {
    const el = document.getElementById(id);
    if (el) { el.classList.remove('show'); el.textContent = ''; }
}

function toast(msg, type = 'inf') {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.className   = `toast ${type} show`;
    setTimeout(() => t.classList.remove('show'), 3000);
}

async function post(path, body, auth = false) {
    try {
        const h = { 'Content-Type': 'application/json' };
        if (auth) h['Authorization'] = `Bearer ${token}`;
        const r = await fetch(API + path, { method: 'POST', headers: h, body: JSON.stringify(body) });
        return await r.json();
    } catch { return { success: false, message: 'ไม่สามารถเชื่อมต่อ server ได้' }; }
}
async function get(path) {
    try {
        const r = await fetch(API + path, { headers: { Authorization: `Bearer ${token}` } });
        return await r.json();
    } catch { return { success: false }; }
}

// Keyboard shortcuts
document.addEventListener('keydown', e => {
    if (e.target.id === 'new-room'    && e.key === 'Enter') createRoom();
    if (e.target.id === 'login-user'  && e.key === 'Enter') doLogin();
    if (e.target.id === 'login-pass'  && e.key === 'Enter') doLogin();
    if (e.target.id === 'reg-pass2'   && e.key === 'Enter') doRegister();
});
