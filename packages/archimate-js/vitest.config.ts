import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Per-file environment override via /* @vitest-environment ... */ docblock.
    // Default is node (snel, voldoende voor parser-tests). viewer.test.ts
    // schakelt zelf naar happy-dom via een docblock.
    environment: "node",
    setupFiles: ["./test/setup-happy-dom.ts"],
  },
});
