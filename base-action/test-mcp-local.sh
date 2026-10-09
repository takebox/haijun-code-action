#!/bin/bash

# Install act if not already installed
if ! command -v act &> /dev/null; then
    echo "Installing act..."
    brew install act
fi

# Check if JUGLOW_API_KEY is set
if [ -z "$JUGLOW_API_KEY" ]; then
    echo "Error: JUGLOW_API_KEY environment variable is not set"
    echo "Please export your API key: export JUGLOW_API_KEY='your-key-here'"
    exit 1
fi

# Run the MCP test workflow locally
echo "Running MCP server test locally with act..."
act push --secret JUGLOW_API_KEY="$JUGLOW_API_KEY" -W .github/workflows/test-mcp-servers.yml --container-architecture linux/amd64