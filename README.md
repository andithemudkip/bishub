# BisHub

BisHub is a cross-platform desktop application for managing and displaying Bible verses, hymns, and videos, designed for use in church services and similar settings. Built with Electron, React, and Vite, it provides both a display interface and a remote control interface, supporting local and YouTube video playback, hymn search, and Bible navigation.

## Features

- **Display Mode**: Project Bible verses, hymns, or videos to an external display.
- **Remote Control**: Control the display from another device via a web interface.
- **Bible Navigation**: Quickly search and display Bible passages.
- **Hymn Search**: Search and display hymns from a local database.
- **Video Library**: Manage and play local and YouTube videos.
- **YouTube Downloader**: Download YouTube videos for offline playback.
- **Multi-platform**: Runs on macOS, Windows, and Linux.

## Project Structure

- `src/` - Main frontend code (React, TypeScript)
  - `display/` - Display interface
  - `remote/` - Remote control interface
  - `shared/` - Shared utilities and types
  - `styles/` - CSS styles
- `electron/` - Electron main and preload scripts
- `assets/` - Static assets (Bible XML, hymns, etc.)
- `bin/` - Platform-specific binaries (yt-dlp for video downloads)
- `release/` - Packaged application builds

## Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- npm or yarn
- (For development) Electron installed globally or via npm scripts

### Install Dependencies
```bash
npm install
```

### Run in Development
```bash
npm run dev
```

### Build for Production
```bash
npm run build
```

### Package Electron App
```bash
npm run electron:build
```

## Usage
- Launch the app. Use the display interface for projection and the remote interface for control.
- Add videos to the library or download from YouTube.
- Search for hymns or Bible passages to display.

## Configuration
- Bible and hymn data are stored in `assets/`.
- Video downloads use `yt-dlp` binaries in `bin/`.
- App settings can be managed via the remote interface.

## License
[MIT](LICENSE)
