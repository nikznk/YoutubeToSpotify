//popup.js file
// Spotify configuration
const CLIENT_ID = '34831eac922f4f8a93d28c81c559877c';
const REDIRECT_URI = chrome.identity.getRedirectURL();
const SCOPES = [
    'playlist-modify-public',
    'playlist-modify-private',
    'playlist-read-private',
    'user-read-private'
].join(' ');

// State management
let state = {
    isAuthenticated: false,
    currentSong: null,
    isLoading: false,
    error: null
};

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuthStatus();
    renderApp();
});

// Check if user is already authenticated
async function checkAuthStatus() {
    const token = await chrome.storage.local.get('spotify_token');
    state.isAuthenticated = !!token.spotify_token;

    if (state.isAuthenticated) {
        // Verify token is still valid
        try {
            const response = await fetch('https://api.spotify.com/v1/me', {
                headers: {
                    'Authorization': `Bearer ${token.spotify_token}`
                }
            });
            if (!response.ok) {
                state.isAuthenticated = false;
                chrome.storage.local.remove('spotify_token');
            }
        } catch (error) {
            state.isAuthenticated = false;
            chrome.storage.local.remove('spotify_token');
        }
    }
}

// Spotify authentication
async function authenticateWithSpotify() {
    state.isLoading = true;
    state.error = null;
    renderApp();

    const authUrl = `https://accounts.spotify.com/authorize?client_id=${CLIENT_ID}&response_type=token&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES)}`;

    try {
        const redirectUrl = await chrome.identity.launchWebAuthFlow({
            url: authUrl,
            interactive: true
        });

        // Extract token from redirect URL
        const hash = redirectUrl.substring(redirectUrl.indexOf('#') + 1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');

        if (accessToken) {
            await chrome.storage.local.set({ 'spotify_token': accessToken });
            state.isAuthenticated = true;
            state.error = null;
        } else {
            state.error = 'Failed to get access token';
        }
    } catch (error) {
        console.error('Authentication failed:', error);
        state.error = 'Authentication failed';
    }

    state.isLoading = false;
    renderApp();
}

// UI Rendering
function renderApp() {
    const app = document.getElementById('app');

    if (state.isLoading) {
        app.innerHTML = `
      <div class="flex flex-col items-center justify-center min-h-[300px]">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
      </div>
    `;
        return;
    }

    if (state.error) {
        app.innerHTML = `
      <div class="p-4 text-red-500">
        ${state.error}
        <button id="retry-button" class="mt-2 px-4 py-2 bg-green-500 text-white rounded">
          Retry
        </button>
      </div>
    `;
        document.getElementById('retry-button').addEventListener('click', authenticateWithSpotify);
        return;
    }

    if (!state.isAuthenticated) {
        app.innerHTML = `
      <div class="p-4 flex flex-col items-center gap-4">
        <h2 class="text-xl font-bold">YouTube to Spotify</h2>
        <button id="login-button" class="w-full py-2 px-4 bg-green-500 text-white rounded-full hover:bg-green-600">
          Connect to Spotify
        </button>
      </div>
    `;
        document.getElementById('login-button').addEventListener('click', authenticateWithSpotify);
    } else {
        app.innerHTML = `
      <div class="p-4">
        <h2 class="text-xl font-bold mb-4">Connected to Spotify</h2>
        <div id="current-song" class="mb-4"></div>
        <div id="playlists" class="mt-4"></div>
      </div>
    `;
        getCurrentVideo();
    }
}

// Get current YouTube video info
// Get current YouTube video info
// Get current YouTube video info
async function getCurrentVideo() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) {
            throw new Error('No active tab found');
        }

        if (!tab.url?.includes('youtube.com/watch')) {
            document.getElementById('current-song').innerHTML = `
                <p class="text-sm text-gray-600">Please open a YouTube video</p>
            `;
            return;
        }

        // Inject content script if not already injected
        try {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    // Check if content script is already injected
                    return window.hasOwnProperty('youtubeToSpotifyExtensionLoaded');
                }
            });
        } catch (error) {
            console.error('Error checking content script:', error);
        }

        const response = await chrome.tabs.sendMessage(tab.id, {
            type: 'GET_VIDEO_INFO'
        });

        if (response && response.title) {
            document.getElementById('current-song').innerHTML = `
                <div class="p-3 bg-gray-100 rounded">
                    <h3 class="font-medium">Current Video</h3>
                    <p class="text-sm text-gray-600">${response.title}</p>
                </div>
            `;
        } else {
            throw new Error('Could not get video information');
        }
    } catch (error) {
        console.error('Error getting video info:', error);
        document.getElementById('current-song').innerHTML = `
            <div class="p-3 bg-red-100 rounded">
                <p class="text-sm text-red-600">Error: Could not get video information. Please refresh the page and try again.</p>
            </div>
        `;
    }
}