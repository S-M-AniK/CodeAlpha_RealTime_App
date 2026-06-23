const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'codealpha-secret-key-2026';
const users = {};

app.use(express.json());
app.use(session({
    secret: JWT_SECRET,
    resave: false,
    saveUninitialized: false,
}));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
});

app.get('/lobby', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'lobby.html'));
});

app.get('/room/:roomId', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'room.html'));
});

app.use(express.static(path.join(__dirname, '..', 'public')));

app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }
    if (users[username]) {
        return res.status(400).json({ error: 'Username already taken' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    users[username] = { username, password: hashedPassword };

    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, username });
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    const user = users[username];
    if (!user) {
        return res.status(400).json({ error: 'Invalid username or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        return res.status(400).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, username });
});

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join-room', ({ roomId, username }) => {
        socket.join(roomId);
        socket.roomId = roomId;
        socket.username = username;

        socket.to(roomId).emit('user-joined', {
            socketId: socket.id,
            username,
        });

        console.log(`${username} joined room ${roomId}`);
    });

    socket.on('offer', ({ to, offer }) => {
        io.to(to).emit('offer', { from: socket.id, offer });
    });

    socket.on('answer', ({ to, answer }) => {
        io.to(to).emit('answer', { from: socket.id, answer });
    });

    socket.on('ice-candidate', ({ to, candidate }) => {
        io.to(to).emit('ice-candidate', { from: socket.id, candidate });
    });

    socket.on('chat-message', ({ roomId, username, message }) => {
        io.to(roomId).emit('chat-message', { username, message });
    });

    socket.on('draw', ({ roomId, data }) => {
        socket.to(roomId).emit('draw', data);
    });

    socket.on('clear-board', ({ roomId }) => {
        socket.to(roomId).emit('clear-board');
    });

    socket.on('disconnect', () => {
        if (socket.roomId) {
            socket.to(socket.roomId).emit('user-left', {
                socketId: socket.id,
                username: socket.username,
            });
        }
        console.log('User disconnected:', socket.id);
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});