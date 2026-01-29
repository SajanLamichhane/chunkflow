/**
 * Vue Plugin for ChunkFlow Upload SDK
 *
 * Provides UploadManager instance to Vue application via provide/inject.
 * Handles initialization and cleanup of the manager.
 *
 * @remarks
 * - Validates: Requirement 10.2 (Vue Composables integration)
 * - Validates: Requirement 10.3 (auto-initialize on mount)
 * - Validates: Requirement 10.4 (auto-cleanup on unmount)
 */

import type { App, Plugin } from "vue";
import { UploadManager, type UploadManagerOptions } from "@chunkflow/core";
import type { RequestAdapter } from "@chunkflow/protocol";

/**
 * Injection key for UploadManager
 *
 * Use this key with inject() to access the UploadManager instance.
 * Prefer using the useUploadManager() composable instead.
 */
export const UPLOAD_MANAGER_KEY = Symbol("uploadManager");

/**
 * Options for the Upload Plugin
 */
export interface UploadPluginOptions {
  /** Request adapter for API calls (required) */
  requestAdapter: RequestAdapter;
  /** Optional configuration for the UploadManager */
  managerOptions?: Partial<UploadManagerOptions>;
}

/**
 * Vue Plugin for ChunkFlow Upload SDK
 *
 * Install this plugin in your Vue application to enable upload functionality.
 * Creates and manages a single UploadManager instance for the entire app.
 *
 * @remarks
 * - Validates: Requirement 10.2 (Vue Composables)
 * - Validates: Requirement 10.3 (auto-initialize on install)
 * - Validates: Requirement 10.4 (auto-cleanup on unmount)
 * - Creates UploadManager instance on install
 * - Provides manager via Vue's provide/inject
 * - Initializes manager automatically
 * - Cleans up manager on app unmount
 *
 * @example
 * ```typescript
 * import { createApp } from 'vue';
 * import { createUploadPlugin } from '@chunkflow/upload-client-vue';
 * import { myRequestAdapter } from './api';
 * import App from './App.vue';
 *
 * const app = createApp(App);
 *
 * const uploadPlugin = createUploadPlugin({
 *   requestAdapter: myRequestAdapter,
 *   managerOptions: {
 *     maxConcurrentTasks: 5,
 *     defaultChunkSize: 2 * 1024 * 1024, // 2MB
 *   },
 * });
 *
 * app.use(uploadPlugin);
 * app.mount('#app');
 * ```
 */
export function createUploadPlugin(options: UploadPluginOptions): Plugin {
  const { requestAdapter, managerOptions } = options;

  // Create the plugin object
  const plugin: Plugin = {
    install(app: App) {
      // Create UploadManager instance
      const manager = new UploadManager({
        requestAdapter,
        ...managerOptions,
      });

      // Provide manager to all components
      // Requirement 10.2: Vue provide/inject mechanism
      app.provide(UPLOAD_MANAGER_KEY, manager);

      // Initialize manager
      // Requirement 10.3: Auto-initialize on install
      manager.init().catch((error) => {
        console.error("Failed to initialize UploadManager:", error);
      });

      // Cleanup on app unmount
      // Requirement 10.4: Auto-cleanup on unmount
      // Note: Vue 3 doesn't have a built-in unmount hook for plugins,
      // but we can use the app's unmount lifecycle
      const originalUnmount = app.unmount.bind(app);
      app.unmount = () => {
        manager.close();
        originalUnmount();
      };
    },
  };

  return plugin;
}

/**
 * Default export for convenience
 *
 * @example
 * ```typescript
 * import UploadPlugin from '@chunkflow/upload-client-vue';
 * app.use(UploadPlugin, { requestAdapter: myAdapter });
 * ```
 */
export default {
  install(app: App, options: UploadPluginOptions) {
    const plugin = createUploadPlugin(options);
    plugin.install!(app);
  },
} as Plugin<UploadPluginOptions>;
