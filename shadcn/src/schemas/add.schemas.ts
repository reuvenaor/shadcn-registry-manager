import { z } from "zod";
import { initOptionsField } from "./fields";

// This is the base schema for "add" operations, with options common to most commands.
// It does NOT include `cwd`.
const addOperationBaseSchema = z.object({
  overwrite: z.boolean().optional().describe("Whether to overwrite existing files. Defaults to false."),
  srcDir: z.boolean().optional().describe("Whether to use the src directory structure. Defaults to false."),
  cssVariables: z.boolean().optional().describe("Whether to use CSS variables for theming. Defaults to true."),
  ...initOptionsField,
});

// This schema is for the `execute_add` tool.
// It extends the base schema with the `components` array and does NOT accept `cwd`.
export const executeAddOptionsSchema = addOperationBaseSchema.extend({
  components: z.array(z.string()).describe("Array of component names to add to the project. This is required."),
});

// This schema is for the `add_item` tool.
// It extends the base schema with a `name` for a single component and does NOT accept `cwd`.
export const addItemOptionsSchema = addOperationBaseSchema.extend({
  name: z.string().describe("The name of the item to add to the registry. This is required."),
});

// This schema is for the internal `addComponents` utility. It does NOT accept `cwd`.
export const addComponentsOptionsSchema = addOperationBaseSchema.pick({
  overwrite: true,
  initOptions: true,
}).partial().extend({
  silent: z.boolean().optional(),
  isNewProject: z.boolean().optional(),
  style: z.string().optional(),
});

// This schema is for the internal `executeAddCommand`.
// It extends the `executeAddOptionsSchema` and explicitly adds `cwd`, as it is required for file operations.
export const executeAddCommandOptionsSchema = executeAddOptionsSchema.extend({
  cwd: z.string().describe("The working directory path where the project is located. This is required and must be the user's project directory."),
});

// This is a comprehensive schema for the internal `add` command, including `cwd` and other automation flags.
export const addOptionsSchema = executeAddCommandOptionsSchema.extend({
  yes: z.boolean().describe("Skip all prompts and use default values."),
  all: z.boolean().describe("Whether to add all components."),
  path: z.string().optional().describe("The path to add the component to."),
  silent: z.boolean().describe("Suppress all output."),
}); 