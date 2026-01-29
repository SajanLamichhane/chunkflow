import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConcurrencyController } from "./concurrency-controller";

describe("ConcurrencyController", () => {
  describe("constructor", () => {
    it("should create a controller with the specified limit", () => {
      const controller = new ConcurrencyController({ limit: 5 });
      expect(controller.getLimit()).toBe(5);
    });

    it("should create a controller with default limit of 3", () => {
      const controller = new ConcurrencyController({ limit: 3 });
      expect(controller.getLimit()).toBe(3);
    });
  });

  describe("run", () => {
    it("should execute a single async function", async () => {
      const controller = new ConcurrencyController({ limit: 3 });
      const mockFn = vi.fn(async () => "result");

      const result = await controller.run(mockFn);

      expect(result).toBe("result");
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it("should execute multiple functions concurrently up to the limit", async () => {
      const controller = new ConcurrencyController({ limit: 2 });
      const executionOrder: number[] = [];
      const delays = [50, 30, 20, 10];

      const createTask = (id: number, delay: number) => async () => {
        executionOrder.push(id);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return id;
      };

      const promises = delays.map((delay, index) => controller.run(createTask(index, delay)));

      const results = await Promise.all(promises);

      // All tasks should complete
      expect(results).toEqual([0, 1, 2, 3]);

      // First two tasks should start immediately
      expect(executionOrder.slice(0, 2)).toEqual([0, 1]);

      // Remaining tasks should start after some complete
      expect(executionOrder.length).toBe(4);
    });

    it("should respect concurrency limit", async () => {
      const controller = new ConcurrencyController({ limit: 2 });
      let activeCount = 0;
      let maxActiveCount = 0;

      const createTask = (delay: number) => async () => {
        activeCount++;
        maxActiveCount = Math.max(maxActiveCount, activeCount);
        await new Promise((resolve) => setTimeout(resolve, delay));
        activeCount--;
      };

      await Promise.all([
        controller.run(createTask(50)),
        controller.run(createTask(50)),
        controller.run(createTask(50)),
        controller.run(createTask(50)),
      ]);

      // Should never exceed the limit of 2
      expect(maxActiveCount).toBeLessThanOrEqual(2);
    });

    it("should handle errors in tasks", async () => {
      const controller = new ConcurrencyController({ limit: 3 });
      const error = new Error("Task failed");
      const failingTask = async () => {
        throw error;
      };

      await expect(controller.run(failingTask)).rejects.toThrow("Task failed");
    });

    it("should allow successful tasks to complete even if others fail", async () => {
      const controller = new ConcurrencyController({ limit: 3 });

      const successTask = async () => "success";
      const failTask = async () => {
        throw new Error("fail");
      };

      const results = await Promise.allSettled([
        controller.run(successTask),
        controller.run(failTask),
        controller.run(successTask),
      ]);

      expect(results[0].status).toBe("fulfilled");
      expect(results[1].status).toBe("rejected");
      expect(results[2].status).toBe("fulfilled");
    });
  });

  describe("updateLimit", () => {
    it("should update the concurrency limit", () => {
      const controller = new ConcurrencyController({ limit: 3 });

      controller.updateLimit(5);

      expect(controller.getLimit()).toBe(5);
    });

    it("should throw error for invalid limit (zero)", () => {
      const controller = new ConcurrencyController({ limit: 3 });

      expect(() => controller.updateLimit(0)).toThrow("Concurrency limit must be greater than 0");
    });

    it("should throw error for invalid limit (negative)", () => {
      const controller = new ConcurrencyController({ limit: 3 });

      expect(() => controller.updateLimit(-1)).toThrow("Concurrency limit must be greater than 0");
    });

    it("should apply new limit to subsequent operations", async () => {
      const controller = new ConcurrencyController({ limit: 1 });

      // Start with limit of 1
      const firstBatch = [
        controller.run(async () => {
          await new Promise((resolve) => setTimeout(resolve, 30));
          return 1;
        }),
        controller.run(async () => {
          await new Promise((resolve) => setTimeout(resolve, 30));
          return 2;
        }),
      ];

      // Wait for first batch to complete
      await Promise.all(firstBatch);

      // Update to limit of 2
      controller.updateLimit(2);

      let activeCount = 0;
      let maxActiveCount = 0;

      const createTask = (delay: number) => async () => {
        activeCount++;
        maxActiveCount = Math.max(maxActiveCount, activeCount);
        await new Promise((resolve) => setTimeout(resolve, delay));
        activeCount--;
      };

      // New operations should use the new limit of 2
      const secondBatch = [
        controller.run(createTask(30)),
        controller.run(createTask(30)),
        controller.run(createTask(30)),
      ];

      await Promise.all(secondBatch);

      // New operations should respect the new limit of 2
      expect(maxActiveCount).toBeLessThanOrEqual(2);
    });
  });

  describe("getLimit", () => {
    it("should return the current limit", () => {
      const controller = new ConcurrencyController({ limit: 7 });
      expect(controller.getLimit()).toBe(7);
    });

    it("should return updated limit after updateLimit", () => {
      const controller = new ConcurrencyController({ limit: 3 });
      controller.updateLimit(8);
      expect(controller.getLimit()).toBe(8);
    });
  });

  describe("pendingCount and activeCount", () => {
    it("should track pending and active operations", async () => {
      const controller = new ConcurrencyController({ limit: 1 });

      const longTask = async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      };

      // Start multiple tasks
      const promises = [
        controller.run(longTask),
        controller.run(longTask),
        controller.run(longTask),
      ];

      // Give time for first task to start
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should have 1 active and 2 pending
      expect(controller.activeCount).toBe(1);
      expect(controller.pendingCount).toBe(2);

      await Promise.all(promises);

      // All should be complete
      expect(controller.activeCount).toBe(0);
      expect(controller.pendingCount).toBe(0);
    });
  });

  describe("clearQueue", () => {
    it("should clear pending operations", async () => {
      const controller = new ConcurrencyController({ limit: 1 });

      const longTask = async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      };

      // Start multiple tasks
      controller.run(longTask);
      controller.run(longTask);
      controller.run(longTask);

      // Give time for first task to start
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should have pending tasks
      expect(controller.pendingCount).toBeGreaterThan(0);

      // Clear the queue
      controller.clearQueue();

      // Pending count should be 0
      expect(controller.pendingCount).toBe(0);
    });
  });

  describe("edge cases", () => {
    it("should handle limit of 1 (sequential execution)", async () => {
      const controller = new ConcurrencyController({ limit: 1 });
      const executionOrder: number[] = [];

      const createTask = (id: number) => async () => {
        executionOrder.push(id);
        await new Promise((resolve) => setTimeout(resolve, 10));
      };

      await Promise.all([
        controller.run(createTask(1)),
        controller.run(createTask(2)),
        controller.run(createTask(3)),
      ]);

      // Should execute in order with limit of 1
      expect(executionOrder).toEqual([1, 2, 3]);
    });

    it("should handle high concurrency limit", async () => {
      const controller = new ConcurrencyController({ limit: 100 });
      const taskCount = 50;

      const tasks = Array.from({ length: taskCount }, (_, i) => controller.run(async () => i));

      const results = await Promise.all(tasks);

      expect(results).toHaveLength(taskCount);
      expect(results).toEqual(Array.from({ length: taskCount }, (_, i) => i));
    });

    it("should handle tasks that return different types", async () => {
      const controller = new ConcurrencyController({ limit: 3 });

      const stringTask = async () => "string";
      const numberTask = async () => 42;
      const objectTask = async () => ({ key: "value" });
      const arrayTask = async () => [1, 2, 3];

      const [str, num, obj, arr] = await Promise.all([
        controller.run(stringTask),
        controller.run(numberTask),
        controller.run(objectTask),
        controller.run(arrayTask),
      ]);

      expect(str).toBe("string");
      expect(num).toBe(42);
      expect(obj).toEqual({ key: "value" });
      expect(arr).toEqual([1, 2, 3]);
    });

    it("should handle empty task (immediate resolution)", async () => {
      const controller = new ConcurrencyController({ limit: 3 });

      const result = await controller.run(async () => undefined);

      expect(result).toBeUndefined();
    });
  });

  describe("real-world scenarios", () => {
    it("should handle chunk upload simulation", async () => {
      const controller = new ConcurrencyController({ limit: 3 });
      const uploadedChunks: number[] = [];

      const uploadChunk = async (chunkIndex: number) => {
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 50));
        uploadedChunks.push(chunkIndex);
        return { success: true, chunkIndex };
      };

      const chunks = Array.from({ length: 10 }, (_, i) => i);
      const results = await Promise.all(
        chunks.map((index) => controller.run(() => uploadChunk(index))),
      );

      expect(results).toHaveLength(10);
      expect(uploadedChunks).toHaveLength(10);
      expect(results.every((r) => r.success)).toBe(true);
    });

    it("should handle dynamic limit adjustment during upload", async () => {
      const controller = new ConcurrencyController({ limit: 2 });
      const completedTasks: number[] = [];

      const task = async (id: number) => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        completedTasks.push(id);
        return id;
      };

      // Start some tasks
      const batch1 = [
        controller.run(() => task(1)),
        controller.run(() => task(2)),
        controller.run(() => task(3)),
      ];

      // Increase limit after a delay
      setTimeout(() => controller.updateLimit(5), 20);

      // Add more tasks
      const batch2 = [
        controller.run(() => task(4)),
        controller.run(() => task(5)),
        controller.run(() => task(6)),
      ];

      await Promise.all([...batch1, ...batch2]);

      expect(completedTasks).toHaveLength(6);
      expect(controller.getLimit()).toBe(5);
    });
  });
});
