import { z } from "zod";
import { BASE_COLORS } from "@/src/registry/api";
import { TEMPLATES } from "@/src/utils/create-project";

export const initOptionsSchema = z.object({
  cwd: z.string().describe("The working directory. Defaults to the current directory."),
  components: z.array(z.string()).optional().describe("The components to initialize with."),
  yes: z.boolean().describe("Skip all prompts and use default values."),
  defaults: z.boolean().describe("Use default values for all prompts."),
  force: z.boolean().describe("Overwrite existing configuration files."),
  silent: z.boolean().describe("Suppress all output."),
  isNewProject: z.boolean().describe("Whether this is a new project."),
  srcDir: z.boolean().optional().describe("Whether to use a `src` directory."),
  cssVariables: z.boolean().describe("Whether to use CSS variables for theming."),
  flag: z.enum(["force", "legacy-peer-deps"]).optional().describe("Flags to pass to the package manager."),
  style: z.enum(["new-york", "default", "none"]).describe("The style to use."),
  skipPreflight: z.boolean().describe("Skip preflight checks."),
  tailwindBaseColor: z.enum(BASE_COLORS.map(color => color.name) as [string, ...string[]]).optional().describe("The base color for Tailwind CSS."),
  template: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (val) {
          return TEMPLATES[val as keyof typeof TEMPLATES];
        }
        return true;
      },
      {
        message: "Invalid template. Please use 'next' or 'next-monorepo'.",
      }
    ).describe("The project template to use."),
  baseColor: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (val) {
          return BASE_COLORS.find((color) => color.name === val);
        }
        return true;
      },
      {
        message: `Invalid base color. Please use '${BASE_COLORS.map((color) => color.name).join("', '")}'`,
      }
    ).describe("The base color for the project."),
});

export const executeInitOptionsSchema = z.object({
  cwd: z.string().describe("The working directory path where the project should be initialized. This is required."),
  style: z.enum(["new-york", "default", "none"]).optional().default("new-york").describe("The style to use for the project."),
  baseColor: z.string().optional().default("slate").describe("The base color to use for the project."),
  srcDir: z.boolean().optional().describe("Whether to use the src directory structure. Defaults to false."),
  cssVariables: z.boolean().optional().describe("Whether to use CSS variables for theming. Defaults to true."),
  force: z.boolean().optional().describe("Whether to overwrite existing files. Defaults to false."),
  template: z.string().optional().describe("The template to use for the project. Can be 'next' or 'next-monorepo'."),
});

export const getInitInstructionsOptionsSchema = z.object({
  registryUrl: z.string(),
  style: z.string(),
});

export const createProjectOptionsSchema = initOptionsSchema; 