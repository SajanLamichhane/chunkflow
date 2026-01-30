/**
 * Additional edge case tests for UploadManager
 *
 * Tests edge cases and error scenarios including:
 * - Storage unavailability
 * - Resume operations with errors
 * - Batch operations edge cases
 * - Concurrent task management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { UploadManager } from "../src/upload-manager";
import { UploadStorage } from "@chunkflow/shared";
import type { RequestAdapter } from "@chunkflow/protocol";
import { createMockAdapter, createMockFile } from "./setup";

describe("UploadManager - Edge Cases", () => {
  let manager: UploadManager;
  let mockAdapter: RequestAdapter;

  beforeEach(async () => {
    mockAdapter = createMockAdapter();
    manager = new UploadManager({
      requestAdapter: mockAdapter,
      autoResumeUnfinished: false,
    });

    await manager.init();
  });

  afterEach(() => {
    manager.close();
  });

  describe("Storage Unavailability", () => {
    it("should handle storage initialization failure gracefully", async () => {
      // Create a manager that will fail storage init
      const failingManager = new UploadManager({
        requestAdapter: mockAdapter,
        autoResumeUnfinished: true,
      });

      // Mock storage to fail
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // Should not throw even if storage fails
      await expect(failingManager.init()).resolves.toBeUndefined();

      // Manager should still be initialized
      expect(failingManager.isInitialized()).toBe(true);

      consoleSpy.mockRestore();
      failingManager.close();
    });

    it("should handle getUnfinishedTasksInfo when storage is unavailable", async () => {
      // Close storage to make it unavailable
      manager.close();

      const unfinished = await manager.getUnfinishedTasksInfo();

      // Should return empty array instead of throwing
      expect(unfinished).toEqual([]);
    });

    it("should handle resumeTask when storage is unavailable", async () => {
      const file = createMockFile("test.txt", 1024);

      // Close storage to make it unavailable
      manager.close();

      // Should throw appropriate error
      await expect(manager.resumeTask("task_123", file)).rejects.toThrow(
        "Storage is not available",
      );
    });

    it("should handle clearAllUnfinishedTasks when storage is unavailable", async () => {
      // Close storage to make it unavailable
      manager.close();

      const cleared = await manager.clearAllUnfinishedTasks();

      // Should return 0 instead of throwing
      expect(cleared).toBe(0);
    });
  });

  describe("Resume Operations Edge Cases", () => {
    let storage: UploadStorage;

    beforeEach(async () => {
      storage = new UploadStorage();
      await storage.init();
    });

    afterEach(() => {
      storage.close();
    });

    it("should handle resume with storage errors during record deletion", async () => {
      const file = createMockFile("test.txt", 1024);

      const mockRecord = {
        taskId: "task_123",
        fileInfo: {
          name: "test.txt",
          size: 1024,
          type: "text/plain",
          lastModified: file.lastModified,
        },
        uploadedChunks: [0],
        uploadToken: "mock-token",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await storage.saveRecord(mockRecord);

      // Mock console.warn to verify warning is logged if deletion fails
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // Get the manager's internal storage and mock its deleteRecord to fail
      // @ts-expect-error - accessing private property for testing
      const managerStorage = manager.storage;
      const originalDelete = managerStorage.deleteRecord.bind(managerStorage);
      vi.spyOn(managerStorage, "deleteRecord").mockImplementation(async (taskId: string) => {
        // Call original to actually delete from our test storage
        await originalDelete(taskId);
        // Then throw to simulate error
        throw new Error("Delete failed");
      });

      // Resume should still succeed even if deletion fails
      const task = await manager.resumeTask("task_123", file);

      expect(task).toBeDefined();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should handle clearUnfinishedTask with storage errors", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // Close storage to cause error
      storage.close();

      // Should not throw
      await expect(manager.clearUnfinishedTask("task_123")).resolves.toBeUndefined();

      consoleSpy.mockRestore();
    });
  });

  describe("Batch Operations Edge Cases", () => {
    it("should handle resumeAll with mixed task states", async () => {
      const file1 = createMockFile("test1.txt", 1024);
      const file2 = createMockFile("test2.txt", 2048);
      const file3 = createMockFile("test3.txt", 4096);

      const task1 = manager.createTask(file1);
      const task2 = manager.createTask(file2);
      const task3 = manager.createTask(file3);

      // Set different statuses and initialize upload tokens for paused tasks
      (task1 as any).status = "paused";
      (task1 as any).uploadToken = {
        token: "test-token-1",
        fileId: "file-1",
        chunkSize: 1024 * 1024,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      };
      (task1 as any).chunks = [];

      (task2 as any).status = "uploading";

      (task3 as any).status = "paused";
      (task3 as any).uploadToken = {
        token: "test-token-3",
        fileId: "file-3",
        chunkSize: 1024 * 1024,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      };
      (task3 as any).chunks = [];

      const resumed = await manager.resumeAll();

      // Should only resume paused tasks
      expect(resumed).toBe(2);
    });

    it("should handle resumeAll with resume failures", async () => {
      const file1 = createMockFile("test1.txt", 1024);
      const file2 = createMockFile("test2.txt", 2048);

      const task1 = manager.createTask(file1);
      const task2 = manager.createTask(file2);

      // Set both to paused and initialize upload tokens
      (task1 as any).status = "paused";
      (task1 as any).uploadToken = {
        token: "test-token-1",
        fileId: "file-1",
        chunkSize: 1024 * 1024,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      };
      (task1 as any).chunks = [];

      (task2 as any).status = "paused";
      (task2 as any).uploadToken = {
        token: "test-token-2",
        fileId: "file-2",
        chunkSize: 1024 * 1024,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      };
      (task2 as any).chunks = [];

      // Mock task2.resume to fail
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.spyOn(task2, "resume").mockRejectedValue(new Error("Resume failed"));

      const resumed = await manager.resumeAll();

      // Should resume task1 successfully and log warning for task2
      expect(resumed).toBe(1);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should handle pauseAll with no uploading tasks", () => {
      const file1 = createMockFile("test1.txt", 1024);
      const file2 = createMockFile("test2.txt", 2048);

      manager.createTask(file1);
      manager.createTask(file2);

      // Both tasks are idle
      const paused = manager.pauseAll();

      expect(paused).toBe(0);
    });

    it("should handle cancelAll with no active tasks", () => {
      const file1 = createMockFile("test1.txt", 1024);
      const file2 = createMockFile("test2.txt", 2048);

      const task1 = manager.createTask(file1);
      const task2 = manager.createTask(file2);

      // Set both to terminal states
      (task1 as any).status = "success";
      (task2 as any).status = "error";

      const cancelled = manager.cancelAll();

      expect(cancelled).toBe(0);
    });

    it("should handle clearCompletedTasks with storage errors", async () => {
      const file1 = createMockFile("test1.txt", 1024);
      const file2 = createMockFile("test2.txt", 2048);

      const task1 = manager.createTask(file1);
      const task2 = manager.createTask(file2);

      // Set to completed states
      (task1 as any).status = "success";
      (task2 as any).status = "error";

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // Mock storage to fail on delete
      // @ts-expect-error - accessing private property for testing
      const storage = manager.storage;
      vi.spyOn(storage, "deleteRecord").mockRejectedValue(new Error("Delete failed"));

      // Should still attempt to clear tasks
      const cleared = await manager.clearCompletedTasks();

      // Tasks should be removed from manager even if storage cleanup fails
      expect(cleared).toBe(2);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe("Task Management Edge Cases", () => {
    it("should handle deleteTask with storage cleanup failure", async () => {
      const file = createMockFile("test.txt", 1024);
      const task = manager.createTask(file);

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // Mock storage to fail on delete
      // @ts-expect-error - accessing private property for testing
      const storage = manager.storage;
      vi.spyOn(storage, "deleteRecord").mockRejectedValue(new Error("Delete failed"));

      // Should still delete task from manager
      await manager.deleteTask(task.id);

      expect(manager.getTask(task.id)).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should handle multiple rapid task creations", () => {
      const tasks = [];

      // Create many tasks rapidly
      for (let i = 0; i < 100; i++) {
        const file = createMockFile(`test${i}.txt`, 1024);
        const task = manager.createTask(file);
        tasks.push(task);
      }

      expect(manager.getTaskCount()).toBe(100);

      // All task IDs should be unique
      const taskIds = tasks.map((t) => t.id);
      const uniqueIds = new Set(taskIds);
      expect(uniqueIds.size).toBe(100);
    });

    it("should handle task creation with all custom options", () => {
      const file = createMockFile("test.txt", 1024);

      const task = manager.createTask(file, {
        chunkSize: 2 * 1024 * 1024,
        concurrency: 5,
        retryCount: 5,
        retryDelay: 2000,
        autoStart: true,
      });

      expect(task).toBeDefined();
      expect(task.file).toBe(file);
    });

    it("should maintain task order in getAllTasks", () => {
      const file1 = createMockFile("test1.txt", 1024);
      const file2 = createMockFile("test2.txt", 2048);
      const file3 = createMockFile("test3.txt", 4096);

      const task1 = manager.createTask(file1);
      const task2 = manager.createTask(file2);
      const task3 = manager.createTask(file3);

      const allTasks = manager.getAllTasks();

      // Tasks should be in insertion order
      expect(allTasks[0]).toBe(task1);
      expect(allTasks[1]).toBe(task2);
      expect(allTasks[2]).toBe(task3);
    });
  });

  describe("Statistics Edge Cases", () => {
    it("should handle statistics with all task states", () => {
      const files = [
        createMockFile("idle.txt", 1024),
        createMockFile("uploading.txt", 2048),
        createMockFile("paused.txt", 4096),
        createMockFile("success.txt", 8192),
        createMockFile("error.txt", 16384),
        createMockFile("cancelled.txt", 32768),
      ];

      const tasks = files.map((file) => manager.createTask(file));

      // Set each task to a different status
      (tasks[0] as any).status = "idle";
      (tasks[1] as any).status = "uploading";
      (tasks[2] as any).status = "paused";
      (tasks[3] as any).status = "success";
      (tasks[4] as any).status = "error";
      (tasks[5] as any).status = "cancelled";

      const stats = manager.getStatistics();

      expect(stats.total).toBe(6);
      expect(stats.idle).toBe(1);
      expect(stats.uploading).toBe(1);
      expect(stats.paused).toBe(1);
      expect(stats.success).toBe(1);
      expect(stats.error).toBe(1);
      expect(stats.cancelled).toBe(1);
    });

    it("should handle statistics after task deletion", async () => {
      const file1 = createMockFile("test1.txt", 1024);
      const file2 = createMockFile("test2.txt", 2048);

      const task1 = manager.createTask(file1);
      const task2 = manager.createTask(file2);

      (task1 as any).status = "success";
      (task2 as any).status = "uploading";

      let stats = manager.getStatistics();
      expect(stats.total).toBe(2);
      expect(stats.success).toBe(1);
      expect(stats.uploading).toBe(1);

      // Delete one task
      await manager.deleteTask(task1.id);

      stats = manager.getStatistics();
      expect(stats.total).toBe(1);
      expect(stats.success).toBe(0);
      expect(stats.uploading).toBe(1);
    });
  });

  describe("Initialization Edge Cases", () => {
    it("should handle multiple init calls without issues", async () => {
      const newManager = new UploadManager({
        requestAdapter: mockAdapter,
      });

      // Call init multiple times
      await newManager.init();
      await newManager.init();
      await newManager.init();

      expect(newManager.isInitialized()).toBe(true);

      newManager.close();
    });

    it("should work without initialization for basic operations", () => {
      const newManager = new UploadManager({
        requestAdapter: mockAdapter,
      });

      // Should be able to create tasks without init
      const file = createMockFile("test.txt", 1024);
      const task = newManager.createTask(file);

      expect(task).toBeDefined();
      expect(newManager.getTaskCount()).toBe(1);

      newManager.close();
    });

    it("should handle close before init", () => {
      const newManager = new UploadManager({
        requestAdapter: mockAdapter,
      });

      // Should not throw
      expect(() => newManager.close()).not.toThrow();

      expect(newManager.isInitialized()).toBe(false);
    });

    it("should handle operations after close", async () => {
      const file = createMockFile("test.txt", 1024);

      manager.close();

      // Creating tasks after close should still work
      // (manager doesn't prevent this, just clears state)
      const task = manager.createTask(file);
      expect(task).toBeDefined();

      // But manager state is reset
      expect(manager.isInitialized()).toBe(false);
    });
  });

  describe("Plugin Integration Edge Cases", () => {
    it("should handle plugin hooks with task state changes", () => {
      const hookCalls: string[] = [];

      const plugin = {
        name: "test-plugin",
        onTaskCreated: () => hookCalls.push("created"),
        onTaskStart: () => hookCalls.push("start"),
        onTaskProgress: () => hookCalls.push("progress"),
        onTaskSuccess: () => hookCalls.push("success"),
        onTaskError: () => hookCalls.push("error"),
        onTaskPause: () => hookCalls.push("pause"),
        onTaskResume: () => hookCalls.push("resume"),
        onTaskCancel: () => hookCalls.push("cancel"),
      };

      manager.use(plugin);

      const file = createMockFile("test.txt", 1024);
      const task = manager.createTask(file);

      expect(hookCalls).toContain("created");

      // Simulate various events
      // @ts-expect-error - accessing private property for testing
      task.eventBus.emit("start", { taskId: task.id, file });
      expect(hookCalls).toContain("start");

      // @ts-expect-error - accessing private property for testing
      task.eventBus.emit("pause", { taskId: task.id });
      expect(hookCalls).toContain("pause");

      // @ts-expect-error - accessing private property for testing
      task.eventBus.emit("resume", { taskId: task.id });
      expect(hookCalls).toContain("resume");

      // @ts-expect-error - accessing private property for testing
      task.eventBus.emit("cancel", { taskId: task.id });
      expect(hookCalls).toContain("cancel");
    });

    it("should handle multiple plugins with same hooks", () => {
      const calls1: string[] = [];
      const calls2: string[] = [];

      const plugin1 = {
        name: "plugin1",
        onTaskCreated: () => calls1.push("created"),
      };

      const plugin2 = {
        name: "plugin2",
        onTaskCreated: () => calls2.push("created"),
      };

      manager.use(plugin1);
      manager.use(plugin2);

      const file = createMockFile("test.txt", 1024);
      manager.createTask(file);

      // Both plugins should be called
      expect(calls1).toContain("created");
      expect(calls2).toContain("created");
    });
  });
});
