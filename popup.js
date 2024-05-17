document.getElementById('save-button').addEventListener('click', () => {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, {action: 'getYouTubeInfo'}, (response) => {
        if (response) {
          saveToSpotify(response.title, response.artist);
        }
      });
    });
  });
  
  function saveToSpotify(title, artist) {
    chrome.runtime.sendMessage({action: 'saveToSpotify', title, artist});
  }
  