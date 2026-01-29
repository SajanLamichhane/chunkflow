/**
 * File utility functions for ChunkFlow Upload SDK
 * Provides functions for file slicing, hash calculation, and formatting
 */

import SparkMD5 from "spark-md5";

/**
 * Slice a file into a blob chunk
 * @param file - The file to slice
 * @param start - Start byte position
 * @param end - End byte position
 * @returns Blob containing the file chunk
 */
export function sliceFile(file: File, start: number, end: number): Blob {
  return file.slice(start, end);
}

/**
 * Calculate MD5 hash of a file
 * Uses chunked reading to avoid blocking the main thread
 * @param file - The file to hash
 * @param onProgress - Optional callback for progress updates (0-100)
 * @returns Promise resolving to the MD5 hash string
 */
export async function calculateFileHash(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Check if FileReader is available (browser environment)
    if (typeof FileReader === "undefined") {
      reject(new Error("FileReader is not available in this environment"));
      return;
    }

    const chunkSize = 2 * 1024 * 1024; // 2MB chunks for reading
    const chunks = Math.ceil(file.size / chunkSize);
    let currentChunk = 0;
    const spark = new SparkMD5.ArrayBuffer();
    const fileReader = new FileReader();

    fileReader.onload = (e) => {
      if (!e.target?.result) {
        reject(new Error("Failed to read file chunk"));
        return;
      }

      spark.append(e.target.result as ArrayBuffer);
      currentChunk++;

      // Report progress
      if (onProgress) {
        const progress = (currentChunk / chunks) * 100;
        onProgress(Math.min(progress, 100));
      }

      if (currentChunk < chunks) {
        loadNext();
      } else {
        const hash = spark.end();
        resolve(hash);
      }
    };

    fileReader.onerror = () => {
      reject(new Error("Failed to read file"));
    };

    function loadNext() {
      const start = currentChunk * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const blob = file.slice(start, end);
      fileReader.readAsArrayBuffer(blob);
    }

    loadNext();
  });
}

/**
 * Calculate MD5 hash of a single chunk (Blob)
 * @param chunk - The blob chunk to hash
 * @returns Promise resolving to the MD5 hash string
 */
export async function calculateChunkHash(chunk: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    // Check if FileReader is available (browser environment)
    if (typeof FileReader === "undefined") {
      reject(new Error("FileReader is not available in this environment"));
      return;
    }

    const fileReader = new FileReader();

    fileReader.onload = (e) => {
      if (!e.target?.result) {
        reject(new Error("Failed to read chunk"));
        return;
      }

      const spark = new SparkMD5.ArrayBuffer();
      spark.append(e.target.result as ArrayBuffer);
      const hash = spark.end();
      resolve(hash);
    };

    fileReader.onerror = () => {
      reject(new Error("Failed to read chunk"));
    };

    fileReader.readAsArrayBuffer(chunk);
  });
}

/**
 * Format file size in human-readable format
 * @param bytes - Size in bytes
 * @returns Formatted string (e.g., "1.50 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Calculate upload speed in bytes per second
 * @param uploadedBytes - Number of bytes uploaded
 * @param elapsedMs - Time elapsed in milliseconds
 * @returns Speed in bytes per second
 */
export function calculateSpeed(uploadedBytes: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  return (uploadedBytes / elapsedMs) * 1000; // bytes per second
}

/**
 * Estimate remaining time for upload
 * @param remainingBytes - Number of bytes remaining
 * @param speed - Current upload speed in bytes per second
 * @returns Estimated remaining time in seconds
 */
export function estimateRemainingTime(remainingBytes: number, speed: number): number {
  if (speed <= 0 || remainingBytes <= 0) return 0;
  return remainingBytes / speed;
}
