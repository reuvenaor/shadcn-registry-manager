import { getRegistryItem } from "@/src/registry/api"
import { z } from "zod"
import { getRegistryItemUrl } from "../lib/registry-utils"
import { getItemOptionsSchema } from "@/src/schemas/registry.schemas"

export async function getItem(
  args: z.infer<typeof getItemOptionsSchema>,
  { registryUrl, style }: { registryUrl: string; style: string }
) {
  const { name } = getItemOptionsSchema.parse(args)

  const itemUrl = getRegistryItemUrl(name, registryUrl, style)
  const item = await getRegistryItem(itemUrl, "")

  return {
    content: [{ type: "text", text: JSON.stringify(item, null, 2) }],
    structuredContent: item,
  }
} 