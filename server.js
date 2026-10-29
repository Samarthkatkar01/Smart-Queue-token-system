const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- CORE QUEUE DATA ---
let tokenCounter = 100; // Tokens start at 101
let currentlyServing = '---';
let queue = []; // Holds tokens: [101, 102, 103, ...]

// --- ADMIN AUTHENTICATION SETUP ---
const ADMIN_PASSWORD = 'adminpass'; // The secret password
let adminSessionToken = null; // Stores the active session token

// Middleware to check for Admin Authentication
function authenticateAdmin(req, res, next) {
    const authHeader = req.headers['authorization'];
    // Check if the Authorization header is present and matches the active session token
    if (authHeader === `Bearer ${adminSessionToken}` && adminSessionToken) {
        next(); // Authentication successful
    } else {
        // Return 401 status if no valid token is provided
        res.status(401).json({ success: false, message: 'Authentication required' });
    }
}
// ----------------------------------------


// --- 1. LOGIN ENDPOINT ---
app.post('/api/login', (req, res) => {
    const { password } = req.body;
    
    if (password === ADMIN_PASSWORD) {
        // Generate a simple, temporary session token
        adminSessionToken = Math.random().toString(36).substring(2, 15);
        console.log(`Admin logged in. New Session Token: ${adminSessionToken}`);
        res.json({ success: true, token: adminSessionToken });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});
// ------------------------------


// --- 2. SECURED ADMIN ENDPOINTS ---

// GET /api/admin/status (Secured Status Endpoint)
app.get('/api/admin/status', authenticateAdmin, (req, res) => {
    // This is the status check used by admin.js
    const nextToken = queue.length > 0 ? queue[0] : '---';
    res.json({
        currentlyServing: currentlyServing,
        waitingInQueue: queue.length,
        nextToken: nextToken
    });
});

// POST /api/next-token (Secured)
app.post('/api/next-token', authenticateAdmin, (req, res) => {
    if (queue.length > 0) {
        currentlyServing = queue.shift();
        res.json({ success: true, servedToken: currentlyServing });
    } else {
        res.json({ success: false, message: 'Queue is empty.' });
    }
});

// POST /api/reset-queue (Secured)
app.post('/api/reset-queue', authenticateAdmin, (req, res) => {
    queue = [];
    currentlyServing = '---';
    tokenCounter = 100;
    adminSessionToken = null; // Log out admin on full reset by clearing the server token
    console.log('Queue has been fully reset and admin session cleared.');
    res.json({ success: true, message: 'Queue reset successfully and admin logged out.' });
});
// ------------------------------------


// --- 3. PUBLIC USER ENDPOINTS (UNCHANGED) ---

// POST /api/generate
app.post('/api/generate', (req, res) => {
    tokenCounter++;
    queue.push(tokenCounter);
    console.log(`Token ${tokenCounter} generated. Queue size: ${queue.length}`);
    res.json({ success: true, token: tokenCounter });
});

// POST /api/cancel-token
app.post('/api/cancel-token', (req, res) => {
    const token = req.body.token;
    const initialLength = queue.length;
    queue = queue.filter(t => t !== token);
    
    if (queue.length < initialLength) {
        console.log(`Token ${token} cancelled by user.`);
        res.json({ success: true, message: `Token ${token} removed from queue.` });
    } else {
        res.json({ success: false, message: `Token ${token} not found in queue.` });
    }
});

// GET /api/status (Public Status Endpoint)
app.get('/api/status', (req, res) => {
    const waitingInQueue = queue.filter(t => t > currentlyServing);
    res.json({
        currentlyServing: currentlyServing,
        waitingInQueue: queue.length
    });
});
// -------------------------------------------


app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
    console.log(`Admin panel: http://localhost:${PORT}/admin.html`);
});
