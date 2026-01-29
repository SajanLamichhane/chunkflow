/**
 * Property-based tests for file utility functions
 * Uses fast-check to verify universal properties across random inputs
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { calculateChunkHash } from "../src/file-utils";

describe("File Utils - Property-Based Tests", () => {
  // Feature: chunkflow, Property 22: 分片 Hash 唯一性
  // **Validates: Requirements 18.1**
  it("should generate same hash for same content and different hash for different content", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(
          fc.uint8Array({ minLength: 1024, maxLength: 1024 }),
          fc.uint8Array({ minLength: 1024, maxLength: 1024 }),
        ),
        async ([chunk1, chunk2]) => {
          // Create blobs from the byte arrays
          const blob1 = new Blob([chunk1]);
          const blob2 = new Blob([chunk2]);

          // Calculate hashes
          const hash1 = await calculateChunkHash(blob1);
          const hash2 = await calculateChunkHash(blob2);

          // Property 1: Same content should produce same hash (idempotency)
          const hash1Again = await calculateChunkHash(blob1);
          expect(hash1).toBe(hash1Again);

          // Property 2: Different content should produce different hash
          // (or same hash if content is identical)
          const arraysEqual =
            chunk1.length === chunk2.length && chunk1.every((val, idx) => val === chunk2[idx]);

          if (!arraysEqual) {
            // Different content should have different hash
            // Note: In theory, hash collisions are possible but extremely rare with MD5
            expect(hash1).not.toBe(hash2);
          } else {
            // Same content should have same hash
            expect(hash1).toBe(hash2);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  // Additional property: Hash should be deterministic
  it("should produce deterministic hashes for the same content", async () => {
    await fc.assert(
      fc.asyncProperty(fc.uint8Array({ minLength: 100, maxLength: 10000 }), async (content) => {
        const blob1 = new Blob([content]);
        const blob2 = new Blob([content]);

        const hash1 = await calculateChunkHash(blob1);
        const hash2 = await calculateChunkHash(blob2);

        // Same content should always produce the same hash
        expect(hash1).toBe(hash2);
        expect(hash1).toBeTruthy();
        expect(typeof hash1).toBe("string");
        expect(hash1.length).toBe(32); // MD5 hash is 32 hex characters
      }),
      { numRuns: 100 },
    );
  });

  // Property: Hash should be consistent regardless of how blob is created
  it("should produce same hash regardless of blob creation method", async () => {
    await fc.assert(
      fc.asyncProperty(fc.uint8Array({ minLength: 100, maxLength: 5000 }), async (content) => {
        // Create blobs in different ways
        const blob1 = new Blob([content]);
        const blob2 = new Blob([content.buffer]);
        const blob3 = new Blob([new Uint8Array(content)]);

        const hash1 = await calculateChunkHash(blob1);
        const hash2 = await calculateChunkHash(blob2);
        const hash3 = await calculateChunkHash(blob3);

        // All should produce the same hash
        expect(hash1).toBe(hash2);
        expect(hash2).toBe(hash3);
      }),
      { numRuns: 100 },
    );
  });

  // Property: Empty chunks should have consistent hash
  it("should produce consistent hash for empty chunks", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(new Uint8Array(0)), async () => {
        const blob1 = new Blob([]);
        const blob2 = new Blob([new Uint8Array(0)]);

        const hash1 = await calculateChunkHash(blob1);
        const hash2 = await calculateChunkHash(blob2);

        // Empty blobs should have the same hash
        expect(hash1).toBe(hash2);
        expect(hash1).toBeTruthy();
        expect(hash1.length).toBe(32);
      }),
      { numRuns: 10 },
    );
  });

  // Property: Single byte difference should produce different hash
  it("should produce different hash for single byte difference", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uint8Array({ minLength: 1024, maxLength: 1024 }),
        fc.integer({ min: 0, max: 1023 }),
        async (content, position) => {
          // Create two arrays that differ by one byte
          const content1 = new Uint8Array(content);
          const content2 = new Uint8Array(content);
          content2[position] = (content2[position] + 1) % 256;

          const blob1 = new Blob([content1]);
          const blob2 = new Blob([content2]);

          const hash1 = await calculateChunkHash(blob1);
          const hash2 = await calculateChunkHash(blob2);

          // Even a single byte difference should produce different hash
          expect(hash1).not.toBe(hash2);
        },
      ),
      { numRuns: 100 },
    );
  });
});
