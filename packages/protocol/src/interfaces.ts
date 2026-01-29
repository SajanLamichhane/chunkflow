/**
 * API interfaces for ChunkFlow Upload SDK Protocol Layer
 */

import type { UploadToken } from "./types";

/**
 * Create file request (HEAD)
 * Initiates an upload session and negotiates chunk size
 */
export interface CreateFileRequest {
  /** File name */
  fileName: string;
  /** File size in bytes */
  fileSize: number;
  /** MIME type */
  fileType: string;
  /** Preferred chunk size in bytes (optional) */
  preferredChunkSize?: number;
}

/**
 * Create file response
 * Returns upload token and negotiated chunk size
 */
export interface CreateFileResponse {
  /** Upload token for this session */
  uploadToken: UploadToken;
  /** Negotiated chunk size in bytes */
  negotiatedChunkSize: number;
}

/**
 * Hash verification request
 * Checks if file or chunks already exist (for instant upload/resume)
 */
export interface VerifyHashRequest {
  /** File hash (MD5), optional */
  fileHash?: string;
  /** Array of chunk hashes (MD5), optional */
  chunkHashes?: string[];
  /** Upload token for authentication */
  uploadToken: string;
}

/**
 * Hash verification response
 * Returns existence status and missing chunks
 */
export interface VerifyHashResponse {
  /** Whether the complete file already exists */
  fileExists: boolean;
  /** File URL if file exists (instant upload) */
  fileUrl?: string;
  /** Indices of chunks that already exist */
  existingChunks: number[];
  /** Indices of chunks that need to be uploaded */
  missingChunks: number[];
}

/**
 * Upload chunk request
 * Uploads a single chunk with verification
 */
export interface UploadChunkRequest {
  /** Upload token for authentication */
  uploadToken: string;
  /** Chunk index (0-based) */
  chunkIndex: number;
  /** Chunk hash (MD5) for verification */
  chunkHash: string;
  /** Chunk data (Blob in browser, Buffer in Node.js) */
  chunk: Blob | Buffer;
}

/**
 * Upload chunk response
 * Confirms successful chunk upload
 */
export interface UploadChunkResponse {
  /** Whether upload was successful */
  success: boolean;
  /** Chunk hash for verification */
  chunkHash: string;
}

/**
 * Merge file request
 * Performs logical merge (validation and URL generation)
 */
export interface MergeFileRequest {
  /** Upload token for authentication */
  uploadToken: string;
  /** Complete file hash (MD5) */
  fileHash: string;
  /** Array of chunk hashes in order */
  chunkHashes: string[];
}

/**
 * Merge file response
 * Returns file URL after successful merge
 */
export interface MergeFileResponse {
  /** Whether merge was successful */
  success: boolean;
  /** File access URL */
  fileUrl: string;
  /** File identifier */
  fileId: string;
}

/**
 * Request adapter interface
 * Abstracts HTTP client implementation from core logic
 */
export interface RequestAdapter {
  /**
   * Create file and get upload token
   * @param request - Create file request
   * @returns Create file response with upload token
   */
  createFile(request: CreateFileRequest): Promise<CreateFileResponse>;

  /**
   * Verify file/chunk hashes for instant upload or resume
   * @param request - Hash verification request
   * @returns Hash verification response with existing/missing chunks
   */
  verifyHash(request: VerifyHashRequest): Promise<VerifyHashResponse>;

  /**
   * Upload a single chunk
   * @param request - Upload chunk request
   * @returns Upload chunk response
   */
  uploadChunk(request: UploadChunkRequest): Promise<UploadChunkResponse>;

  /**
   * Merge file (logical merge, no physical concatenation)
   * @param request - Merge file request
   * @returns Merge file response with file URL
   */
  mergeFile(request: MergeFileRequest): Promise<MergeFileResponse>;
}
