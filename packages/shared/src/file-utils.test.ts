/**
 * Unit tests for file utility functions
 */

import { describe, it, expect, vi } from "vitest";
import {
  sliceFile,
  calculateFileHash,
  calculateChunkHash,
  formatFileSize,
  calculateSpeed,
  estimateRemainingTime,
} from "./file-utils";

describe("File Utils", () => {
  describe("sliceFile", () => {
    it("should slice a file correctly", () => {
      const content = "Hello, World!";
      const file = new File([content], "test.txt", { type: "text/plain" });

      const slice = sliceFile(file, 0, 5);

      expect(slice).toBeInstanceOf(Blob);
      expect(slice.size).toBe(5);
    });

    it("should handle slicing from middle to end", () => {
      const content = "Hello, World!";
      const file = new File([content], "test.txt", { type: "text/plain" });

      const slice = sliceFile(file, 7, 12);

      expect(slice.size).toBe(5);
    });

    it("should handle empty slice", () => {
      const file = new File(["test"], "test.txt", { type: "text/plain" });

      const slice = sliceFile(file, 0, 0);

      expect(slice.size).toBe(0);
    });
  });

  describe("calculateFileHash", () => {
    it("should calculate hash for a small file", async () => {
      const content = "Hello, World!";
      const file = new File([content], "test.txt", { type: "text/plain" });

      const hash = await calculateFileHash(file);

      expect(hash).toBeTruthy();
      expect(typeof hash).toBe("string");
      expect(hash.length).toBe(32); // MD5 hash is 32 characters
    });

    it("should calculate consistent hash for same content", async () => {
      const content = "Test content";
      const file1 = new File([content], "test1.txt", { type: "text/plain" });
      const file2 = new File([content], "test2.txt", { type: "text/plain" });

      const hash1 = await calculateFileHash(file1);
      const hash2 = await calculateFileHash(file2);

      expect(hash1).toBe(hash2);
    });

    it("should calculate different hash for different content", async () => {
      const file1 = new File(["content1"], "test1.txt", { type: "text/plain" });
      const file2 = new File(["content2"], "test2.txt", { type: "text/plain" });

      const hash1 = await calculateFileHash(file1);
      const hash2 = await calculateFileHash(file2);

      expect(hash1).not.toBe(hash2);
    });

    it("should call progress callback during hashing", async () => {
      const content = new Array(100).fill("a").join("");
      const file = new File([content], "test.txt", { type: "text/plain" });
      const progressCallback = vi.fn();

      await calculateFileHash(file, progressCallback);

      expect(progressCallback).toHaveBeenCalled();
      expect(progressCallback).toHaveBeenCalledWith(expect.any(Number));

      // Check that progress values are between 0 and 100
      const calls = progressCallback.mock.calls;
      calls.forEach(([progress]) => {
        expect(progress).toBeGreaterThanOrEqual(0);
        expect(progress).toBeLessThanOrEqual(100);
      });
    });

    it("should handle empty file", async () => {
      const file = new File([], "empty.txt", { type: "text/plain" });

      const hash = await calculateFileHash(file);

      expect(hash).toBeTruthy();
      expect(typeof hash).toBe("string");
    });
  });

  describe("calculateChunkHash", () => {
    it("should calculate hash for a blob chunk", async () => {
      const blob = new Blob(["test chunk"]);

      const hash = await calculateChunkHash(blob);

      expect(hash).toBeTruthy();
      expect(typeof hash).toBe("string");
      expect(hash.length).toBe(32);
    });

    it("should calculate consistent hash for same content", async () => {
      const blob1 = new Blob(["same content"]);
      const blob2 = new Blob(["same content"]);

      const hash1 = await calculateChunkHash(blob1);
      const hash2 = await calculateChunkHash(blob2);

      expect(hash1).toBe(hash2);
    });

    it("should calculate different hash for different content", async () => {
      const blob1 = new Blob(["content1"]);
      const blob2 = new Blob(["content2"]);

      const hash1 = await calculateChunkHash(blob1);
      const hash2 = await calculateChunkHash(blob2);

      expect(hash1).not.toBe(hash2);
    });

    it("should handle empty blob", async () => {
      const blob = new Blob([]);

      const hash = await calculateChunkHash(blob);

      expect(hash).toBeTruthy();
      expect(typeof hash).toBe("string");
    });
  });

  describe("formatFileSize", () => {
    it("should format bytes correctly", () => {
      expect(formatFileSize(0)).toBe("0 B");
      expect(formatFileSize(100)).toBe("100.00 B");
      expect(formatFileSize(999)).toBe("999.00 B");
    });

    it("should format kilobytes correctly", () => {
      expect(formatFileSize(1024)).toBe("1.00 KB");
      expect(formatFileSize(1536)).toBe("1.50 KB");
      expect(formatFileSize(10240)).toBe("10.00 KB");
    });

    it("should format megabytes correctly", () => {
      expect(formatFileSize(1024 * 1024)).toBe("1.00 MB");
      expect(formatFileSize(1.5 * 1024 * 1024)).toBe("1.50 MB");
      expect(formatFileSize(100 * 1024 * 1024)).toBe("100.00 MB");
    });

    it("should format gigabytes correctly", () => {
      expect(formatFileSize(1024 * 1024 * 1024)).toBe("1.00 GB");
      expect(formatFileSize(2.5 * 1024 * 1024 * 1024)).toBe("2.50 GB");
    });

    it("should format terabytes correctly", () => {
      expect(formatFileSize(1024 * 1024 * 1024 * 1024)).toBe("1.00 TB");
      expect(formatFileSize(1.5 * 1024 * 1024 * 1024 * 1024)).toBe("1.50 TB");
    });

    it("should not exceed TB unit", () => {
      const petabyte = 1024 * 1024 * 1024 * 1024 * 1024;
      const result = formatFileSize(petabyte);
      expect(result).toContain("TB");
    });
  });

  describe("calculateSpeed", () => {
    it("should calculate speed correctly", () => {
      const uploadedBytes = 1024 * 1024; // 1 MB
      const elapsedMs = 1000; // 1 second

      const speed = calculateSpeed(uploadedBytes, elapsedMs);

      expect(speed).toBe(1024 * 1024); // 1 MB/s
    });

    it("should handle fractional seconds", () => {
      const uploadedBytes = 512 * 1024; // 512 KB
      const elapsedMs = 500; // 0.5 seconds

      const speed = calculateSpeed(uploadedBytes, elapsedMs);

      expect(speed).toBe(1024 * 1024); // 1 MB/s
    });

    it("should return 0 for zero elapsed time", () => {
      const speed = calculateSpeed(1024, 0);
      expect(speed).toBe(0);
    });

    it("should return 0 for negative elapsed time", () => {
      const speed = calculateSpeed(1024, -100);
      expect(speed).toBe(0);
    });

    it("should handle zero uploaded bytes", () => {
      const speed = calculateSpeed(0, 1000);
      expect(speed).toBe(0);
    });

    it("should handle large values", () => {
      const uploadedBytes = 100 * 1024 * 1024; // 100 MB
      const elapsedMs = 10000; // 10 seconds

      const speed = calculateSpeed(uploadedBytes, elapsedMs);

      expect(speed).toBe(10 * 1024 * 1024); // 10 MB/s
    });
  });

  describe("estimateRemainingTime", () => {
    it("should estimate remaining time correctly", () => {
      const remainingBytes = 10 * 1024 * 1024; // 10 MB
      const speed = 1024 * 1024; // 1 MB/s

      const time = estimateRemainingTime(remainingBytes, speed);

      expect(time).toBe(10); // 10 seconds
    });

    it("should handle fractional results", () => {
      const remainingBytes = 1.5 * 1024 * 1024; // 1.5 MB
      const speed = 1024 * 1024; // 1 MB/s

      const time = estimateRemainingTime(remainingBytes, speed);

      expect(time).toBe(1.5); // 1.5 seconds
    });

    it("should return 0 for zero speed", () => {
      const time = estimateRemainingTime(1024, 0);
      expect(time).toBe(0);
    });

    it("should return 0 for negative speed", () => {
      const time = estimateRemainingTime(1024, -100);
      expect(time).toBe(0);
    });

    it("should return 0 for zero remaining bytes", () => {
      const time = estimateRemainingTime(0, 1024);
      expect(time).toBe(0);
    });

    it("should return 0 for negative remaining bytes", () => {
      const time = estimateRemainingTime(-1024, 1024);
      expect(time).toBe(0);
    });

    it("should handle large values", () => {
      const remainingBytes = 1024 * 1024 * 1024; // 1 GB
      const speed = 10 * 1024 * 1024; // 10 MB/s

      const time = estimateRemainingTime(remainingBytes, speed);

      expect(time).toBeCloseTo(102.4, 1); // ~102.4 seconds
    });
  });
});
