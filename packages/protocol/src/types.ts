/**
 * Core types for ChunkFlow Upload SDK Protocol Layer
 */

/**
 * File information
 */
export interface FileInfo {
  /** File name */
  name: string;
  /** File size in bytes */
  size: number;
  /** MIME type */
  type: string;
  /** File hash (MD5), optional until calculated */
  hash?: string;
  /** Last modified timestamp */
  lastModified: number;
}

/**
 * Chunk information
 */
export interface ChunkInfo {
  /** Chunk index (0-based) */
  index: number;
  /** Chunk hash (MD5) */
  hash: string;
  /** Chunk size in bytes */
  size: number;
  /** Start position in file */
  start: number;
  /** End position in file */
  end: number;
}

/**
 * Upload token for authentication and session management
 */
export interface UploadToken {
  /** JWT or similar token string */
  token: string;
  /** Unique file identifier */
  fileId: string;
  /** Negotiated chunk size in bytes */
  chunkSize: number;
  /** Token expiration timestamp (milliseconds since epoch) */
  expiresAt: number;
}

/**
 * Upload status enumeration
 */
export enum UploadStatus {
  /** Initial state, not started */
  IDLE = "idle",
  /** Calculating file hash */
  HASHING = "hashing",
  /** Uploading chunks */
  UPLOADING = "uploading",
  /** Upload paused by user */
  PAUSED = "paused",
  /** Upload completed successfully */
  SUCCESS = "success",
  /** Upload failed with error */
  ERROR = "error",
  /** Upload cancelled by user */
  CANCELLED = "cancelled",
}
