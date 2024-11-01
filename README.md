# YouTube to Spotify/Apple Music Saver

## Setup
1. Clone the repository
2. Copy `config.template.js` to `config.js`
3. Add your Spotify Client ID to `config.js`
4. Load the extension in Chrome

## Configuration
Create a `config.js` file with your credentials:
```javascript
const config = {
    SPOTIFY_CLIENT_ID: 'YOUR_SPOTIFY_CLIENT_ID_HERE'
};

export default config;
```

## Security Note
Never commit your actual Client ID or any other sensitive credentials to the repository.