import { defineConfig } from "tsdown";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { rolldown } from "rolldown";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  plugins: [
    {
      name: "raw-loader",
      async resolveId(id, importer) {
        if (id.endsWith("?raw")) {
          // Resolve relative to the importer
          const cleanId = id.replace("?raw", "");
          if (importer) {
            const importerDir = dirname(importer);
            return resolve(importerDir, cleanId) + "?raw";
          }
          return resolve(__dirname, cleanId) + "?raw";
        }
      },
      async load(id) {
        if (id.endsWith("?raw")) {
          const filePath = id.replace("?raw", "");

          // Check if this is the worker file
          if (filePath.includes("hash-worker-inline")) {
            // Bundle the worker as IIFE with all dependencies inline
            const bundle = await rolldown({
              input: filePath,
              external: [], // Bundle all dependencies
            });

            const { output } = await bundle.generate({
              format: "iife",
              name: "HashWorker",
            });

            const workerCode = output[0].code;

            // Return as a module that exports the bundled worker code as a string
            return `export default ${JSON.stringify(workerCode)};`;
          }

          // For other files, just read as text
          const content = readFileSync(filePath, "utf-8");
          return `export default ${JSON.stringify(content)};`;
        }
      },
    },
  ],
});
