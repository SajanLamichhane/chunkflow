import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: [path.resolve(__dirname, "./packages/core/__tests__/test-setup.ts")],
    include: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.property.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "dist/", "**/__tests__/**", "**/types.ts"],
    },
  },
});
