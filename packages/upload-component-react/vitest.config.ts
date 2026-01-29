import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: [path.resolve(__dirname, "./__tests__/test-setup.ts")],
    include: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
  },
});
