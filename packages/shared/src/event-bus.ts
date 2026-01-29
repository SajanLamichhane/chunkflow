import mitt, { type Emitter } from "mitt";

/**
 * Upload event types
 * Defines all events that can be emitted during the upload lifecycle
 */
export type UploadEvents = {
  /** Fired when upload starts */
  start: { taskId: string; file: File };

  /** Fired when upload progress updates */
  progress: { taskId: string; progress: number; speed: number };

  /** Fired when a chunk is successfully uploaded */
  chunkSuccess: { taskId: string; chunkIndex: number };

  /** Fired when a chunk upload fails */
  chunkError: { taskId: string; chunkIndex: number; error: Error };

  /** Fired when hash calculation progress updates */
  hashProgress: { taskId: string; progress: number };

  /** Fired when hash calculation completes */
  hashComplete: { taskId: string; hash: string };

  /** Fired when upload completes successfully */
  success: { taskId: string; fileUrl: string };

  /** Fired when upload encounters an error */
  error: { taskId: string; error: Error };

  /** Fired when upload is paused */
  pause: { taskId: string };

  /** Fired when upload is resumed */
  resume: { taskId: string };

  /** Fired when upload is cancelled */
  cancel: { taskId: string };
};

/**
 * Event bus type
 */
export type UploadEventBus = Emitter<UploadEvents>;

/**
 * Creates a new event bus for upload events
 *
 * @returns An event bus instance that can emit and listen to upload events
 *
 * @example
 * ```typescript
 * const eventBus = createEventBus();
 *
 * // Listen to events
 * eventBus.on('start', ({ taskId, file }) => {
 *   console.log(`Upload started for ${file.name}`);
 * });
 *
 * // Emit events
 * eventBus.emit('start', { taskId: '123', file: myFile });
 * ```
 */
export function createEventBus(): UploadEventBus {
  return mitt<UploadEvents>();
}
