import { getRegistry } from "../lib/registry-utils"
import { z } from "zod"
import { getItemsOptionsSchema } from "@/src/schemas/registry.schemas"

export async function getItems(args: z.infer<typeof getItemsOptionsSchema>) {
  const { registryUrl } = getItemsOptionsSchema.parse(args)
  const registry = await getRegistry(registryUrl)

  if (!registry) {
    return {
      content: [
        {
          type: "text",
          text: "No items found in the registry",
        },
      ],
    }
  }

  return {
    content: [
      {
        type: "text",
        text: `The following items are available in the registry:
              ${registry
            .map(
              (item) =>
                `- ${item.name} (${item.type})${item.description ? `: ${item.description}` : ""
                }`
            )
            .join("\n")}.
              - To install and use an item in your project, you can use the execute_add tool to add it directly to your project.
              - Example: Use execute_add with components: ["${registry[0].name
          }"], cwd: "/path/to/your/project" to install the ${registry[0].name
          } item.
              - Before using any item, you need to add it first.
              - Adding the items will install all dependencies for the item and format the code as per the project.
              - Example components should not be installed directly unless asked. These components should be used as a reference to build other components.
              `,
      },
    ],
  }
} 