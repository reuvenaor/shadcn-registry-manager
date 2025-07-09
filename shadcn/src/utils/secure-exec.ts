import { execa, type ExecaReturnValue, type Options as ExecaOptions } from "execa"
import { validateWorkingDirectory } from "./security"

// Allowlist of commands that are permitted to be executed
const ALLOWED_COMMANDS = [
  'npm',
  'pnpm',
  'yarn',
  'npx',
  'git',
  'tar',
  'node',
  'deno',
  'bun'
] as const

// Command-specific timeouts (in milliseconds)
const COMMAND_TIMEOUTS: Record<string, number> = {
  'npm': 600000,        // 10 minutes for npm install
  'pnpm': 600000,       // 10 minutes for pnpm install
  'yarn': 600000,       // 10 minutes for yarn install
  'npx': 300000,        // 5 minutes for npx commands
  'git': 60000,         // 1 minute for git operations
  'tar': 120000,        // 2 minutes for tar operations
  'node': 300000,       // 5 minutes for node execution
  'deno': 300000,       // 5 minutes for deno
  'bun': 300000,        // 5 minutes for bun
  'default': 180000     // 3 minutes default
}

// Allowlist of npm/npx packages that can be executed
const ALLOWED_NPX_PACKAGES = [
  'create-next-app',
  'expo'
] as const

