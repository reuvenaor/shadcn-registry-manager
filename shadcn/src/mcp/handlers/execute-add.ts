import { z } from "zod"
import { executeAddCommand } from "../lib/add-command"
import path from "path"
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol"
import { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types"
import fs from "fs"
import { executeAddOptionsSchema } from "@/src/schemas/add.schemas"

export async function executeAdd(
  args: z.infer<typeof executeAddOptionsSchema>,
  extra: RequestHandlerExtra<ServerRequest, ServerNotification>
) {
  const {
    components,
    cwd: rawCwd,
    overwrite,
    srcDir,
    cssVariables,
    initOptions,
  } = executeAddOptionsSchema.parse(args)

  if (!components || components.length === 0) {
    throw new Error("Components array is required and cannot be empty")
  }

  let cwd = rawCwd
  if (cwd !== "/workspace") {
    if (fs.existsSync("/workspace")) {
      console.warn(
        `[MCP] Overriding cwd from '${cwd}' to '/workspace' (MCP Docker convention)`
      )
      cwd = "/workspace"
    } else {
      console.warn(
        `[MCP] /workspace does not exist, using provided cwd '${rawCwd}'`
      )
      if (!process.env.WORKSPACE_DIR) {
        throw new Error("WORKSPACE_DIR is not set")
      }
      cwd = process.env.WORKSPACE_DIR
    }
  }

  try {
    console.log("[MCP] Calling executeAddCommand for execute_add", {
      components,
      cwd,
      overwrite,
      srcDir,
      cssVariables,
      initOptions,
    })
    const result = await executeAddCommand(
      {
        components,
        cwd: cwd,
        overwrite: overwrite || false,
        srcDir: srcDir || false,
        cssVariables: cssVariables !== false, // default to true
        initOptions,
      },
      extra
    )
    console.log("[MCP] executeAddCommand result:", result)
    return {
      structuredContent: result,
      content: [
        {
          type: "text",
          text: result.message,
        },
        ...result.filesCreated.map((file: string) => ({
          type: "resource" as const,
          resource: {
            uri: `file://${path.join(cwd, file)}`,
            text: file,
            description: "New file added to the project.",
          }
        })),
        ...result.filesModified.map((file: string) => ({
          type: "resource" as const,
          resource: {
            uri: `file://${path.join(cwd, file)}`,
            text: file,
            description: "Existing file modified.",
          }
        })),
      ],
    }
  } catch (error) {
    console.error("[MCP] Error in execute_add:", error)
    return {
      content: [
        {
          type: "text",
          text: `Failed to add components: ${error instanceof Error ? error.message : String(error)
            }`,
        },
      ],
      isError: true,
    }
  }
} 