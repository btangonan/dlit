# Emergency Deployment Dockerfile
# Forces Render to use our explicit configuration

FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    py3-pip \
    make \
    g++ \
    && pip3 install --break-system-packages yt-dlp

# Copy package files first for caching
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev --verbose

# Copy all source files
COPY . .

# Make entry points executable
RUN chmod +x index.js || true
RUN chmod +x server.js || true

# Build Next.js app
RUN npm run build

# Create health check endpoint
RUN echo '{"status":"ok","timestamp":"'$(date -Iseconds)'"}' > /app/health.json

# List files for debugging
RUN echo "=== DOCKERFILE DEBUG INFO ===" && \
    ls -la /app && \
    echo "=== NODE_MODULES BIN ===" && \
    ls -la /app/node_modules/.bin/next || echo "Next.js not found" && \
    echo "=== PACKAGE.JSON ===" && \
    cat /app/package.json

# Expose port
EXPOSE 3000

# Use our bulletproof entry point
CMD ["node", "/app/index.js"]