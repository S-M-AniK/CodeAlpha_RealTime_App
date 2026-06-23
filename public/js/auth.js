let isLoginMode = true;

const formTitle = document.getElementById('formTitle');
const submitBtn = document.getElementById('submitBtn');
const toggleModeBtn = document.getElementById('toggleModeBtn');
const usernameInput = document.getElementById('usernameInput');
const passwordInput = document.getElementById('passwordInput');
const errorMsg = document.getElementById('errorMsg');

toggleModeBtn.addEventListener('click', () => {
    isLoginMode = !isLoginMode;
    if (isLoginMode) {
        formTitle.textContent = 'Login to your account';
        submitBtn.textContent = 'Login';
        toggleModeBtn.textContent = "Don't have an account? Register";
    } else {
        formTitle.textContent = 'Create a new account';
        submitBtn.textContent = 'Register';
        toggleModeBtn.textContent = 'Already have an account? Login';
    }
    errorMsg.style.display = 'none';
});

submitBtn.addEventListener('click', async () => {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) {
        showError('Please fill in all fields');
        return;
    }

    const endpoint = isLoginMode ? '/api/login' : '/api/register';

    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });

        const data = await res.json();

        if (!res.ok) {
            showError(data.error || 'Something went wrong');
            return;
        }

        localStorage.setItem('token', data.token);
        localStorage.setItem('username', data.username);
        window.location.href = '/lobby';
    } catch (err) {
        showError('Server error. Please try again.');
    }
});

function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.style.display = 'block';
}