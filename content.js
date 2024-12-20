// Utility function to wait for elements
function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(selector)) {
      return resolve(document.querySelector(selector));
    }

    const observer = new MutationObserver(() => {
      if (document.querySelector(selector)) {
        observer.disconnect();
        resolve(document.querySelector(selector));
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timeout waiting for ${selector}`));
    }, timeout);
  });
}

// Global indicator that extension is loaded
window.youtubeToSpotifyExtensionLoaded = true;

// Message listener for communication with popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request);

  if (request.type === 'GET_VIDEO_INFO') {
    const videoInfo = getVideoInfo();
    console.log('Sending video info:', videoInfo);
    sendResponse(videoInfo);
    return true;
  }
});

// Function to get video information
function getVideoInfo() {
  try {
    const title = document.querySelector('h1.ytd-video-primary-info-renderer')?.textContent?.trim();
    const channel = document.querySelector('ytd-channel-name yt-formatted-string a')?.textContent?.trim();
    const description = document.querySelector('ytd-expander#description')?.textContent?.trim();

    console.log('Found video info:', {
      title,
      channel,
      description: description?.substring(0, 200) // First 200 chars
    });

    return {
      title: title || 'Unknown Title',
      channel: channel || 'Unknown Channel',
      description: description || ''
    };
  } catch (error) {
    console.error('Error getting video info:', error);
    return {
      title: 'Error getting video title',
      channel: 'Unknown Channel',
      description: ''
    };
  }
}

// Add Spotify button to YouTube player
async function addSpotifyButton() {
  try {
    console.log('Attempting to add Spotify button...');

    // Check if we're on a video page
    if (!window.location.pathname.includes('/watch')) {
      console.log('Not a video page, skipping button addition');
      return;
    }

    // Check if button already exists
    if (document.querySelector('.spotify-save-button')) {
      console.log('Button already exists');
      return;
    }

    // Wait for the controls to be available
    const rightControls = await waitForElement('.ytp-right-controls');
    console.log('Found right controls:', rightControls);

    // Create our button
    // Update this part in your addSpotifyButton function
    const spotifyButton = document.createElement('button');
    spotifyButton.className = 'ytp-button spotify-save-button';
    spotifyButton.title = 'Save to Spotify';

    // Add Spotify-like icon (using SVG)
    spotifyButton.innerHTML = `
  <svg height="100%" version="1.1" viewBox="0 0 24 24" width="100%" style="fill: white;">
    <path d="M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2ZM16.5 12.7C15.0555 11.255 12.5 11 10.5 11.5C10.3112 11.5463 10.1235 11.4433 10.0772 11.2545C10.031 11.0657 10.134 10.878 10.3227 10.8318C12.5727 10.2818 15.4445 10.5368 17.1445 12.2368C17.2841 12.3764 17.2841 12.6014 17.1445 12.741C17.0049 12.8806 16.7896 12.8806 16.65 12.741L16.5 12.7ZM17.85 10.85C16.1 9.1 12.7 8.75 10.4 9.35C10.1672 9.41674 9.92584 9.27832 9.85911 9.04555C9.79237 8.81277 9.93079 8.57139 10.1636 8.50465C12.7636 7.84799 16.5 8.24799 18.5 10.25C18.6642 10.4142 18.6642 10.6858 18.5 10.85C18.3358 11.0142 18.0642 11.0142 17.9 10.85H17.85ZM19.25 8.75C17.15 6.65 12.95 6.25 10.25 6.95C10.0172 7.01674 9.77584 6.87832 9.70911 6.64555C9.64237 6.41277 9.78079 6.17139 10.0136 6.10465C13.0136 5.34799 17.5977 5.78299 19.9477 8.13299C20.1119 8.29721 20.1119 8.56879 19.9477 8.73301C19.7835 8.89722 19.5119 8.89722 19.3477 8.73301L19.25 8.75Z"/>
  </svg>
`;

    // Style the button with updated CSS
    spotifyButton.style.cssText = `
  border: none !important;
  background: none !important;
  padding: 0 8px !important;
  cursor: pointer !important;
  opacity: 0.9 !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 48px !important;
  height: 100% !important;
  min-width: 48px !important;
  position: relative !important;
  vertical-align: top !important;
  float: none !important;
  flex: 0 0 auto !important;
  margin: 0 !important;
`;

    // Also add this style to your style element in initializeExtension
    const styleElement = document.createElement('style');
    styleElement.textContent = `
  .ytp-right-controls {
    display: flex !important;
    align-items: center !important;
    height: 100% !important;
  }
  
  .spotify-save-button {
    order: -1 !important; /* This will place it before the fullscreen button */
  }
`;
    document.head.appendChild(styleElement);

    // Add hover effect
    spotifyButton.addEventListener('mouseenter', () => {
      spotifyButton.style.opacity = '1';
    });

    spotifyButton.addEventListener('mouseleave', () => {
      spotifyButton.style.opacity = '0.9';
    });

    // Handle click event
    spotifyButton.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();

      // Get video info
      const videoInfo = getVideoInfo();

      // Get token to check auth status
      const token = await chrome.storage.local.get('spotify_token');
      if (!token.spotify_token) {
        // If not authenticated, show auth popup
        showSuccessNotification('Please authenticate with Spotify first');
        chrome.runtime.sendMessage({ type: 'OPEN_POPUP' });
        return;
      }

      // Show playlist menu if authenticated
      showPlaylistMenu(videoInfo, spotifyButton);
    });

    // Insert before the last control
    const fullscreenButton = rightControls.querySelector('.ytp-fullscreen-button');
    if (fullscreenButton) {
      rightControls.insertBefore(spotifyButton, fullscreenButton);
    } else {
      rightControls.appendChild(spotifyButton);
    }

    console.log('Successfully added Spotify button');
  } catch (error) {
    console.error('Error adding Spotify button:', error);
  }
}

function isValidPlaylist(playlist) {
  return playlist
    && typeof playlist === 'object'
    && typeof playlist.id === 'string'
    && typeof playlist.name === 'string'
    && playlist.tracks
    && typeof playlist.tracks.total === 'number';
}

// Show playlist menu
async function showPlaylistMenu(videoInfo, buttonElement) {
  try {
    console.log('Starting showPlaylistMenu...'); // Debug log

    // Remove existing menu
    const existingMenu = document.getElementById('spotify-playlist-menu');
    if (existingMenu) existingMenu.remove();

    // Get token
    const token = await chrome.storage.local.get('spotify_token');
    console.log('Token status:', !!token.spotify_token); // Debug log

    if (!token.spotify_token) {
      throw new Error('No Spotify token found');
    }

    // Create menu with loading state
    const menu = document.createElement('div');
    menu.id = 'spotify-playlist-menu';
    menu.style.cssText = `
            position: fixed;
            background: #282828;
            border-radius: 8px;
            padding: 12px;
            min-width: 300px;
            max-width: 350px;
            box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
            z-index: 2147483647;
            color: white;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        `;

    // Add loading state
    menu.innerHTML = `
            <div style="padding: 16px; text-align: center;">
                <div style="display: inline-block; border: 2px solid #1DB954; border-top-color: transparent; border-radius: 50%; width: 20px; height: 20px; animation: spin 1s linear infinite;"></div>
                <div style="margin-top: 8px; color: #b3b3b3;">Loading playlists...</div>
            </div>
        `;

    // Position menu
    const buttonRect = buttonElement.getBoundingClientRect();
    menu.style.top = `${buttonRect.bottom + 10}px`;
    menu.style.left = `${buttonRect.left}px`;
    document.body.appendChild(menu);

    // Fetch playlists
    console.log('Fetching playlists...'); // Debug log
    const response = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', {
      headers: {
        'Authorization': `Bearer ${token.spotify_token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch playlists: ${response.status}`);
    }

    const data = await response.json();
    console.log('Received playlists:', data); // Debug log

    if (!data || !Array.isArray(data.items)) {
      throw new Error('Invalid playlist data received');
    }

    // Filter valid playlists
    const validPlaylists = data.items.filter(isValidPlaylist);
    console.log('Valid playlists:', validPlaylists.length); // Debug log

    if (validPlaylists.length === 0) {
      menu.innerHTML = `
                <div style="padding: 16px; text-align: center; color: #b3b3b3;">
                    No playlists found
                </div>
            `;
      return;
    }

    // Update menu with content
    menu.innerHTML = `
            <div style="padding: 12px;">
                <div style="font-size: 14px; font-weight: 500; margin-bottom: 12px;">
                    Add "${videoInfo?.title || 'Current video'}" to Playlist
                </div>
                <div style="margin-bottom: 12px;">
                    <input 
                        type="text" 
                        id="playlist-search" 
                        placeholder="Search playlists..."
                        style="
                            width: 100%;
                            padding: 8px 12px;
                            border: none;
                            border-radius: 4px;
                            background: #333;
                            color: white;
                            font-size: 13px;
                            outline: none;
                        "
                    >
                </div>
                <div id="playlists-container" style="
                    max-height: 400px;
                    overflow-y: auto;
                    margin: 0 -12px;
                ">
                    ${validPlaylists.map(playlist => `
                        <button 
                            class="playlist-item" 
                            data-playlist-id="${playlist.id}"
                            style="
                                width: 100%;
                                display: flex;
                                align-items: center;
                                padding: 8px 12px;
                                background: none;
                                border: none;
                                color: white;
                                cursor: pointer;
                                transition: background-color 0.2s;
                                text-align: left;
                            "
                        >
                            <div style="min-width: 40px; height: 40px; margin-right: 12px; background: #333; border-radius: 4px; overflow: hidden;">
                                ${playlist.images && playlist.images[0] ?
        `<img src="${playlist.images[0].url}" style="width: 100%; height: 100%; object-fit: cover;">` :
        ''
      }
                            </div>
                            <div>
                                <div class="playlist-name" style="font-size: 14px; margin-bottom: 4px;">${playlist.name}</div>
                                <div style="font-size: 12px; color: #b3b3b3;">${playlist.tracks.total} tracks</div>
                            </div>
                        </button>
                    `).join('')}
                </div>
            </div>
        `;

    // Add search functionality
    const searchInput = menu.querySelector('#playlist-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const items = menu.querySelectorAll('.playlist-item');
        items.forEach(item => {
          const name = item.querySelector('.playlist-name')?.textContent.toLowerCase() || '';
          item.style.display = name.includes(searchTerm) ? 'flex' : 'none';
        });
      });
      searchInput.focus();
    }

    // Add playlist click handlers
    menu.querySelectorAll('.playlist-item').forEach(button => {
      // Hover effects
      button.addEventListener('mouseover', () => {
        button.style.backgroundColor = '#333';
      });
      button.addEventListener('mouseout', () => {
        button.style.backgroundColor = 'transparent';
      });

      // Click handler
      button.addEventListener('click', handlePlaylistClick);
    });

    // Close menu on outside click
    document.addEventListener('click', function closeMenu(e) {
      if (!menu.contains(e.target) && e.target !== buttonElement) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    });

  } catch (error) {
    console.error('Error in showPlaylistMenu:', error);
    showError(error.message);
  }
}

async function handlePlaylistClick(event) {
  const button = event.currentTarget;
  const playlistId = button.dataset.playlistId;
  const originalContent = button.innerHTML;

  try {
    button.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; width: 100%;">
        <div style="border: 2px solid #1DB954; border-top-color: transparent; border-radius: 50%; width: 16px; height: 16px; animation: spin 1s linear infinite; margin-right: 8px;"></div>
        Processing...
      </div>
    `;
    button.disabled = true;

    const videoInfo = getVideoInfo();

    // Send all the work to background script
    const response = await chrome.runtime.sendMessage({
      type: 'ADD_TO_PLAYLIST',
      data: {
        playlistId,
        videoInfo,
        checkDuplicate: true // New flag to enable duplicate checking
      }
    });

    if (!response?.success) {
      throw new Error(response?.message || 'Failed to add to playlist');
    }

    button.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; width: 100%; color: #1DB954;">
        <span style="margin-right: 8px;">✓</span>
        ${response.message || 'Added!'}
      </div>
    `;

    setTimeout(() => {
      const menu = document.getElementById('spotify-playlist-menu');
      if (menu) menu.remove();
      showSuccessNotification(response.message || 'Added to playlist!');
    }, 1000);

  } catch (error) {
    console.error('Error:', error);
    button.innerHTML = `
      <div style="color: #ff4444; padding: 8px; text-align: center;">
        ${error.message}
      </div>
    `;
    setTimeout(() => {
      button.innerHTML = originalContent;
      button.disabled = false;
    }, 2000);
  }
}



// Render playlist items
function renderPlaylistItems(playlists) {
  if (!playlists || playlists.length === 0) {
    return `
            <div style="text-align: center; color: #b3b3b3; padding: 16px;">
                No playlists found
            </div>
        `;
  }

  return playlists.map(playlist => `
        <button 
            class="playlist-item" 
            data-playlist-id="${playlist.id}"
            style="
                width: 100%;
                display: flex;
                align-items: center;
                padding: 8px 12px;
                margin: 2px 0;
                background: none;
                border: none;
                color: white;
                cursor: pointer;
                border-radius: 4px;
                transition: background-color 0.2s;
            "
        >
            <img 
                src="${playlist.images?.[0]?.url || '#'}" 
                style="width: 40px; height: 40px; border-radius: 4px; margin-right: 12px; background: #333;"
                onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22><rect width=%2224%22 height=%2224%22 fill=%22%23333%22/></svg>'"
            >
            <div style="text-align: left;">
                <div class="playlist-name" style="font-size: 14px;">${playlist.name}</div>
                <div style="font-size: 12px; color: #b3b3b3;">${playlist.tracks.total} tracks</div>
            </div>
        </button>
    `).join('');
}

// Attach handlers to playlist items
function attachPlaylistHandlers(container, videoInfo, menu) {
  container.querySelectorAll('.playlist-item').forEach(item => {
    item.addEventListener('mouseover', () => {
      item.style.backgroundColor = '#333';
    });

    item.addEventListener('mouseout', () => {
      item.style.backgroundColor = 'transparent';
    });

    item.addEventListener('click', () => {
      const playlistId = item.dataset.playlistId;
      item.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="
            border: 2px solid #1DB954;
            border-top-color: transparent;
            border-radius: 50%;
            width: 12px;
            height: 12px;
            animation: spin 1s linear infinite;
          "></div>
          Adding to playlist...
        </div>
      `;
      item.style.opacity = '0.7';
      item.style.cursor = 'default';

      chrome.runtime.sendMessage({
        type: 'ADD_TO_PLAYLIST',
        data: { playlistId, videoInfo }
      }, (response) => {
        if (response && response.success) {
          showSuccessNotification('Added to playlist!');
          menu.remove();
        } else {
          handleError(new Error('Failed to add to playlist'), menu);
        }
      });
    });
  });
}