// Arguments that should never be allowed (potential command injection)
const FORBIDDEN_ARG_PATTERNS = [
  /[;&|`$()]/,          // Shell metacharacters
  /\n|\r/,              // Line breaks
  /\0/,                 // Null bytes
  /\\.\\./,             // Path traversal attempts
] as const

// Allowed flags for package managers and other commands
const ALLOWED_FLAGS = [
  // NPM/PNPM/YARN flags
  '--force',
  '--legacy-peer-deps',
  '--silent',
  '--save-dev',
  '-D',
  '--dev',
  '--production',
  '--no-save',
  '--exact',
  '--save-exact',
  '--dry-run',
  '--verbose',
  '-v',
  '--version',
  '--help',
  '-h',

  // Git flags
  '--version',
  'init',
  'add',
  'commit',
  '--message',
  '-m',
  '-A',

  // Tar flags
  '-xzf',
  '-C',
  '--strip-components',

  // NPX flags
  '--yes',
  '--no',
  '--quiet',
  '-q',
  '--package',
  '-p',

  // Create-next-app flags
  '--tailwind',
  '--eslint',
  '--typescript',
  '--app',
  '--src-dir',
  '--no-src-dir',
  '--no-import-alias',
  '--use-npm',
  '--use-pnpm',
  '--use-yarn',
  '--use-bun',
  '--turbopack',

  // Generic patterns for versioned flags and numeric options
  /^--use-[a-z]+$/,     // --use-npm, --use-pnpm, etc.
  /^--strip-components=\d+$/,  // --strip-components=1, etc.
] as const

/**
 * Validates a command against the allowlist
 */
function validateCommand(command: string): void {
  if (!command || typeof command !== 'string') {
    throw new Error("Command must be a non-empty string")
  }

  if (!ALLOWED_COMMANDS.includes(command as any)) {
    throw new Error(`Command not allowed: ${command}. Allowed commands: ${ALLOWED_COMMANDS.join(', ')}`)
  }
}

/**
 * Validates command arguments for security issues
 */
function validateArguments(command: string, args: string[]): string[] {
  if (!Array.isArray(args)) {
    throw new Error("Arguments must be an array")
  }

  const validatedArgs: string[] = []

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (typeof arg !== 'string') {
      throw new Error(`Argument ${i} must be a string, got ${typeof arg}`)
    }

    // Check for forbidden patterns
    for (const pattern of FORBIDDEN_ARG_PATTERNS) {
      if (pattern.test(arg)) {
        throw new Error(`Dangerous pattern in argument ${i}: ${arg}`)
      }
    }

    // Check if argument starts with dash (potential flag)
    if (arg.startsWith('-')) {
      validateFlag(arg)
    }

    // Validate length (prevent DoS)
    if (arg.length > 1000) {
      throw new Error(`Argument ${i} too long: ${arg.length} characters`)
    }

    // Special validation for npx commands
    if (command === 'npx' && i === 0) {
      validateNpxPackage(arg)
    }

    validatedArgs.push(arg)
  }

  return validatedArgs
}

/**
 * Validates flags against the allowlist
 */
function validateFlag(flag: string): void {
  // Check against exact string matches
  const stringFlags = ALLOWED_FLAGS.filter(f => typeof f === 'string') as string[]
  if (stringFlags.includes(flag)) {
    return
  }

  // Check against regex patterns
  const regexFlags = ALLOWED_FLAGS.filter(f => f instanceof RegExp) as RegExp[]
  for (const pattern of regexFlags) {
    if (pattern.test(flag)) {
      return
    }
  }

  // Special cases for numeric arguments after flags (e.g., "--strip-components=1")
  const flagWithValue = flag.split('=')[0]
  if (stringFlags.includes(flagWithValue)) {
    return
  }

  throw new Error(`Flag not allowed: ${flag}. Use only approved flags.`)
}

/**
 * Validates npx package names against allowlist
 */
function validateNpxPackage(packageName: string): void {
  // Handle versioned packages (e.g., "create-next-app@latest")
  const baseName = packageName.split('@')[0]

  if (!ALLOWED_NPX_PACKAGES.includes(baseName as any)) {
    throw new Error(`NPX package not allowed: ${packageName}. Allowed packages: ${ALLOWED_NPX_PACKAGES.join(', ')}`)
  }

  // Additional validation for package versions
  if (packageName.includes('@')) {
    const version = packageName.split('@')[1]
    // Allow common version patterns: latest, canary, numbers, beta, rc
    const validVersionPattern = /^(latest|canary|\d+(\.\d+)*(-\w+)?|beta|rc(\d+)?)$/
    if (!validVersionPattern.test(version)) {
      throw new Error(`Invalid package version: ${version}`)
    }
  }
}

/**
 * Securely executes a command with validation and safety measures
 */
export async function secureExeca(
  command: string,
  args: string[] = [],
  options: ExecaOptions = {}
): Promise<ExecaReturnValue> {

  // Validate command
  validateCommand(command)

  // Validate and sanitize arguments
  const sanitizedArgs = validateArguments(command, args)

  // Validate working directory if provided
  let safeCwd = options.cwd
  if (safeCwd) {
    safeCwd = validateWorkingDirectory(safeCwd as string)
  }

  // Set security-focused options
  const secureOptions: ExecaOptions = {
    ...options,
    cwd: safeCwd,
    timeout: COMMAND_TIMEOUTS[command] || COMMAND_TIMEOUTS.default,
    cleanup: true,
    killSignal: 'SIGTERM',
    windowsHide: true,
    // Prevent shell execution to avoid injection
    shell: false,
    // Limit environment variables
    env: {
      ...options.env,
      // Remove potentially dangerous env vars
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      USER: process.env.USER,
      NODE_ENV: process.env.NODE_ENV
    }
  }

  try {
    return await execa(command, sanitizedArgs, secureOptions)
  } catch (error) {
    // Log security-relevant failures but don't expose internal details
    if (error instanceof Error) {
      if (error.message.includes('ENOENT')) {
        throw new Error(`Command not found: ${command}`)
      }
      if (error.message.includes('timeout')) {
        throw new Error(`Command timed out: ${command}`)
      }
      if (error.message.includes('EACCES')) {
        throw new Error(`Permission denied: ${command}`)
      }
    }

    // Re-throw the error but ensure we don't leak sensitive information
    throw new Error(`Command execution failed: ${command}`)
  }
}

/**
 * Wrapper for npm install operations with additional validation
 */
export async function secureNpmInstall(
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun',
  dependencies: string[],
  devDependencies: string[],
  cwd: string,
  flags: string[] = []
): Promise<void> {

  // Validate package names
  const allPackages = [...dependencies, ...devDependencies]
  for (const pkg of allPackages) {
    validatePackageName(pkg)
  }

  // Validate flags using the central validation function
  for (const flag of flags) {
    if (flag.startsWith('-')) {
      validateFlag(flag)
    }
  }

  // Execute package installation based on package manager
  if (packageManager === 'npm') {
    if (dependencies.length > 0) {
      await secureExeca('npm', ['install', '--legacy-peer-deps', ...flags, ...dependencies], { cwd })
    }
    if (devDependencies.length > 0) {
      await secureExeca('npm', ['install', '--legacy-peer-deps', ...flags, '-D', ...devDependencies], { cwd })
    }
  } else if (packageManager === 'pnpm') {
    if (dependencies.length > 0) {
      await secureExeca('pnpm', ['install', ...flags, ...dependencies], { cwd })
    }
    if (devDependencies.length > 0) {
      await secureExeca('pnpm', ['install', ...flags, '-D', ...devDependencies], { cwd })
    }
  } else {
    throw new Error(`Package manager not fully supported yet: ${packageManager}`)
  }
}

/**
 * Validates package names to prevent malicious packages
 */
function validatePackageName(packageName: string): void {
  if (!packageName || typeof packageName !== 'string') {
    throw new Error("Package name must be a non-empty string")
  }

  // Basic npm package name validation
  const validPackagePattern = /^(@[a-z0-9-_]+\/)?[a-z0-9-_.]+(@[a-z0-9-_.]+)?$/i
  if (!validPackagePattern.test(packageName)) {
    throw new Error(`Invalid package name format: ${packageName}`)
  }

  // Prevent excessively long package names
  if (packageName.length > 214) {
    throw new Error(`Package name too long: ${packageName}`)
  }

  // Prevent certain dangerous patterns
  const dangerousPatterns = [
    /\.\./,               // Path traversal
    /[;&|`$()]/,         // Shell metacharacters
    /\s/,                // Whitespace
    /\0/                 // Null bytes
  ]

  for (const pattern of dangerousPatterns) {
    if (pattern.test(packageName)) {
      throw new Error(`Dangerous pattern in package name: ${packageName}`)
    }
  }
} 