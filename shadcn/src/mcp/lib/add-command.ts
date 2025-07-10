import path from "path"
import { addOptionsSchema } from "@/src/schemas/add.schemas"
import { executeAddCommandOptionsSchema } from "@/src/schemas/add.schemas"
import { runInit } from "@/src/mcp/lib/run-init"
import { preFlightAdd } from "@/src/preflights/preflight-add"
import { getRegistryIndex, getRegistryItem } from "@/src/registry/api"
import { registryItemTypeSchema } from "@/src/registry/schema"
import { isLocalFile, isUrl } from "@/src/registry/utils"
import { addComponents } from "@/src/utils/add-components"
import { createProjectMcp } from "@/src/utils/create-project"
import * as ERRORS from "@/src/utils/errors"
import { getConfig } from "@/src/utils/get-config"
import { getProjectInfo } from "@/src/utils/get-project-info"
import { updateAppIndex } from "@/src/utils/update-app-index"
import { z } from "zod"
import { ServerNotification, ServerRequest } from "@modelcontextprotocol/sdk/types"
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol"
import { spinner } from "@/src/utils/spinner"
import { getSafeWorkspaceCwd } from "@/src/utils/security"

const DEPRECATED_COMPONENTS = [
  {
    name: "toast",
    deprecatedBy: "sonner",
    message:
      "The toast component is deprecated. Use the sonner component instead.",
  },
  {
    name: "toaster",
    deprecatedBy: "sonner",
    message:
      "The toaster component is deprecated. Use the sonner component instead.",
  },
]

