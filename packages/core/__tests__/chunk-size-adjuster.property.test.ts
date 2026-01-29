import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { ChunkSizeAdjuster } from "../src/chunk-size-adjuster";

describe("ChunkSizeAdjuster - Property-Based Tests", () => {
  const KB = 1024;
  const MB = 1024 * 1024;

  /**
   * Property 2: Dynamic chunk size adjustment
   * **Validates: Requirements 2.2, 2.3, 2.4**
   *
   * For any chunk size adjuster with valid configuration:
   * - When upload time is fast (< 50% of target), the next chunk size should increase (up to maxSize)
   * - When upload time is slow (> 150% of target), the next chunk size should decrease (down to minSize)
   * - The chunk size should always stay within [minSize, maxSize] bounds
   */
  describe("Property 2: Dynamic chunk size adjustment", () => {
    it("should always keep chunk size within bounds", () => {
      fc.assert(
        fc.property(
          // Generate valid configuration
          fc.record({
            minSize: fc.integer({ min: 64 * KB, max: 512 * KB }),
            maxSize: fc.integer({ min: 5 * MB, max: 20 * MB }),
            targetTime: fc.integer({ min: 1000, max: 10000 }),
          }),
          // Generate a sequence of upload times
          fc.array(fc.integer({ min: 0, max: 20000 }), { minLength: 1, maxLength: 50 }),
          (config, uploadTimes) => {
            // Initial size should be between min and max
            const initialSize = Math.floor((config.minSize + config.maxSize) / 2);

            const adjuster = new ChunkSizeAdjuster({
              initialSize,
              minSize: config.minSize,
              maxSize: config.maxSize,
              targetTime: config.targetTime,
            });

            // Apply all upload times and verify bounds
            for (const uploadTime of uploadTimes) {
              const newSize = adjuster.adjust(uploadTime);

              // Property: Size must always be within bounds
              expect(newSize).toBeGreaterThanOrEqual(config.minSize);
              expect(newSize).toBeLessThanOrEqual(config.maxSize);
              expect(adjuster.getCurrentSize()).toBe(newSize);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should increase chunk size when upload is fast (< 50% of target)", () => {
      fc.assert(
        fc.property(
          fc.record({
            minSize: fc.integer({ min: 64 * KB, max: 512 * KB }),
            maxSize: fc.integer({ min: 5 * MB, max: 20 * MB }),
            targetTime: fc.integer({ min: 1000, max: 10000 }),
          }),
          (config) => {
            const initialSize = Math.floor((config.minSize + config.maxSize) / 2);

            const adjuster = new ChunkSizeAdjuster({
              initialSize,
              minSize: config.minSize,
              maxSize: config.maxSize,
              targetTime: config.targetTime,
            });

            const sizeBefore = adjuster.getCurrentSize();

            // Upload time is fast (< 50% of target)
            const fastUploadTime = Math.floor(config.targetTime * 0.4);
            const sizeAfter = adjuster.adjust(fastUploadTime);

            // Property: Size should increase or stay at max
            if (sizeBefore < config.maxSize) {
              expect(sizeAfter).toBeGreaterThan(sizeBefore);
            } else {
              expect(sizeAfter).toBe(config.maxSize);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should decrease chunk size when upload is slow (> 150% of target)", () => {
      fc.assert(
        fc.property(
          fc.record({
            minSize: fc.integer({ min: 64 * KB, max: 512 * KB }),
            maxSize: fc.integer({ min: 5 * MB, max: 20 * MB }),
            targetTime: fc.integer({ min: 1000, max: 10000 }),
          }),
          (config) => {
            const initialSize = Math.floor((config.minSize + config.maxSize) / 2);

            const adjuster = new ChunkSizeAdjuster({
              initialSize,
              minSize: config.minSize,
              maxSize: config.maxSize,
              targetTime: config.targetTime,
            });

            const sizeBefore = adjuster.getCurrentSize();

            // Upload time is slow (> 150% of target)
            const slowUploadTime = Math.floor(config.targetTime * 1.6);
            const sizeAfter = adjuster.adjust(slowUploadTime);

            // Property: Size should decrease or stay at min
            if (sizeBefore > config.minSize) {
              expect(sizeAfter).toBeLessThan(sizeBefore);
            } else {
              expect(sizeAfter).toBe(config.minSize);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should maintain or keep chunk size stable when upload time is acceptable", () => {
      fc.assert(
        fc.property(
          fc.record({
            minSize: fc.integer({ min: 64 * KB, max: 512 * KB }),
            maxSize: fc.integer({ min: 5 * MB, max: 20 * MB }),
            targetTime: fc.integer({ min: 1000, max: 10000 }),
          }),
          (config) => {
            const initialSize = Math.floor((config.minSize + config.maxSize) / 2);

            const adjuster = new ChunkSizeAdjuster({
              initialSize,
              minSize: config.minSize,
              maxSize: config.maxSize,
              targetTime: config.targetTime,
            });

            const sizeBefore = adjuster.getCurrentSize();

            // Upload time is acceptable (between 50% and 150% of target)
            // Use 100% of target time (right in the middle)
            const acceptableUploadTime = config.targetTime;
            const sizeAfter = adjuster.adjust(acceptableUploadTime);

            // Property: Size should remain the same
            expect(sizeAfter).toBe(sizeBefore);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should double size on fast uploads until reaching maxSize", () => {
      fc.assert(
        fc.property(
          fc.record({
            minSize: fc.integer({ min: 64 * KB, max: 512 * KB }),
            maxSize: fc.integer({ min: 5 * MB, max: 20 * MB }),
            targetTime: fc.integer({ min: 1000, max: 10000 }),
          }),
          (config) => {
            const initialSize = config.minSize;

            const adjuster = new ChunkSizeAdjuster({
              initialSize,
              minSize: config.minSize,
              maxSize: config.maxSize,
              targetTime: config.targetTime,
            });

            // Fast upload time (< 50% of target)
            const fastUploadTime = Math.floor(config.targetTime * 0.3);

            let currentSize = initialSize;
            let iterations = 0;
            const maxIterations = 20; // Prevent infinite loops

            while (currentSize < config.maxSize && iterations < maxIterations) {
              const previousSize = currentSize;
              currentSize = adjuster.adjust(fastUploadTime);

              // Property: Should double until reaching max
              const expectedSize = Math.min(previousSize * 2, config.maxSize);
              expect(currentSize).toBe(expectedSize);

              iterations++;
            }

            // Property: Should eventually reach maxSize
            expect(currentSize).toBe(config.maxSize);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should halve size on slow uploads until reaching minSize", () => {
      fc.assert(
        fc.property(
          fc.record({
            minSize: fc.integer({ min: 64 * KB, max: 512 * KB }),
            maxSize: fc.integer({ min: 5 * MB, max: 20 * MB }),
            targetTime: fc.integer({ min: 1000, max: 10000 }),
          }),
          (config) => {
            const initialSize = config.maxSize;

            const adjuster = new ChunkSizeAdjuster({
              initialSize,
              minSize: config.minSize,
              maxSize: config.maxSize,
              targetTime: config.targetTime,
            });

            // Slow upload time (> 150% of target)
            const slowUploadTime = Math.floor(config.targetTime * 2);

            let currentSize = initialSize;
            let iterations = 0;
            const maxIterations = 20; // Prevent infinite loops

            while (currentSize > config.minSize && iterations < maxIterations) {
              const previousSize = currentSize;
              currentSize = adjuster.adjust(slowUploadTime);

              // Property: Should halve until reaching min
              const expectedSize = Math.max(previousSize / 2, config.minSize);
              expect(currentSize).toBe(expectedSize);

              iterations++;
            }

            // Property: Should eventually reach minSize
            expect(currentSize).toBe(config.minSize);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should be idempotent for getCurrentSize", () => {
      fc.assert(
        fc.property(
          fc.record({
            minSize: fc.integer({ min: 64 * KB, max: 512 * KB }),
            maxSize: fc.integer({ min: 5 * MB, max: 20 * MB }),
            targetTime: fc.integer({ min: 1000, max: 10000 }),
          }),
          fc.array(fc.integer({ min: 0, max: 20000 }), { minLength: 1, maxLength: 20 }),
          (config, uploadTimes) => {
            const initialSize = Math.floor((config.minSize + config.maxSize) / 2);

            const adjuster = new ChunkSizeAdjuster({
              initialSize,
              minSize: config.minSize,
              maxSize: config.maxSize,
              targetTime: config.targetTime,
            });

            // Apply adjustments
            for (const uploadTime of uploadTimes) {
              adjuster.adjust(uploadTime);
            }

            // Property: Multiple calls to getCurrentSize should return the same value
            const size1 = adjuster.getCurrentSize();
            const size2 = adjuster.getCurrentSize();
            const size3 = adjuster.getCurrentSize();

            expect(size1).toBe(size2);
            expect(size2).toBe(size3);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should reset to initial size", () => {
      fc.assert(
        fc.property(
          fc.record({
            minSize: fc.integer({ min: 64 * KB, max: 512 * KB }),
            maxSize: fc.integer({ min: 5 * MB, max: 20 * MB }),
            targetTime: fc.integer({ min: 1000, max: 10000 }),
          }),
          fc.array(fc.integer({ min: 0, max: 20000 }), { minLength: 1, maxLength: 20 }),
          (config, uploadTimes) => {
            const initialSize = Math.floor((config.minSize + config.maxSize) / 2);

            const adjuster = new ChunkSizeAdjuster({
              initialSize,
              minSize: config.minSize,
              maxSize: config.maxSize,
              targetTime: config.targetTime,
            });

            // Apply adjustments
            for (const uploadTime of uploadTimes) {
              adjuster.adjust(uploadTime);
            }

            // Reset
            adjuster.reset();

            // Property: After reset, size should be back to initial
            expect(adjuster.getCurrentSize()).toBe(initialSize);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should handle extreme upload times gracefully", () => {
      fc.assert(
        fc.property(
          fc.record({
            minSize: fc.integer({ min: 64 * KB, max: 512 * KB }),
            maxSize: fc.integer({ min: 5 * MB, max: 20 * MB }),
            targetTime: fc.integer({ min: 1000, max: 10000 }),
          }),
          fc.integer({ min: 0, max: 1000000 }), // Very wide range of upload times
          (config, uploadTime) => {
            const initialSize = Math.floor((config.minSize + config.maxSize) / 2);

            const adjuster = new ChunkSizeAdjuster({
              initialSize,
              minSize: config.minSize,
              maxSize: config.maxSize,
              targetTime: config.targetTime,
            });

            // Should not throw and should stay within bounds
            const newSize = adjuster.adjust(uploadTime);

            expect(newSize).toBeGreaterThanOrEqual(config.minSize);
            expect(newSize).toBeLessThanOrEqual(config.maxSize);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("should converge to stable size with consistent upload times", () => {
      fc.assert(
        fc.property(
          fc.record({
            minSize: fc.integer({ min: 64 * KB, max: 512 * KB }),
            maxSize: fc.integer({ min: 5 * MB, max: 20 * MB }),
            targetTime: fc.integer({ min: 1000, max: 10000 }),
          }),
          (config) => {
            const initialSize = Math.floor((config.minSize + config.maxSize) / 2);

            const adjuster = new ChunkSizeAdjuster({
              initialSize,
              minSize: config.minSize,
              maxSize: config.maxSize,
              targetTime: config.targetTime,
            });

            // Consistent upload time at target
            const consistentUploadTime = config.targetTime;

            // Apply many times
            let stableSize = initialSize;
            for (let i = 0; i < 10; i++) {
              stableSize = adjuster.adjust(consistentUploadTime);
            }

            // Property: Size should stabilize (not change)
            const finalSize = adjuster.adjust(consistentUploadTime);
            expect(finalSize).toBe(stableSize);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
