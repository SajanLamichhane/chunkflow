/**
 * @chunkflow/protocol
 *
 * Protocol layer defining communication interfaces between client and server
 * for ChunkFlow Upload SDK.
 *
 * This package provides:
 * - Core types (FileInfo, ChunkInfo, UploadToken, UploadStatus)
 * - API request/response interfaces (CreateFile, VerifyHash, UploadChunk, MergeFile)
 * - RequestAdapter interface for HTTP client abstraction
 *
 * @packageDocumentation
 */

// Export all types
export * from "./types";

// Export all interfaces
export * from "./interfaces";
