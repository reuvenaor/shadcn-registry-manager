import { z } from "zod";
import { registryItemCssSchema, tailwindConfigSchema, registryItemFileSchema } from "@/src/registry/schema";

export const updateCssOptionsSchema = z.object({
  css: registryItemCssSchema.optional().describe("The css to update."),
  silent: z.boolean().optional().describe("Suppress all output."),
});

export const updateCssVarsOptionsSchema = z.object({
  cleanupDefaultNextStyles: z.boolean().optional().describe("Whether to clean up default Next.js styles."),
  overwriteCssVars: z.boolean().optional().describe("Whether to overwrite existing CSS variables."),
  initIndex: z.boolean().optional().describe("Whether to initialize the index."),
  silent: z.boolean().optional().describe("Suppress all output."),
  tailwindVersion: z.enum(["v3", "v4"]).optional().describe("The Tailwind CSS version."),
  tailwindConfig: tailwindConfigSchema.describe("The Tailwind CSS configuration."),
});

export const updateFilesOptionsSchema = z.object({
  files: z.array(registryItemFileSchema).describe("The files to update."),
  targetDir: z.string().describe("The target directory."),
  overwrite: z.boolean().optional().describe("Whether to overwrite existing files."),
  silent: z.boolean().optional().describe("Suppress all output."),
  isRemote: z.boolean().optional().describe("Whether the files are remote."),
});

export const updateTailwindConfigOptionsSchema = z.object({
  tailwindConfig: z.unknown().optional().describe("The Tailwind CSS configuration."),
  silent: z.boolean().optional().describe("Suppress all output."),
  tailwindVersion: z.enum(["v3", "v4"]).optional().describe("The Tailwind CSS version."),
});

export const updateTailwindContentOptionsSchema = z.object({
  content: z.array(z.string()).describe("The content to update."),
  silent: z.boolean().optional().describe("Suppress all output."),
});

export const updateDependenciesOptionsSchema = z.object({
  dependencies: z.array(z.string()).optional().describe("The dependencies to update."),
  devDependencies: z.array(z.string()).optional().describe("The dev dependencies to update."),
  silent: z.boolean().optional().describe("Suppress all output."),
  flag: z.enum(["force", "legacy-peer-deps"]).optional().describe("The flag to use when updating dependencies."),
}); 