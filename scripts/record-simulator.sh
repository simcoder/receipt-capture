#!/bin/sh
set -eu
cd "$(dirname "$0")/.."

export PATH="$HOME/.maestro/bin:$PATH"

if ! java -version >/dev/null 2>&1; then
  for jdk in /opt/homebrew/opt/openjdk@21 /opt/homebrew/opt/openjdk@17; do
    if [ -x "$jdk/bin/java" ]; then
      export JAVA_HOME="$jdk"
      export PATH="$jdk/bin:$PATH"
      break
    fi
  done
fi

if ! java -version >/dev/null 2>&1; then
  echo "Install a JDK, then run this again: brew install openjdk@21"
  exit 1
fi

if ! command -v maestro >/dev/null 2>&1; then
  echo "Install Maestro, then run this again: curl -Ls https://get.maestro.mobile.dev | bash"
  exit 1
fi

if ! xcrun simctl list devices booted | grep -q Booted; then
  echo "Boot the iOS Simulator and start the app with npm run ios from this folder."
  exit 1
fi

stamp=$(date +%Y%m%d-%H%M%S)
out="maestro/recordings"
mkdir -p "$out"
video="$out/walk-$stamp.mp4"

echo "Recording $video"
echo "The app should already be open in Expo Go. For the City Parking steps, set EXPO_PUBLIC_SHOW_FAKE_RECEIPTS=1 and restart Expo before this run."

maestro record --local \
  --debug-output "$out/debug-$stamp" \
  -e MAESTRO_USERNAME="${MAESTRO_USERNAME:-northwind.demo}" \
  -e MAESTRO_PASSWORD="${MAESTRO_PASSWORD:-Northwind-demo-1}" \
  maestro/walk.yaml \
  "$video"

echo "Video: $video"
echo "Commit that mp4. Debug screenshots stay out of git."
