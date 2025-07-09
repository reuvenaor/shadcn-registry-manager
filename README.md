# shadcn registry manager - MCP Server

This project provides an **MCP (Model Context Protocol) server** for the [shadcn/ui](https://ui.shadcn.com) component registry and CLI. It enables remote, programmatic, or containerized execution of shadcn CLI commands (such as `init`, `add`, etc.) that you would normally run locally, making it easy to automate, integrate, or run in cloud/dev environments.

## What It Does

This MCP server exposes shadcn CLI operations as MCP tools, so you (or an AI agent) can:
- Initialize a project
- Add components from the shadcn registry **including block components**
- List and fetch registry items
- Run all shadcn CLI workflows remotely

## Usage

### Docker (reuvenaor/shadcn-registry-manager):

Run the MCP server in a container, mounting your project directory:

Add the following to your `mcp.json` file:

```json
   "shadcn-registry-manager": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "--mount",
        "type=bind,src=<your-project-path>,dst=/workspace",
        "-e", 
        "REGISTRY_URL=https://ui.shadcn.com/r",
        "-e", 
        "STYLE=new-york",
        "reuvenaor/shadcn-registry-manager"
      ],
    },
```

### Mounting:
- **your-project-path** - is the path to your project directory.
- **workspace** - is the path to the workspace directory inside the container.

### ENV Variables:
- **REGISTRY_URL** - is the URL of the shadcn registry - https://ui.shadcn.com/r
- **STYLE** - is the style of the shadcn registry - new-york


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