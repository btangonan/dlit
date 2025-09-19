# 🚀 Video Downloader - Startup Guide

## Quick Start

### 🌐 Web Version (Browser)
```bash
./start.sh
```
Opens at: http://localhost:5173

### 🖥️ Desktop Version (Electron)
```bash
./start-electron.sh
```
Opens as a desktop application

---

## What the Scripts Do

### `start.sh` - Web Server
1. **Kills** any process on port 3000
2. **Cleans** existing Node processes
3. **Checks** Node.js, npm, yt-dlp availability
4. **Installs** dependencies if needed
5. **Sets** required environment variables
6. **Starts** the Next.js development server
7. **Verifies** server is running
8. **Shows** clear success/error status

### `start-electron.sh` - Desktop App
1. **Kills** existing Electron processes
2. **Checks** if web server is running (starts if needed)
3. **Builds** the app if necessary
4. **Launches** Electron desktop window

---

## Status Indicators

- ✅ **Green** = Success
- ⚠️ **Yellow** = Warning (non-critical)
- ❌ **Red** = Error (needs attention)
- 🔵 **Blue** = Information

---

## Manual Commands

If scripts don't work, use these commands:

### Kill port 5173
```bash
lsof -ti:5173 | xargs kill -9
```

### Start web server
```bash
JWT_SECRET="test-secret-for-development" npm run dev
```

### Start Electron
```bash
JWT_SECRET="test-secret-for-development" npm run electron
```

---

## Troubleshooting

### Port 5173 in use
The script automatically kills it, but if issues persist:
```bash
sudo lsof -i :5173
kill -9 <PID>
```

### yt-dlp not found
Install with:
```bash
# macOS
brew install yt-dlp

# Python
pip install yt-dlp
```

### Dependencies issues
```bash
rm -rf node_modules package-lock.json
npm install
```

---

## Requirements

- **Node.js** v16 or higher
- **npm** v7 or higher
- **yt-dlp** (for video extraction)
- **macOS/Linux** (scripts use bash)

---

## Success Output Example

When everything works, you'll see:
```
═══════════════════════════════════════════════════════════════
              ✅ SERVER IS UP AND RUNNING! ✅
═══════════════════════════════════════════════════════════════

✅ Web Interface: http://localhost:5173
✅ API Endpoint:  http://localhost:5173/api/extract

Press Ctrl+C to stop the server
═══════════════════════════════════════════════════════════════
```