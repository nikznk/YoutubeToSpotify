//background.js file

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'GET_PLAYLISTS') {
        fetchPlaylists().then(playlists => {
            sendResponse({ playlists });
        });
        return true;
    }

    if (request.type === 'ADD_TO_PLAYLIST') {
        handleAddToPlaylist(request.data).then(success => {
            sendResponse({ success });
        });
        return true;
    }
});

async function fetchPlaylists() {
    const token = await chrome.storage.local.get('spotify_token');
    if (!token.spotify_token) return [];

    try {
        const response = await fetch('https://api.spotify.com/v1/me/playlists', {
            headers: {
                'Authorization': `Bearer ${token.spotify_token}`
            }
        });

        if (!response.ok) throw new Error('Failed to fetch playlists');
        const data = await response.json();
        return data.items;
    } catch (error) {
        console.error('Error fetching playlists:', error);
        return [];
    }
}

async function handleAddToPlaylist({ playlistId, videoInfo }) {
    const token = await chrome.storage.local.get('spotify_token');
    if (!token.spotify_token) return { success: false, message: 'Not authenticated' };

    try {
        // Search for the track
        const searchResponse = await fetch(
            `https://api.spotify.com/v1/search?q=${encodeURIComponent(videoInfo.title)}&type=track&limit=1`,
            {
                headers: {
                    'Authorization': `Bearer ${token.spotify_token}`
                }
            }
        );

        if (!searchResponse.ok) throw new Error('Failed to search track');
        const searchData = await searchResponse.json();
        const track = searchData.tracks.items[0];

        if (!track) {
            return {
                success: false,
                message: 'Track not found on Spotify'
            };
        }

        // Check if track already exists in playlist
        const exists = await checkTrackInPlaylist(playlistId, track.uri, token.spotify_token);

        if (exists) {
            return {
                success: false,
                message: 'Track already exists in playlist',
                alreadyExists: true
            };
        }

        // Add track to playlist
        const addResponse = await fetch(
            `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token.spotify_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    uris: [track.uri]
                })
            }
        );

        if (!addResponse.ok) {
            throw new Error('Failed to add track to playlist');
        }

        return {
            success: true,
            message: 'Track added successfully'
        };
    } catch (error) {
        console.error('Error adding to playlist:', error);
        return {
            success: false,
            message: error.message || 'Failed to add track'
        };
    }
}

async function checkTrackInPlaylist(playlistId, trackUri, token) {
    try {
        // Get tracks in playlist (paginate through all tracks)
        let offset = 0;
        const limit = 100;
        let allTracks = [];

        while (true) {
            const response = await fetch(
                `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=${limit}&offset=${offset}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            if (!response.ok) throw new Error('Failed to fetch playlist tracks');
            const data = await response.json();

            allTracks = allTracks.concat(data.items.map(item => item.track.uri));

            if (data.items.length < limit) break;
            offset += limit;
        }

        return allTracks.includes(trackUri);
    } catch (error) {
        console.error('Error checking track in playlist:', error);
        return false;
    }
}