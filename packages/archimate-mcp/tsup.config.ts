import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: true,
  target: "es2022",
  external: [],
  banner: {
    js: "#!/usr/bin/env node",
  },
});
