#!/usr/bin/env bash
set -euo pipefail

# Check if config exists
if [[ ! -f ".mcp.json" ]]; then
    echo "❌ No MCP config found in this directory"
    echo "Run the ChromaDB setup script first"
    exit 1
fi

# Validate JSON
if ! jq -e . .mcp.json >/dev/null 2>&1; then
    echo "❌ Invalid .mcp.json configuration"
    echo "Run: jq . .mcp.json to see the error"
    exit 1
fi

# Start Claude with chat subcommand - it will auto-detect .mcp.json
echo "🚀 Starting Claude with ChromaDB..."
echo "📝 Note: Running 'claude chat' as a single command"
exec claude chat "$@"