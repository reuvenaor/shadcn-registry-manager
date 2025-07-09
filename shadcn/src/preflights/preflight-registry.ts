import path from "path"
import { buildOptionsSchema } from "@/src/schemas/build"
import * as ERRORS from "@/src/utils/errors"
import { getConfig } from "@/src/utils/get-config"
import { logger } from "@/src/utils/logger"
import fs from "fs-extra"
import { z } from "zod"

export async function preFlightRegistryBuild(
  options: z.infer<typeof buildOptionsSchema>
) {
  const errors: Record<string, boolean> = {}

  const resolvePaths = {
    cwd: options.cwd,
    registryFile: path.resolve(options.cwd, options.registryFile),
    outputDir: path.resolve(options.cwd, options.outputDir),
  }

  // Ensure registry file exists.
  if (!fs.existsSync(resolvePaths.registryFile)) {
    errors[ERRORS.BUILD_MISSING_REGISTRY_FILE] = true
    return {
      errors,
      resolvePaths: null,
      config: null,
    }
  }

  // Check for existing components.json file.
  if (!fs.existsSync(path.resolve(options.cwd, "components.json"))) {
    errors[ERRORS.MISSING_CONFIG] = true
    return {
      errors,
      resolvePaths: null,
      config: null,
    }
  }

  // Create output directory if it doesn't exist.
  await fs.mkdir(resolvePaths.outputDir, { recursive: true })

  try {
    const config = await getConfig(options.cwd)

    return {
      errors,
      config: config!,
      resolvePaths,
    }
  } catch (error) {
    logger.break()
    logger.error(
      `An invalid components.json file was found at ${options.cwd}.\nBefore you can build the registry, you must create a valid components.json file by running the init command.`
    )
    logger.break()
    throw new Error(`Invalid components.json file found at ${options.cwd}.`)
  }
}
