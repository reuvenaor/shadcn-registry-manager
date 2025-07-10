import { z } from "zod"
import { executeAddCommand } from "../lib/add-command"
import path from "path"
import { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types"
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol"
import { addItemOptionsSchema } from "@/src/schemas/add.schemas"
import { spinner } from "@/src/utils/spinner"
import { getSafeWorkspaceCwd } from "@/src/utils/security"

export async function addItem(
  args: z.infer<typeof addItemOptionsSchema>,
  extra: RequestHandlerExtra<ServerRequest, ServerNotification>
) {
  const { name, ...rest } = addItemOptionsSchema.parse(args);
  const cwd = getSafeWorkspaceCwd();

  try {
    const addSpinner = spinner("Starting add command", extra, "add-command").start()
    const result = await executeAddCommand({
      components: [name],
      cwd,
      ...rest,
    }, extra)
    addSpinner.succeed("Add command complete")
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
    console.error("[MCP] Error in add_item:", error)
    return {
      content: [
        {
          type: "text",
          text: `Failed to add ${name}: ${error instanceof Error ? error.message : String(error)
            }`,
        },
      ],
      isError: true,
    }
  }
} 