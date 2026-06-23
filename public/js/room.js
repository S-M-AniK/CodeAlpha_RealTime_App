const socket = io();

const roomId = window.location.pathname.split('/room/')[1];
const username = sessionStorage.getItem('username') || 'Guest';

document.getElementById('roomLabel').textContent = `Room: ${roomId}`;

document.getElementById('copyLinkBtn').addEventListener('click', () => {
    navigator.clipboard.writeText(window.location.href);
    alert('Room link copied!');
});

let localStream = null;
const peerConnections = {};
const videoGrid = document.getElementById('videoGrid');

const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
    ],
};

function addVideoTile(stream, name, id) {
    const existing = document.getElementById(`tile-${id}`);
    if (existing) existing.remove();

    const tile = document.createElement('div');
    tile.classList.add('video-tile');
    tile.id = `tile-${id}`;

    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    video.playsInline = true;
    if (id === 'local') video.muted = true;

    const nameTag = document.createElement('div');
    nameTag.classList.add('name-tag');
    nameTag.textContent = name;

    tile.appendChild(video);
    tile.appendChild(nameTag);
    videoGrid.appendChild(tile);
}

function removeVideoTile(id) {
    const tile = document.getElementById(`tile-${id}`);
    if (tile) tile.remove();
}

function createPeerConnection(socketId, username) {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
    });

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', {
                to: socketId,
                candidate: event.candidate,
            });
        }
    };

    pc.ontrack = (event) => {
        addVideoTile(event.streams[0], username, socketId);
    };

    peerConnections[socketId] = pc;
    return pc;
}

async function callUser(socketId, username) {
    const pc = createPeerConnection(socketId, username);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('offer', { to: socketId, offer });
}

socket.on('user-joined', async ({ socketId, username }) => {
    console.log(`${username} joined`);
    await callUser(socketId, username);
});

socket.on('offer', async ({ from, offer }) => {
    const pc = createPeerConnection(from, 'User');
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit('answer', { to: from, answer });
});

socket.on('answer', async ({ from, answer }) => {
    const pc = peerConnections[from];
    if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
});

socket.on('ice-candidate', async ({ from, candidate }) => {
    const pc = peerConnections[from];
    if (pc) {
        try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
            console.error('Error adding ICE candidate:', err);
        }
    }
});

socket.on('user-left', ({ socketId }) => {
    removeVideoTile(socketId);
    if (peerConnections[socketId]) {
        peerConnections[socketId].close();
        delete peerConnections[socketId];
    }
});

async function initLocalMedia() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
        });
        addVideoTile(localStream, `${username} (You)`, 'local');
        socket.emit('join-room', { roomId, username });
    } catch (err) {
        console.error('Error accessing camera/mic:', err);
        alert('Could not access camera/microphone. Please allow permissions.');
    }
}

socket.on('connect', () => {
    console.log('Connected with id:', socket.id);
    initLocalMedia();
});

let isMicOn = true;
let isCamOn = true;

document.getElementById('micBtn').addEventListener('click', () => {
    isMicOn = !isMicOn;
    localStream.getAudioTracks().forEach((track) => {
        track.enabled = isMicOn;
    });
    document.getElementById('micBtn').classList.toggle('active', !isMicOn);
    document.getElementById('micBtn').textContent = isMicOn ? '🎤' : '🔇';
});

document.getElementById('camBtn').addEventListener('click', () => {
    isCamOn = !isCamOn;
    localStream.getVideoTracks().forEach((track) => {
        track.enabled = isCamOn;
    });
    document.getElementById('camBtn').classList.toggle('active', !isCamOn);
    document.getElementById('camBtn').textContent = isCamOn ? '📷' : '📵';
});

document.getElementById('leaveBtn').addEventListener('click', () => {
    localStream.getTracks().forEach((track) => track.stop());
    Object.values(peerConnections).forEach((pc) => pc.close());
    window.location.href = '/';
});

let isScreenSharing = false;
let screenStream = null;
let originalVideoTrack = null;

