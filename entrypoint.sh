#!/bin/bash
set -e

# Start the MCP server.
# The REGISTRY_URL should be passed as an environment variable to the container,
# which will point to the Next.js server running on the host machine.
cd /app/shadcn

node dist/index.js #registry:mcp

# The script will now exit automatically after the node process finishes. 
