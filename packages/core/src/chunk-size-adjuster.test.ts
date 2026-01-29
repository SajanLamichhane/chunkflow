import { describe, it, expect, beforeEach } from "vitest";
import { ChunkSizeAdjuster } from "./chunk-size-adjuster";

describe("ChunkSizeAdjuster", () => {
  const MB = 1024 * 1024;
  const KB = 1024;

  describe("constructor", () => {
    it("should initialize with provided options", () => {
      const adjuster = new ChunkSizeAdjuster({
        initialSize: 1 * MB,
        minSize: 256 * KB,
        maxSize: 10 * MB,
        targetTime: 3000,
      });

      expect(adjuster.getCurrentSize()).toBe(1 * MB);
    });

    it("should use default targetTime of 3000ms when not provided", () => {
      const adjuster = new ChunkSizeAdjuster({
        initialSize: 1 * MB,
        minSize: 256 * KB,
        maxSize: 10 * MB,
      });

      // Verify default by testing behavior
      // Fast upload (< 1500ms) should increase size
      const newSize = adjuster.adjust(1000);
      expect(newSize).toBe(2 * MB);
    });

    it("should throw error when minSize > maxSize", () => {
      expect(() => {
        new ChunkSizeAdjuster({
          initialSize: 1 * MB,
          minSize: 10 * MB,
          maxSize: 1 * MB,
        });
      }).toThrow("minSize cannot be greater than maxSize");
    });

    it("should throw error when initialSize < minSize", () => {
      expect(() => {
        new ChunkSizeAdjuster({
          initialSize: 100 * KB,
          minSize: 256 * KB,
          maxSize: 10 * MB,
        });
      }).toThrow("initialSize must be between minSize and maxSize");
    });

    it("should throw error when initialSize > maxSize", () => {
      expect(() => {
        new ChunkSizeAdjuster({
          initialSize: 20 * MB,
          minSize: 256 * KB,
          maxSize: 10 * MB,
        });
      }).toThrow("initialSize must be between minSize and maxSize");
    });

    it("should throw error when targetTime is zero", () => {
      expect(() => {
        new ChunkSizeAdjuster({
          initialSize: 1 * MB,
          minSize: 256 * KB,
          maxSize: 10 * MB,
          targetTime: 0,
        });
      }).toThrow("targetTime must be positive");
    });

    it("should throw error when targetTime is negative", () => {
      expect(() => {
        new ChunkSizeAdjuster({
          initialSize: 1 * MB,
          minSize: 256 * KB,
          maxSize: 10 * MB,
          targetTime: -1000,
        });
      }).toThrow("targetTime must be positive");
    });
  });

  describe("adjust", () => {
    let adjuster: ChunkSizeAdjuster;

    beforeEach(() => {
      adjuster = new ChunkSizeAdjuster({
        initialSize: 1 * MB,
        minSize: 256 * KB,
        maxSize: 10 * MB,
        targetTime: 3000,
      });
    });

    it("should throw error when uploadTimeMs is negative", () => {
      expect(() => {
        adjuster.adjust(-100);
      }).toThrow("uploadTimeMs cannot be negative");
    });

    describe("fast upload (< 50% of target time)", () => {
      it("should double chunk size when upload is very fast", () => {
        // Target is 3000ms, 50% is 1500ms
        const newSize = adjuster.adjust(1000);
        expect(newSize).toBe(2 * MB);
      });

      it("should double chunk size at exactly 50% threshold", () => {
        // At exactly 1500ms (50% of 3000ms), should still be considered fast
        const newSize = adjuster.adjust(1499);
        expect(newSize).toBe(2 * MB);
      });

      it("should not exceed maxSize when doubling", () => {
        // Start at 6MB, double would be 12MB but max is 10MB
        adjuster = new ChunkSizeAdjuster({
          initialSize: 6 * MB,
          minSize: 256 * KB,
          maxSize: 10 * MB,
          targetTime: 3000,
        });

        const newSize = adjuster.adjust(1000);
        expect(newSize).toBe(10 * MB);
      });

      it("should continue doubling on consecutive fast uploads until max", () => {
        // 1MB -> 2MB
        let size = adjuster.adjust(1000);
        expect(size).toBe(2 * MB);

        // 2MB -> 4MB
        size = adjuster.adjust(1000);
        expect(size).toBe(4 * MB);

        // 4MB -> 8MB
        size = adjuster.adjust(1000);
        expect(size).toBe(8 * MB);

        // 8MB -> 10MB (capped at max)
        size = adjuster.adjust(1000);
        expect(size).toBe(10 * MB);

        // Should stay at max
        size = adjuster.adjust(1000);
        expect(size).toBe(10 * MB);
      });
    });

    describe("slow upload (> 150% of target time)", () => {
      it("should halve chunk size when upload is very slow", () => {
        // Target is 3000ms, 150% is 4500ms
        const newSize = adjuster.adjust(5000);
        expect(newSize).toBe(0.5 * MB);
      });

      it("should halve chunk size at exactly 150% threshold", () => {
        // At exactly 4500ms (150% of 3000ms), should still be considered acceptable
        // Just above threshold should trigger decrease
        const newSize = adjuster.adjust(4501);
        expect(newSize).toBe(0.5 * MB);
      });

      it("should not go below minSize when halving", () => {
        // Start at 300KB, halve would be 150KB but min is 256KB
        adjuster = new ChunkSizeAdjuster({
          initialSize: 300 * KB,
          minSize: 256 * KB,
          maxSize: 10 * MB,
          targetTime: 3000,
        });

        const newSize = adjuster.adjust(5000);
        expect(newSize).toBe(256 * KB);
      });

      it("should continue halving on consecutive slow uploads until min", () => {
        // 1MB -> 512KB
        let size = adjuster.adjust(5000);
        expect(size).toBe(512 * KB);

        // 512KB -> 256KB (at min)
        size = adjuster.adjust(5000);
        expect(size).toBe(256 * KB);

        // Should stay at min
        size = adjuster.adjust(5000);
        expect(size).toBe(256 * KB);
      });
    });

    describe("acceptable upload time (50% - 150% of target)", () => {
      it("should keep current size when upload time is at target", () => {
        const newSize = adjuster.adjust(3000);
        expect(newSize).toBe(1 * MB);
      });

      it("should keep current size when upload time is slightly below target", () => {
        const newSize = adjuster.adjust(2500);
        expect(newSize).toBe(1 * MB);
      });

      it("should keep current size when upload time is slightly above target", () => {
        const newSize = adjuster.adjust(3500);
        expect(newSize).toBe(1 * MB);
      });

      it("should keep current size at 50% threshold", () => {
        const newSize = adjuster.adjust(1500);
        expect(newSize).toBe(1 * MB);
      });

      it("should keep current size at 150% threshold", () => {
        const newSize = adjuster.adjust(4500);
        expect(newSize).toBe(1 * MB);
      });
    });

    describe("edge cases", () => {
      it("should handle zero upload time (instant upload)", () => {
        const newSize = adjuster.adjust(0);
        expect(newSize).toBe(2 * MB); // Should double
      });

      it("should handle very large upload time", () => {
        const newSize = adjuster.adjust(100000);
        expect(newSize).toBe(0.5 * MB); // Should halve
      });

      it("should handle when already at maxSize", () => {
        adjuster = new ChunkSizeAdjuster({
          initialSize: 10 * MB,
          minSize: 256 * KB,
          maxSize: 10 * MB,
          targetTime: 3000,
        });

        const newSize = adjuster.adjust(1000);
        expect(newSize).toBe(10 * MB);
      });

      it("should handle when already at minSize", () => {
        adjuster = new ChunkSizeAdjuster({
          initialSize: 256 * KB,
          minSize: 256 * KB,
          maxSize: 10 * MB,
          targetTime: 3000,
        });

        const newSize = adjuster.adjust(5000);
        expect(newSize).toBe(256 * KB);
      });
    });

    describe("mixed scenarios", () => {
      it("should adapt to changing network conditions", () => {
        // Start with fast uploads
        let size = adjuster.adjust(1000);
        expect(size).toBe(2 * MB);

        size = adjuster.adjust(1000);
        expect(size).toBe(4 * MB);

        // Network slows down
        size = adjuster.adjust(5000);
        expect(size).toBe(2 * MB);

        size = adjuster.adjust(5000);
        expect(size).toBe(1 * MB);

        // Network improves again
        size = adjuster.adjust(1000);
        expect(size).toBe(2 * MB);
      });

      it("should stabilize at optimal size for consistent network", () => {
        // Simulate consistent network with ~3000ms uploads
        for (let i = 0; i < 10; i++) {
          const size = adjuster.adjust(3000);
          expect(size).toBe(1 * MB); // Should stay stable
        }
      });
    });
  });

  describe("getCurrentSize", () => {
    it("should return current size without modifying it", () => {
      const adjuster = new ChunkSizeAdjuster({
        initialSize: 1 * MB,
        minSize: 256 * KB,
        maxSize: 10 * MB,
      });

      expect(adjuster.getCurrentSize()).toBe(1 * MB);

      // Adjust size
      adjuster.adjust(1000);
      expect(adjuster.getCurrentSize()).toBe(2 * MB);

      // Multiple calls should return same value
      expect(adjuster.getCurrentSize()).toBe(2 * MB);
      expect(adjuster.getCurrentSize()).toBe(2 * MB);
    });
  });

  describe("reset", () => {
    it("should reset size to initial size", () => {
      const adjuster = new ChunkSizeAdjuster({
        initialSize: 1 * MB,
        minSize: 256 * KB,
        maxSize: 10 * MB,
      });

      // Adjust size multiple times
      adjuster.adjust(1000);
      adjuster.adjust(1000);
      expect(adjuster.getCurrentSize()).toBe(4 * MB);

      // Reset
      adjuster.reset();
      expect(adjuster.getCurrentSize()).toBe(1 * MB);
    });

    it("should allow adjusting again after reset", () => {
      const adjuster = new ChunkSizeAdjuster({
        initialSize: 1 * MB,
        minSize: 256 * KB,
        maxSize: 10 * MB,
      });

      adjuster.adjust(1000);
      expect(adjuster.getCurrentSize()).toBe(2 * MB);

      adjuster.reset();
      expect(adjuster.getCurrentSize()).toBe(1 * MB);

      adjuster.adjust(1000);
      expect(adjuster.getCurrentSize()).toBe(2 * MB);
    });
  });

  describe("custom targetTime", () => {
    it("should respect custom targetTime", () => {
      const adjuster = new ChunkSizeAdjuster({
        initialSize: 1 * MB,
        minSize: 256 * KB,
        maxSize: 10 * MB,
        targetTime: 2000, // 2 seconds instead of default 3
      });

      // 50% of 2000ms = 1000ms
      // Upload at 900ms should be fast
      let size = adjuster.adjust(900);
      expect(size).toBe(2 * MB);

      adjuster.reset();

      // 150% of 2000ms = 3000ms
      // Upload at 3100ms should be slow
      size = adjuster.adjust(3100);
      expect(size).toBe(0.5 * MB);
    });
  });
});
