# YouTube to Spotify Saver

## Setup
1. Clone the repository
2. Copy `config.template.js` to `config.js` and add your Spotify Client ID
3. Run `npm install` (if you haven't already)
4. Run `npm run build` to generate manifest.json
5. Load the extension in Chrome

## Development
- manifest.json is generated from manifest.template.json during build
- Never commit manifest.json or config.js
- Always run `npm run build` after updating config.js