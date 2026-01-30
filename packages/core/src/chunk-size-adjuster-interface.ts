/**
 * Common interface for chunk size adjusters
 * All chunk size adjustment strategies must implement this interface
 */
export interface IChunkSizeAdjuster {
  /**
   * Adjusts the chunk size based on upload performance
   * @param uploadTimeMs - Time taken to upload the previous chunk in milliseconds
   * @returns New chunk size in bytes
   */
  adjust(uploadTimeMs: number): number;

  /**
   * Gets the current chunk size without adjusting it
   * @returns Current chunk size in bytes
   */
  getCurrentSize(): number;

  /**
   * Resets the adjuster to its initial state
   */
  reset(): void;
}

/**
 * Base options that all chunk size adjusters should support
 */
export interface BaseChunkSizeAdjusterOptions {
  /**
   * Initial chunk size in bytes
   */
  initialSize: number;
  /**
   * Minimum chunk size in bytes
   */
  minSize: number;
  /**
   * Maximum chunk size in bytes
   */
  maxSize: number;
  /**
   * Target upload time in milliseconds (default: 3000ms = 3 seconds)
   * The adjuster will try to keep upload times close to this target
   */
  targetTime?: number;
}
