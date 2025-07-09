import path from "path"
import { migrateOptionsSchema } from "@/src/schemas/migrate"
import * as ERRORS from "@/src/utils/errors"
import { getConfig } from "@/src/utils/get-config"
import { logger } from "@/src/utils/logger"
import fs from "fs-extra"
import { z } from "zod"

export async function preFlightMigrate(
  options: z.infer<typeof migrateOptionsSchema>
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
      config: null,
    }
  }

  // Check for existing components.json file.
  if (!fs.existsSync(path.resolve(options.cwd, "components.json"))) {
    errors[ERRORS.MISSING_CONFIG] = true
    return {
      errors,
      config: null,
    }
  }

  try {
    const config = await getConfig(options.cwd)

    return {
      errors,
      config: config!,
    }
  } catch (error) {
    logger.break()
    logger.error(
      `An invalid components.json file was found at ${options.cwd}.\nBefore you can run a migration, you must create a valid components.json file by running the init command.`
    )
    logger.error(
      `Learn more at "https://ui.shadcn.com/docs/components-json".`
    )
    logger.break()
    throw new Error(`Invalid components.json file found at ${options.cwd}.`)
  }
}
