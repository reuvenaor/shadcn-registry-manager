import path from "path"
import { z } from "zod"
import { runInit } from "../lib/run-init"
import { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types"
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol"
import { executeInitOptionsSchema } from "@/src/schemas/init.schemas"
import { getSafeWorkspaceCwd } from "@/src/utils/security"
import { spinner } from "@/src/utils/spinner"


export async function executeInit(
  args: z.infer<typeof executeInitOptionsSchema>,
  extra: RequestHandlerExtra<ServerRequest, ServerNotification>
) {
  const { cwd: rawCwd, style, baseColor, srcDir, cssVariables, force, template } =
    executeInitOptionsSchema.parse(args)

  const cwd = getSafeWorkspaceCwd(rawCwd)
  const resolvedCwd = path.resolve(cwd)

  try {
    const initSpinner = spinner("Initializing project configuration", extra, "init-command").start()

    const config = await runInit({
      cwd: resolvedCwd,
      style: style ?? "default",
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

    initSpinner.succeed()

    if (!config) {
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
        config: {
          ...config,
          tailwind: {
            ...config.tailwind,
            config: {},
          },
        },
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