import { getRegistry, getRegistryItemUrl } from "../lib/registry-utils"
import { z } from "zod"
import { getInitInstructionsOptionsSchema } from "@/src/schemas/init.schemas"

export async function getInitInstructions(
  args: z.infer<typeof getInitInstructionsOptionsSchema>
) {
  const { registryUrl, style } = getInitInstructionsOptionsSchema.parse(args)
  const registry = await getRegistry(registryUrl)
  const styleItem = registry.find((item) => item.type === "registry:style")

  let text = `To initialize a new project, run the following command:
                \`\`\`bash
                npx shadcn@canary init
                \`\`\`
                - This will install all the dependencies and theme for the project.
                - If running the init command installs a rules i.e registry.mdc file, you should follow the instructions in the file to configure the project.
                `

  const rules = registry.find(
    (item) => item.type === "registry:file" && item.name === "rules"
  )

  if (rules) {
    text += `
                You should also install the rules for the project.
                \`\`\`bash
                npx shadcn@canary add ${getRegistryItemUrl(
      rules.name,
      registryUrl,
      style
    )}
                \`\`\`
                `
  }

  if (!styleItem) {
    return {
      content: [
        {
          type: "text",
          text,
        },
      ],
    }
  }

  return {
    content: [
      {
        type: "text",
        text: `To initialize a new project using the ${styleItem.name
          } style, run the following command:
              \`\`\`bash
              npx shadcn@canary init ${getRegistryItemUrl(
            styleItem.name,
            registryUrl,
            style
          )}
              \`\`\`
              `,
      },
    ],
  }
} 