/**
 * useUploadManager - Vue Composable for accessing UploadManager
 *
 * Provides access to the UploadManager instance via Vue's inject API.
 * Must be used within a component that has the Upload Plugin installed.
 *
 * @remarks
 * - Validates: Requirement 10.2 (Vue Composables)
 */

import { inject } from "vue";
import type { UploadManager } from "@chunkflow/core";
import { UPLOAD_MANAGER_KEY } from "./plugin";

/**
 * Composable for accessing the UploadManager instance
 *
 * Retrieves the UploadManager instance provided by the Upload Plugin.
 * Throws an error if used outside of a component tree with the plugin installed.
 *
 * @returns The UploadManager instance
 * @throws Error if Upload Plugin is not installed
 *
 * @remarks
 * - Validates: Requirement 10.2 (Vue Composables)
 * - Uses Vue's inject API
 * - Validates plugin installation
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { useUploadManager } from '@chunkflow/upload-client-vue';
 *
 * const manager = useUploadManager();
 *
 * // Use manager to create tasks, etc.
 * const task = manager.createTask(file);
 * </script>
 * ```
 */
export function useUploadManager(): UploadManager {
  const manager = inject<UploadManager>(UPLOAD_MANAGER_KEY);

  if (!manager) {
    throw new Error(
      "useUploadManager must be used within a component tree that has the Upload Plugin installed. " +
        "Make sure you have called app.use(createUploadPlugin({ ... })) in your main.ts file.",
    );
  }

  return manager;
}
