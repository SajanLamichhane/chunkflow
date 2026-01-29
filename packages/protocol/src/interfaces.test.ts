/**
 * Unit tests for Protocol interfaces
 */

import { describe, it, expect } from "vitest";
import type {
  CreateFileRequest,
  CreateFileResponse,
  VerifyHashRequest,
  VerifyHashResponse,
  UploadChunkRequest,
  UploadChunkResponse,
  MergeFileRequest,
  MergeFileResponse,
  RequestAdapter,
} from "./interfaces";
import type { UploadToken } from "./types";

describe("Protocol Interfaces", () => {
  describe("CreateFileRequest", () => {
    it("should have all required properties", () => {
      const request: CreateFileRequest = {
        fileName: "test.pdf",
        fileSize: 5 * 1024 * 1024,
        fileType: "application/pdf",
      };

      expect(request.fileName).toBe("test.pdf");
      expect(request.fileSize).toBe(5 * 1024 * 1024);
      expect(request.fileType).toBe("application/pdf");
    });

    it("should allow optional preferredChunkSize", () => {
      const request: CreateFileRequest = {
        fileName: "test.pdf",
        fileSize: 5 * 1024 * 1024,
        fileType: "application/pdf",
        preferredChunkSize: 2 * 1024 * 1024,
      };

      expect(request.preferredChunkSize).toBe(2 * 1024 * 1024);
    });
  });

  describe("CreateFileResponse", () => {
    it("should have all required properties", () => {
      const uploadToken: UploadToken = {
        token: "jwt-token",
        fileId: "file-123",
        chunkSize: 1024 * 1024,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      };

      const response: CreateFileResponse = {
        uploadToken,
        negotiatedChunkSize: 1024 * 1024,
      };

      expect(response.uploadToken).toBe(uploadToken);
      expect(response.negotiatedChunkSize).toBe(1024 * 1024);
    });
  });

  describe("VerifyHashRequest", () => {
    it("should support file hash verification", () => {
      const request: VerifyHashRequest = {
        fileHash: "file-hash-abc123",
        uploadToken: "token-123",
      };

      expect(request.fileHash).toBe("file-hash-abc123");
      expect(request.uploadToken).toBe("token-123");
    });

    it("should support chunk hashes verification", () => {
      const request: VerifyHashRequest = {
        chunkHashes: ["chunk1-hash", "chunk2-hash", "chunk3-hash"],
        uploadToken: "token-123",
      };

      expect(request.chunkHashes).toHaveLength(3);
      expect(request.chunkHashes).toContain("chunk1-hash");
    });

    it("should support both file and chunk hash verification", () => {
      const request: VerifyHashRequest = {
        fileHash: "file-hash",
        chunkHashes: ["chunk1", "chunk2"],
        uploadToken: "token-123",
      };

      expect(request.fileHash).toBeDefined();
      expect(request.chunkHashes).toBeDefined();
    });
  });

  describe("VerifyHashResponse", () => {
    it("should indicate file exists for instant upload", () => {
      const response: VerifyHashResponse = {
        fileExists: true,
        fileUrl: "https://example.com/files/abc123",
        existingChunks: [],
        missingChunks: [],
      };

      expect(response.fileExists).toBe(true);
      expect(response.fileUrl).toBe("https://example.com/files/abc123");
    });

    it("should list existing and missing chunks", () => {
      const response: VerifyHashResponse = {
        fileExists: false,
        existingChunks: [0, 1, 3],
        missingChunks: [2, 4, 5],
      };

      expect(response.fileExists).toBe(false);
      expect(response.existingChunks).toEqual([0, 1, 3]);
      expect(response.missingChunks).toEqual([2, 4, 5]);
    });

    it("should handle no existing chunks", () => {
      const response: VerifyHashResponse = {
        fileExists: false,
        existingChunks: [],
        missingChunks: [0, 1, 2, 3, 4],
      };

      expect(response.existingChunks).toHaveLength(0);
      expect(response.missingChunks).toHaveLength(5);
    });
  });

  describe("UploadChunkRequest", () => {
    it("should have all required properties with Blob", () => {
      const blob = new Blob(["test data"], { type: "application/octet-stream" });
      const request: UploadChunkRequest = {
        uploadToken: "token-123",
        chunkIndex: 0,
        chunkHash: "chunk-hash-abc",
        chunk: blob,
      };

      expect(request.uploadToken).toBe("token-123");
      expect(request.chunkIndex).toBe(0);
      expect(request.chunkHash).toBe("chunk-hash-abc");
      expect(request.chunk).toBe(blob);
    });

    it("should support Buffer type for Node.js", () => {
      const buffer = Buffer.from("test data");
      const request: UploadChunkRequest = {
        uploadToken: "token-123",
        chunkIndex: 1,
        chunkHash: "chunk-hash-def",
        chunk: buffer,
      };

      expect(request.chunk).toBe(buffer);
      expect(Buffer.isBuffer(request.chunk)).toBe(true);
    });
  });

  describe("UploadChunkResponse", () => {
    it("should confirm successful upload", () => {
      const response: UploadChunkResponse = {
        success: true,
        chunkHash: "chunk-hash-abc",
      };

      expect(response.success).toBe(true);
      expect(response.chunkHash).toBe("chunk-hash-abc");
    });
  });

  describe("MergeFileRequest", () => {
    it("should have all required properties", () => {
      const request: MergeFileRequest = {
        uploadToken: "token-123",
        fileHash: "complete-file-hash",
        chunkHashes: ["chunk1", "chunk2", "chunk3"],
      };

      expect(request.uploadToken).toBe("token-123");
      expect(request.fileHash).toBe("complete-file-hash");
      expect(request.chunkHashes).toHaveLength(3);
    });

    it("should maintain chunk order", () => {
      const orderedHashes = ["hash0", "hash1", "hash2", "hash3"];
      const request: MergeFileRequest = {
        uploadToken: "token-123",
        fileHash: "file-hash",
        chunkHashes: orderedHashes,
      };

      expect(request.chunkHashes).toEqual(orderedHashes);
      expect(request.chunkHashes[0]).toBe("hash0");
      expect(request.chunkHashes[3]).toBe("hash3");
    });
  });

  describe("MergeFileResponse", () => {
    it("should return file URL on success", () => {
      const response: MergeFileResponse = {
        success: true,
        fileUrl: "https://example.com/files/merged-file",
        fileId: "file-123",
      };

      expect(response.success).toBe(true);
      expect(response.fileUrl).toBe("https://example.com/files/merged-file");
      expect(response.fileId).toBe("file-123");
    });
  });

  describe("RequestAdapter", () => {
    it("should define all required methods", () => {
      const mockAdapter: RequestAdapter = {
        createFile: async (request: CreateFileRequest) => {
          return {
            uploadToken: {
              token: "mock-token",
              fileId: "mock-file-id",
              chunkSize: request.preferredChunkSize || 1024 * 1024,
              expiresAt: Date.now() + 24 * 60 * 60 * 1000,
            },
            negotiatedChunkSize: request.preferredChunkSize || 1024 * 1024,
          };
        },
        verifyHash: async (request: VerifyHashRequest) => {
          return {
            fileExists: false,
            existingChunks: [],
            missingChunks: [0, 1, 2],
          };
        },
        uploadChunk: async (request: UploadChunkRequest) => {
          return {
            success: true,
            chunkHash: request.chunkHash,
          };
        },
        mergeFile: async (request: MergeFileRequest) => {
          return {
            success: true,
            fileUrl: "https://example.com/files/merged",
            fileId: "file-123",
          };
        },
      };

      expect(mockAdapter.createFile).toBeDefined();
      expect(mockAdapter.verifyHash).toBeDefined();
      expect(mockAdapter.uploadChunk).toBeDefined();
      expect(mockAdapter.mergeFile).toBeDefined();
    });

    it("should support async operations", async () => {
      const mockAdapter: RequestAdapter = {
        createFile: async (request: CreateFileRequest) => {
          return {
            uploadToken: {
              token: "test-token",
              fileId: "test-file",
              chunkSize: 1024 * 1024,
              expiresAt: Date.now() + 24 * 60 * 60 * 1000,
            },
            negotiatedChunkSize: 1024 * 1024,
          };
        },
        verifyHash: async () => ({
          fileExists: false,
          existingChunks: [],
          missingChunks: [],
        }),
        uploadChunk: async (request) => ({
          success: true,
          chunkHash: request.chunkHash,
        }),
        mergeFile: async () => ({
          success: true,
          fileUrl: "test-url",
          fileId: "test-id",
        }),
      };

      const createResponse = await mockAdapter.createFile({
        fileName: "test.txt",
        fileSize: 1024,
        fileType: "text/plain",
      });

      expect(createResponse.uploadToken.token).toBe("test-token");
    });
  });

  describe("Type Safety", () => {
    it("should enforce type constraints at compile time", () => {
      // This test verifies TypeScript type checking
      // If this compiles, the types are correctly defined

      const createRequest: CreateFileRequest = {
        fileName: "test.txt",
        fileSize: 1024,
        fileType: "text/plain",
      };

      const uploadToken: UploadToken = {
        token: "token",
        fileId: "file-id",
        chunkSize: 1024 * 1024,
        expiresAt: Date.now(),
      };

      const createResponse: CreateFileResponse = {
        uploadToken,
        negotiatedChunkSize: 1024 * 1024,
      };

      // Type assertions to verify compilation
      expect(createRequest).toBeDefined();
      expect(createResponse).toBeDefined();
    });
  });
});
