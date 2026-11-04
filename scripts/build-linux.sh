#!/bin/bash
# TurboGrab Linux Build Script (AppImage, .deb, .rpm)
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
cd "$DIR"

echo "======================================================================"
echo "   TurboGrab Linux Packaging Engine"
echo "   Targets: AppImage, Debian (.deb), RedHat/Fedora (.rpm)"
echo "======================================================================"
echo

echo "[1/3] Compiling React Frontend..."
npm run build

echo
echo "[2/3] Running Engine Test Suite..."
node tests/engine.test.cjs

echo
echo "[3/3] Packaging Linux Distributions via Electron Builder..."
# Requires electron-builder multi-target support
npx electron-builder --linux AppImage deb rpm

echo
echo "======================================================================"
echo "   Linux Packages Generated Successfully in release/"
echo "======================================================================"
