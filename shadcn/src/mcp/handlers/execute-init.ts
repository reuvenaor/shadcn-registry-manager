import path from "path"
import { z } from "zod"
import { runInit } from "../lib/run-init"
import { getProjectConfig } from "@/src/utils/get-project-info"
import { registryItemSchema } from "@/src/registry/schema"
import { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types"
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol"
import { executeInitOptionsSchema } from "@/src/schemas/init.schemas"
import { getSafeWorkspaceCwd } from "@/src/utils/security"

const projectConfigSchema = registryItemSchema.pick({
  tailwind: true,
})

export async function executeInit(
  args: z.infer<typeof executeInitOptionsSchema>,
  extra: RequestHandlerExtra<ServerRequest, ServerNotification>
) {
  const { cwd: rawCwd, style, baseColor, srcDir, cssVariables, force, template } =
    executeInitOptionsSchema.parse(args)

  const cwd = getSafeWorkspaceCwd(rawCwd)
  const resolvedCwd = path.resolve(cwd)

  try {
    await extra?.sendNotification({
      method: "notifications/progress",
      params: {
        progressToken: "init-command",
        progress: 0,
        total: 100,
        message: "Initializing project configuration",
        requestId: extra?.requestId,
      },
    })

    const config = await runInit({
      cwd: resolvedCwd,
      style: style ?? "none",
      baseColor: baseColor ?? "slate",
      template: template,
      srcDir: srcDir ?? false,
      cssVariables: cssVariables ?? true,
      force: force ?? false,
      yes: true,
      silent: true,
      defaults: true,
      isNewProject: false, // preFlightInit will handle this.
      skipPreflight: false,
    }, extra)

    const projectConfig = await getProjectConfig(resolvedCwd)
    if (!projectConfig) {
      throw new Error("Failed to get project config.")
    }

    return {
      content: [
        {
          type: "text",
          text: `Project initialized successfully. Configuration written to components.json.`,
        },
        {
          type: "resource" as const,
          resource: {
            uri: `file://${resolvedCwd}/components.json`,
            text: "components.json",
            description: "Project configuration file.",
            mimeType: "application/json",
          }
        },
      ],
      structuredContent: {
        success: true,
        message: "Project initialized successfully.",
        configFile: `${resolvedCwd}/components.json`,
        config: projectConfigSchema.parse(projectConfig),
      },
    }
  } catch (error) {
    console.error("[MCP] Error in execute_init:", error)
    return {
      content: [
        {
          type: "text",
          text: `Failed to initialize project: ${error instanceof Error ? error.message : String(error)
            }`,
        },
      ],
      isError: true,
    }
  }
} 