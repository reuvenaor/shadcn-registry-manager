import path from "path"
import { buildOptionsSchema } from "@/src/schemas/build"
import * as ERRORS from "@/src/utils/errors"
import { logger } from "@/src/utils/logger"
import fs from "fs-extra"
import { z } from "zod"

export async function preFlightBuild(
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
  }

  // Create output directory if it doesn't exist.
  await fs.mkdir(resolvePaths.outputDir, { recursive: true })

  if (Object.keys(errors).length > 0) {
    if (errors[ERRORS.BUILD_MISSING_REGISTRY_FILE]) {
      logger.break()
      logger.error(
        `The path ${resolvePaths.registryFile} does not exist.`
      )
      throw new Error(`The registry file at ${resolvePaths.registryFile} does not exist.`)
    }

    logger.break()
    throw new Error('...')
  }

  return {
    errors,
    resolvePaths,
  }
}
