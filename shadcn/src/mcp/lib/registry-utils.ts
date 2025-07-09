import { registryIndexSchema } from "@/src/registry"
import { fetchRegistry } from "@/src/registry/api"

export async function getRegistry(registryUrl: string) {
  const [registryJson] = await fetchRegistry([`${registryUrl}/index.json`], {
    useCache: false,
  })
  return registryIndexSchema.parse(registryJson)
}

export function getRegistryItemUrl(
  itemName: string,
  registryUrl: string,
  style: string
) {
  return `${registryUrl}/styles/${style}/${itemName}.json`
} 