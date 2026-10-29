// public/admin.js - Logic for admin.html (Now with Authentication)

// --- DOM Element References ---
const loginForm = document.getElementById('login-form');
const passwordInput = document.getElementById('password');
const loginButton = document.getElementById('login-button');
const loginMessage = document.getElementById('login-message');
const loginFormContainer = document.getElementById('login-form-container');
const adminPanel = document.getElementById('admin-panel');

const nextButton = document.getElementById('next-button');
const clearButton = document.getElementById('clear-button'); 
const adminServingEl = document.getElementById('admin-serving');
const adminWaitingEl = document.getElementById('admin-waiting');
const adminNextEl = document.getElementById('admin-next');

const AUTH_TOKEN_KEY = 'admin_session_token';
let authToken = localStorage.getItem(AUTH_TOKEN_KEY); // Retrieve token on load

// --- Utility: Secure Fetch Wrapper ---
// This function ensures all secured API calls include the authorization header
async function secureFetch(endpoint, options = {}) {
    if (!authToken) {
        // If no token, force redirect to login immediately
        displayLoginScreen('No authentication token found. Please log in.');
        throw new Error('No authentication token found.');
    }
    
    const headers = options.headers || {};
    // Add the Bearer token to the Authorization header
    headers['Authorization'] = `Bearer ${authToken}`;
    options.headers = headers;

    const response = await fetch(endpoint, options);

    // If the server returns 401 (Unauthorized), it means the token is invalid/expired
    if (response.status === 401) {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        authToken = null;
        displayLoginScreen('Session expired or unauthorized. Please log in.');
        throw new Error('Unauthorized');
    }

    return response;
}

// --- UI Management ---
function displayLoginScreen(message = '') {
    adminPanel.classList.add('hidden');
    loginFormContainer.classList.remove('hidden');
    loginMessage.innerText = message;
    loginMessage.classList.remove('hidden');
}

function displayAdminPanel() {
    loginFormContainer.classList.add('hidden');
    loginMessage.classList.add('hidden');
    adminPanel.classList.remove('hidden');
    // Start status updates only after successful login
    updateAdminStatus();
    setInterval(updateAdminStatus, 5000);
}


// --- 1. Login Handler ---
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginButton.disabled = true;
    loginButton.innerText = 'Verifying...';
    loginMessage.classList.add('hidden');
    
    const password = passwordInput.value;

    try {
        // Attempt to log in by sending the password to the server
        const response = await fetch('/api/login', {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });

        const data = await response.json();

        if (data.success && data.token) {
            authToken = data.token;
            localStorage.setItem(AUTH_TOKEN_KEY, authToken); // Store the session token locally
            passwordInput.value = ''; // Clear password field for security
            displayAdminPanel();
        } else {
            loginMessage.innerText = data.message || 'Login failed. Check credentials.';
            loginMessage.classList.remove('hidden');
        }
    } catch (error) {
        loginMessage.innerText = 'Connection Error: Could not reach server.';
        loginMessage.classList.remove('hidden');
    } finally {
        loginButton.disabled = false;
        loginButton.innerText = 'ACCESS PANEL';
    }
});


// --- 2. Button Click Handler (Serve Next) ---
nextButton.addEventListener('click', async () => {
    try {
        // Use secureFetch to include the token
        const response = await secureFetch('/api/next-token', {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();

        if (data.success) {
            console.log(`Token Served: ${data.servedToken}`);
            updateAdminStatus();
        } else {
            console.warn('Queue is empty. Cannot serve next token.');
            updateAdminStatus();
        }
    } catch (error) {
        console.error('Action error:', error);
    }
});

// --- 3. Button Click Handler (Clear Queue) ---
clearButton.addEventListener('click', async () => {
    // IMPORTANT: Replacing browser's confirm() with a custom message in console
    console.warn('ADMIN ACTION: Clear All Waiting Tokens initiated. The system will reset and you will be logged out.');

    try {
        // Use secureFetch to include the token
        const response = await secureFetch('/api/reset-queue', {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();

        if (data.success) {
            // Server has successfully reset and cleared its session token
            localStorage.removeItem(AUTH_TOKEN_KEY); // Clear local token
            authToken = null; 
            console.log(`✅ Success: ${data.message}`);
            // Force return to login screen
            displayLoginScreen('Queue reset successful. Please log in again.');
        } else {
            console.error('❌ Error clearing queue.');
            updateAdminStatus();
        }
    } catch (error) {
        console.error('Action error:', error);
    }
});


// --- 4. Function to update the admin status board ---
async function updateAdminStatus() {
    try {
        // Use the secureFetch wrapper
        const response = await secureFetch('/api/admin/status'); 
        const data = await response.json();
        
        adminServingEl.innerText = data.currentlyServing;
        adminWaitingEl.innerText = data.waitingInQueue;
        adminNextEl.innerText = data.nextToken;

        // Visual feedback based on queue state
        if (data.waitingInQueue > 0) {
            nextButton.disabled = false;
            nextButton.innerText = `SERVE NEXT TOKEN (${data.nextToken})`;
            nextButton.classList.remove('bg-gray-500'); 
            nextButton.classList.add('animated-button-green');
        } else {
            nextButton.disabled = true;
            nextButton.innerText = 'QUEUE EMPTY';
            nextButton.classList.add('bg-gray-500');
            nextButton.classList.remove('animated-button-green');
        }

    } catch (error) {
        // The secureFetch wrapper handles the 401 (Unauthorized) status by redirecting to the login screen.
        console.log('Admin status update requires login.');
    }
}

// Initial check on load
// Check if a valid token exists and attempt to restore the session
if (authToken) {
    // If token exists, try to display panel and update status immediately.
    displayAdminPanel(); 
} else {
    displayLoginScreen('Please enter the Admin Password to access the control center.');
}
