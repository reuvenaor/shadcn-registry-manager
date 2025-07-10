import path from "path"
import {
  fetchRegistry,
  getRegistryParentMap,
  getRegistryTypeAliasMap,
  registryResolveItemsTree,
  resolveRegistryItems,
} from "@/src/registry/api"
import { registryItemSchema } from "@/src/registry/schema"
import {
  configSchema,
  findCommonRoot,
  findPackageRoot,
  getWorkspaceConfig,
  workspaceConfigSchema,
  type Config,
} from "@/src/utils/get-config"
import { getProjectTailwindVersionFromConfig } from "@/src/utils/get-project-info"
import { logger } from "@/src/utils/logger"
import { spinner } from "@/src/utils/spinner"
import { updateCss } from "@/src/utils/updaters/update-css"
import { updateCssVars } from "@/src/utils/updaters/update-css-vars"
import { updateDependencies } from "@/src/utils/updaters/update-dependencies"
import { updateFiles } from "@/src/utils/updaters/update-files"
import { updateTailwindConfig } from "@/src/utils/updaters/update-tailwind-config"
import { z } from "zod"
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol"
import { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types"
import { initOptionsSchema } from "@/src/schemas/init.schemas"
import { addComponentsOptionsSchema } from "@/src/schemas/add.schemas"

export async function addComponents(
  components: string[],
  config: Config,
  options: z.infer<typeof addComponentsOptionsSchema>,
  extra?: RequestHandlerExtra<ServerRequest, ServerNotification>
) {
  const validatedOptions = addComponentsOptionsSchema.parse(options)
  options = {
    overwrite: false,
    silent: false,
    isNewProject: false,
    style: "default",
    ...validatedOptions,
  }

  const workspaceConfig = await getWorkspaceConfig(config)
  if (
    workspaceConfig &&
    workspaceConfig.ui &&
    workspaceConfig.ui.resolvedPaths.cwd !== config.resolvedPaths.cwd
  ) {
    const result = await addWorkspaceComponents(
      components,
      config,
      workspaceConfig,
      {
        ...options,
        isRemote:
          components?.length === 1 && !!components[0].match(/\/chat\/b\//),
        initOptions: options.initOptions,
      },
      extra
    )
    return {
      filesCreated: result.filesCreated,
      filesModified: result.filesUpdated,
    }
  }

  return await addProjectComponents(components, config, options, extra)
}

async function addProjectComponents(
  components: string[],
  config: z.infer<typeof configSchema>,
  options: z.infer<typeof addComponentsOptionsSchema>,
  extra?: RequestHandlerExtra<ServerRequest, ServerNotification>
) {
  const registrySpinner = spinner(`Checking registry.`, extra, "addProjectComponents", 5).start()
  const tree = await registryResolveItemsTree(components, config)
  if (!tree) {
    registrySpinner?.fail("Failed to fetch components from registry.")
    throw new Error("Failed to fetch components from registry.")
  }
  const filesModified: string[] = []

  const tailwindVersion = await getProjectTailwindVersionFromConfig(config)

  const tailwindConfigUpdated = await updateTailwindConfig(
    tree.tailwind?.config,
    config,
    {
      silent: options.silent,
      tailwindVersion: tailwindVersion ?? undefined,
    }, extra
  )
  if (tailwindConfigUpdated) {
    filesModified.push(
      path.relative(config.resolvedPaths.cwd, tailwindConfigUpdated)
    )
  }
  registrySpinner?.progress(1, "Tailwind config updated")

  const overwriteCssVars = await shouldOverwriteCssVars(components, config)
  const cssVarsUpdated = await updateCssVars(tree.cssVars, config, {
    cleanupDefaultNextStyles: options.isNewProject,
    silent: options.silent,
    tailwindVersion: tailwindVersion ?? undefined,
    tailwindConfig: tree.tailwind?.config,
    overwriteCssVars,
    initIndex: options.style ? options.style === "index" : false,
  }, extra)
  if (cssVarsUpdated) {
    filesModified.push(path.relative(config.resolvedPaths.cwd, cssVarsUpdated))
  }
  registrySpinner?.progress(2, "CSS vars updated")

  // Add CSS updater
  const cssUpdated = await updateCss(tree.css, config, {
    silent: options.silent,
    css: tree.css,
  }, extra)
  if (cssUpdated) {
    filesModified.push(path.relative(config.resolvedPaths.cwd, cssUpdated))
  }

  registrySpinner?.progress(3, "CSS updated")

  await updateDependencies(tree.dependencies, tree.devDependencies, config, {
    silent: options.silent,
    flag: options.initOptions?.flag,
  }, extra)
  const { filesCreated, filesUpdated } = await updateFiles(tree.files, config, {
    overwrite: options.overwrite,
    silent: options.silent,
    files: tree.files ?? [],
    targetDir: config.resolvedPaths.components,
  }, extra)

  registrySpinner?.progress(4, "Files updated")

  if (tree.docs) {
    logger.info(tree.docs)
  }

  registrySpinner?.succeed()

  return {
    filesCreated,
    filesModified: [...filesModified, ...filesUpdated],
  }
}

async function addWorkspaceComponents(
  components: string[],
  config: z.infer<typeof configSchema>,
  workspaceConfig: z.infer<typeof workspaceConfigSchema>,
  options: {
    overwrite?: boolean
    silent?: boolean
    isNewProject?: boolean
    isRemote?: boolean
    style?: string
    initOptions?: z.infer<typeof initOptionsSchema>
  },
  extra?: RequestHandlerExtra<ServerRequest, ServerNotification>
) {
  const rootSpinner = spinner(`Checking registry.`, extra, "addWorkspaceComponents", 5).start()
  let registryItems = await resolveRegistryItems(components, config)
  let result = await fetchRegistry(registryItems)
  const payload = z.array(registryItemSchema).parse(result)
  if (!payload) {
    rootSpinner?.fail("Failed to fetch components from registry.")
    throw new Error("Failed to fetch components from registry.")
  }

  rootSpinner?.progress(2, "Fetching components from registry")

  const registryParentMap = getRegistryParentMap(payload)
  const registryTypeAliasMap = getRegistryTypeAliasMap()

  const filesCreated: string[] = []
  const filesUpdated: string[] = []
  const filesSkipped: string[] = []

  rootSpinner?.progress(3, "Resolving components")

  for (const component of payload) {
    const alias = registryTypeAliasMap.get(component.type)
    const registryParent = registryParentMap.get(component.name)

    // We don't support this type of component.
    if (!alias) {
      continue
    }

    // A good start is ui for now.
    // TODO: Add support for other types.
    let targetConfig =
      component.type === "registry:ui" || registryParent?.type === "registry:ui"
        ? workspaceConfig.ui
        : config

    const tailwindVersion = await getProjectTailwindVersionFromConfig(
      targetConfig
    )

    const workspaceRoot = findCommonRoot(
      config.resolvedPaths.cwd,
      targetConfig.resolvedPaths.ui
    )
    const packageRoot =
      (await findPackageRoot(workspaceRoot, targetConfig.resolvedPaths.cwd)) ??
      targetConfig.resolvedPaths.cwd

    // 1. Update tailwind config.
    if (component.tailwind?.config) {
      await updateTailwindConfig(component.tailwind?.config, targetConfig, {
        silent: true,
        tailwindVersion: tailwindVersion ?? undefined,
      })
      filesUpdated.push(
        path.relative(workspaceRoot, targetConfig.resolvedPaths.tailwindConfig)
      )
    }

    // 2. Update css vars.
    if (component.cssVars) {
      const overwriteCssVars = await shouldOverwriteCssVars(components, config)
      await updateCssVars(component.cssVars, targetConfig, {
        silent: true,
        tailwindVersion: tailwindVersion ?? undefined,
        tailwindConfig: component.tailwind?.config,
        overwriteCssVars,
      }, extra)
      filesUpdated.push(
        path.relative(workspaceRoot, targetConfig.resolvedPaths.tailwindCss)
      )
    }

    // 3. Update CSS
    if (component.css) {
      await updateCss(component.css, targetConfig, {
        silent: true,
      }, extra)
      filesUpdated.push(
        path.relative(workspaceRoot, targetConfig.resolvedPaths.tailwindCss)
      )
    }

    // 4. Update dependencies.
    await updateDependencies(
      component.dependencies,
      component.devDependencies,
      targetConfig,
      {
        silent: true,
        flag: options.initOptions?.flag,
      }, extra)

    // 5. Update files.
    const files = await updateFiles(component.files, targetConfig, {
      overwrite: options.overwrite,
      silent: true,
      files: component.files ?? [],
      targetDir: targetConfig.resolvedPaths.components,
      // rootSpinner,
      isRemote: options.isRemote,
    }, extra)

    filesCreated.push(
      ...files.filesCreated.map((file) =>
        path.relative(workspaceRoot, path.join(packageRoot, file))
      )
    )
    filesUpdated.push(
      ...files.filesUpdated.map((file) =>
        path.relative(workspaceRoot, path.join(packageRoot, file))
      )
    )
    filesSkipped.push(
      ...files.filesSkipped.map((file) =>
        path.relative(workspaceRoot, path.join(packageRoot, file))
      )
    )
  }

  rootSpinner?.progress(4, 'Installing components complete')

  // Sort files.
  filesCreated.sort()
  filesUpdated.sort()
  filesSkipped.sort()

  const hasUpdatedFiles = filesCreated.length || filesUpdated.length
  if (!hasUpdatedFiles && !filesSkipped.length) {
    rootSpinner?.info(`No files updated.`)
  }

  if (filesCreated.length) {
    rootSpinner?.progress(5, `Created ${filesCreated.length} ${filesCreated.length === 1 ? "file" : "files"}`)
    for (const file of filesCreated) {
      logger.log(`  - ${file}`)
    }
  }

  if (filesUpdated.length) {
    rootSpinner?.progress(5, `Updated ${filesUpdated.length} ${filesUpdated.length === 1 ? "file" : "files"}`)
    for (const file of filesUpdated) {
      logger.log(`  - ${file}`)
    }
  }

  if (filesSkipped.length) {
    rootSpinner?.progress(5, `Skipped ${filesSkipped.length} ${filesSkipped.length === 1 ? "file" : "files"}: (use --overwrite to overwrite)`)
    for (const file of filesSkipped) {
      logger.log(`  - ${file}`)
    }
  }

  rootSpinner?.succeed()

  return {
    filesCreated,
    filesUpdated,
    filesSkipped,
  }
}

async function shouldOverwriteCssVars(
  components: z.infer<typeof registryItemSchema>["name"][],
  config: z.infer<typeof configSchema>
) {
  let registryItems = await resolveRegistryItems(components, config)
  let result = await fetchRegistry(registryItems)
  const payload = z.array(registryItemSchema).parse(result)

  return payload.some(
    (component) =>
      component.type === "registry:theme" || component.type === "registry:style"
  )
}
