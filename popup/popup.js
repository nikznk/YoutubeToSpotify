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
    try {
        state.isLoading = true;
        renderApp();
        await checkAuthStatus();
    } catch (error) {
        console.error('Initialization error:', error);
        state.error = 'Failed to initialize: ' + error.message;
    } finally {
        state.isLoading = false;
        renderApp();
    }
});

// Check if user is already authenticated
async function checkAuthStatus() {
    try {
        const token = await chrome.storage.local.get('spotify_token');
        state.isAuthenticated = !!token.spotify_token;

        if (state.isAuthenticated) {
            // Add timeout to prevent hanging
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Request timeout')), 5000)
            );

            const verifyPromise = fetch('https://api.spotify.com/v1/me', {
                headers: {
                    'Authorization': `Bearer ${token.spotify_token}`
                }
            });

            const response = await Promise.race([verifyPromise, timeoutPromise]);

            if (!response.ok) {
                throw new Error('Token validation failed');
            }
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        state.isAuthenticated = false;
        await chrome.storage.local.remove('spotify_token');
        state.error = 'Authentication expired. Please login again.';
    }
}

// Spotify authentication
async function authenticateWithSpotify() {
    state.isLoading = true;
    state.error = null;
    renderApp();

    try {
        const authUrl = `https://accounts.spotify.com/authorize?client_id=${CLIENT_ID}&response_type=token&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES)}`;

        const redirectUrl = await chrome.identity.launchWebAuthFlow({
            url: authUrl,
            interactive: true
        });

        if (!redirectUrl) {
            throw new Error('Authentication window was closed');
        }

        const hash = redirectUrl.substring(redirectUrl.indexOf('#') + 1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');

        if (!accessToken) {
            throw new Error('No access token received');
        }

        await chrome.storage.local.set({ 'spotify_token': accessToken });
        state.isAuthenticated = true;
        state.error = null;

    } catch (error) {
        console.error('Authentication failed:', error);
        state.error = `Authentication failed: ${error.message}`;
        state.isAuthenticated = false;
    } finally {
        state.isLoading = false;
        renderApp();
    }
}

// UI Rendering
// UI Rendering
function renderApp() {
    const app = document.getElementById('app');

    if (state.isLoading) {
        app.innerHTML = `
            <div class="flex flex-col items-center justify-center min-h-[300px]">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mb-4"></div>
                <div class="text-sm text-gray-600">Loading...</div>
            </div>
        `;
        return;
    }

    if (state.error) {
        app.innerHTML = `
            <div class="p-4">
                <div class="text-red-500 mb-4">${state.error}</div>
                <button id="retry-button" class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
                    Try Again
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
                <div id="playlists" class="mt-4">
                    <div class="p-3 bg-gray-100 rounded">
                        <p class="text-sm text-gray-600">Loading playlists...</p>
                    </div>
                </div>
            </div>
        `;
        getCurrentVideo().then(() => {
            loadPlaylists().catch(error => {
                console.error('Error loading playlists:', error);
                const playlistsContainer = document.getElementById('playlists');
                if (playlistsContainer) {
                    playlistsContainer.innerHTML = `
                        <div class="p-3 bg-red-100 rounded">
                            <p class="text-sm text-red-600">Error loading playlists. Please try again.</p>
                        </div>
                    `;
                }
            });
        });
    }
}
async function getCurrentVideo() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) {
            throw new Error('No active tab found');
        }

        if (!tab.url?.includes('youtube.com/watch')) {
            document.getElementById('current-song').innerHTML = `
                <div class="p-3 bg-gray-100 rounded">
                    <p class="text-sm text-gray-600">Please open a YouTube video</p>
                </div>
            `;
            return;
        }

        // Inject content script if not already injected
        try {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    return window.hasOwnProperty('youtubeToSpotifyExtensionLoaded');
                }
            });

            // Get video information from content script
            const response = await chrome.tabs.sendMessage(tab.id, {
                type: 'GET_VIDEO_INFO'
            });

            if (response && response.title) {
                // Show video info and playlists
                document.getElementById('current-song').innerHTML = `
                    <div class="p-3 bg-gray-100 rounded">
                        <h3 class="font-medium">Current Video</h3>
                        <p class="text-sm text-gray-600">${response.title}</p>
                    </div>
                `;

                // Load playlists
                loadPlaylists();
            } else {
                throw new Error('Could not get video information');
            }
        } catch (error) {
            console.error('Content script error:', error);
            document.getElementById('current-song').innerHTML = `
                <div class="p-3 bg-red-100 rounded">
                    <p class="text-sm text-red-600">Error: Please refresh the YouTube page and try again</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error getting video info:', error);
        document.getElementById('current-song').innerHTML = `
            <div class="p-3 bg-red-100 rounded">
                <p class="text-sm text-red-600">Error: ${error.message}</p>
            </div>
        `;
    }
}

// Load Spotify playlists
async function loadPlaylists() {
    const playlistsContainer = document.getElementById('playlists');

    try {
        // Show loading state
        playlistsContainer.innerHTML = `
            <div class="p-3 bg-gray-100 rounded">
                <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-green-500 inline-block mr-2"></div>
                Loading your playlists...
            </div>
        `;

        // Get the Spotify token
        const token = await chrome.storage.local.get('spotify_token');
        if (!token.spotify_token) {
            throw new Error('Spotify authentication required');
        }

        // Fetch playlists directly
        const response = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', {
            headers: {
                'Authorization': `Bearer ${token.spotify_token}`
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                // Token expired
                await chrome.storage.local.remove('spotify_token');
                throw new Error('Session expired. Please reconnect to Spotify');
            }
            throw new Error('Failed to load playlists');
        }

        const data = await response.json();
        console.log('Spotify API Response:', data); // Debug log

        if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
            playlistsContainer.innerHTML = `
                <div class="p-3 bg-gray-100 rounded">
                    <p class="text-sm text-gray-600">No playlists found. Create a playlist on Spotify first!</p>
                </div>
            `;
            return;
        }

        // Filter valid playlists
        const validPlaylists = data.items.filter(playlist =>
            playlist &&
            playlist.id &&
            playlist.name &&
            typeof playlist.id === 'string'
        );

        if (validPlaylists.length === 0) {
            throw new Error('No valid playlists found');
        }

        const playlistsHTML = validPlaylists.map(playlist => {
            const imageUrl = playlist.images?.[0]?.url;
            const trackCount = playlist.tracks?.total ?? '0';

            return `
        <button 
            class="w-full text-left p-3 hover:bg-gray-800 rounded-lg mb-2 transition-colors duration-200 group"
            data-playlist-id="${playlist.id}"
        >
            <div class="flex items-center space-x-3">
                <div class="flex-shrink-0 w-12 h-12 bg-gray-800 rounded overflow-hidden">
                    ${imageUrl
                    ? `<img src="${imageUrl}" class="w-full h-full object-cover group-hover:opacity-80 transition-opacity" alt=""
                             onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22><rect width=%2224%22 height=%2224%22 fill=%22%23333%22/></svg>'">`
                    : '<div class="w-full h-full bg-gray-700"></div>'
                }
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-white group-hover:text-green-400 truncate transition-colors">${playlist.name}</p>
                    <p class="text-xs text-gray-400">${trackCount} tracks</p>
                </div>
            </div>
        </button>
    `;
        }).join('');

        playlistsContainer.innerHTML = `
            <div class="mb-3">
                <input type="text" 
                    id="playlist-search" 
                    placeholder="Search your playlists..." 
                    class="w-full p-2 border rounded text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
            </div>
            <div class="max-h-[400px] overflow-y-auto pr-1">
                ${playlistsHTML}
            </div>
        `;

        // Add search functionality
        const searchInput = document.getElementById('playlist-search');
        const allButtons = playlistsContainer.querySelectorAll('button');

        searchInput?.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            allButtons.forEach(button => {
                const playlistName = button.querySelector('.font-medium')?.textContent.toLowerCase() || '';
                button.style.display = playlistName.includes(searchTerm) ? 'block' : 'none';
            });
        });

        // Add click handlers
        allButtons.forEach(button => {
            button.addEventListener('click', async () => {
                try {
                    const playlistId = button.dataset.playlistId;
                    if (!playlistId) throw new Error('Invalid playlist');

                    // Save original button content
                    const originalContent = button.innerHTML;

                    // Show loading state
                    button.innerHTML = `
                        <div class="flex items-center justify-center py-1">
                            <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-green-500 mr-2"></div>
                            <span class="text-sm">Adding to playlist...</span>
                        </div>
                    `;
                    button.disabled = true;

                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (!tab?.id) throw new Error('No active tab found');

                    const videoInfo = await chrome.tabs.sendMessage(tab.id, { type: 'GET_VIDEO_INFO' });
                    if (!videoInfo?.title) throw new Error('Could not get video information');

                    const response = await chrome.runtime.sendMessage({
                        type: 'ADD_TO_PLAYLIST',
                        data: { playlistId, videoInfo }
                    });

                    if (!response?.success) {
                        throw new Error(response?.message || 'Failed to add to playlist');
                    }

                    button.innerHTML = `
                        <div class="flex items-center justify-center py-1 text-green-500">
                            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                            </svg>
                            <span class="text-sm">Added successfully!</span>
                        </div>
                    `;

                    setTimeout(() => {
                        button.innerHTML = originalContent;
                        button.disabled = false;
                    }, 2000);

                } catch (error) {
                    console.error('Error adding to playlist:', error);
                    button.innerHTML = `
                        <div class="flex items-center justify-center py-1 text-red-500">
                            <span class="text-sm">${error.message}</span>
                        </div>
                    `;
                    setTimeout(() => {
                        button.innerHTML = originalContent;
                        button.disabled = false;
                    }, 3000);
                }
            });
        });

    } catch (error) {
        console.error('Error loading playlists:', error);
        playlistsContainer.innerHTML = `
            <div class="p-3 bg-red-100 rounded">
                <p class="text-sm text-red-600">
                    ${error.message}
                    <button 
                        class="ml-2 text-red-700 underline hover:text-red-800"
                        onclick="location.reload()"
                    >
                        Retry
                    </button>
                </p>
            </div>
        `;
    }
}

// Helper function to show notifications
function showNotification(message, type = 'success') {
    const notificationEl = document.createElement('div');
    notificationEl.className = `
        fixed bottom-4 right-4 p-3 rounded shadow-lg
        ${type === 'success' ? 'bg-green-500' : 'bg-red-500'} 
        text-white text-sm animate-fade-in
    `;
    notificationEl.textContent = message;
    document.body.appendChild(notificationEl);

    setTimeout(() => {
        notificationEl.classList.add('animate-fade-out');
        setTimeout(() => notificationEl.remove(), 300);
    }, 3000);
}

// Helper function to show errors
function showError(message) {
    const menu = document.getElementById('spotify-playlist-menu');
    if (menu) {
        menu.innerHTML = `
            <div style="padding: 16px; text-align: center; color: #ff4444;">
                ${message}
            </div>
        `;
    }
}

// Helper function to get current video info
async function getCurrentVideoInfo() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_VIDEO_INFO' });
    return response;
}

// Add song to playlist
async function addToPlaylist(playlistId, videoInfo) {
    const playlistsContainer = document.getElementById('playlists');
    try {
        const response = await chrome.runtime.sendMessage({
            type: 'ADD_TO_PLAYLIST',
            data: { playlistId, videoInfo }
        });

        if (response && response.success) {
            playlistsContainer.innerHTML = `
                <div class="p-3 bg-green-100 rounded">
                    <p class="text-sm text-green-600">Successfully added to playlist!</p>
                </div>
            `;
            setTimeout(loadPlaylists, 2000); // Reload playlists after 2 seconds
        } else {
            throw new Error(response?.message || 'Failed to add to playlist');
        }
    } catch (error) {
        console.error('Error adding to playlist:', error);
        playlistsContainer.innerHTML = `
            <div class="p-3 bg-red-100 rounded">
                <p class="text-sm text-red-600">Error: ${error.message}</p>
            </div>
        `;
    }
}

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
    try {
        state.isLoading = true;
        renderApp();
        await checkAuthStatus();
    } catch (error) {
        console.error('Initialization error:', error);
        state.error = 'Failed to initialize: ' + error.message;
    } finally {
        state.isLoading = false;
        renderApp();
    }
});