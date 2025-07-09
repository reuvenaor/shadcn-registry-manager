import { URL } from "url"

// Allowlist of registry hosts that are permitted
const ALLOWED_REGISTRY_HOSTS = [
  'ui.shadcn.com',
  'localhost',
  'host.docker.internal',
  '127.0.0.1'
] as const

// Allowed protocols for registry URLs
const ALLOWED_PROTOCOLS = ['http:', 'https:'] as const

// Hosts that must use HTTPS (external hosts)
const HTTPS_REQUIRED_HOSTS = [
  'ui.shadcn.com'
] as const

// Maximum URL length to prevent DoS
const MAX_URL_LENGTH = 2048

// Timeout for HTTP requests (in milliseconds)
export const HTTP_TIMEOUT = 30000 // 30 seconds

/**
 * Validates a registry URL against security policies
 */
export function validateRegistryUrl(url: string): string {
  if (!url || typeof url !== 'string') {
    throw new Error("Registry URL must be a non-empty string")
  }

  // Check URL length
  if (url.length > MAX_URL_LENGTH) {
    throw new Error(`Registry URL too long: ${url.length} characters (max: ${MAX_URL_LENGTH})`)
  }

  // Check for dangerous characters
  if (url.includes('\0') || url.includes('\n') || url.includes('\r')) {
    throw new Error("Registry URL contains invalid characters")
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch (error) {
    throw new Error(`Invalid registry URL format: ${url}`)
  }

  // Validate protocol
  if (!ALLOWED_PROTOCOLS.includes(parsedUrl.protocol as any)) {
    throw new Error(`Protocol not allowed: ${parsedUrl.protocol}. Allowed: ${ALLOWED_PROTOCOLS.join(', ')}`)
  }

  // Validate hostname
  if (!ALLOWED_REGISTRY_HOSTS.includes(parsedUrl.hostname as any)) {
    throw new Error(`Registry host not allowed: ${parsedUrl.hostname}. Allowed: ${ALLOWED_REGISTRY_HOSTS.join(', ')}`)
  }

  // Enforce HTTPS for external hosts
  if (HTTPS_REQUIRED_HOSTS.includes(parsedUrl.hostname as any) && parsedUrl.protocol !== 'https:') {
    throw new Error(`HTTPS required for external registry: ${parsedUrl.hostname}`)
  }

  // Validate port (if specified)
  if (parsedUrl.port) {
    const port = parseInt(parsedUrl.port, 10)
    if (isNaN(port) || port < 1 || port > 65535) {
      throw new Error(`Invalid port number: ${parsedUrl.port}`)
    }

    // Restrict to common web ports for security
    const allowedPorts = [80, 443, 3000, 3333, 8080, 8443]
    if (!allowedPorts.includes(port)) {
      throw new Error(`Port not allowed: ${port}. Allowed ports: ${allowedPorts.join(', ')}`)
    }
  }

  // Validate path - prevent access to sensitive endpoints
  const forbiddenPaths = [
    '/admin',
    '/.env',
    '/config',
    '/system',
    '/private'
  ]

  for (const forbidden of forbiddenPaths) {
    if (parsedUrl.pathname.startsWith(forbidden)) {
      throw new Error(`Access to path not allowed: ${parsedUrl.pathname}`)
    }
  }

  // Prevent query string injection
  if (parsedUrl.search) {
    // Basic validation of query parameters
    const queryParams = new URLSearchParams(parsedUrl.search)
    const entries = Array.from(queryParams.entries())
    for (const [key, value] of entries) {
      if (key.length > 100 || value.length > 1000) {
        throw new Error("Query parameter too long")
      }

      // Check for dangerous patterns in query params
      if (/[<>\"'&]/.test(key) || /[<>\"'&]/.test(value)) {
        throw new Error("Invalid characters in query parameters")
      }
    }
  }

  // Return the validated URL
  return parsedUrl.toString()
}

/**
 * Validates a component URL (could be local file, URL, or registry name)
 */
export function validateComponentUrl(url: string): { type: 'local' | 'url' | 'registry', value: string } {
  if (!url || typeof url !== 'string') {
    throw new Error("Component URL must be a non-empty string")
  }

  // Prevent excessively long URLs
  if (url.length > MAX_URL_LENGTH) {
    throw new Error(`Component URL too long: ${url.length} characters`)
  }

  // Check for null bytes and line breaks
  if (url.includes('\0') || url.includes('\n') || url.includes('\r')) {
    throw new Error("Component URL contains invalid characters")
  }

  // Determine URL type and validate accordingly
  if (isUrl(url)) {
    // External URL - validate as registry URL
    const validatedUrl = validateRegistryUrl(url)
    return { type: 'url', value: validatedUrl }
  } else if (isLocalFile(url)) {
    // Local file - validate path structure
    if (url.includes('..') || url.startsWith('/')) {
      throw new Error("Local file path contains dangerous patterns")
    }
    if (!url.endsWith('.json')) {
      throw new Error("Local files must be JSON files")
    }
    return { type: 'local', value: url }
  } else {
    // Registry component name - validate name format
    validateRegistryComponentName(url)
    return { type: 'registry', value: url }
  }
}

/**
 * Validates a registry component name
 */
function validateRegistryComponentName(name: string): void {
  // Allow alphanumeric, hyphens, slashes, and certain special chars
  const validNamePattern = /^[a-zA-Z0-9\-_\/\.@]+$/
  if (!validNamePattern.test(name)) {
    throw new Error(`Invalid registry component name: ${name}`)
  }

  // Prevent certain dangerous patterns
  const dangerousPatterns = [
    /\.\./,     // Path traversal
    /\/\//,     // Double slashes
    /^\./,      // Starting with dot
    /\/$/       // Ending with slash
  ]

  for (const pattern of dangerousPatterns) {
    if (pattern.test(name)) {
      throw new Error(`Dangerous pattern in component name: ${name}`)
    }
  }
}

/**
 * Checks if a string is a URL
 */
function isUrl(str: string): boolean {
  try {
    new URL(str)
    return true
  } catch {
    return false
  }
}

/**
 * Checks if a string represents a local file
 */
function isLocalFile(str: string): boolean {
  return str.endsWith('.json') && !isUrl(str)
}

/**
 * Creates secure fetch options for HTTP requests (node-fetch compatible)
 */
export function createSecureFetchOptions(additionalOptions: any = {}): any {
  return {
    ...additionalOptions,
    // Security headers
    headers: {
      'User-Agent': 'shadcn-mcp-server/1.0.0',
      'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
      // Prevent some attacks
      'X-Requested-With': 'XMLHttpRequest',
      ...(additionalOptions.headers || {})
    },
    // Security options (node-fetch compatible)
    redirect: 'follow', // Allow redirects
    timeout: HTTP_TIMEOUT, // Use timeout option for node-fetch
    // Note: some options like 'mode', 'credentials', 'cache', 'referrerPolicy' are not supported in node-fetch
  }
}

/**
 * Validates HTTP response for security issues (node-fetch compatible)
 */
export function validateHttpResponse(response: any, expectedContentType: string = 'application/json'): void {
  // Check status code
  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status} ${response.statusText || 'Unknown error'}`)
  }

  // Check content type
  const contentType = response.headers.get('content-type')
  if (contentType && !contentType.includes(expectedContentType)) {
    throw new Error(`Unexpected content type: ${contentType}`)
  }

  // Check content length (prevent DoS)
  const contentLength = response.headers.get('content-length')
  if (contentLength) {
    const length = parseInt(contentLength, 10)
    const maxSize = 50 * 1024 * 1024 // 50MB
    if (length > maxSize) {
      throw new Error(`Response too large: ${length} bytes (max: ${maxSize})`)
    }
  }
}

/**
 * Safely parses JSON with size limits (node-fetch compatible)
 */
export async function safeJsonParse(response: any, maxSize: number = 10 * 1024 * 1024): Promise<any> {
  const text = await response.text()

  // Check size
  if (text.length > maxSize) {
    throw new Error(`JSON response too large: ${text.length} bytes (max: ${maxSize})`)
  }

  // Check for potential issues
  if (text.includes('\0')) {
    throw new Error("JSON contains null bytes")
  }

  try {
    return JSON.parse(text)
  } catch (error) {
    throw new Error(`Invalid JSON response: ${error instanceof Error ? error.message : String(error)}`)
  }
} 