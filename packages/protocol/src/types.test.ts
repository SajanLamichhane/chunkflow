/**
 * Unit tests for Protocol types
 */

import { describe, it, expect } from "vitest";
import type { FileInfo, ChunkInfo, UploadToken } from "./types";
import { UploadStatus } from "./types";

describe("Protocol Types", () => {
  describe("FileInfo", () => {
    it("should have all required properties", () => {
      const fileInfo: FileInfo = {
        name: "test.txt",
        size: 1024,
        type: "text/plain",
        lastModified: Date.now(),
      };

      expect(fileInfo.name).toBe("test.txt");
      expect(fileInfo.size).toBe(1024);
      expect(fileInfo.type).toBe("text/plain");
      expect(fileInfo.lastModified).toBeGreaterThan(0);
    });

    it("should allow optional hash property", () => {
      const fileInfoWithHash: FileInfo = {
        name: "test.txt",
        size: 1024,
        type: "text/plain",
        hash: "abc123",
        lastModified: Date.now(),
      };

      expect(fileInfoWithHash.hash).toBe("abc123");
    });
  });

  describe("ChunkInfo", () => {
    it("should have all required properties", () => {
      const chunkInfo: ChunkInfo = {
        index: 0,
        hash: "chunk-hash-123",
        size: 1024 * 1024,
        start: 0,
        end: 1024 * 1024,
      };

      expect(chunkInfo.index).toBe(0);
      expect(chunkInfo.hash).toBe("chunk-hash-123");
      expect(chunkInfo.size).toBe(1024 * 1024);
      expect(chunkInfo.start).toBe(0);
      expect(chunkInfo.end).toBe(1024 * 1024);
    });

    it("should correctly represent chunk boundaries", () => {
      const chunkSize = 1024 * 1024; // 1MB
      const chunk1: ChunkInfo = {
        index: 0,
        hash: "hash1",
        size: chunkSize,
        start: 0,
        end: chunkSize,
      };
      const chunk2: ChunkInfo = {
        index: 1,
        hash: "hash2",
        size: chunkSize,
        start: chunkSize,
        end: chunkSize * 2,
      };

      expect(chunk1.end).toBe(chunk2.start);
      expect(chunk2.size).toBe(chunk2.end - chunk2.start);
    });
  });

  describe("UploadToken", () => {
    it("should have all required properties", () => {
      const uploadToken: UploadToken = {
        token: "jwt-token-string",
        fileId: "file-123",
        chunkSize: 1024 * 1024,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      };

      expect(uploadToken.token).toBe("jwt-token-string");
      expect(uploadToken.fileId).toBe("file-123");
      expect(uploadToken.chunkSize).toBe(1024 * 1024);
      expect(uploadToken.expiresAt).toBeGreaterThan(Date.now());
    });

    it("should represent valid expiration time", () => {
      const now = Date.now();
      const uploadToken: UploadToken = {
        token: "test-token",
        fileId: "test-file",
        chunkSize: 1024 * 1024,
        expiresAt: now + 24 * 60 * 60 * 1000, // 24 hours
      };

      const isExpired = uploadToken.expiresAt < Date.now();
      expect(isExpired).toBe(false);
    });
  });

  describe("UploadStatus", () => {
    it("should have all status values", () => {
      expect(UploadStatus.IDLE).toBe("idle");
      expect(UploadStatus.HASHING).toBe("hashing");
      expect(UploadStatus.UPLOADING).toBe("uploading");
      expect(UploadStatus.PAUSED).toBe("paused");
      expect(UploadStatus.SUCCESS).toBe("success");
      expect(UploadStatus.ERROR).toBe("error");
      expect(UploadStatus.CANCELLED).toBe("cancelled");
    });

    it("should be usable in type guards", () => {
      const status: UploadStatus = UploadStatus.UPLOADING;

      const isActive = status === UploadStatus.UPLOADING || status === UploadStatus.HASHING;
      const isTerminal =
        status === UploadStatus.SUCCESS ||
        status === UploadStatus.ERROR ||
        status === UploadStatus.CANCELLED;

      expect(isActive).toBe(true);
      expect(isTerminal).toBe(false);
    });

    it("should support all valid state transitions", () => {
      // Valid transitions from IDLE
      const validFromIdle = [UploadStatus.HASHING, UploadStatus.UPLOADING];
      expect(validFromIdle).toContain(UploadStatus.HASHING);
      expect(validFromIdle).toContain(UploadStatus.UPLOADING);

      // Valid transitions from UPLOADING
      const validFromUploading = [
        UploadStatus.PAUSED,
        UploadStatus.SUCCESS,
        UploadStatus.ERROR,
        UploadStatus.CANCELLED,
      ];
      expect(validFromUploading).toContain(UploadStatus.PAUSED);
      expect(validFromUploading).toContain(UploadStatus.SUCCESS);

      // Terminal states
      const terminalStates = [UploadStatus.SUCCESS, UploadStatus.ERROR, UploadStatus.CANCELLED];
      expect(terminalStates).toContain(UploadStatus.SUCCESS);
      expect(terminalStates).toContain(UploadStatus.ERROR);
      expect(terminalStates).toContain(UploadStatus.CANCELLED);
    });
  });
});
