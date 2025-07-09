import { z } from "zod";
import { initOptionsField } from "./fields";

export const executeAddOptionsSchema = z.object({
  components: z.array(z.string()).describe("Array of component names to add to the project. This is required."),
  cwd: z.string().describe("The working directory path where the project is located. This is required and must be the user's project directory."),
  overwrite: z.boolean().optional().describe("Whether to overwrite existing files. Defaults to false."),
  srcDir: z.boolean().optional().describe("Whether to use the src directory structure. Defaults to false."),
  cssVariables: z.boolean().optional().describe("Whether to use CSS variables for theming. Defaults to true."),
  ...initOptionsField,
});

export const addItemOptionsSchema = executeAddOptionsSchema.pick({
  cwd: true,
  srcDir: true,
  cssVariables: true,
  overwrite: true,
  initOptions: true,
}).extend({
  name: z.string().describe("The name of the item to add to the registry. This is required."),
});

export const addComponentsOptionsSchema = executeAddOptionsSchema.pick({
  overwrite: true,
  initOptions: true,
}).partial().extend({
  silent: z.boolean().optional(),
  isNewProject: z.boolean().optional(),
  style: z.string().optional(),
});

export const executeAddCommandOptionsSchema = executeAddOptionsSchema.pick({
  components: true,
  cwd: true,
  overwrite: true,
  srcDir: true,
  cssVariables: true,
  initOptions: true,
});

export const addOptionsSchema = executeAddOptionsSchema.pick({
  components: true,
  cwd: true,
  overwrite: true,
  srcDir: true,
  cssVariables: true,
  initOptions: true,
}).extend({
  yes: z.boolean().describe("Skip all prompts and use default values."),
  all: z.boolean().describe("Whether to add all components."),
  path: z.string().optional().describe("The path to add the component to."),
  silent: z.boolean().describe("Suppress all output."),
}); 