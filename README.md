# shadcn registry manager - MCP Server

This project provides an **MCP (Model Context Protocol) server** for the [shadcn/ui](https://ui.shadcn.com) component registry and CLI. It enables remote, programmatic, or containerized execution of shadcn CLI commands (such as `init`, `add`, etc.) that you would normally run locally, making it easy to automate, integrate, or run in cloud/dev environments.

## What It Does

This MCP server exposes shadcn CLI operations as MCP tools, so you (or an AI agent) can:
- Initialize a project
- Add components from the shadcn registry **including block components**
- List and fetch registry items
- Run all shadcn CLI workflows remotely
- You can use the shadcn: https://ui.shadcn.com/r or run your **own registry server**  and add your own blocks follow this guide: https://ui.shadcn.com/docs/blocks

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

- **\<your-project-path\>** - is the path to your project directory. 
Example: `/Users/reuvennaor/Library/Projects/shadcn-registry-manager/www`

- **/workspace** - is the path to the workspace directory inside the container. 
(**Don't change it**, if you do, you must pass the same path as `cwd` param on every tool call)

### ENV Variables:
- **REGISTRY_URL**  
  - option 1: `https://ui.shadcn.com/r` - The URL of the shadcn registry
  - option 2: `http://localhost:3000>/r` - The URL of your own registry server (follow this guide: https://ui.shadcn.com/docs/blocks)
- **STYLE** - is the style of the shadcn registry - `new-york`


## Example MCP Tools
- `get_init_instructions`: Get project initialization instructions
- `execute_init`: Run full project initialization
- `get_items`: List available registry items
- `get_item`: Fetch a specific registry item
- `add_item`: Add a registry item to your project
- `execute_add`: Add multiple components to your project
- `get_blocks`: Get current blocks from the registry

## Example Usage

```
use the tool `get_blocks` to get the blocks from the registry
```
```
use the tool `add_item` - dashboard-01 to your project
```

```
use the tool `execute_add` - components: button, input
```


## Source
- **[shadcn/ui](https://github.com/shadcn/ui)**
- **[Model Context Protocol](https://github.com/modelcontextprotocol)**

made with ❤️ by **Reuven Naor**

---

MIT License. See LICENSE for details. 