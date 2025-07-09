import { RegistryItem } from "@/src/registry/schema"
import { updateDependenciesOptionsSchema } from "@/src/schemas/update.schemas"
import { Config } from "@/src/utils/get-config"
import { getPackageInfo } from "@/src/utils/get-package-info"
import { getPackageManager } from "@/src/utils/get-package-manager"
import { logger } from "@/src/utils/logger"
import { spinner } from "@/src/utils/spinner"
import { secureExeca, secureNpmInstall } from "@/src/utils/secure-exec"
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol"
import { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types"
import { z } from "zod"

export async function updateDependencies(
  dependencies: RegistryItem["dependencies"],
  devDependencies: RegistryItem["devDependencies"],
  config: Config,
  options: z.infer<typeof updateDependenciesOptionsSchema>,
  extra?: RequestHandlerExtra<ServerRequest, ServerNotification>
) {
  dependencies = Array.from(new Set(dependencies))
  devDependencies = Array.from(new Set(devDependencies))

  if (!dependencies?.length && !devDependencies?.length) {
    return
  }

  const validatedOptions = updateDependenciesOptionsSchema.parse(options)

  const dependenciesSpinner = spinner(`Installing dependencies.`, extra, "update-dependencies").start()
  const packageManager = await getUpdateDependenciesPackageManager(config)

  // Offer to use --force or --legacy-peer-deps if using React 19 with pnpm.
  let flag = ""
  if (shouldPromptForNpmFlag(config) && (packageManager === "pnpm" || packageManager === "npm")) {
    if (validatedOptions.silent) {
      flag = "force"
    } else {
      dependenciesSpinner.stopAndPersist()
      logger.warn(
        "\nIt looks like you are using React 19. \nSome packages may fail to install due to peer dependency issues in pnpm (see https://ui.shadcn.com/react-19).\n"
      )
      if (validatedOptions.flag) {
        flag = validatedOptions.flag
      }
    }
  }

  dependenciesSpinner?.start()

  await installWithPackageManager(
    packageManager,
    dependencies,
    devDependencies,
    config.resolvedPaths.cwd,
    flag
  )

  dependenciesSpinner?.succeed()
}

function shouldPromptForNpmFlag(config: Config) {
  const packageInfo = getPackageInfo(config.resolvedPaths.cwd, false)

  if (!packageInfo?.dependencies?.react) {
    return false
  }

  const hasReact19 = /^(?:\^|~)?19(?:\.\d+)*(?:-.*)?$/.test(
    packageInfo.dependencies.react
  )
  const hasReactDayPicker8 =
    packageInfo.dependencies["react-day-picker"]?.startsWith("8")

  return hasReact19 && hasReactDayPicker8
}

async function getUpdateDependenciesPackageManager(config: Config) {
  const expoVersion = getPackageInfo(config.resolvedPaths.cwd, false)
    ?.dependencies?.expo

  if (expoVersion) {
    // Ensures package versions match the React Native version.
    // https://docs.expo.dev/more/expo-cli/#install
    return "expo"
  }

  return getPackageManager(config.resolvedPaths.cwd)
}

async function installWithPackageManager(
  packageManager: Awaited<
    ReturnType<typeof getUpdateDependenciesPackageManager>
  >,
  dependencies: string[],
  devDependencies: string[],
  cwd: string,
  flag?: string
) {
  if (packageManager === "pnpm") {
    return secureNpmInstall("pnpm", dependencies, devDependencies, cwd, flag ? [`--${flag}`] : [])
  }

  if (packageManager === "npm") {
    return secureNpmInstall("npm", dependencies, devDependencies, cwd, flag ? [`--${flag}`] : [])
  }

  if (packageManager === "deno") {
    return installWithDeno(dependencies, devDependencies, cwd)
  }

  if (packageManager === "expo") {
    return installWithExpo(dependencies, devDependencies, cwd)
  }

  // Handle other package managers with secure execution
  if (dependencies?.length) {
    await secureExeca(packageManager as string, ["add", ...dependencies], {
      cwd,
    })
  }

  if (devDependencies?.length) {
    await secureExeca(packageManager as string, ["add", "-D", ...devDependencies], { cwd })
  }
}

// Note: installWithNpm and installWithPnpm are now replaced by secureNpmInstall

async function installWithDeno(
  dependencies: string[],
  devDependencies: string[],
  cwd: string
) {
  if (dependencies?.length) {
    await secureExeca("deno", ["add", ...dependencies.map((dep) => `pnpm:${dep}`)], {
      cwd,
    })
  }

  if (devDependencies?.length) {
    await secureExeca(
      "deno",
      ["add", "-D", ...devDependencies.map((dep) => `pnpm:${dep}`)],
      { cwd }
    )
  }
}

async function installWithExpo(
  dependencies: string[],
  devDependencies: string[],
  cwd: string
) {
  if (dependencies.length) {
    await secureExeca("npx", ["expo", "install", ...dependencies], { cwd })
  }

  if (devDependencies.length) {
    await secureExeca("npx", ["expo", "install", "-- -D", ...devDependencies], {
      cwd,
    })
  }
}
