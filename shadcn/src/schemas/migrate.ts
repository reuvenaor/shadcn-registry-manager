import { z } from "zod"

// Standalone schema, not inherited or reused by others
export const migrations = [
  {
    name: "icons",
    description: "migrate your ui components to a different icon library.",
  },
  {
    name: "radix",
    description: "migrate to radix-ui.",
  },
] as const

export const migrateOptionsSchema = z.object({
  cwd: z.string().describe("The working directory. Defaults to the current directory."),
  list: z.boolean().describe("List available migrations."),
  yes: z.boolean().describe("Skip all prompts and use default values."),
  migration: z
    .string()
    .refine(
      (value) =>
        value && migrations.some((migration) => migration.name === value),
      {
        message:
          "You must specify a valid migration. Run `shadcn migrate --list` to see available migrations.",
      }
    )
    .optional()
    .describe("The migration to run."),
})