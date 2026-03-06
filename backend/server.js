// ============================================================
// backend/server.js
// Express REST API + Socket.io Real-Time Chat
// ============================================================
const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const path       = require('path');
const db         = require('./db');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});

const PORT       = 3000;
const JWT_SECRET = 'chat_secret_key_2024';

app.use(cors());
app.use(express.json());

// Serve frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// ============================================================
// MIDDLEWARE – JWT verify
// ============================================================
function auth(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Unauthorized' });
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        res.status(401).json({ success: false, message: 'Invalid token' });
    }
}

// ============================================================
// AUTH
// ============================================================

// POST /register
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username?.trim() || !password)
        return res.json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบ' });
    if (username.trim().length < 3)
        return res.json({ success: false, message: 'Username ต้องมีอย่างน้อย 3 ตัวอักษร' });
    if (password.length < 4)
        return res.json({ success: false, message: 'Password ต้องมีอย่างน้อย 4 ตัวอักษร' });
    try {
        const hash = await bcrypt.hash(password, 10);
        await db.execute('INSERT INTO users (username, password) VALUES (?, ?)', [username.trim(), hash]);
        res.json({ success: true, message: 'สมัครสมาชิกสำเร็จ!' });
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY')
            res.json({ success: false, message: 'Username นี้ถูกใช้งานแล้ว' });
        else
            res.json({ success: false, message: 'เกิดข้อผิดพลาด: ' + e.message });
    }
});

// POST /login
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password)
        return res.json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบ' });
    try {
        const [rows] = await db.execute('SELECT * FROM users WHERE username = ?', [username.trim()]);
        if (!rows.length)
            return res.json({ success: false, message: 'ไม่พบผู้ใช้งาน' });
        const user = rows[0];
        if (!await bcrypt.compare(password, user.password))
            return res.json({ success: false, message: 'รหัสผ่านไม่ถูกต้อง' });
        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ success: true, token, username: user.username, id: user.id });
    } catch (e) {
        res.json({ success: false, message: 'เกิดข้อผิดพลาด' });
    }
});

// ============================================================
// ROOMS
// ============================================================

// GET /rooms
app.get('/rooms', auth, async (req, res) => {
    const [rooms] = await db.execute('SELECT * FROM rooms ORDER BY name ASC');
    res.json({ success: true, rooms });
});

// POST /rooms
app.post('/rooms', auth, async (req, res) => {
    const name = req.body.name?.trim().toLowerCase().replace(/\s+/g, '-').substring(0, 30);
    if (!name) return res.json({ success: false, message: 'กรุณาระบุชื่อห้อง' });
    try {
        await db.execute('INSERT INTO rooms (name, created_by) VALUES (?, ?)', [name, req.user.id]);
        res.json({ success: true, room: name });
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY')
            res.json({ success: false, message: 'ห้องนี้มีอยู่แล้ว' });
        else
            res.json({ success: false, message: 'เกิดข้อผิดพลาด' });
    }
});

// ============================================================
// MESSAGES
// ============================================================

// GET /messages?room=general&limit=50
app.get('/messages', auth, async (req, res) => {
    const room  = req.query.room  || 'general';
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    try {
        const [rows] = await db.execute(
            `SELECT m.id, m.message, m.created_at, u.username, u.id AS user_id
             FROM messages m JOIN users u ON m.user_id = u.id
             WHERE m.room = ?
             ORDER BY m.created_at DESC LIMIT ?`,
            [room, limit]
        );
        res.json({ success: true, messages: rows.reverse() });
    } catch (e) {
        res.json({ success: false, messages: [] });
    }
});

// POST /send-message
app.post('/send-message', auth, async (req, res) => {
    const { message, room = 'general' } = req.body;
    if (!message?.trim()) return res.json({ success: false, message: 'ข้อความว่างเปล่า' });
    try {
        const [result] = await db.execute(
            'INSERT INTO messages (user_id, room, message) VALUES (?, ?, ?)',
            [req.user.id, room, message.trim()]
        );
        res.json({ success: true, id: result.insertId });
    } catch (e) {
        res.json({ success: false, message: 'บันทึกไม่สำเร็จ' });
    }
});

// ============================================================
// SOCKET.IO
// ============================================================
const onlineUsers = new Map(); // socketId → { username, userId, room }

io.on('connection', (socket) => {

    socket.on('join_room', ({ room, username, userId }) => {
        const prev = onlineUsers.get(socket.id);
        if (prev?.room) {
            socket.leave(prev.room);
            socket.to(prev.room).emit('user_left', { username: prev.username });
            broadcastOnline(prev.room);
        }
        socket.join(room);
        onlineUsers.set(socket.id, { username, userId, room });
        socket.to(room).emit('user_joined', { username });
        broadcastOnline(room);
    });

    socket.on('send_message', async ({ message, room, token }) => {
        try {
            const user = jwt.verify(token, JWT_SECRET);
            await db.execute(
                'INSERT INTO messages (user_id, room, message) VALUES (?, ?, ?)',
                [user.id, room, message.trim()]
            );
            io.to(room).emit('receive_message', {
                username  : user.username,
                userId    : user.id,
                message   : message.trim(),
                room,
                created_at: new Date().toISOString(),
            });
        } catch (e) {
            socket.emit('error_msg', 'ส่งข้อความไม่สำเร็จ');
        }
    });

    socket.on('typing', ({ room, username, isTyping }) => {
        socket.to(room).emit('user_typing', { username, isTyping });
    });

    socket.on('disconnect', () => {
        const user = onlineUsers.get(socket.id);
        if (user) {
            socket.to(user.room).emit('user_left', { username: user.username });
            onlineUsers.delete(socket.id);
            broadcastOnline(user.room);
        }
    });
});

function broadcastOnline(room) {
    const users = [...onlineUsers.values()]
        .filter(u => u.room === room)
        .map(u => u.username);
    io.to(room).emit('online_users', users);
}

// ============================================================
// START
// ============================================================
server.listen(PORT, () => {
    console.log(`\n🚀  Chat server → http://localhost:${PORT}\n`);
});
