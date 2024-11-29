//background.js file

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'GET_PLAYLISTS') {
        fetchPlaylists()
            .then(playlists => {
                sendResponse({ playlists, success: true });
            })
            .catch(error => {
                sendResponse({ error: error.message, success: false });
            });
        return true; // Will respond asynchronously
    }

    if (request.type === 'ADD_TO_PLAYLIST') {
        handleAddToPlaylist(request.data)
            .then(result => {
                sendResponse({ success: true, ...result });
            })
            .catch(error => {
                sendResponse({ success: false, message: error.message });
            });
        return true; // Will respond asynchronously
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
    if (!token.spotify_token) return false;

    try {
        // Clean up the title for better search
        const searchQuery = cleanupVideoTitle(videoInfo.title);
        console.log('Searching Spotify for:', searchQuery);

        // Search for the track
        const searchResponse = await fetch(
            `https://api.spotify.com/v1/search?q=${encodeURIComponent(searchQuery)}&type=track&limit=5`,
            {
                headers: {
                    'Authorization': `Bearer ${token.spotify_token}`
                }
            }
        );

        if (!searchResponse.ok) throw new Error('Failed to search track');
        const searchData = await searchResponse.json();
        const tracks = searchData.tracks.items;

        if (tracks.length === 0) {
            return {
                success: false,
                message: 'Track not found on Spotify'
            };
        }

        // Try to find the best match
        const track = findBestMatch(tracks, videoInfo.title, videoInfo.channel);

        if (!track) {
            return {
                success: false,
                message: 'No matching track found'
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

        return {
            success: addResponse.ok,
            message: addResponse.ok ? 'Track added successfully' : 'Failed to add track',
            trackDetails: {
                name: track.name,
                artist: track.artists[0].name
            }
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

function cleanupVideoTitle(title) {
    // Remove common YouTube suffixes and prefixes
    let cleanTitle = title
        .replace(/\[Official (Video|Audio|Music Video|Lyric Video)\]/gi, '')
        .replace(/\(Official (Video|Audio|Music Video|Lyric Video)\)/gi, '')
        .replace(/\bOfficial\b/gi, '')
        .replace(/\bVideo\b/gi, '')
        .replace(/\bAudio\b/gi, '')
        .replace(/\[.*?\]/g, '')  // Remove anything in square brackets
        .replace(/\(.*?\)/g, '')  // Remove anything in parentheses
        .replace(/\bft\b|\bfeat\b/gi, 'feat.') // Standardize featuring
        .replace(/\s+/g, ' ')    // Remove extra spaces
        .trim();

    // Try to extract artist and song name
    const hyphenSplit = cleanTitle.split(' - ');
    if (hyphenSplit.length === 2) {
        const [artist, song] = hyphenSplit;
        cleanTitle = `${song} ${artist}`; // Format as "Song Artist" for better Spotify search
    }

    return cleanTitle;
}

// Helper function to find best matching track
function findBestMatch(tracks, videoTitle, channelName) {
    const cleanVideoTitle = cleanupVideoTitle(videoTitle).toLowerCase();

    return tracks.find(track => {
        const artistName = track.artists[0].name.toLowerCase();
        const trackName = track.name.toLowerCase();

        // Check if channel name matches artist name
        const channelMatch = channelName.toLowerCase().includes(artistName) ||
            artistName.includes(channelName.toLowerCase());

        // Check if video title contains both artist and track name
        const titleMatch = cleanVideoTitle.includes(artistName) &&
            cleanVideoTitle.includes(trackName);

        return channelMatch || titleMatch;
    }) || tracks[0]; // Return first track if no better match found
}