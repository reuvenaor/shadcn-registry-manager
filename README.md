# shadcn registry manager - MCP Server

This project provides an **MCP (Model Context Protocol) server** for the [shadcn/ui](https://ui.shadcn.com) component registry and CLI. It enables remote, programmatic, or containerized execution of shadcn CLI commands (such as `init`, `add`, etc.) that you would normally run locally, making it easy to automate, integrate, or run in cloud/dev environments.

## What It Does

This MCP server exposes shadcn CLI operations as MCP tools, so you (or an AI agent) can:
- Initialize a project
- Add components from the shadcn registry
- List and fetch registry items
- Run all shadcn CLI workflows remotely

## Usage Modes

You can run the MCP server in two main ways:

### 1. Docker (mcp-shadcn)

Run the MCP server in a container, mounting your project directory:

```bash
docker run --rm -it \
  --mount type=bind,src=/path/to/your/project,dst=/workspace \
  -e REGISTRY_URL=https://ui.shadcn.com/r \
  -e STYLE=new-york \
  mcp-shadcn
```

- The server will listen for MCP requests and execute shadcn CLI commands inside the container.
- You can customize the registry URL and style via environment variables.
- See the `mcp-shadcn` entry in `mcp.json` for the exact Docker invocation.

### 2. Local Node (shadcn-local)

Run the MCP server directly with Node.js (useful for local development):

```bash
npx tsx shadcn/src/index.ts
```

Or, as defined in `mcp.json`:

```bash
/Users/reuvennaor/.nvm/versions/node/v20.17.0/bin/node /Library/Projects/mcp-docker/shadcn/dist/index.js
```

- Set `REGISTRY_URL` and `WORKSPACE_DIR` as needed.
- This will start the MCP server and allow you to send MCP requests to it.

## Example MCP Tools
- `get_init_instructions`: Get project initialization instructions
- `execute_init`: Run full project initialization
- `get_items`: List available registry items
- `get_item`: Fetch a specific registry item
- `add_item`: Add a registry item to your project
- `execute_add`: Add multiple components to your project

## Development
- See `mcp.json` for all available server modes and commands.
- The server is implemented in TypeScript under `shadcn/src/`.
- For more on MCP, see the [Model Context Protocol documentation](https://github.com/modelcontextprotocol).

## Authors
- **Reuven Naor**

## Source
- **shadcn** ([shadcn/ui](https://github.com/shadcn/ui))
- **MCP** ([Model Context Protocol](https://github.com/modelcontextprotocol))

---

MIT License. See LICENSE for details. 