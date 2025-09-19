#!/bin/bash
# Production setup script for Render.com deployment
# Ensures yt-dlp binary is available in production environment

set -e

echo "🚀 Starting production setup for video-downloader..."

# Check if we're in production environment
if [ "$NODE_ENV" = "production" ]; then
    echo "📦 Production environment detected"

    # Check available package managers
    if command -v apt-get >/dev/null 2>&1; then
        echo "🔧 Using apt-get (Debian/Ubuntu)"

        # Update package list
        apt-get update -q

        # Install yt-dlp via pip (most reliable method)
        if command -v pip3 >/dev/null 2>&1; then
            echo "📥 Installing yt-dlp via pip3..."
            pip3 install --user yt-dlp

            # Create symlink in accessible location
            mkdir -p /usr/local/bin
            ln -sf ~/.local/bin/yt-dlp /usr/local/bin/yt-dlp || true
        else
            echo "⚠️ pip3 not available, trying alternative installation..."

            # Try installing via package manager
            apt-get install -y python3-pip
            pip3 install yt-dlp
        fi

    elif command -v yum >/dev/null 2>&1; then
        echo "🔧 Using yum (RHEL/CentOS)"
        yum update -y
        yum install -y python3-pip
        pip3 install yt-dlp

    else
        echo "⚠️ Unknown package manager, attempting direct installation..."

        # Direct download method (fallback)
        echo "📥 Downloading yt-dlp binary directly..."
        curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
        chmod +x /usr/local/bin/yt-dlp
    fi

    # Verify installation
    if command -v yt-dlp >/dev/null 2>&1; then
        echo "✅ yt-dlp installed successfully: $(yt-dlp --version)"
    else
        echo "❌ yt-dlp installation failed"
        exit 1
    fi

else
    echo "🔧 Development environment - using npm package binary"
fi

# Verify Node.js app dependencies
echo "📦 Installing Node.js dependencies..."
npm ci --only=production

echo "🏗️ Building Next.js application..."
npm run build

echo "✅ Production setup completed successfully!"