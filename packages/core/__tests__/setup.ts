/**
 * Test setup file for core package
 * Configures IndexedDB mock and common test utilities
 */

import "fake-indexeddb/auto";
import { vi } from "vitest";
import type { RequestAdapter } from "@chunkflowjs/protocol";

/**
 * Create a mock RequestAdapter with proper return values
 */
export const createMockAdapter = (): RequestAdapter => ({
  createFile: vi.fn().mockResolvedValue({
    uploadToken: {
      token: "test-token",
      fileId: "test-file-id",
      chunkSize: 1024 * 1024,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    },
    negotiatedChunkSize: 1024 * 1024,
  }),
  verifyHash: vi.fn().mockResolvedValue({
    fileExists: false,
    existingChunks: [],
    missingChunks: [],
  }),
  uploadChunk: vi.fn().mockResolvedValue({
    success: true,
    chunkHash: "test-hash",
  }),
  mergeFile: vi.fn().mockResolvedValue({
    success: true,
    fileUrl: "https://example.com/file.txt",
    fileId: "test-file-id",
  }),
});

/**
 * Create a mock File object for testing
 * Creates a file with the specified size by generating content in chunks
 */
export const createMockFile = (name: string, size: number, type: string = "text/plain"): File => {
  // For small files, create directly
  if (size <= 1024) {
    const blob = new Blob(["x".repeat(size)], { type });
    return new File([blob], name, { type, lastModified: Date.now() });
  }

  // For larger files, create in chunks to avoid memory issues
  const chunkSize = 1024;
  const chunks: string[] = [];
  let remaining = size;

  while (remaining > 0) {
    const currentChunkSize = Math.min(chunkSize, remaining);
    chunks.push("x".repeat(currentChunkSize));
    remaining -= currentChunkSize;
  }

  const blob = new Blob(chunks, { type });
  return new File([blob], name, { type, lastModified: Date.now() });
};
