#!/bin/bash
# TurboGrab Native Messaging launcher for macOS / Linux
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Locate Node.js executable
NODE_EXE="node"
if ! command -v node >/dev/null 2>&1; then
  if [ -x "/usr/local/bin/node" ]; then
    NODE_EXE="/usr/local/bin/node"
  elif [ -x "/usr/bin/node" ]; then
    NODE_EXE="/usr/bin/node"
  elif [ -x "/opt/homebrew/bin/node" ]; then
    NODE_EXE="/opt/homebrew/bin/node"
  elif [ -x "$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node 2>/dev/null | tail -n 1)/bin/node" ]; then
    NODE_EXE="$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node 2>/dev/null | tail -n 1)/bin/node"
  fi
fi

exec "$NODE_EXE" "$DIR/native_host.cjs" "$@"