// MCP-safe version of the add command that doesn't call process.exit() or prompt users
export async function executeAddCommand(
  options: z.infer<typeof executeAddCommandOptionsSchema>,
  extra?: RequestHandlerExtra<ServerRequest, ServerNotification>
) {
  try {
    const validatedOptions = executeAddCommandOptionsSchema.parse(options)
    const addSpinner = spinner("Starting add command", extra, "add-command", 100).start()

    addSpinner.progress(0, "Starting add command")

    const cwd = getSafeWorkspaceCwd(options.cwd)

    const addOptions = addOptionsSchema.parse({
      ...validatedOptions,
      cwd,
      yes: true, // Always skip confirmation prompts in MCP context
      all: false,
      silent: true, // Run in silent mode for MCP
    })

    // Handle URL/local file components
    let itemType: z.infer<typeof registryItemTypeSchema> | undefined
    if (
      addOptions.components &&
      addOptions.components.length > 0 &&
      (isUrl(addOptions.components[0]) || isLocalFile(addOptions.components[0]))
    ) {
      const item = await getRegistryItem(addOptions.components[0], "")
      itemType = item?.type
    }

    // If no components specified, get all available components (for MCP we'll error instead)
    if (!addOptions.components?.length) {
      const registryIndex = await getRegistryIndex()
      if (!registryIndex) {
        throw new Error("Failed to fetch registry index.")
      }

      // For MCP, we don't prompt - we should have components specified
      throw new Error("No components specified to add.")
    }

    addSpinner.progress(20, "Getting project information")

    const projectInfo = await getProjectInfo(cwd)

    if (projectInfo?.tailwindVersion === "v4") {
      const deprecatedComponents = DEPRECATED_COMPONENTS.filter((component) =>
        addOptions.components?.includes(component.name)
      )

      if (deprecatedComponents?.length) {
        const messages = deprecatedComponents.map(
          (component) => component.message
        )
        throw new Error(`Deprecated components found: ${messages.join(", ")}`)
      }
    }

    addSpinner.progress(30, "Running preflight checks")

    let { errors, config } = await preFlightAdd(addOptions)

    addSpinner.progress(50, "preFlightAdd complete")
    // No components.json file. Run init automatically without prompting.
    if (errors[ERRORS.MISSING_CONFIG]) {
      addSpinner.fail("Running runInit for missing config")
      config = await runInit({
        cwd: cwd,
        yes: addOptions.initOptions?.yes || true,
        force: addOptions.initOptions?.force || false,
        defaults: false,
        skipPreflight: addOptions.initOptions?.skipPreflight || false,
        silent: true,
        isNewProject: false,
        srcDir: addOptions.srcDir,
        cssVariables: addOptions.cssVariables || true,
        style: addOptions.initOptions?.style || "default",
        flag: addOptions.initOptions?.flag,
        tailwindBaseColor: addOptions.initOptions?.tailwindBaseColor,
      })
    }

    addSpinner.progress(60, "runInit complete")

    let shouldUpdateAppIndex = false
    if (errors[ERRORS.MISSING_DIR_OR_EMPTY_PROJECT]) {
      const { projectPath, template } = await createProjectMcp({
        cwd: cwd,
        force: addOptions.overwrite || false,
        srcDir: addOptions.srcDir,
        components: addOptions.components,
        style: addOptions.initOptions?.style || "default",
        cssVariables: addOptions.cssVariables || true,
        yes: addOptions.initOptions?.yes || true,
        defaults: addOptions.initOptions?.defaults || false,
        silent: addOptions.initOptions?.silent || true,
        isNewProject: addOptions.initOptions?.isNewProject || true,
        flag: addOptions.initOptions?.flag,
        tailwindBaseColor: addOptions.initOptions?.tailwindBaseColor,
        skipPreflight: addOptions.initOptions?.skipPreflight || false,
      }, extra)

      addSpinner.progress(80, "createProject complete")

      if (!projectPath) {
        throw new Error("Failed to create project")
      }

      addOptions.cwd = projectPath

      if (template === "next-monorepo") {
        addOptions.cwd = path.resolve(cwd, "apps/web")
        config = await getConfig(addOptions.cwd)
      } else {
        config = await runInit({
          cwd: addOptions.cwd,
          yes: addOptions.initOptions?.yes || true,
          force: addOptions.initOptions?.force || false,
          defaults: addOptions.initOptions?.defaults || false,
          skipPreflight: addOptions.initOptions?.skipPreflight || false,
          silent: addOptions.initOptions?.silent || true,
          isNewProject: addOptions.initOptions?.isNewProject || true,
          srcDir: addOptions.srcDir,
          cssVariables: addOptions.cssVariables || true,
          style: addOptions.initOptions?.style || "default",
          flag: addOptions.initOptions?.flag,
          tailwindBaseColor: addOptions.initOptions?.tailwindBaseColor,
        })

        shouldUpdateAppIndex =
          addOptions.components?.length === 1 &&
          !!addOptions.components[0].match(/\/chat\/b\//)
      }
    }

    if (!config) {
      throw new Error(`Failed to read or create a config at ${addOptions.cwd}.`)
    }

    addSpinner.progress(70, `Adding components: ${addOptions.components?.join(", ")}`)

    const { filesCreated, filesModified } = await addComponents(
      addOptions.components,
      config,
      addOptions,
      extra
    )

    addSpinner.progress(80, "Finalizing installation")

    // If we're adding a single component and it's from the v0 registry,
    // let's update the app/page.tsx file to import the component.
    if (shouldUpdateAppIndex && addOptions.components?.[0]) {
      addSpinner.progress(95, "Updating app/page.tsx")
      await updateAppIndex(addOptions.components[0], config)
    }

    addSpinner.progress(100, "Installation complete!")

    return {
      success: true,
      message: `Successfully added components ${addOptions.components?.join(
        ", "
      )} to your project at ${addOptions.cwd}`,
      componentsAdded: addOptions.components,
      filesCreated,
      filesModified,
    }
  } catch (error) {
    const failSpinner = spinner("Add command failed", extra, "add-command").fail(
      error instanceof Error ? error.message : String(error)
    )
    failSpinner.fail(`Failed to add components: ${error instanceof Error ? error.message : String(error)}`)

    if (error instanceof Error) {
      throw error
    }
    throw new Error(`Failed to add components: ${String(error)}`)
  }
} 