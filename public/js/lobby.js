const token = localStorage.getItem('token');
const savedUsername = localStorage.getItem('username');

if (!token) {
    window.location.href = '/';
}

document.getElementById('welcomeName').textContent = savedUsername || '';

const usernameInput = document.getElementById('usernameInput');
const roomInput = document.getElementById('roomInput');
const joinBtn = document.getElementById('joinBtn');
const createBtn = document.getElementById('createBtn');
const logoutBtn = document.getElementById('logoutBtn');

usernameInput.value = savedUsername || '';

function generateRoomId() {
    return Math.random().toString(36).substring(2, 8);
}

createBtn.addEventListener('click', () => {
    roomInput.value = generateRoomId();
});

joinBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    const room = roomInput.value.trim();

    if (!username) {
        alert('Please enter your name');
        return;
    }
    if (!room) {
        alert('Please enter or generate a room ID');
        return;
    }

    sessionStorage.setItem('username', username);
    window.location.href = `/room/${room}`;
});

logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    window.location.href = '/';
});