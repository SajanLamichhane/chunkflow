import type {
  IChunkSizeAdjuster,
  BaseChunkSizeAdjusterOptions,
} from "./chunk-size-adjuster-interface";

/**
 * TCP Slow Start inspired chunk size adjuster
 * Implements a more accurate TCP-like congestion control algorithm
 */

export interface TCPChunkSizeAdjusterOptions extends BaseChunkSizeAdjusterOptions {
  /**
   * Initial slow start threshold (default: maxSize / 2)
   */
  initialSsthresh?: number;
}

export enum CongestionState {
  SLOW_START = "slow_start",
  CONGESTION_AVOIDANCE = "congestion_avoidance",
  FAST_RECOVERY = "fast_recovery",
}

/**
 * TCP-inspired chunk size adjuster with proper slow start and congestion avoidance
 *
 * Algorithm:
 * 1. Slow Start: Exponential growth (double size) until ssthresh
 * 2. Congestion Avoidance: Linear growth (add increment) after ssthresh
 * 3. Fast Recovery: On congestion, set ssthresh = currentSize / 2, reduce size
 *
 * @example
 * ```typescript
 * const adjuster = new TCPChunkSizeAdjuster({
 *   initialSize: 256 * 1024,      // 256KB (like TCP initial cwnd)
 *   minSize: 256 * 1024,           // 256KB
 *   maxSize: 10 * 1024 * 1024,     // 10MB
 *   targetTime: 3000,              // 3 seconds
 *   initialSsthresh: 5 * 1024 * 1024 // 5MB
 * });
 *
 * // After each chunk upload
 * const newSize = adjuster.adjust(uploadTimeMs);
 * ```
 */
export class TCPChunkSizeAdjuster implements IChunkSizeAdjuster {
  private currentSize: number;
  private ssthresh: number; // Slow start threshold
  private state: CongestionState;
  private readonly options: Required<TCPChunkSizeAdjusterOptions>;
  private consecutiveFastUploads: number = 0;
  private consecutiveSlowUploads: number = 0;

  constructor(options: TCPChunkSizeAdjusterOptions) {
    this.currentSize = options.initialSize;
    this.options = {
      targetTime: 3000,
      initialSsthresh: options.initialSsthresh ?? options.maxSize / 2,
      ...options,
    };
    this.ssthresh = this.options.initialSsthresh;
    this.state = CongestionState.SLOW_START;

    this.validate();
  }

  private validate(): void {
    const { minSize, maxSize, initialSize, targetTime, initialSsthresh } = this.options;

    if (minSize > maxSize) {
      throw new Error("minSize cannot be greater than maxSize");
    }
    if (initialSize < minSize || initialSize > maxSize) {
      throw new Error("initialSize must be between minSize and maxSize");
    }
    if (targetTime <= 0) {
      throw new Error("targetTime must be positive");
    }
    if (initialSsthresh < minSize || initialSsthresh > maxSize) {
      throw new Error("initialSsthresh must be between minSize and maxSize");
    }
  }

  /**
   * Adjusts chunk size based on upload performance using TCP-like algorithm
   *
   * @param uploadTimeMs - Time taken to upload the previous chunk
   * @returns New chunk size in bytes
   */
  adjust(uploadTimeMs: number): number {
    if (uploadTimeMs < 0) {
      throw new Error("uploadTimeMs cannot be negative");
    }

    const { targetTime, minSize, maxSize } = this.options;
    const ratio = uploadTimeMs / targetTime;

    // Fast upload (< 50% of target time)
    if (ratio < 0.5) {
      this.consecutiveFastUploads++;
      this.consecutiveSlowUploads = 0;
      this.handleFastUpload();
    }
    // Slow upload (> 150% of target time) - congestion detected
    else if (ratio > 1.5) {
      this.consecutiveSlowUploads++;
      this.consecutiveFastUploads = 0;
      this.handleSlowUpload();
    }
    // Normal upload - maintain current size
    else {
      this.consecutiveFastUploads = 0;
      this.consecutiveSlowUploads = 0;
    }

    // Ensure size is within bounds
    this.currentSize = Math.max(minSize, Math.min(this.currentSize, maxSize));

    return this.currentSize;
  }

  private handleFastUpload(): void {
    const { maxSize } = this.options;

    switch (this.state) {
      case CongestionState.SLOW_START:
        // Exponential growth: double the size
        const newSize = this.currentSize * 2;

        if (newSize >= this.ssthresh) {
          // Reached ssthresh, switch to congestion avoidance
          this.currentSize = this.ssthresh;
          this.state = CongestionState.CONGESTION_AVOIDANCE;
        } else {
          this.currentSize = Math.min(newSize, maxSize);
        }
        break;

      case CongestionState.CONGESTION_AVOIDANCE:
        // Linear growth: add a fraction of current size
        // Similar to TCP's cwnd += MSS * MSS / cwnd
        const increment = Math.max(
          this.options.minSize,
          Math.floor(this.currentSize * 0.1), // 10% increment
        );
        this.currentSize = Math.min(this.currentSize + increment, maxSize);
        break;

      case CongestionState.FAST_RECOVERY:
        // Exit fast recovery, enter congestion avoidance
        this.state = CongestionState.CONGESTION_AVOIDANCE;
        break;
    }
  }

  private handleSlowUpload(): void {
    const { minSize } = this.options;

    // Congestion detected - similar to TCP's multiplicative decrease
    // Set ssthresh to half of current size
    this.ssthresh = Math.max(minSize, Math.floor(this.currentSize / 2));

    // Reduce current size
    this.currentSize = this.ssthresh;

    // Enter fast recovery state
    this.state = CongestionState.FAST_RECOVERY;
  }

  /**
   * Gets the current chunk size
   */
  getCurrentSize(): number {
    return this.currentSize;
  }

  /**
   * Gets the current slow start threshold
   */
  getSsthresh(): number {
    return this.ssthresh;
  }

  /**
   * Gets the current congestion state
   */
  getState(): CongestionState {
    return this.state;
  }

  /**
   * Resets to initial state
   */
  reset(): void {
    this.currentSize = this.options.initialSize;
    this.ssthresh = this.options.initialSsthresh;
    this.state = CongestionState.SLOW_START;
    this.consecutiveFastUploads = 0;
    this.consecutiveSlowUploads = 0;
  }

  /**
   * Gets statistics about the adjuster's behavior
   */
  getStats() {
    return {
      currentSize: this.currentSize,
      ssthresh: this.ssthresh,
      state: this.state,
      consecutiveFastUploads: this.consecutiveFastUploads,
      consecutiveSlowUploads: this.consecutiveSlowUploads,
    };
  }
}
