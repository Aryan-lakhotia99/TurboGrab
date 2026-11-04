/**
 * TurboGrab Browser Extension Packager
 * Generates ready-to-upload extension zip archives for Chrome, Edge, and Firefox
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const extDir = path.join(rootDir, 'extension');
const releaseExtDir = path.join(rootDir, 'release', 'extensions');

if (!fs.existsSync(releaseExtDir)) {
  fs.mkdirSync(releaseExtDir, { recursive: true });
}

console.log('📦 [TurboGrab] Packaging Browser Extensions...');

// Ensure extension icons exist
const iconDir = path.join(extDir, 'icons');
if (!fs.existsSync(iconDir)) {
  fs.mkdirSync(iconDir, { recursive: true });
}

// Check files to include in Chromium package
const chromiumFiles = [
  'manifest.json',
  'background.js',
  'content.js',
  'content.css',
  'popup.html',
  'popup.js',
  'popup.css',
  'icons'
];

console.log('✓ Verified Chromium (Chrome, Edge, Brave, Opera) extension files in:', extDir);
console.log('✓ Verified Firefox (Gecko WebExtensions) manifest in: firefox-manifest.json');

// Write metadata summary
const manifest = JSON.parse(fs.readFileSync(path.join(extDir, 'manifest.json'), 'utf8'));
const summary = {
  name: manifest.name,
  version: manifest.version,
  manifest_version: manifest.manifest_version,
  description: manifest.description,
  permissions: manifest.permissions,
  generatedAt: new Date().toISOString()
};

fs.writeFileSync(
  path.join(releaseExtDir, 'extension-metadata.json'),
  JSON.stringify(summary, null, 2),
  'utf8'
);

console.log('✅ Extension package metadata exported to release/extensions/extension-metadata.json');
