import { readFile, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import config from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function buildManifest() {
    try {
        // Read the template
        const templatePath = join(__dirname, 'manifest.template.json');
        console.log('Reading template from:', templatePath);

        const manifestTemplate = await readFile(templatePath, 'utf8');
        console.log('Template read successfully');

        // Replace the placeholder with actual client ID
        const manifestContent = manifestTemplate.replace(
            '"__SPOTIFY_CLIENT_ID__"',
            `"${config.SPOTIFY_CLIENT_ID}"`
        );

        // Write the final manifest
        const manifestPath = join(__dirname, 'manifest.json');
        await writeFile(manifestPath, manifestContent);

        console.log('✅ manifest.json has been generated successfully!');
    } catch (error) {
        console.error('❌ Error generating manifest.json:', error);
        console.error('Current directory:', __dirname);
        console.error('Full error:', error);
    }
}

buildManifest();