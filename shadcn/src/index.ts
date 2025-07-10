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
import { validateRegistryUrl } from "./utils/registry-security";
import { getBlocks } from "./mcp/handlers/get-blocks";

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
      },
    }
  );

  // Security configuration
  const MAX_CONCURRENT_OPERATIONS = 5;
  let activeOperations = 0;

  // Wrapper function to enforce rate limiting
  function withRateLimit<T extends any[], R>(fn: (...args: T) => Promise<R>) {
    return async (...args: T): Promise<R> => {
      if (activeOperations >= MAX_CONCURRENT_OPERATIONS) {
        throw new Error("Too many concurrent operations. Please try again later.");
      }

      activeOperations++;
      try {
        return await fn(...args);
      } finally {
        activeOperations--;
      }
    };
  }

  // Validate and set the registry URL from environment with security checks
  let REGISTRY_URL: string;
  try {
    const envUrl = process.env.REGISTRY_URL ?? "http://host.docker.internal:3333/r";
    REGISTRY_URL = validateRegistryUrl(envUrl);
  } catch (error) {
    console.error(`[MCP] Security error - Invalid REGISTRY_URL: ${error instanceof Error ? error.message : String(error)}`);
    console.error(`[MCP] Falling back to secure default`);
    REGISTRY_URL = "http://host.docker.internal:3333/r"; // Safe fallback
  }

  // Validate style parameter
  const STYLE = (() => {
    const envStyle = process.env.STYLE ?? "new-york";
    if (typeof envStyle === 'string' && /^[a-z-]+$/i.test(envStyle) && envStyle.length <= 50) {
      return envStyle;
    }
    console.warn(`[MCP] Invalid STYLE environment variable, using default: new-york`);
    return "new-york";
  })();

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
    withRateLimit(async (args, extra) => {
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
    })
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
    withRateLimit(async (args, extra) => {
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
    })
  );

  server.registerTool(
    "get_blocks",
    {
      description: "List all the available blocks from the local blocks.json file",
      inputSchema: z.object({}).shape,
    },
    async (_args, _extra) => {
      const blocks = await getBlocks();
      return {
        content: [
          {
            type: "text" as const,
            text: `Blocks available:\n${blocks.map((b: { name: string }) => `- ${b.name}`).join("\n")}`,
            _meta: {}
          }
        ],
        structuredContent: { blocks }
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