import type {
  IChunkSizeAdjuster,
  BaseChunkSizeAdjusterOptions,
} from "./chunk-size-adjuster-interface";

/**
 * Options for configuring the ChunkSizeAdjuster
 */
export interface ChunkSizeAdjusterOptions extends BaseChunkSizeAdjusterOptions {}

/**
 * ChunkSizeAdjuster dynamically adjusts chunk sizes based on upload performance.
 * Uses a simple binary strategy: doubles size when fast, halves when slow.
 *
 * @example
 * ```typescript
 * const adjuster = new ChunkSizeAdjuster({
 *   initialSize: 1024 * 1024, // 1MB
 *   minSize: 256 * 1024,       // 256KB
 *   maxSize: 10 * 1024 * 1024, // 10MB
 *   targetTime: 3000           // 3 seconds
 * });
 *
 * // After uploading a chunk
 * const uploadTimeMs = 1500;
 * const newSize = adjuster.adjust(uploadTimeMs);
 * ```
 */
export class ChunkSizeAdjuster implements IChunkSizeAdjuster {
  private currentSize: number;
  private readonly options: Required<ChunkSizeAdjusterOptions>;

  constructor(options: ChunkSizeAdjusterOptions) {
    this.currentSize = options.initialSize;
    this.options = {
      targetTime: 3000, // Default 3 seconds
      ...options,
    };

    // Validate options
    if (this.options.minSize > this.options.maxSize) {
      throw new Error("minSize cannot be greater than maxSize");
    }
    if (
      this.options.initialSize < this.options.minSize ||
      this.options.initialSize > this.options.maxSize
    ) {
      throw new Error("initialSize must be between minSize and maxSize");
    }
    if (this.options.targetTime <= 0) {
      throw new Error("targetTime must be positive");
    }
  }

  /**
   * Adjusts the chunk size based on the upload time of the previous chunk.
   * Uses a simple binary strategy:
   * - If upload is fast (< 50% of target time): double the chunk size
   * - If upload is slow (> 150% of target time): halve the chunk size
   * - Otherwise: keep the current size
   *
   * @param uploadTimeMs - The time taken to upload the previous chunk in milliseconds
   * @returns The new chunk size in bytes
   */
  adjust(uploadTimeMs: number): number {
    if (uploadTimeMs < 0) {
      throw new Error("uploadTimeMs cannot be negative");
    }

    const { targetTime, minSize, maxSize } = this.options;

    // Fast upload: increase chunk size (similar to TCP slow start)
    if (uploadTimeMs < targetTime * 0.5) {
      this.currentSize = Math.min(this.currentSize * 2, maxSize);
    }
    // Slow upload: decrease chunk size (congestion avoidance)
    else if (uploadTimeMs > targetTime * 1.5) {
      this.currentSize = Math.max(this.currentSize / 2, minSize);
    }
    // Upload time is within acceptable range: keep current size

    return this.currentSize;
  }

  /**
   * Gets the current chunk size without adjusting it.
   *
   * @returns The current chunk size in bytes
   */
  getCurrentSize(): number {
    return this.currentSize;
  }

  /**
   * Resets the chunk size to the initial size.
   * Useful when starting a new upload or after an error.
   */
  reset(): void {
    this.currentSize = this.options.initialSize;
  }
}
