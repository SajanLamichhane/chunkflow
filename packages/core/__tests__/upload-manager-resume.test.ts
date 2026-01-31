/**
 * Unit tests for UploadManager resume functionality
 *
 * Tests the resume functionality including:
 * - Getting unfinished tasks info
 * - Resuming tasks with re-selected files
 * - File validation for resume
 * - Clearing unfinished tasks
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { UploadManager } from "../src/upload-manager";
import { UploadStorage } from "@chunkflowjs/shared";
import type { RequestAdapter } from "@chunkflowjs/protocol";
import type {
  CreateFileRequest,
  CreateFileResponse,
  VerifyHashRequest,
  VerifyHashResponse,
  UploadChunkRequest,
  UploadChunkResponse,
} from "@chunkflowjs/protocol";

// Mock RequestAdapter
const createMockAdapter = (): RequestAdapter => ({
  createFile: vi.fn(
    async (request: CreateFileRequest): Promise<CreateFileResponse> => ({
      uploadToken: {
        token: "mock-token",
        fileId: "mock-file-id",
        chunkSize: request.preferredChunkSize || 1024 * 1024,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      },
      negotiatedChunkSize: request.preferredChunkSize || 1024 * 1024,
    }),
  ),
  verifyHash: vi.fn(
    async (_request: VerifyHashRequest): Promise<VerifyHashResponse> => ({
      fileExists: false,
      existingChunks: [],
      missingChunks: [],
    }),
  ),
  uploadChunk: vi.fn(
    async (request: UploadChunkRequest): Promise<UploadChunkResponse> => ({
      success: true,
      chunkHash: request.chunkHash,
    }),
  ),
  mergeFile: vi.fn().mockResolvedValue({
    success: true,
    fileUrl: "https://example.com/file.txt",
    fileId: "test-file-id",
  }),
});

// Helper to create a mock File
const createMockFile = (
  name: string,
  size: number,
  type: string = "text/plain",
  lastModified: number = Date.now(),
): File => {
  const content = new Array(size).fill("a").join("");
  const file = new File([content], name, { type, lastModified });
  return file;
};

describe("UploadManager - Resume Functionality", () => {
  let manager: UploadManager;
  let mockAdapter: RequestAdapter;
  let storage: UploadStorage;

  beforeEach(async () => {
    mockAdapter = createMockAdapter();
    manager = new UploadManager({
      requestAdapter: mockAdapter,
      autoResumeUnfinished: false, // Disable auto-resume for tests
    });

    await manager.init();

    // Get storage instance for test setup
    storage = new UploadStorage();
    await storage.init();
  });

  afterEach(async () => {
    // Clean up storage after each test
    try {
      await storage.clearAll();
      storage.close();
    } catch (error) {
      // Ignore cleanup errors
    }

    manager.close();
  });

  describe("getUnfinishedTasksInfo", () => {
    it("should return empty array when no unfinished tasks exist", async () => {
      const unfinished = await manager.getUnfinishedTasksInfo();
      expect(unfinished).toEqual([]);
    });

    it("should return unfinished tasks from storage", async () => {
      // Create a mock unfinished task record
      const mockRecord = {
        taskId: "task_123",
        fileInfo: {
          name: "test.txt",
          size: 1024,
          type: "text/plain",
          lastModified: Date.now(),
        },
        uploadedChunks: [0, 1, 2],
        uploadToken: "mock-token",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await storage.saveRecord(mockRecord);

      const unfinished = await manager.getUnfinishedTasksInfo();

      expect(unfinished).toHaveLength(1);
      expect(unfinished[0].taskId).toBe("task_123");
      expect(unfinished[0].fileInfo.name).toBe("test.txt");
      expect(unfinished[0].uploadedChunks).toEqual([0, 1, 2]);
    });

    it("should return multiple unfinished tasks", async () => {
      // Create multiple mock records
      const mockRecord1 = {
        taskId: "task_1",
        fileInfo: {
          name: "file1.txt",
          size: 1024,
          type: "text/plain",
          lastModified: Date.now(),
        },
        uploadedChunks: [0],
        uploadToken: "token-1",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const mockRecord2 = {
        taskId: "task_2",
        fileInfo: {
          name: "file2.txt",
          size: 2048,
          type: "text/plain",
          lastModified: Date.now(),
        },
        uploadedChunks: [0, 1],
        uploadToken: "token-2",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await storage.saveRecord(mockRecord1);
      await storage.saveRecord(mockRecord2);

      const unfinished = await manager.getUnfinishedTasksInfo();

      expect(unfinished).toHaveLength(2);
      expect(unfinished.map((r) => r.taskId)).toContain("task_1");
      expect(unfinished.map((r) => r.taskId)).toContain("task_2");
    });

    it("should handle storage errors gracefully", async () => {
      // Close storage to simulate error
      storage.close();

      const unfinished = await manager.getUnfinishedTasksInfo();

      // Should return empty array instead of throwing
      expect(unfinished).toEqual([]);
    });
  });

  describe("resumeTask", () => {
    it("should resume a task with matching file", async () => {
      const lastModified = Date.now();
      const file = createMockFile("test.txt", 1024, "text/plain", lastModified);

      // Create a mock unfinished task record
      const mockRecord = {
        taskId: "task_resume_123",
        fileInfo: {
          name: "test.txt",
          size: 1024,
          type: "text/plain",
          lastModified,
        },
        uploadedChunks: [0, 1],
        uploadToken: "mock-resume-token",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await storage.saveRecord(mockRecord);

      // Resume the task
      const task = await manager.resumeTask("task_resume_123", file);

      expect(task).toBeDefined();
      expect(task.id).toBe("task_resume_123");
      expect(task.file).toBe(file);
      expect(manager.getTask("task_resume_123")).toBe(task);
    });

    it("should throw error if task record not found", async () => {
      const file = createMockFile("test.txt", 1024);

      await expect(manager.resumeTask("non-existent-task", file)).rejects.toThrow(
        "No unfinished task found with ID: non-existent-task",
      );
    });

    it("should throw error if file name doesn't match", async () => {
      const mockRecord = {
        taskId: "task_123",
        fileInfo: {
          name: "original.txt",
          size: 1024,
          type: "text/plain",
          lastModified: Date.now(),
        },
        uploadedChunks: [0],
        uploadToken: "mock-token",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await storage.saveRecord(mockRecord);

      const file = createMockFile("different.txt", 1024);

      await expect(manager.resumeTask("task_123", file)).rejects.toThrow(
        'File name mismatch: expected "original.txt", got "different.txt"',
      );
    });

    it("should throw error if file size doesn't match", async () => {
      const mockRecord = {
        taskId: "task_123",
        fileInfo: {
          name: "test.txt",
          size: 1024,
          type: "text/plain",
          lastModified: Date.now(),
        },
        uploadedChunks: [0],
        uploadToken: "mock-token",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await storage.saveRecord(mockRecord);

      const file = createMockFile("test.txt", 2048); // Different size

      await expect(manager.resumeTask("task_123", file)).rejects.toThrow(
        "File size mismatch: expected 1024, got 2048",
      );
    });

    it("should throw error if file type doesn't match", async () => {
      const mockRecord = {
        taskId: "task_123",
        fileInfo: {
          name: "test.txt",
          size: 1024,
          type: "text/plain",
          lastModified: Date.now(),
        },
        uploadedChunks: [0],
        uploadToken: "mock-token",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await storage.saveRecord(mockRecord);

      const file = createMockFile("test.txt", 1024, "application/json"); // Different type

      await expect(manager.resumeTask("task_123", file)).rejects.toThrow(
        'File type mismatch: expected "text/plain", got "application/json"',
      );
    });

    it("should delete old storage record after resume", async () => {
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

      // Verify record exists
      let record = await storage.getRecord("task_123");
      expect(record).not.toBeNull();

      // Resume task
      await manager.resumeTask("task_123", file);

      // Verify record was deleted
      record = await storage.getRecord("task_123");
      expect(record).toBeNull();
    });

    it("should allow custom options when resuming", async () => {
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

      // Resume with custom options
      const task = await manager.resumeTask("task_123", file, {
        chunkSize: 2 * 1024 * 1024,
        concurrency: 5,
      });

      expect(task).toBeDefined();
    });
  });

  describe("clearUnfinishedTask", () => {
    it("should clear a specific unfinished task", async () => {
      const mockRecord = {
        taskId: "task_123",
        fileInfo: {
          name: "test.txt",
          size: 1024,
          type: "text/plain",
          lastModified: Date.now(),
        },
        uploadedChunks: [0],
        uploadToken: "mock-token",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await storage.saveRecord(mockRecord);

      // Verify record exists
      let record = await storage.getRecord("task_123");
      expect(record).not.toBeNull();

      // Clear the task
      await manager.clearUnfinishedTask("task_123");

      // Verify record was deleted
      record = await storage.getRecord("task_123");
      expect(record).toBeNull();
    });

    it("should be safe to clear non-existent task", async () => {
      // Should not throw
      await expect(manager.clearUnfinishedTask("non-existent")).resolves.toBeUndefined();
    });

    it("should not affect active tasks", async () => {
      const file = createMockFile("test.txt", 1024);
      const task = manager.createTask(file);

      // Clear a different task ID
      await manager.clearUnfinishedTask("different-task");

      // Active task should still exist
      expect(manager.getTask(task.id)).toBe(task);
    });
  });

  describe("clearAllUnfinishedTasks", () => {
    it("should clear all unfinished tasks", async () => {
      // Create multiple mock records
      const mockRecord1 = {
        taskId: "task_1",
        fileInfo: {
          name: "file1.txt",
          size: 1024,
          type: "text/plain",
          lastModified: Date.now(),
        },
        uploadedChunks: [0],
        uploadToken: "token-1",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const mockRecord2 = {
        taskId: "task_2",
        fileInfo: {
          name: "file2.txt",
          size: 2048,
          type: "text/plain",
          lastModified: Date.now(),
        },
        uploadedChunks: [0, 1],
        uploadToken: "token-2",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await storage.saveRecord(mockRecord1);
      await storage.saveRecord(mockRecord2);

      // Verify records exist
      let records = await storage.getAllRecords();
      expect(records).toHaveLength(2);

      // Clear all
      const cleared = await manager.clearAllUnfinishedTasks();

      expect(cleared).toBe(2);

      // Verify all records were deleted
      records = await storage.getAllRecords();
      expect(records).toHaveLength(0);
    });

    it("should return 0 when no unfinished tasks exist", async () => {
      const cleared = await manager.clearAllUnfinishedTasks();
      expect(cleared).toBe(0);
    });

    it("should not affect active tasks", async () => {
      const file1 = createMockFile("test1.txt", 1024);
      const file2 = createMockFile("test2.txt", 2048);

      const task1 = manager.createTask(file1);
      const task2 = manager.createTask(file2);

      // Clear all unfinished tasks
      await manager.clearAllUnfinishedTasks();

      // Active tasks should still exist
      expect(manager.getTask(task1.id)).toBe(task1);
      expect(manager.getTask(task2.id)).toBe(task2);
      expect(manager.getTaskCount()).toBe(2);
    });

    it("should handle storage errors gracefully", async () => {
      // Close storage to simulate error
      storage.close();

      const cleared = await manager.clearAllUnfinishedTasks();

      // Should return 0 instead of throwing
      expect(cleared).toBe(0);
    });
  });

  describe("Integration - Resume Workflow", () => {
    it("should support complete resume workflow", async () => {
      const file = createMockFile("large-file.txt", 5 * 1024 * 1024); // 5MB

      // Step 1: Create a mock unfinished upload
      const mockRecord = {
        taskId: "task_large_file",
        fileInfo: {
          name: "large-file.txt",
          size: 5 * 1024 * 1024,
          type: "text/plain",
          lastModified: file.lastModified,
        },
        uploadedChunks: [0, 1, 2], // First 3 chunks uploaded
        uploadToken: "mock-large-file-token",
        createdAt: Date.now() - 60000, // 1 minute ago
        updatedAt: Date.now() - 60000,
      };

      await storage.saveRecord(mockRecord);

      // Step 2: Get unfinished tasks
      const unfinished = await manager.getUnfinishedTasksInfo();
      expect(unfinished).toHaveLength(1);
      expect(unfinished[0].taskId).toBe("task_large_file");
      expect(unfinished[0].uploadedChunks).toEqual([0, 1, 2]);

      // Step 3: User re-selects the file and resumes
      const task = await manager.resumeTask("task_large_file", file);
      expect(task.id).toBe("task_large_file");

      // Step 4: Verify old record was cleaned up
      const record = await storage.getRecord("task_large_file");
      expect(record).toBeNull();

      // Step 5: Task is ready to start
      expect(task.getStatus()).toBe("idle");
      expect(manager.getTask("task_large_file")).toBe(task);
    });

    it("should allow clearing unwanted unfinished tasks", async () => {
      // Create multiple unfinished tasks
      const mockRecord1 = {
        taskId: "task_1",
        fileInfo: {
          name: "file1.txt",
          size: 1024,
          type: "text/plain",
          lastModified: Date.now(),
        },
        uploadedChunks: [0],
        uploadToken: "token-1",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const mockRecord2 = {
        taskId: "task_2",
        fileInfo: {
          name: "file2.txt",
          size: 2048,
          type: "text/plain",
          lastModified: Date.now(),
        },
        uploadedChunks: [0, 1],
        uploadToken: "token-2",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await storage.saveRecord(mockRecord1);
      await storage.saveRecord(mockRecord2);

      // User decides to only resume task_1 and clear task_2
      await manager.clearUnfinishedTask("task_2");

      const unfinished = await manager.getUnfinishedTasksInfo();
      expect(unfinished).toHaveLength(1);
      expect(unfinished[0].taskId).toBe("task_1");
    });
  });
});
