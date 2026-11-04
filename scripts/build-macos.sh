#!/bin/bash
# TurboGrab macOS Build Script (.dmg for Intel & Apple Silicon)
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
cd "$DIR"

echo "======================================================================"
echo "   TurboGrab macOS Packaging Engine"
echo "   Target: Apple Disk Image (.dmg) [Universal: x64 + arm64]"
echo "======================================================================"
echo

echo "[1/3] Compiling React Frontend..."
npm run build

echo
echo "[2/3] Running Engine Test Suite..."
node tests/engine.test.cjs

echo
echo "[3/3] Packaging macOS .dmg via Electron Builder..."
npx electron-builder --mac dmg --universal

echo
echo "======================================================================"
echo "   macOS Disk Image Generated Successfully in release/"
echo "======================================================================"
