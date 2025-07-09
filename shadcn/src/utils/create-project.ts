import os from "os"
import path from "path"
import { fetchRegistry } from "@/src/registry/api"
import { getPackageManager } from "@/src/utils/get-package-manager"
import { handleError } from "@/src/utils/handle-error"
import { logger } from "@/src/utils/logger"
import { spinner } from "@/src/utils/spinner"
import { execa } from "execa"
import fs from "fs-extra"
import prompts from "prompts"
import { z } from "zod"
import { initOptionsSchema } from "@/src/schemas/init.schemas"
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol"
import { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types"

const MONOREPO_TEMPLATE_URL =
  "https://codeload.github.com/shadcn-ui/ui/tar.gz/main"

export const TEMPLATES = {
  next: "next",
  "next-monorepo": "next-monorepo",
} as const

export async function createProject(
  options: z.infer<typeof initOptionsSchema>
) {
  const validatedOptions = initOptionsSchema.parse(options)
  return createProjectInternal(validatedOptions, { mcpSafe: false })
}

// MCP-safe version that throws errors instead of exiting
export async function createProjectMcp(
  options: z.infer<typeof initOptionsSchema>,
  extra?: RequestHandlerExtra<ServerRequest, ServerNotification>
) {
  const validatedOptions = initOptionsSchema.parse(options)
  return createProjectInternal(validatedOptions, { mcpSafe: true }, extra)
}

async function createProjectInternal(
  options: z.infer<typeof initOptionsSchema>,
  context: { mcpSafe: boolean },
  extra?: RequestHandlerExtra<ServerRequest, ServerNotification>
) {
  options = {
    srcDir: false,
    ...options,
  }

  let template: keyof typeof TEMPLATES =
    options.template && TEMPLATES[options.template as keyof typeof TEMPLATES]
      ? (options.template as keyof typeof TEMPLATES)
      : "next"
  let projectName: string =
    template === TEMPLATES.next ? "my-app" : "my-monorepo"
  let nextVersion = "latest"

  const isRemoteComponent =
    options.components?.length === 1 &&
    !!options.components[0].match(/\/chat\/b\//)

  if (options.components && isRemoteComponent) {
    try {
      const [result] = await fetchRegistry(options.components)
      const { meta } = z
        .object({
          meta: z.object({
            nextVersion: z.string(),
          }),
        })
        .parse(result)
      nextVersion = meta.nextVersion

      // Force template to next for remote components.
      template = TEMPLATES.next
    } catch (error) {
      logger.break()
      handleError(error)
    }
  }

  if (!options.force) {
    const { type, name } = await prompts([
      {
        type: options.template || isRemoteComponent ? null : "select",
        name: "type",
        message: `The path ${options.cwd} does not contain a package.json file.\n  Would you like to start a new project?`,
        choices: [
          { title: "Next.js", value: "next" },
          { title: "Next.js (Monorepo)", value: "next-monorepo" },
        ],
        initial: 0,
      },
      {
        type: "text",
        name: "name",
        message: "What is your project named?",
        initial: projectName,
        format: (value: string) => value.trim(),
        validate: (value: string) =>
          value.length > 128
            ? `Name should be less than 128 characters.`
            : true,
      },
    ])

    template = type ?? template
    projectName = name
  }

  const packageManager = await getPackageManager(options.cwd, {
    withFallback: true,
  })

  const projectPath = `${options.cwd}/${projectName}`

  // Check if path is writable.
  try {
    await fs.access(options.cwd, fs.constants.W_OK)
  } catch (error) {
    logger.break()
    logger.error(`The path ${options.cwd} is not writable.`)
    logger.error(
      `It is likely you do not have write permissions for this folder or the path ${options.cwd} does not exist.`
    )
    logger.break()
    throw new Error(`The path ${options.cwd} is not writable`)
  }

  if (fs.existsSync(path.resolve(options.cwd, projectName, "package.json"))) {
    logger.break()
    logger.error(
      `A project with the name ${projectName} already exists.`
    )
    logger.error(`Please choose a different name and try again.`)
    logger.break()
    throw new Error(`A project with the name ${projectName} already exists`)
  }

  if (template === TEMPLATES.next) {
    await createNextProject(projectPath, {
      version: nextVersion,
      cwd: options.cwd,
      packageManager,
      srcDir: !!options.srcDir,
    }, context, extra)
  }

  if (template === TEMPLATES["next-monorepo"]) {
    await createMonorepoProject(projectPath, {
      packageManager,
    }, context, extra)
  }

  return {
    projectPath,
    projectName,
    template,
  }
}

async function createNextProject(
  projectPath: string,
  options: {
    version: string
    cwd: string
    packageManager: string
    srcDir: boolean
  },
  context: { mcpSafe: boolean },
  extra?: RequestHandlerExtra<ServerRequest, ServerNotification>
) {
  const createSpinner = spinner(
    `Creating a new Next.js project. This may take a few minutes.`,
    extra,
    "create-next-project"
  ).start()

  // Note: pnpm fails here. Fallback to npx with --use-PACKAGE-MANAGER.
  const args = [
    "--tailwind",
    "--eslint",
    "--typescript",
    "--app",
    options.srcDir ? "--src-dir" : "--no-src-dir",
    "--no-import-alias",
    `--use-${options.packageManager}`,
  ]

  if (
    options.version.startsWith("15") ||
    options.version.startsWith("latest") ||
    options.version.startsWith("canary")
  ) {
    args.push("--turbopack")
  }

  try {
    await execa(
      "npx",
      [`create-next-app@${options.version}`, projectPath, "--silent", ...args],
      {
        cwd: options.cwd,
      }
    )
  } catch (error) {
    logger.break()
    logger.error(
      `Something went wrong creating a new Next.js project. Please try again.`
    )
    throw new Error(`Failed to create Next.js project: ${error}`)
  }

  createSpinner?.succeed('Creating a new Next.js project complete')
}

async function createMonorepoProject(
  projectPath: string,
  options: {
    packageManager: string
  },
  context: { mcpSafe: boolean },
  extra?: RequestHandlerExtra<ServerRequest, ServerNotification>
) {
  const createSpinner = spinner(
    `Creating a new Next.js monorepo. This may take a few minutes.`,
    extra,
    "create-monorepo-project"
  ).start()

  try {
    // Get the template.
    const templatePath = path.join(os.tmpdir(), `shadcn-template-${Date.now()}`)
    await fs.ensureDir(templatePath)
    const response = await fetch(MONOREPO_TEMPLATE_URL)
    if (!response.ok) {
      throw new Error(`Failed to download template: ${response.statusText}`)
    }

    // Write the tar file
    const tarPath = path.resolve(templatePath, "template.tar.gz")
    await fs.writeFile(tarPath, Buffer.from(await response.arrayBuffer()))
    await execa("tar", [
      "-xzf",
      tarPath,
      "-C",
      templatePath,
      "--strip-components=2",
      "ui-main/templates/monorepo-next",
    ])
    const extractedPath = path.resolve(templatePath, "monorepo-next")
    await fs.move(extractedPath, projectPath)
    await fs.remove(templatePath)

    // Run install.
    await execa(options.packageManager, ["install"], {
      cwd: projectPath,
    })

    // Try git init.
    const cwd = process.cwd()
    await execa("git", ["--version"], { cwd: projectPath })
    await execa("git", ["init"], { cwd: projectPath })
    await execa("git", ["add", "-A"], { cwd: projectPath })
    await execa("git", ["commit", "-m", "Initial commit"], {
      cwd: projectPath,
    })
    await execa("cd", [cwd])

    createSpinner?.succeed('Creating a new Next.js monorepo complete')
  } catch (error) {
    createSpinner?.fail('Something went wrong creating a new Next.js monorepo')
    throw new Error(`Failed to create Next.js monorepo: ${error}`)
  }
}
