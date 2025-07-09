import { initOptionsSchema } from "@/src/schemas/init.schemas"
import { promises as fs } from "fs"
import path from "path"
import { preFlightInit } from "@/src/preflights/preflight-init"
import { addComponents } from "@/src/utils/add-components"
import { createProject } from "@/src/utils/create-project"
import * as ERRORS from "@/src/utils/errors"
import {
  DEFAULT_COMPONENTS,
  DEFAULT_TAILWIND_CONFIG,
  DEFAULT_TAILWIND_CSS,
  DEFAULT_UTILS,
  getConfig,
  rawConfigSchema,
  resolveConfigPaths,
  // type Config,
  DEFAULT_TAILWIND_BASE_COLOR,
} from "@/src/utils/get-config"
import {
  getProjectConfig,
  getProjectInfo,
} from "@/src/utils/get-project-info"
import { spinner } from "@/src/utils/spinner"
import { updateTailwindContent } from "@/src/utils/updaters/update-tailwind-content"
import { z } from "zod"
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol"
import { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types"

export async function runInit(
  options: z.infer<typeof initOptionsSchema> & {
    skipPreflight?: boolean
  },
  extra?: RequestHandlerExtra<ServerRequest, ServerNotification>
) {
  let projectInfo
  let newProjectTemplate
  if (!options.skipPreflight) {
    const preflight = await preFlightInit(options, extra)
    if (preflight.errors[ERRORS.MISSING_DIR_OR_EMPTY_PROJECT]) {
      const { projectPath, template } = await createProject(options)
      if (!projectPath) {
        throw new Error("Missing directory or empty project")
      }
      options.cwd = projectPath
      options.isNewProject = true
      newProjectTemplate = template
    }
    projectInfo = preflight.projectInfo
  } else {
    projectInfo = await getProjectInfo(options.cwd)
  }

  if (newProjectTemplate === "next-monorepo") {
    options.cwd = path.resolve(options.cwd, "apps/web")
    return await getConfig(options.cwd)
  }

  const projectConfig = await getProjectConfig(options.cwd, projectInfo)

  let config: z.infer<typeof rawConfigSchema>
  if (projectConfig) {
    // Ported from `promptForMinimalConfig`.
    const style = options.style ?? projectConfig.style
    const baseColor =
      options.tailwindBaseColor ??
      options.baseColor ??
      projectConfig.tailwind.baseColor
    const cssVariables = options.cssVariables

    config = rawConfigSchema.parse({
      $schema: projectConfig.$schema,
      style,
      tailwind: {
        ...projectConfig.tailwind,
        baseColor,
        cssVariables,
      },
      rsc: projectConfig.rsc,
      tsx: projectConfig.tsx,
      aliases: projectConfig.aliases,
      iconLibrary: projectConfig.iconLibrary,
    })
  } else {
    if (!projectInfo) {
      throw new Error(
        "Project info could not be determined. Please report this."
      )
    }

    // Ported from `promptForConfig`.
    const tsx = projectInfo.isTsx
    const rsc = projectInfo.isRSC
    const tailwindCss = projectInfo.tailwindCssFile ?? DEFAULT_TAILWIND_CSS
    const tailwindConfig =
      projectInfo.tailwindConfigFile ?? DEFAULT_TAILWIND_CONFIG

    const components = projectInfo.aliasPrefix
      ? `${projectInfo.aliasPrefix}/components`
      : DEFAULT_COMPONENTS
    const utils = projectInfo.aliasPrefix
      ? `${projectInfo.aliasPrefix}/lib/utils`
      : DEFAULT_UTILS

    config = rawConfigSchema.parse({
      $schema: "https://ui.shadcn.com/schema.json",
      style: options.style,
      tailwind: {
        config: tailwindConfig,
        css: tailwindCss,
        baseColor: options.tailwindBaseColor ?? DEFAULT_TAILWIND_BASE_COLOR,
        cssVariables: options.cssVariables,
        prefix: "",
      },
      rsc: rsc,
      tsx: tsx,
      aliases: {
        utils,
        components,
        lib: utils.replace(/\/utils$/, ""),
        hooks: components.replace(/\/components$/, "/hooks"),
      },
    })
  }

  // Write components.json.
  const componentSpinner = spinner(`Writing components.json.`, extra, "components").start()
  const targetPath = path.resolve(options.cwd, "components.json")
  await fs.writeFile(targetPath, JSON.stringify(config, null, 2), "utf8")
  componentSpinner.succeed()

  // Add components.
  const fullConfig = await resolveConfigPaths(options.cwd, config)
  const components = [
    ...(options.style === "none" ? [] : [options.style]),
    ...(options.components ?? []),
  ]
  await addComponents(components, fullConfig, {
    // Init will always overwrite files.
    overwrite: true,
    silent: options.silent,
    style: options.style,
    isNewProject:
      options.isNewProject || projectInfo?.framework.name === "next-app",
    initOptions: {
      ...options,
    },
  })

  // If a new project is using src dir, let's update the tailwind content config.
  // TODO: Handle this per framework.
  if (options.isNewProject && options.srcDir) {
    await updateTailwindContent(
      ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
      fullConfig,
      {
        silent: options.silent,
        content: []
      }
    )
  }

  return fullConfig
}