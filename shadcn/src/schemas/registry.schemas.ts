import { z } from "zod";

export const getItemOptionsSchema = z.object({
  name: z.string().describe("The name of the item to get from the registry. This is required."),
});

export const getItemsOptionsSchema = z.object({
  registryUrl: z.string(),
}); 