// Add keyboard support
function addKeyboardSupport(menu) {
  const searchInput = menu.querySelector('#playlist-search');
  const playlistItems = menu.querySelectorAll('.playlist-item');
  let currentFocus = -1;

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      currentFocus++;
      if (currentFocus >= playlistItems.length) currentFocus = 0;
      highlightItem(currentFocus);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      currentFocus--;
      if (currentFocus < 0) currentFocus = playlistItems.length - 1;
      highlightItem(currentFocus);
    } else if (e.key === 'Enter' && currentFocus !== -1) {
      e.preventDefault();
      playlistItems[currentFocus].click();
    } else if (e.key === 'Escape') {
      menu.remove();
    }
  });

  function highlightItem(index) {
    playlistItems.forEach((item, i) => {
      item.style.backgroundColor = i === index ? '#333' : 'transparent';
    });

    if (playlistItems[index]) {
      playlistItems[index].scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }
  }
}

// Error handling
// Continue from where handleError function left off
function handleError(error, menu) {
  console.error('Error:', error);
  menu.innerHTML = `
        <div style="padding: 16px;">
            <div style="color: #ff4444; margin-bottom: 8px;">
                ${error.message || 'An error occurred'}
            </div>
            <button id="retry-button" style="
                padding: 4px 12px;
                background: #333;
                border: none;
                border-radius: 4px;
                color: white;
                cursor: pointer;
                font-size: 13px;
            ">
                Retry
            </button>
        </div>
    `;

  const retryButton = menu.querySelector('#retry-button');
  retryButton.addEventListener('click', async () => {
    const videoInfo = getVideoInfo();
    showPlaylistMenu(videoInfo, document.querySelector('.spotify-save-button'));
  });
}

