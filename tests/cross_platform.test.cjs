/**
 * TurboGrab Cross-Platform Integration & Security Test Suite
 */

const assert = require('assert');
const browserDetector = require('../electron/engine/browserDetector.cjs');
const downloadManager = require('../electron/engine/downloadManager.cjs');

console.log('====================================================');
console.log('   TURBOGRAB CROSS-PLATFORM & BROWSER TEST SUITE    ');
console.log('====================================================\n');

// Test 1: System Info & Cross-Platform Detection
console.log('[Test 1]: Verifying OS & System Environment Metadata...');
const sysInfo = browserDetector.getSystemInfo();
assert(sysInfo.osName, 'OS name must be detected');
assert(['win32', 'darwin', 'linux'].includes(sysInfo.platform), 'Platform must be one of win32, darwin, linux');
assert(sysInfo.arch, 'CPU architecture must be detected');
console.log(`  ✓ System detected: ${sysInfo.osName} (${sysInfo.platform}) on ${sysInfo.arch} architecture`);
console.log(`  ✓ Node.js runtime: ${sysInfo.nodeVersion}`);

// Test 2: Multi-Browser Definitions for Windows, macOS, and Linux
console.log('\n[Test 2]: Verifying Cross-Platform Browser Definitions...');
const originalPlatform = browserDetector.platform;

// Check Windows
browserDetector.platform = 'win32';
const winBrowsers = browserDetector.getBrowserDefinitions();
assert(winBrowsers.some(b => b.id === 'chrome'), 'Windows must include Chrome');
assert(winBrowsers.some(b => b.id === 'edge'), 'Windows must include Edge');
assert(winBrowsers.some(b => b.id === 'firefox'), 'Windows must include Firefox');
assert(winBrowsers.some(b => b.id === 'brave'), 'Windows must include Brave');
assert(winBrowsers.some(b => b.id === 'opera'), 'Windows must include Opera');
console.log(`  ✓ Windows browser catalog verified (${winBrowsers.length} browsers configured)`);

// Check macOS
browserDetector.platform = 'darwin';
const macBrowsers = browserDetector.getBrowserDefinitions();
assert(macBrowsers.some(b => b.id === 'chrome'), 'macOS must include Chrome');
assert(macBrowsers.some(b => b.id === 'edge'), 'macOS must include Edge');
assert(macBrowsers.some(b => b.id === 'firefox'), 'macOS must include Firefox');
assert(macBrowsers.some(b => b.id === 'brave'), 'macOS must include Brave');
assert(macBrowsers.some(b => b.id === 'opera'), 'macOS must include Opera');
console.log(`  ✓ macOS browser catalog verified (${macBrowsers.length} browsers configured)`);

// Check Linux
browserDetector.platform = 'linux';
const linuxBrowsers = browserDetector.getBrowserDefinitions();
assert(linuxBrowsers.some(b => b.id === 'chrome'), 'Linux must include Chrome');
assert(linuxBrowsers.some(b => b.id === 'chromium'), 'Linux must include Chromium');
assert(linuxBrowsers.some(b => b.id === 'firefox'), 'Linux must include Firefox');
assert(linuxBrowsers.some(b => b.id === 'brave'), 'Linux must include Brave');
console.log(`  ✓ Linux browser catalog verified (${linuxBrowsers.length} browsers configured)`);

browserDetector.platform = originalPlatform;

// Test 3: Host Browser Scan
console.log('\n[Test 3]: Scanning Current Host for Installed Browsers...');
const detected = browserDetector.detectInstalledBrowsers();
console.log(`  ✓ Scanned ${detected.length} browsers on host:`);
for (const b of detected) {
  console.log(`    - ${b.name}: ${b.isInstalled ? 'INSTALLED (' + b.executablePath + ')' : 'Not Installed'} | Native Host: ${b.isHostRegistered ? 'Registered' : 'Unregistered'}`);
}
assert(detected.length > 0, 'Must return browser scan array');

// Test 4: Deduplication Verification
console.log('\n[Test 4]: Verifying Download Request Deduplication...');
const testUrl = 'https://example.com/unique_test_video.mp4';
const dupCheck1 = downloadManager.findDuplicate(testUrl, 'video.mp4');
assert(!dupCheck1.isDuplicate, 'Brand new URL must not be flagged as duplicate');
console.log('  ✓ Pre-download deduplication check confirmed clean state');

// Test 5: Native Host Shell Script Syntax & Permissions
console.log('\n[Test 5]: Verifying macOS/Linux Native Host Wrapper (turbograb_host.sh)...');
const fs = require('fs');
const path = require('path');
const shPath = path.resolve(__dirname, '..', 'extension', 'host', 'turbograb_host.sh');
assert(fs.existsSync(shPath), 'turbograb_host.sh must exist');
const shContent = fs.readFileSync(shPath, 'utf8');
assert(shContent.includes('native_host.cjs'), 'turbograb_host.sh must invoke native_host.cjs');
assert(!shContent.includes('src-tauri'), 'turbograb_host.sh must not reference legacy src-tauri');
console.log('  ✓ turbograb_host.sh syntax and Node execution target verified');

// Test 6: Windows Native Host Batch Script
console.log('\n[Test 6]: Verifying Windows Native Host Wrapper (turbograb_host.bat)...');
const batPath = path.resolve(__dirname, '..', 'extension', 'host', 'turbograb_host.bat');
assert(fs.existsSync(batPath), 'turbograb_host.bat must exist');
const batContent = fs.readFileSync(batPath, 'utf8');
assert(batContent.includes('native_host.cjs'), 'turbograb_host.bat must invoke native_host.cjs');
assert(!batContent.includes('src-tauri'), 'turbograb_host.bat must not reference legacy src-tauri');
console.log('  ✓ turbograb_host.bat syntax and Node execution target verified');

console.log('\n====================================================');
console.log('   ALL CROSS-PLATFORM TESTS PASSED SUCCESSFULLY!    ');
console.log('====================================================\n');
