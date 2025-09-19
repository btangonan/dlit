#!/bin/bash

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Function to print colored status messages
print_status() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Clear the terminal
clear

echo -e "${PURPLE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${PURPLE}        🖥️  Video Downloader Desktop - Startup Script 🖥️         ${NC}"
echo -e "${PURPLE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Step 1: Kill existing Electron processes
print_status "Checking for existing Electron processes..."
pkill -f "electron" 2>/dev/null
sleep 1
print_success "Cleaned up existing Electron processes"

# Step 2: Check if the web server is running
print_status "Checking if web server is running on port 5173..."
if ! curl -s http://localhost:5173 > /dev/null 2>&1; then
    print_warning "Web server is not running! Starting it first..."

    # Start the web server in the background
    export JWT_SECRET="test-secret-for-development"
    export NODE_ENV="development"
    npm run dev > /tmp/video-downloader-server.log 2>&1 &
    SERVER_PID=$!

    # Wait for server to start
    print_status "Waiting for web server to start..."
    for i in {1..30}; do
        if curl -s http://localhost:5173 > /dev/null 2>&1; then
            print_success "Web server started successfully!"
            break
        fi
        echo -n "."
        sleep 1
    done

    if ! curl -s http://localhost:5173 > /dev/null 2>&1; then
        print_error "Failed to start web server. Check /tmp/video-downloader-server.log"
        exit 1
    fi
else
    print_success "Web server is already running"
fi

# Step 3: Build the Next.js app for Electron (if needed)
if [ ! -d "out" ]; then
    print_status "Building Next.js app for Electron..."
    npm run build
    if [ $? -eq 0 ]; then
        print_success "Build completed successfully!"
    else
        print_error "Build failed! Check the error messages above."
        exit 1
    fi
else
    print_success "Build already exists"
fi

# Step 4: Start Electron
echo ""
echo -e "${PURPLE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}        🚀 Starting Video Downloader Desktop App... 🚀          ${NC}"
echo -e "${PURPLE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

print_success "Launching Electron app..."
echo ""
echo -e "${YELLOW}The desktop app window should open shortly...${NC}"
echo -e "${YELLOW}Press Ctrl+C in this terminal to stop the app${NC}"
echo ""

# Start Electron with environment variables
JWT_SECRET="test-secret-for-development" NODE_ENV="development" npm run electron