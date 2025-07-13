import { defineConfig } from "tsup"

export default defineConfig({
  clean: true,
  dts: true,
  entry: ["src/index.ts", "src/registry/index.ts"],
  format: ["esm"],
  sourcemap: true,
  minify: true,
  target: "esnext",
  outDir: "dist",
  treeshake: true,
  // Add shebang for CLI entry point
  banner: {
    js: "#!/usr/bin/env node",
  },
  // Ensure proper CommonJS handling
  platform: "node",
  // Don't bundle problematic dependencies
  external: [
    "minimatch",
    "brace-expansion"
  ],
})
