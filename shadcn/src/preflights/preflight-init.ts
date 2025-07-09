import path from "path"
import { initOptionsSchema } from "@/src/schemas/init.schemas"
import * as ERRORS from "@/src/utils/errors"
import { getProjectInfo } from "@/src/utils/get-project-info"
import { logger } from "@/src/utils/logger"
import { spinner } from "@/src/utils/spinner"
import fs from "fs-extra"
import { z } from "zod"
import { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types"
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol"

export async function preFlightInit(
  options: z.infer<typeof initOptionsSchema>,
  extra?: RequestHandlerExtra<ServerRequest, ServerNotification>
) {
  const errors: Record<string, boolean> = {}

  // Ensure target directory exists.
  // Check for empty project. We assume if no package.json exists, the project is empty.
  if (
    !fs.existsSync(options.cwd) ||
    !fs.existsSync(path.resolve(options.cwd, "package.json"))
  ) {
    errors[ERRORS.MISSING_DIR_OR_EMPTY_PROJECT] = true
    return {
      errors,
      projectInfo: null,
    }
  }

  const projectSpinner = spinner(`Preflight checks.`, extra, "project").start()

  if (
    fs.existsSync(path.resolve(options.cwd, "components.json")) &&
    !options.force
  ) {
    projectSpinner?.fail()
    logger.break()
    logger.error(
      `A "components.json" file already exists at ${options.cwd}.\nTo start over, remove the "components.json" file and run "init" again.`
    )
    logger.break()
    throw new Error(`A components.json file already exists at ${options.cwd}.`)
  }

  projectSpinner?.succeed()

  const frameworkSpinner = spinner(`Verifying framework.`, extra, "framework").start()
  const projectInfo = await getProjectInfo(options.cwd)
  if (!projectInfo || projectInfo?.framework.name === "manual") {
    errors[ERRORS.UNSUPPORTED_FRAMEWORK] = true
    frameworkSpinner?.fail()
    logger.break()
    if (projectInfo?.framework.links.installation) {
      logger.error(
        `We could not detect a supported framework at ${options.cwd}.\n` +
        `Visit ${projectInfo?.framework.links.installation} to manually configure your project.\nOnce configured, you can use the cli to add components.`
      )
    }
    logger.break()
    throw new Error(`No Tailwind CSS configuration or import alias found in your project at ${options.cwd}.`)
  }
  frameworkSpinner?.succeed(
    `Verifying framework. Found ${projectInfo.framework.label}.`
  )

  let tailwindSpinnerMessage = "Validating Tailwind CSS."

  if (projectInfo.tailwindVersion === "v4") {
    tailwindSpinnerMessage = `Validating Tailwind CSS config. Found ${projectInfo.tailwindVersion}.`
  }

  const tailwindSpinner = spinner(tailwindSpinnerMessage, extra, "tailwind").start()
  if (
    projectInfo.tailwindVersion === "v3" &&
    (!projectInfo?.tailwindConfigFile || !projectInfo?.tailwindCssFile)
  ) {
    errors[ERRORS.TAILWIND_NOT_CONFIGURED] = true
    tailwindSpinner?.fail()
  } else if (
    projectInfo.tailwindVersion === "v4" &&
    !projectInfo?.tailwindCssFile
  ) {
    errors[ERRORS.TAILWIND_NOT_CONFIGURED] = true
    tailwindSpinner?.fail()
  } else if (!projectInfo.tailwindVersion) {
    errors[ERRORS.TAILWIND_NOT_CONFIGURED] = true
    tailwindSpinner?.fail()
  } else {
    tailwindSpinner?.succeed()
  }

  const tsConfigSpinner = spinner(`Validating import alias.`, extra, "tsconfig").start()
  if (!projectInfo?.aliasPrefix) {
    errors[ERRORS.IMPORT_ALIAS_MISSING] = true
    tsConfigSpinner?.fail()
  } else {
    tsConfigSpinner?.succeed()
  }

  if (Object.keys(errors).length > 0) {
    if (errors[ERRORS.TAILWIND_NOT_CONFIGURED]) {
      logger.break()
      logger.error(
        `No Tailwind CSS configuration found at ${options.cwd}.`
      )
      logger.error(
        `It is likely you do not have Tailwind CSS installed or have an invalid configuration.`
      )
      logger.error(`Install Tailwind CSS then try again.`)
      if (projectInfo?.framework.links.tailwind) {
        logger.error(
          `Visit ${projectInfo?.framework.links.tailwind} to get started.`
        )
      }
    }

    if (errors[ERRORS.IMPORT_ALIAS_MISSING]) {
      logger.break()
      logger.error(`No import alias found in your tsconfig.json file.`)
      if (projectInfo?.framework.links.installation) {
        logger.error(
          `Visit ${projectInfo?.framework.links.installation} to learn how to set an import alias.`
        )
      }
    }

    logger.break()
    throw new Error('')
  }

  return {
    errors,
    projectInfo,
  }
}
