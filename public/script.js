// public/script.js - Logic for index.html

// --- DOM Element References ---
const generateButton = document.getElementById('generate-button');
const servingTokenEl = document.getElementById('serving-token');
const waitingCountEl = document.getElementById('waiting-count');
const waitTimeEl = document.getElementById('wait-time'); // Added for wait time display

// NEW: References for the user token display and new button
const clearMyTokenButton = document.getElementById('clear-my-token-button'); 
const yourTokenDisplay = document.getElementById('your-token-display');
const myTokenEl = document.getElementById('my-token');
const queuePositionEl = document.getElementById('queue-position');
const messageBox = document.getElementById('message-box');

// Constants
const SERVICE_TIME_MINUTES = 2; 
const TOKEN_STORAGE_KEY = 'smart_queue_user_token'; // Key for localStorage

let userToken = null; // Store the token issued to this specific user

// --- Utility: Load Token from Storage ---
// This function checks the browser storage, sets the userToken variable,
// and ensures the correct UI elements (Generate vs. Clear button) are visible.
function loadTokenFromStorage() {
    const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (storedToken) {
        userToken = parseInt(storedToken, 10);
        myTokenEl.innerText = userToken;
        yourTokenDisplay.classList.remove('hidden');
        clearMyTokenButton.classList.remove('hidden'); // Show clear button
        generateButton.classList.add('hidden'); // Hide generate button
    } else {
        userToken = null;
        myTokenEl.innerText = '---';
        yourTokenDisplay.classList.add('hidden');
        clearMyTokenButton.classList.add('hidden'); // Hide clear button
        generateButton.classList.remove('hidden'); // Show generate button
        messageBox.classList.add('hidden');
    }
}


// --- 1. Button Click Handler (Generate Token) ---
generateButton.addEventListener('click', async () => {
    // Check if a token is already assigned (via loadTokenFromStorage)
    if (userToken) return; 

    // Disable button to prevent multiple submissions
    generateButton.disabled = true;
    generateButton.innerText = 'Generating...';
    messageBox.classList.add('hidden');
    
    try {
        const response = await fetch('/api/generate', {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();

        if (data.success) {
            const newToken = data.token;
            userToken = newToken; // Store the new token (e.g., 101, 102)
            localStorage.setItem(TOKEN_STORAGE_KEY, userToken); // Persist
            
            // Update the display for the user
            myTokenEl.innerText = userToken;
            yourTokenDisplay.classList.remove('hidden');
            clearMyTokenButton.classList.remove('hidden'); // Show clear button
            generateButton.classList.add('hidden'); // Hide generate button
            
            // Show message box
            messageBox.innerText = `Token ${userToken} generated. Please watch the Live Status Board.`;
            messageBox.classList.remove('hidden');

            console.log(`Token ${userToken} generated successfully.`);
            
            // Force status update immediately after generation
            updateUserStatus(); 
        } else {
            console.error('Failed to generate token:', data.message);
            messageBox.innerText = 'Error: Failed to generate token.';
            messageBox.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Fetch error during token generation:', error);
        messageBox.innerText = 'Connection Error: Could not reach the server.';
        messageBox.classList.remove('hidden');
    } finally {
        generateButton.disabled = false;
        generateButton.innerText = 'GENERATE NEW TOKEN';
    }
});

// --- 2. Button Click Handler (Clear My Token - Now includes Server Call) ---
clearMyTokenButton.addEventListener('click', async () => { // Made async
    if (!userToken) return;

    // 1. Attempt to remove token from server queue first
    try {
        messageBox.innerText = `Attempting to cancel token ${userToken} from the queue...`;
        messageBox.classList.remove('hidden');

        const response = await fetch('/api/cancel-token', {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: userToken }) // Send the token number to the server
        });

        const data = await response.json();

        if (data.success) {
            // Token successfully removed from the server queue
            console.log(`Server response for cancellation: ${data.message}`);
            messageBox.innerText = `Token ${userToken} successfully cancelled.`;
        } else {
            // Token was not found (e.g., already served, or missing)
            console.log(`Server response for cancellation: ${data.message}`);
            messageBox.innerText = `Token ${userToken} not found in queue (likely already served). Clearing locally.`;
        }

    } catch (error) {
        console.error('Fetch error during token cancellation:', error);
        // On server error, we still clear locally for a clean user UI
        messageBox.innerText = 'Connection Error: Could not reach the server to cancel. Clearing token locally.';
    }

    // 2. Clear token from local storage and reset UI regardless of server response
    localStorage.removeItem(TOKEN_STORAGE_KEY); 
    loadTokenFromStorage(); // Reset UI state (will show Generate button)
    console.log('User token cleared from local storage.');
    updateUserStatus(); // Refresh status board
});


// --- 3. Function to update the user status board ---
async function updateUserStatus() {
    try {
        const response = await fetch('/api/status');
        const data = await response.json();
        
        const serving = data.currentlyServing;
        const waiting = data.waitingInQueue;

        servingTokenEl.innerText = serving;
        waitingCountEl.innerText = waiting;

        // Calculate estimated wait time
        const estimatedWaitTime = waiting * SERVICE_TIME_MINUTES; 
        waitTimeEl.innerText = estimatedWaitTime === 0 ? 'Now Serving!' : `${estimatedWaitTime} min`;

        // Check if the user has a token and update their position
        if (userToken) {
            // Check if the user's token is being served or is already passed
            if (serving === userToken) {
                queuePositionEl.innerText = 'It is your turn now! Proceed to the service window.';
                yourTokenDisplay.classList.add('border-green-400'); // Highlight Green
                yourTokenDisplay.classList.remove('border-indigo-600', 'border-red-400');
            } else if (serving !== '---' && parseInt(serving) > parseInt(userToken)) {
                // If the currently served token is greater than the user's token, they missed it.
                queuePositionEl.innerText = 'Your token was called. Please check with an attendant.';
                yourTokenDisplay.classList.add('border-red-400'); // Highlight Red (Missed)
                yourTokenDisplay.classList.remove('border-indigo-600', 'border-green-400');
            }
             else {
                // User is waiting in queue
                queuePositionEl.innerText = `There are approximately ${waiting} tokens ahead of you.`;
                yourTokenDisplay.classList.add('border-indigo-600'); // Highlight Indigo (Waiting)
                yourTokenDisplay.classList.remove('border-green-400', 'border-red-400');
            }
        }

    } catch (error) {
        console.error('Status fetch error for user:', error);
        servingTokenEl.innerText = 'Error';
        waitingCountEl.innerText = 'Error';
        waitTimeEl.innerText = 'Error';
        messageBox.innerText = 'Connection Error: Status update failed.';
        messageBox.classList.remove('hidden');
    }
}

// Initial setup and periodic updates
loadTokenFromStorage(); // Check and load token first
updateUserStatus();
// Check status every 5 seconds
setInterval(updateUserStatus, 5000);

