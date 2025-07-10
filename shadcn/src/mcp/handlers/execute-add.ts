import { z } from "zod"
import { executeAddCommand } from "../lib/add-command"
import path from "path"
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol"
import { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types"
import { executeAddOptionsSchema } from "@/src/schemas/add.schemas"
import { getSafeWorkspaceCwd } from "@/src/utils/security"

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

  const cwd = getSafeWorkspaceCwd(rawCwd)

  try {
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