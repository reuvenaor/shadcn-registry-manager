import { z } from "zod"

// Standalone schema, not inherited or reused by others
export const buildOptionsSchema = z.object({
  cwd: z.string().optional().describe("The working directory. Defaults to the current directory."),
  registryFile: z.string().describe("The path to the registry file."),
  outputDir: z.string().describe("The output directory."),
})