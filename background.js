const SPOTIFY_CLIENT_ID = '34831eac922f4f8a93d28c81c559877c'; // Replace with your actual Spotify client ID

chrome.runtime.onInstalled.addListener(() => {
  console.log('YouTube to Spotify Extension Installed');
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request);
  if (request.action === 'saveToSpotify') {
    const { title, artist } = request;
    console.log(`Saving to Spotify: ${title} by ${artist}`);
    authenticateSpotify().then(accessToken => {
      console.log('Access token received:', accessToken);
      searchSpotify(title, artist, accessToken).then(trackId => {
        console.log('Track ID found:', trackId);
        addToSpotifyLibrary(trackId, accessToken);
      }).catch(error => {
        console.error('Error searching track:', JSON.stringify(error));
        alert('Failed to find the track on Spotify.');
      });
    }).catch(error => {
      console.error('Error authenticating with Spotify:', JSON.stringify(error));
      alert('Failed to authenticate with Spotify.');
    });
  }
});

function authenticateSpotify() {
  return new Promise((resolve, reject) => {
    const redirectUri = chrome.identity.getRedirectURL();
    console.log('Redirect URI:', redirectUri);
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${SPOTIFY_CLIENT_ID}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=playlist-modify-public playlist-modify-private`;

    chrome.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true
    }, (redirectUrl) => {
      if (chrome.runtime.lastError) {
        console.error('Error in launchWebAuthFlow:', chrome.runtime.lastError);
        return reject(new Error(chrome.runtime.lastError.message));
      }
      console.log('Redirect URL:', redirectUrl);
      const accessTokenMatch = new URL(redirectUrl).hash.match(/access_token=([^&]*)/);
      if (accessTokenMatch && accessTokenMatch[1]) {
        resolve(accessTokenMatch[1]);
      } else {
        reject(new Error('Access token not found in the URL'));
      }
    });
  });
}

function searchSpotify(title, artist, accessToken) {
  const query = encodeURIComponent(`track:${title} artist:${artist}`);
  const url = `https://api.spotify.com/v1/search?q=${query}&type=track`;
  console.log('Searching Spotify with URL:', url);

  return fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`Spotify API response not OK: ${response.statusText}`);
    }
    return response.json();
  })
  .then(data => {
    console.log('Spotify search result:', data);
    if (data.tracks.items.length > 0) {
      return data.tracks.items[0].id;
    } else {
      throw new Error('Track not found');
    }
  }).catch(error => {
    console.error('Error in Spotify search:', JSON.stringify(error));
    throw error;
  });
}

function addToSpotifyLibrary(trackId, accessToken) {
  console.log('Adding track to Spotify library:', trackId);
  fetch(`https://api.spotify.com/v1/me/tracks`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ ids: [trackId] })
  }).then(response => {
    if (response.ok) {
      console.log('Track added successfully');
      alert('Song added to your Spotify library!');
    } else {
      return response.json().then(errorData => {
        console.error('Failed to add the track', JSON.stringify(errorData));
        alert('Failed to add the song to your Spotify library.');
      });
    }
  }).catch(error => {
    console.error('Error adding track to Spotify library:', JSON.stringify(error));
    alert('Failed to add the song to your Spotify library.');
  });
}
