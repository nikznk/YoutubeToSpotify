function injectButton() {
    const controls = document.querySelector('.ytp-right-controls');
    if (!controls) return;
  
    const existingButton = document.getElementById('yt-to-spotify-button');
    if (existingButton) return; // Prevent multiple buttons
  
    const button = document.createElement('button');
    button.id = 'yt-to-spotify-button';
    button.innerText = 'Save to Spotify';
    button.style = `
      background-color: #1DB954;
      color: white;
      border: none;
      border-radius: 2px;
      padding: 5px 10px;
      margin-left: 5px;
      cursor: pointer;
    `;
  
    button.addEventListener('click', () => {
      const titleElement = document.querySelector('.title.style-scope.ytd-video-primary-info-renderer');
      const artistElement = document.querySelector('.ytd-channel-name a');
  
      const title = titleElement ? titleElement.innerText : '';
      const artist = artistElement ? artistElement.innerText : '';
  
      console.log('Sending message to background:', { action: 'saveToSpotify', title, artist });
      if (chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ action: 'saveToSpotify', title, artist }, (response) => {
          console.log('Response from background:', response);
        });
      } else {
        console.error('chrome.runtime.sendMessage is not available');
      }
    });
  
    controls.appendChild(button);
  }
  
  document.addEventListener('DOMContentLoaded', injectButton);
  setInterval(injectButton, 1000); // Ensure the button gets added if controls get re-rendered
  