// Success notification
function showSuccessNotification(message, duration = 2000) {
  const notification = document.createElement('div');
  notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #1DB954;
        color: white;
        padding: 12px 24px;
        border-radius: 4px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 14px;
        z-index: 2147483647;
        animation: fadeIn 0.2s ease;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    `;
  notification.textContent = message;

  document.body.appendChild(notification);
  setTimeout(() => {
    notification.style.animation = 'fadeOut 0.2s ease';
    setTimeout(() => notification.remove(), 200);
  }, duration);
}

// Initialize extension
function initializeExtension() {
  console.log('Initializing YouTube to Spotify extension...');

  // Add required styles
  const style = document.createElement('style');
  style.textContent = `
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }

        .spotify-save-button {
            transition: opacity 0.2s ease !important;
        }

        .playlist-item {
            transition: background-color 0.2s ease !important;
        }

        #spotify-playlist-menu {
            animation: fadeIn 0.2s ease;
        }

        #playlists-container::-webkit-scrollbar {
            width: 8px;
        }
        
        #playlists-container::-webkit-scrollbar-track {
            background: #282828;
        }
        
        #playlists-container::-webkit-scrollbar-thumb {
            background: #666;
            border-radius: 4px;
        }
    `;
  document.head.appendChild(style);

  // Initial button addition
  addSpotifyButton();

  // Watch for YouTube navigation
  const observer = new MutationObserver((mutations) => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      if (window.location.pathname.includes('/watch')) {
        setTimeout(addSpotifyButton, 1000); // Delay to ensure player is loaded
      }
    }
  });

  // Track current URL
  let lastUrl = window.location.href;

  // Start observing
  observer.observe(document.body, {
    subtree: true,
    childList: true
  });

  // Watch specifically for player changes
  const playerObserver = new MutationObserver((mutations) => {
    if (!document.querySelector('.spotify-save-button')) {
      addSpotifyButton();
    }
  });

  // Observe player controls when they exist
  function observePlayer() {
    const player = document.querySelector('.ytp-right-controls');
    if (player) {
      playerObserver.observe(player, {
        childList: true,
        subtree: true
      });
    } else {
      setTimeout(observePlayer, 1000);
    }
  }

  observePlayer();

  // Listen for YouTube's navigation events
  document.addEventListener('yt-navigate-finish', () => {
    console.log('YouTube navigation detected');
    setTimeout(addSpotifyButton, 1000);
  });
}

// Start the extension
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
  initializeExtension();
}

window.addEventListener('unload', () => {
  const button = document.querySelector('.spotify-save-button');
  const menu = document.getElementById('spotify-playlist-menu');
  if (button) button.remove();
  if (menu) menu.remove();
});



// Export for testing if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    addSpotifyButton,
    getVideoInfo,
    showPlaylistMenu
  };
}