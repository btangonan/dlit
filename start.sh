#!/bin/bash

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}           🎥 Video Downloader - Startup Script 🎥              ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Step 1: Kill existing processes on port 3000
print_status "Checking for processes on port 5173..."
if lsof -i:5173 > /dev/null 2>&1; then
    print_warning "Found process on port 5173, killing it..."
    # Kill all processes on port 3000
    lsof -ti:5173 | xargs kill -9 2>/dev/null
    sleep 1
    print_success "Port 5173 cleared!"
else
    print_success "Port 5173 is already free"
fi

# Step 2: Kill any existing npm/node processes for this app
print_status "Cleaning up any existing Node processes..."
pkill -f "next dev" 2>/dev/null
pkill -f "npm run dev" 2>/dev/null
sleep 1
print_success "Cleaned up existing processes"

# Step 3: Check for required dependencies
print_status "Checking environment..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed! Please install Node.js first."
    exit 1
fi
print_success "Node.js found: $(node -v)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed! Please install npm first."
    exit 1
fi
print_success "npm found: $(npm -v)"

# Check if yt-dlp is installed
if command -v yt-dlp &> /dev/null; then
    print_success "yt-dlp found: $(yt-dlp --version 2>/dev/null | head -1)"
else
    print_warning "yt-dlp not found in PATH - video extraction may fail"
    print_warning "Install with: brew install yt-dlp (macOS) or pip install yt-dlp"
fi

# Step 4: Check if node_modules exists
if [ ! -d "node_modules" ]; then
    print_warning "node_modules not found, installing dependencies..."
    npm install
    if [ $? -eq 0 ]; then
        print_success "Dependencies installed successfully!"
    else
        print_error "Failed to install dependencies"
        exit 1
    fi
else
    print_success "Dependencies already installed"
fi

# Step 5: Set environment variables
print_status "Setting environment variables..."
export JWT_SECRET="test-secret-for-development"
export NODE_ENV="development"
print_success "Environment variables set"

# Step 6: Start the development server
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}          🚀 Starting Video Downloader Server... 🚀             ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Function to check if server is ready
check_server() {
    local max_attempts=30
    local attempt=0

    print_status "Waiting for server to start..."

    while [ $attempt -lt $max_attempts ]; do
        if curl -s http://localhost:5173 > /dev/null 2>&1; then
            echo ""
            echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
            echo -e "${GREEN}              ✅ SERVER IS UP AND RUNNING! ✅                   ${NC}"
            echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
            echo ""
            print_success "Web Interface: ${BLUE}http://localhost:5173${NC}"
            print_success "API Endpoint:  ${BLUE}http://localhost:5173/api/extract${NC}"
            echo ""
            echo -e "${YELLOW}Press Ctrl+C to stop the server${NC}"
            echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
            echo ""
            return 0
        fi

        attempt=$((attempt + 1))
        echo -n "."
        sleep 1
    done

    print_error "Server failed to start after 30 seconds"
    return 1
}

# Start the server in the background initially to check if it starts
npm run dev &
SERVER_PID=$!

# Check if the server starts successfully
if check_server; then
    # Server is running, now bring it to foreground
    wait $SERVER_PID
else
    # Kill the background process if server didn't start
    kill $SERVER_PID 2>/dev/null
    print_error "Failed to start the server. Check the logs above for errors."
    exit 1
fi