document.getElementById('screenBtn').addEventListener('click', async () => {
    if (!isScreenSharing) {
        try {
            screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            const screenTrack = screenStream.getVideoTracks()[0];

            originalVideoTrack = localStream.getVideoTracks()[0];

            Object.values(peerConnections).forEach((pc) => {
                const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
                if (sender) sender.replaceTrack(screenTrack);
            });

            const localVideoEl = document.querySelector('#tile-local video');
            if (localVideoEl) {
                const newStream = new MediaStream([screenTrack, ...localStream.getAudioTracks()]);
                localVideoEl.srcObject = newStream;
            }

            isScreenSharing = true;
            document.getElementById('screenBtn').classList.add('active');

            screenTrack.onended = () => {
                stopScreenShare();
            };
        } catch (err) {
            console.error('Error sharing screen:', err);
        }
    } else {
        stopScreenShare();
    }
});

function stopScreenShare() {
    if (screenStream) {
        screenStream.getTracks().forEach((track) => track.stop());
    }

    Object.values(peerConnections).forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
        if (sender) sender.replaceTrack(originalVideoTrack);
    });

    const localVideoEl = document.querySelector('#tile-local video');
    if (localVideoEl) {
        localVideoEl.srcObject = localStream;
    }

    isScreenSharing = false;
    document.getElementById('screenBtn').classList.remove('active');
}

document.getElementById('chatBtn').addEventListener('click', () => {
    document.getElementById('chatPanel').classList.toggle('hidden');
});

const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const chatMessages = document.getElementById('chatMessages');

function addChatMessage(sender, message, isOwn = false) {
    const msgEl = document.createElement('div');
    msgEl.classList.add('chat-message');
    if (isOwn) msgEl.classList.add('own');

    const senderEl = document.createElement('span');
    senderEl.classList.add('sender');
    senderEl.textContent = sender;

    const textEl = document.createElement('div');
    textEl.textContent = message;

    msgEl.appendChild(senderEl);
    msgEl.appendChild(textEl);
    chatMessages.appendChild(msgEl);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = chatInput.value.trim();
    if (!message) return;

    socket.emit('chat-message', { roomId, username, message });
    addChatMessage('You', message, true);
    chatInput.value = '';
});

socket.on('chat-message', ({ username: sender, message }) => {
    addChatMessage(sender, message, false);
});

const boardBtn = document.getElementById('boardBtn');
const whiteboardModal = document.getElementById('whiteboardModal');
const closeBoardBtn = document.getElementById('closeBoardBtn');
const clearBoardBtn = document.getElementById('clearBoardBtn');
const canvas = document.getElementById('whiteboardCanvas');
const ctx = canvas.getContext('2d');
const colorPicker = document.getElementById('colorPicker');
const brushSize = document.getElementById('brushSize');

let isDrawing = false;
let lastX = 0;
let lastY = 0;

function resizeCanvas() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
}

boardBtn.addEventListener('click', () => {
    whiteboardModal.classList.remove('hidden');
    resizeCanvas();
});

closeBoardBtn.addEventListener('click', () => {
    whiteboardModal.classList.add('hidden');
});

clearBoardBtn.addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    socket.emit('clear-board', { roomId });
});

function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    if (e.touches) {
        return {
            x: e.touches[0].clientX - rect.left,
            y: e.touches[0].clientY - rect.top,
        };
    }
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
    };
}

function drawLine(x0, y0, x1, y1, color, size) {
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
}

function startDrawing(e) {
    isDrawing = true;
    const pos = getPos(e);
    lastX = pos.x;
    lastY = pos.y;
}

function draw(e) {
    if (!isDrawing) return;
    const pos = getPos(e);
    const color = colorPicker.value;
    const size = brushSize.value;

    drawLine(lastX, lastY, pos.x, pos.y, color, size);

    socket.emit('draw', {
        roomId,
        data: { x0: lastX, y0: lastY, x1: pos.x, y1: pos.y, color, size },
    });

    lastX = pos.x;
    lastY = pos.y;
}

function stopDrawing() {
    isDrawing = false;
}

canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseleave', stopDrawing);

canvas.addEventListener('touchstart', startDrawing);
canvas.addEventListener('touchmove', draw);
canvas.addEventListener('touchend', stopDrawing);

socket.on('draw', (data) => {
    drawLine(data.x0, data.y0, data.x1, data.y1, data.color, data.size);
});

socket.on('clear-board', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
});

window.addEventListener('resize', resizeCanvas);