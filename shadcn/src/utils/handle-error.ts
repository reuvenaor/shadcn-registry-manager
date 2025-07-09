import { logger } from "@/src/utils/logger"
import { z } from "zod"

// This function now logs the error and always throws, making it MCP-safe.
// It is marked with a `never` return type to indicate it never returns normally.
export function handleError(error: unknown, main: boolean = false): never {
  logger.error(
    `Something went wrong. Please check the error below for more details.`
  )
  logger.error(`If the problem persists, please open an issue on GitHub.`)
  logger.error("")

  let errorMessage = "Unknown error"

  if (typeof error === "string") {
    logger.error(error)
    errorMessage = error
  } else if (error instanceof z.ZodError) {
    logger.error("Validation failed:")
    const fieldErrors = []
    for (const [key, value] of Object.entries(error.flatten().fieldErrors)) {
      const msg = `- ${key}: ${value}`
      logger.error(msg)
      fieldErrors.push(msg)
    }
    errorMessage = `Validation failed: ${fieldErrors.join(", ")}`
  } else if (error instanceof Error) {
    logger.error(error.message)
    errorMessage = error.message
  }

  logger.break()

  if (main) {
    process.exit(1)
  }
  // For an MCP server, we must throw the error instead of exiting the process.
  throw new Error(errorMessage)
}
