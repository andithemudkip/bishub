#!/bin/bash
# Generate platform-specific icons from assets/logo.svg
# Requires: Node.js, sharp (npm dev dependency), macOS (sips, iconutil)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
SVG="$ROOT_DIR/assets/logo.svg"
BUILD_DIR="$ROOT_DIR/build"
ICONSET_DIR="$BUILD_DIR/icon.iconset"

echo "Generating PNGs from SVG..."
mkdir -p "$BUILD_DIR"

# Generate 1024x1024 master PNG using sharp
node -e "
  const sharp = require('sharp');
  sharp('$SVG')
    .resize(1024, 1024)
    .png()
    .toFile('$BUILD_DIR/icon.png')
    .then(() => console.log('  icon.png (1024x1024)'));
"

# --- macOS .icns ---
echo "Generating macOS .icns..."
mkdir -p "$ICONSET_DIR"

for SIZE in 16 32 64 128 256 512; do
  sips -z $SIZE $SIZE "$BUILD_DIR/icon.png" --out "$ICONSET_DIR/icon_${SIZE}x${SIZE}.png" > /dev/null
  DOUBLE=$((SIZE * 2))
  sips -z $DOUBLE $DOUBLE "$BUILD_DIR/icon.png" --out "$ICONSET_DIR/icon_${SIZE}x${SIZE}@2x.png" > /dev/null
done

iconutil -c icns "$ICONSET_DIR" -o "$BUILD_DIR/icon.icns"
rm -rf "$ICONSET_DIR"
echo "  icon.icns"

# --- Windows .ico ---
echo "Generating Windows .ico..."
node -e "
const sharp = require('sharp');
const fs = require('fs');

async function main() {
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const buffers = [];

  for (const size of sizes) {
    const buf = await sharp('$BUILD_DIR/icon.png')
      .resize(size, size)
      .png()
      .toBuffer();
    buffers.push({ size, buf });
  }

  // ICO header
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(buffers.length, 4);

  let dataOffset = 6 + 16 * buffers.length;
  const dirEntries = [];
  const imageData = [];

  for (const { size, buf } of buffers) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size < 256 ? size : 0, 0);
    entry.writeUInt8(size < 256 ? size : 0, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(buf.length, 8);
    entry.writeUInt32LE(dataOffset, 12);
    dirEntries.push(entry);
    imageData.push(buf);
    dataOffset += buf.length;
  }

  fs.writeFileSync('$BUILD_DIR/icon.ico', Buffer.concat([header, ...dirEntries, ...imageData]));
}

main();
"
echo "  icon.ico"

echo ""
echo "Done! Icons saved to build/"
