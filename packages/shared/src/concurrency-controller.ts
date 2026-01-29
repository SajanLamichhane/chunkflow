import pLimit from "p-limit";

/**
 * Options for configuring the ConcurrencyController
 */
export interface ConcurrencyOptions {
  /**
   * Maximum number of concurrent operations
   * @default 3
   */
  limit: number;
}

/**
 * ConcurrencyController manages concurrent operations using p-limit
 *
 * This class provides a simple interface to control the number of concurrent
 * operations, which is essential for managing chunk uploads without overwhelming
 * the network or server.
 *
 * @example
 * ```typescript
 * const controller = new ConcurrencyController({ limit: 3 });
 *
 * // Run multiple operations with concurrency control
 * const results = await Promise.all([
 *   controller.run(() => uploadChunk(1)),
 *   controller.run(() => uploadChunk(2)),
 *   controller.run(() => uploadChunk(3)),
 *   controller.run(() => uploadChunk(4)), // Will wait for one of the above to complete
 * ]);
 * ```
 */
export class ConcurrencyController {
  private limiter: ReturnType<typeof pLimit>;
  private currentLimit: number;

  /**
   * Creates a new ConcurrencyController
   * @param options - Configuration options
   */
  constructor(options: ConcurrencyOptions) {
    this.currentLimit = options.limit;
    this.limiter = pLimit(options.limit);
  }

  /**
   * Runs a function with concurrency control
   *
   * If the concurrency limit is reached, the function will wait in a queue
   * until a slot becomes available.
   *
   * @param fn - The async function to run
   * @returns A promise that resolves with the function's return value
   *
   * @example
   * ```typescript
   * const result = await controller.run(async () => {
   *   return await uploadChunk(chunkData);
   * });
   * ```
   */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    return this.limiter(fn);
  }

  /**
   * Updates the concurrency limit
   *
   * This creates a new limiter with the updated limit. Any operations
   * currently in the queue will continue with the old limiter, but new
   * operations will use the new limit.
   *
   * @param newLimit - The new concurrency limit
   *
   * @example
   * ```typescript
   * // Start with 3 concurrent operations
   * const controller = new ConcurrencyController({ limit: 3 });
   *
   * // Increase to 5 for faster uploads
   * controller.updateLimit(5);
   *
   * // Decrease to 1 for slower network
   * controller.updateLimit(1);
   * ```
   */
  updateLimit(newLimit: number): void {
    if (newLimit <= 0) {
      throw new Error("Concurrency limit must be greater than 0");
    }

    this.currentLimit = newLimit;
    this.limiter = pLimit(newLimit);
  }

  /**
   * Gets the current concurrency limit
   * @returns The current limit
   */
  getLimit(): number {
    return this.currentLimit;
  }

  /**
   * Gets the number of pending operations in the queue
   * @returns The number of pending operations
   */
  get pendingCount(): number {
    return this.limiter.pendingCount;
  }

  /**
   * Gets the number of currently active operations
   * @returns The number of active operations
   */
  get activeCount(): number {
    return this.limiter.activeCount;
  }

  /**
   * Clears the queue of pending operations
   *
   * Note: This does not cancel active operations, only pending ones.
   */
  clearQueue(): void {
    this.limiter.clearQueue();
  }
}
