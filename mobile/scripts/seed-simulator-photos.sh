#!/bin/sh
set -e
cd "$(dirname "$0")/.."
dir="assets/fake-receipts"

if ! xcrun simctl list devices booted | grep -q "(Booted)"; then
  echo "Boot the iOS Simulator first. From mobile/, run: npm run ios" >&2
  exit 1
fi

set --
for image in "$dir"/*; do
  case "$image" in
    *.png|*.jpg|*.jpeg|*.PNG|*.JPG|*.JPEG) set -- "$@" "$image" ;;
  esac
done

if [ "$#" -eq 0 ]; then
  echo "Put PNG or JPEG receipts in mobile/$dir, then run npm run seed:photos again." >&2
  exit 1
fi

xcrun simctl addmedia booted "$@"
echo "Added $# receipt image(s) from mobile/$dir to the booted simulator photo library."
