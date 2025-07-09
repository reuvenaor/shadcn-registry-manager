import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { addItem } from "./mcp/handlers/add-item";
import { executeAdd } from "./mcp/handlers/execute-add";
import { executeInit } from "./mcp/handlers/execute-init";
import { getItem } from "./mcp/handlers/get-item";
import { getItems } from "./mcp/handlers/get-items";
import { getInitInstructions } from "./mcp/handlers/get-init-instructions";
import {
  addItemOptionsSchema,
  executeAddOptionsSchema,
  executeInitOptionsSchema,
  getItemOptionsSchema,
} from '@/src/schemas';

async function main() {
  console.error("[MCP] Starting shadcn MCP server...");

  const server = new McpServer(
    {
      name: "shadcn",
      version: "1.0.0",
    },
    {
      capabilities: {
        logging: {},
        resources: {},
        tools: {
          listChanged: false,
        },
        experimental: {
          // Enable notifications capability
          // serverNotifications: {
          //   progress: true,
          //   message: true,
          // },
        },
      },
    }
  );

  const REGISTRY_URL = process.env.REGISTRY_URL ?? "http://host.docker.internal:3333/r";
  const STYLE = process.env.STYLE ?? "new-york";

  console.log(`[MCP] Using registry URL: ${REGISTRY_URL}`);
  console.log(`[MCP] Using style: ${STYLE}`);

  // Register tools directly with MCP SDK handlers (bypassing wrapHandler due to type incompatibility)
  server.registerTool(
    "get_init_instructions",
    {
      description: "Get instructions on how to initialize a new project using a registry style project structure.",
      inputSchema: z.object({}).shape,
    },
    async (args, extra) => {
      const result = await getInitInstructions({
        registryUrl: REGISTRY_URL,
        style: STYLE,
      });
      return {
        content: result.content.map((c) => ({
          type: "text" as const,
          text: c.text || "",
          _meta: {}
        }))
      };
    }
  );

  server.registerTool(
    "execute_init",
    {
      description: "Execute the full init workflow - this actually initializes the project and creates a components.json file.",
      inputSchema: executeInitOptionsSchema.shape,
    },
    async (args, extra) => {
      const result = await executeInit(args as z.infer<typeof executeInitOptionsSchema>, extra);
      return {
        content: result.content.map((c) => {
          if ('resource' in c && c.resource) {
            return {
              type: "resource" as const,
              resource: {
                uri: c.resource.uri,
                text: c.resource.text,
                mimeType: "text/plain",
                _meta: {}
              }
            };
          } else {
            return {
              type: "text" as const,
              text: c.text || "",
              _meta: {}
            };
          }
        }),
        structuredContent: result.structuredContent,
        isError: result.isError
      };
    }
  );

  server.registerTool(
    "get_items",
    {
      description: "List all the available items in the registry",
      inputSchema: z.object({}).shape,
    },
    async (args, extra) => {
      const result = await getItems({ registryUrl: REGISTRY_URL });
      return {
        content: result.content.map((c) => ({
          type: "text" as const,
          text: c.text || "",
          _meta: {}
        }))
      };
    }
  );

  // Apply to ALL handlers that return content:
  server.registerTool(
    "get_item",
    {
      description: "Get an item from the registry",
      inputSchema: getItemOptionsSchema.shape,
    },
    async (args, extra) => {
      const result = await getItem(args as z.infer<typeof getItemOptionsSchema>, {
        registryUrl: REGISTRY_URL,
        style: STYLE,
      });
      return {
        content: result.content.map((c) => ({
          type: "text" as const,
          text: c.text || "",
          _meta: {}
        })),
        structuredContent: result.structuredContent || undefined
      };
    }
  );

  server.registerTool(
    "add_item",
    {
      description: "Add an item from the registry to the user's project",
      inputSchema: addItemOptionsSchema.shape,
    },
    async (args, extra) => {
      const result = await addItem(args as z.infer<typeof addItemOptionsSchema>, extra);
      return {
        content: result.content.map((c) => {
          if ('resource' in c && c.resource) {
            return {
              type: "resource" as const,
              resource: {
                uri: c.resource.uri,
                text: c.resource.text,
                mimeType: "text/plain",
                _meta: {}
              }
            };
          } else {
            return {
              type: "text" as const,
              text: (c as { text?: string }).text || "",
              _meta: {}
            };
          }
        }),
        structuredContent: result.structuredContent,
        isError: result.isError
      };
    }
  );

  server.registerTool(
    "execute_add",
    {
      description: "Execute the full add component workflow - this actually adds the component to the user's project instead of just providing instructions",
      inputSchema: executeAddOptionsSchema.shape,
    },
    async (args, extra) => {
      console.log("[MCP] execute_add start - extra", extra)
      const result = await executeAdd(args as z.infer<typeof executeAddOptionsSchema>, extra);
      return {
        content: result.content.map((c) => {
          if ('resource' in c && c.resource) {
            return {
              type: "resource" as const,
              resource: {
                uri: c.resource.uri,
                text: c.resource.text,
                mimeType: "text/plain",
                _meta: {}
              }
            };
          } else {
            return {
              type: "text" as const,
              text: (c as { text?: string }).text || "",
              _meta: {}
            };
          }
        }),
        structuredContent: result.structuredContent,
        isError: result.isError
      };
    }
  );

  console.error("[MCP] Tools registered successfully");

  // Create stdio transport
  const transport = new StdioServerTransport();
  console.error("[MCP] Created stdio transport");

  // Connect the server to the transport
  await server.connect(transport);
  console.error("[MCP] Server connected to stdio transport");

  // The server will now handle requests via stdin/stdout
  console.error("[MCP] MCP server ready for requests");
}

// Handle errors and ensure proper shutdown
process.on('SIGINT', () => {
  console.error("[MCP] Received SIGINT, shutting down...");
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error("[MCP] Received SIGTERM, shutting down...");
  process.exit(0);
});

main().catch((error) => {
  console.error("[MCP] Fatal error:", error);
  process.exit(1);
});