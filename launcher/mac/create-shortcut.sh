#!/bin/bash
# One-time setup (macOS): symlinks MarketPane.app onto the Desktop.
# Re-run any time you move the repo, since the symlink target is an
# absolute path resolved at creation time - same caveat as
# launcher/create-shortcut.ps1's Windows .lnk. Unlike a copy, edits to the
# launcher script itself are picked up immediately with no need to re-run
# this - only a repo move requires it.

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_PATH="$SCRIPT_DIR/MarketPane.app"
DESKTOP_LINK="$HOME/Desktop/MarketPane.app"

if [ ! -d "$APP_PATH" ]; then
  echo "Could not find $APP_PATH" >&2
  exit 1
fi

rm -f "$DESKTOP_LINK"
ln -s "$APP_PATH" "$DESKTOP_LINK"
echo "Created: $DESKTOP_LINK -> $APP_PATH"
