import path from "path"
import { homedir } from "os"

/**
 * Validates that a file path is within the allowed workspace directory
 * and doesn't contain dangerous patterns that could lead to path traversal attacks.
 */
export function validateWorkspacePath(inputPath: string, workspaceDir: string): string {
  // Reject null, undefined, or empty paths
  if (!inputPath || typeof inputPath !== 'string') {
    throw new Error("Invalid path: path must be a non-empty string")
  }

  // Reject paths with null bytes (common in path traversal attacks)
  if (inputPath.includes('\0')) {
    throw new Error("Invalid path: null bytes not allowed")
  }

  // Handle home directory expansion securely
  let processedPath = inputPath
  if (inputPath.startsWith("~/")) {
    // Only allow home directory expansion within workspace
    processedPath = inputPath.replace("~/", "")
    if (processedPath.includes("..") || processedPath.startsWith("/")) {
      throw new Error("Invalid home directory path: path traversal detected")
    }
  }

  // Resolve the path relative to workspace directory
  const resolvedPath = path.resolve(workspaceDir, processedPath)
  const normalizedPath = path.normalize(resolvedPath)
  const normalizedWorkspace = path.normalize(workspaceDir)

  // Ensure the resolved path is within the workspace
  if (!normalizedPath.startsWith(normalizedWorkspace + path.sep) &&
    normalizedPath !== normalizedWorkspace) {
    throw new Error(`Path outside workspace not allowed: ${inputPath}`)
  }

  // Additional checks for dangerous patterns
  const dangerousPatterns = [
    /\.\./,           // Parent directory references
    /\/\.\./,         // Unix parent directory
    /\\\.\./,         // Windows parent directory  
    /\.\.$/,          // Ending with parent directory
    /\/$/,            // Ending with slash (potential directory traversal)
    /^\/+/,           // Starting with absolute path indicators
    /^[a-zA-Z]:\\/,   // Windows absolute path
  ]

  for (const pattern of dangerousPatterns) {
    if (pattern.test(processedPath)) {
      throw new Error(`Dangerous path pattern detected: ${inputPath}`)
    }
  }

  return normalizedPath
}

/**
 * Validates a component or registry item name to prevent injection
 */
export function validateComponentName(name: string): string {
  if (!name || typeof name !== 'string') {
    throw new Error("Invalid component name: must be a non-empty string")
  }

  // Allow only alphanumeric, hyphens, underscores, slashes, and dots
  const validNamePattern = /^[a-zA-Z0-9\-_\/\.@]+$/
  if (!validNamePattern.test(name)) {
    throw new Error(`Invalid component name: contains illegal characters: ${name}`)
  }

  // Prevent excessively long names (DoS protection)
  if (name.length > 200) {
    throw new Error("Component name too long")
  }

  // Prevent certain dangerous patterns
  const dangerousPatterns = [
    /\.\./,
    /\/\//,
    /^\./,
    /\/$/,
    /\0/
  ]

  for (const pattern of dangerousPatterns) {
    if (pattern.test(name)) {
      throw new Error(`Dangerous pattern in component name: ${name}`)
    }
  }

  return name
}

/**
 * Validates file content to prevent malicious content injection
 */
export function validateFileContent(content: string, maxSize: number = 10 * 1024 * 1024): string {
  if (typeof content !== 'string') {
    throw new Error("File content must be a string")
  }

  // Size check (default 10MB)
  if (content.length > maxSize) {
    throw new Error(`File content too large: ${content.length} bytes (max: ${maxSize})`)
  }

  // Check for null bytes
  if (content.includes('\0')) {
    throw new Error("File content contains null bytes")
  }

  return content
}

/**
 * Safely resolves a working directory, ensuring it's valid and secure
 */
export function validateWorkingDirectory(cwd: string): string {
  if (!cwd || typeof cwd !== 'string') {
    throw new Error("Working directory must be a non-empty string")
  }

  // Handle special workspace paths
  if (cwd === "/workspace") {
    return "/workspace"
  }

  // Resolve and normalize the path
  const resolvedCwd = path.resolve(cwd)
  const normalizedCwd = path.normalize(resolvedCwd)

  // Prevent access to sensitive system directories
  const forbiddenPaths = [
    "/etc",
    "/proc",
    "/sys",
    "/dev",
    "/boot",
    "/root",
    path.join(homedir(), ".ssh"),
    path.join(homedir(), ".aws"),
    path.join(homedir(), ".config")
  ]

  for (const forbidden of forbiddenPaths) {
    if (normalizedCwd.startsWith(forbidden)) {
      throw new Error(`Access to system directory not allowed: ${cwd}`)
    }
  }

  return normalizedCwd
} 