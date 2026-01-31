/**
 * @chunkflowjs/upload-client-vue
 *
 * Vue adapter for ChunkFlow Upload SDK
 * Provides Vue Plugin, composables, and reactive state management
 *
 * @remarks
 * - Validates: Requirement 10.2 (Vue Composables)
 * - Validates: Requirement 10.3 (auto-initialize on mount)
 * - Validates: Requirement 10.4 (auto-cleanup on unmount)
 * - Validates: Requirement 10.5 (reactive state)
 */

// Plugin
export { createUploadPlugin, UPLOAD_MANAGER_KEY } from "./plugin";
export type { UploadPluginOptions } from "./plugin";
export { default as UploadPlugin } from "./plugin";

// Composables
export { useUploadManager } from "./useUploadManager";
export { useUpload } from "./useUpload";
export type { UseUploadOptions, UseUploadReturn } from "./useUpload";
export { useUploadList } from "./useUploadList";
export type { UseUploadListReturn } from "./useUploadList";

// Re-export core types for convenience
export type {
  UploadTask,
  UploadManager,
  UploadTaskOptions,
  UploadManagerOptions,
} from "@chunkflowjs/core";

export type {
  UploadStatus,
  UploadProgress,
  FileInfo,
  ChunkInfo,
  UploadToken,
  RequestAdapter,
} from "@chunkflowjs/protocol";
