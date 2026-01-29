import { describe, it, expect, beforeEach, afterEach, beforeAll } from "vitest";
import { UploadStorage, StorageError, type UploadRecord } from "./upload-storage";
import "fake-indexeddb/auto";

describe("UploadStorage", () => {
  let storage: UploadStorage;

  beforeEach(async () => {
    storage = new UploadStorage();
    await storage.init();
  });

  afterEach(async () => {
    // Clean up after each test
    try {
      await storage.clearAll();
      storage.close();
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe("init", () => {
    it("should initialize the database successfully", async () => {
      const newStorage = new UploadStorage();
      await expect(newStorage.init()).resolves.toBeUndefined();
      expect(newStorage.isAvailable()).toBe(true);
      newStorage.close();
    });

    it("should handle multiple init calls gracefully", async () => {
      const newStorage = new UploadStorage();
      await newStorage.init();
      await expect(newStorage.init()).resolves.toBeUndefined();
      newStorage.close();
    });
  });

  describe("saveRecord", () => {
    it("should save a new upload record", async () => {
      const record: UploadRecord = {
        taskId: "task-1",
        fileInfo: {
          name: "test.txt",
          size: 1024,
          type: "text/plain",
          lastModified: Date.now(),
        },
        uploadedChunks: [0, 1, 2],
        uploadToken: "token-123",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await expect(storage.saveRecord(record)).resolves.toBeUndefined();

      // Verify the record was saved
      const retrieved = await storage.getRecord("task-1");
      expect(retrieved).toEqual(record);
    });

    it("should update an existing record when saving with same taskId", async () => {
      const record1: UploadRecord = {
        taskId: "task-1",
        fileInfo: {
          name: "test.txt",
          size: 1024,
          type: "text/plain",
          lastModified: Date.now(),
        },
        uploadedChunks: [0, 1],
        uploadToken: "token-123",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await storage.saveRecord(record1);

      const record2: UploadRecord = {
        ...record1,
        uploadedChunks: [0, 1, 2, 3],
        updatedAt: Date.now(),
      };

      await storage.saveRecord(record2);

      const retrieved = await storage.getRecord("task-1");
      expect(retrieved?.uploadedChunks).toEqual([0, 1, 2, 3]);
    });

    it("should throw error when storage is not initialized", async () => {
      const uninitializedStorage = new UploadStorage();
      const record: UploadRecord = {
        taskId: "task-1",
        fileInfo: {
          name: "test.txt",
          size: 1024,
          type: "text/plain",
          lastModified: Date.now(),
        },
        uploadedChunks: [],
        uploadToken: "token-123",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await expect(uninitializedStorage.saveRecord(record)).rejects.toThrow(StorageError);
    });
  });

  describe("getRecord", () => {
    it("should retrieve an existing record", async () => {
      const record: UploadRecord = {
        taskId: "task-1",
        fileInfo: {
          name: "test.txt",
          size: 1024,
          type: "text/plain",
          lastModified: Date.now(),
        },
        uploadedChunks: [0, 1, 2],
        uploadToken: "token-123",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await storage.saveRecord(record);
      const retrieved = await storage.getRecord("task-1");

      expect(retrieved).toEqual(record);
    });

    it("should return null for non-existent record", async () => {
      const retrieved = await storage.getRecord("non-existent");
      expect(retrieved).toBeNull();
    });

    it("should throw error when storage is not initialized", async () => {
      const uninitializedStorage = new UploadStorage();
      await expect(uninitializedStorage.getRecord("task-1")).rejects.toThrow(StorageError);
    });
  });

  describe("updateRecord", () => {
    it("should update an existing record with partial data", async () => {
      const record: UploadRecord = {
        taskId: "task-1",
        fileInfo: {
          name: "test.txt",
          size: 1024,
          type: "text/plain",
          lastModified: Date.now(),
        },
        uploadedChunks: [0, 1],
        uploadToken: "token-123",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await storage.saveRecord(record);

      const updateTime = Date.now();
      await storage.updateRecord("task-1", {
        uploadedChunks: [0, 1, 2, 3, 4],
      });

      const updated = await storage.getRecord("task-1");
      expect(updated?.uploadedChunks).toEqual([0, 1, 2, 3, 4]);
      expect(updated?.updatedAt).toBeGreaterThanOrEqual(updateTime);
      expect(updated?.fileInfo).toEqual(record.fileInfo);
      expect(updated?.uploadToken).toBe("token-123");
    });

    it("should throw error when updating non-existent record", async () => {
      await expect(storage.updateRecord("non-existent", { uploadedChunks: [0] })).rejects.toThrow(
        StorageError,
      );
    });

    it("should not allow changing taskId", async () => {
      const record: UploadRecord = {
        taskId: "task-1",
        fileInfo: {
          name: "test.txt",
          size: 1024,
          type: "text/plain",
          lastModified: Date.now(),
        },
        uploadedChunks: [0],
        uploadToken: "token-123",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await storage.saveRecord(record);

      // Try to update with different taskId (should be ignored)
      await storage.updateRecord("task-1", {
        taskId: "task-2" as any,
        uploadedChunks: [0, 1],
      });

      const updated = await storage.getRecord("task-1");
      expect(updated?.taskId).toBe("task-1");
    });
  });

  describe("deleteRecord", () => {
    it("should delete an existing record", async () => {
      const record: UploadRecord = {
        taskId: "task-1",
        fileInfo: {
          name: "test.txt",
          size: 1024,
          type: "text/plain",
          lastModified: Date.now(),
        },
        uploadedChunks: [0, 1, 2],
        uploadToken: "token-123",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await storage.saveRecord(record);
      await storage.deleteRecord("task-1");

      const retrieved = await storage.getRecord("task-1");
      expect(retrieved).toBeNull();
    });

    it("should not throw error when deleting non-existent record", async () => {
      await expect(storage.deleteRecord("non-existent")).resolves.toBeUndefined();
    });

    it("should throw error when storage is not initialized", async () => {
      const uninitializedStorage = new UploadStorage();
      await expect(uninitializedStorage.deleteRecord("task-1")).rejects.toThrow(StorageError);
    });
  });

  describe("getAllRecords", () => {
    it("should return empty array when no records exist", async () => {
      const records = await storage.getAllRecords();
      expect(records).toEqual([]);
    });

    it("should return all saved records", async () => {
      const record1: UploadRecord = {
        taskId: "task-1",
        fileInfo: {
          name: "test1.txt",
          size: 1024,
          type: "text/plain",
          lastModified: Date.now(),
        },
        uploadedChunks: [0, 1],
        uploadToken: "token-1",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const record2: UploadRecord = {
        taskId: "task-2",
        fileInfo: {
          name: "test2.txt",
          size: 2048,
          type: "text/plain",
          lastModified: Date.now(),
        },
        uploadedChunks: [0, 1, 2],
        uploadToken: "token-2",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await storage.saveRecord(record1);
      await storage.saveRecord(record2);

      const records = await storage.getAllRecords();
      expect(records).toHaveLength(2);
      expect(records.map((r) => r.taskId).sort()).toEqual(["task-1", "task-2"]);
    });

    it("should throw error when storage is not initialized", async () => {
      const uninitializedStorage = new UploadStorage();
      await expect(uninitializedStorage.getAllRecords()).rejects.toThrow(StorageError);
    });
  });

  describe("clearAll", () => {
    it("should clear all records from the database", async () => {
      const record1: UploadRecord = {
        taskId: "task-1",
        fileInfo: {
          name: "test1.txt",
          size: 1024,
          type: "text/plain",
          lastModified: Date.now(),
        },
        uploadedChunks: [0, 1],
        uploadToken: "token-1",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const record2: UploadRecord = {
        taskId: "task-2",
        fileInfo: {
          name: "test2.txt",
          size: 2048,
          type: "text/plain",
          lastModified: Date.now(),
        },
        uploadedChunks: [0, 1, 2],
        uploadToken: "token-2",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await storage.saveRecord(record1);
      await storage.saveRecord(record2);

      await storage.clearAll();

      const records = await storage.getAllRecords();
      expect(records).toEqual([]);
    });
  });

  describe("close", () => {
    it("should close the database connection", () => {
      storage.close();
      expect(storage.isAvailable()).toBe(false);
    });

    it("should handle multiple close calls gracefully", () => {
      storage.close();
      storage.close();
      expect(storage.isAvailable()).toBe(false);
    });
  });

  describe("isAvailable", () => {
    it("should return true when storage is initialized", () => {
      expect(storage.isAvailable()).toBe(true);
    });

    it("should return false when storage is not initialized", () => {
      const uninitializedStorage = new UploadStorage();
      expect(uninitializedStorage.isAvailable()).toBe(false);
    });

    it("should return false after closing", () => {
      storage.close();
      expect(storage.isAvailable()).toBe(false);
    });
  });

  describe("error handling", () => {
    it("should handle StorageError with QUOTA_EXCEEDED code", async () => {
      // This test is difficult to trigger in a real environment
      // but we can verify the error type is exported correctly
      expect(StorageError).toBeDefined();

      const error = new StorageError("Test error", "QUOTA_EXCEEDED");
      expect(error.code).toBe("QUOTA_EXCEEDED");
      expect(error.name).toBe("StorageError");
    });

    it("should handle StorageError with STORAGE_UNAVAILABLE code", () => {
      const error = new StorageError("Test error", "STORAGE_UNAVAILABLE");
      expect(error.code).toBe("STORAGE_UNAVAILABLE");
    });

    it("should handle StorageError with OPERATION_FAILED code", () => {
      const error = new StorageError("Test error", "OPERATION_FAILED");
      expect(error.code).toBe("OPERATION_FAILED");
    });
  });

  describe("edge cases", () => {
    it("should handle records with empty uploadedChunks array", async () => {
      const record: UploadRecord = {
        taskId: "task-1",
        fileInfo: {
          name: "test.txt",
          size: 1024,
          type: "text/plain",
          lastModified: Date.now(),
        },
        uploadedChunks: [],
        uploadToken: "token-123",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await storage.saveRecord(record);
      const retrieved = await storage.getRecord("task-1");
      expect(retrieved?.uploadedChunks).toEqual([]);
    });

    it("should handle records with large uploadedChunks array", async () => {
      const largeChunksArray = Array.from({ length: 1000 }, (_, i) => i);
      const record: UploadRecord = {
        taskId: "task-1",
        fileInfo: {
          name: "large-file.bin",
          size: 1024 * 1024 * 100, // 100MB
          type: "application/octet-stream",
          lastModified: Date.now(),
        },
        uploadedChunks: largeChunksArray,
        uploadToken: "token-123",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await storage.saveRecord(record);
      const retrieved = await storage.getRecord("task-1");
      expect(retrieved?.uploadedChunks).toEqual(largeChunksArray);
    });

    it("should handle records with special characters in file names", async () => {
      const record: UploadRecord = {
        taskId: "task-1",
        fileInfo: {
          name: "测试文件 (1) [copy].txt",
          size: 1024,
          type: "text/plain",
          lastModified: Date.now(),
        },
        uploadedChunks: [0],
        uploadToken: "token-123",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await storage.saveRecord(record);
      const retrieved = await storage.getRecord("task-1");
      expect(retrieved?.fileInfo.name).toBe("测试文件 (1) [copy].txt");
    });

    it("should handle records with optional hash field", async () => {
      const record: UploadRecord = {
        taskId: "task-1",
        fileInfo: {
          name: "test.txt",
          size: 1024,
          type: "text/plain",
          hash: "abc123def456",
          lastModified: Date.now(),
        },
        uploadedChunks: [0, 1, 2],
        uploadToken: "token-123",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await storage.saveRecord(record);
      const retrieved = await storage.getRecord("task-1");
      expect(retrieved?.fileInfo.hash).toBe("abc123def456");
    });
  });
});
