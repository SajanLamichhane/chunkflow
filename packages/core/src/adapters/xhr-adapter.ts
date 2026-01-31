/**
 * XMLHttpRequest-based RequestAdapter implementation
 * Provides a way to create an adapter using XMLHttpRequest with progress tracking
 */

import type { RequestAdapter } from "@chunkflowjs/protocol";

/**
 * Options for creating an XHR adapter
 */
export interface XHRAdapterOptions {
  /** Base URL for API requests */
  baseURL: string;
  /** Custom headers to include in all requests */
  headers?: Record<string, string>;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Whether to send credentials (cookies) with requests (default: false) */
  withCredentials?: boolean;
  /** Callback for upload progress events */
  onUploadProgress?: (event: ProgressEvent) => void;
  /** Callback for handling errors */
  onError?: (error: Error) => void;
}

/**
 * Create an XMLHttpRequest-based RequestAdapter
 *
 * @param options - Configuration options
 * @returns RequestAdapter instance
 *
 * @example
 * ```typescript
 * const adapter = createXHRAdapter({
 *   baseURL: 'http://localhost:3000/api',
 *   headers: {
 *     'Authorization': 'Bearer token123'
 *   },
 *   onUploadProgress: (event) => {
 *     console.log(`Upload progress: ${(event.loaded / event.total) * 100}%`);
 *   }
 * });
 *
 * const manager = new UploadManager({ requestAdapter: adapter });
 * ```
 */
export function createXHRAdapter(options: XHRAdapterOptions): RequestAdapter {
  const {
    baseURL,
    headers = {},
    timeout = 30000,
    withCredentials = false,
    onUploadProgress,
    onError,
  } = options;

  // Ensure baseURL doesn't end with slash
  const normalizedBaseURL = baseURL.replace(/\/$/, "");

  /**
   * Make an XHR request
   */
  function makeRequest<T>(
    method: string,
    url: string,
    data?: any,
    customHeaders?: Record<string, string>,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.open(method, url, true);
      xhr.timeout = timeout;
      xhr.withCredentials = withCredentials;

      // Set headers
      const allHeaders = { ...headers, ...customHeaders };
      Object.entries(allHeaders).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value);
      });

      // Handle upload progress
      if (onUploadProgress && xhr.upload) {
        xhr.upload.addEventListener("progress", onUploadProgress);
      }

      // Handle response
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (error) {
            const parseError = new Error(`Failed to parse response: ${(error as Error).message}`);
            if (onError) onError(parseError);
            reject(parseError);
          }
        } else {
          let errorMessage = `HTTP ${xhr.status}: ${xhr.statusText}`;
          try {
            const errorResponse = JSON.parse(xhr.responseText);
            if (errorResponse.error?.message) {
              errorMessage = errorResponse.error.message;
            }
          } catch {
            // Use default error message
          }
          const error = new Error(errorMessage);
          if (onError) onError(error);
          reject(error);
        }
      };

      // Handle errors
      xhr.onerror = () => {
        const error = new Error("Network error");
        if (onError) onError(error);
        reject(error);
      };

      xhr.ontimeout = () => {
        const error = new Error(`Request timeout after ${timeout}ms`);
        if (onError) onError(error);
        reject(error);
      };

      xhr.onabort = () => {
        const error = new Error("Request aborted");
        if (onError) onError(error);
        reject(error);
      };

      // Send request
      if (data instanceof FormData) {
        xhr.send(data);
      } else if (data) {
        xhr.send(JSON.stringify(data));
      } else {
        xhr.send();
      }
    });
  }

  return {
    /**
     * Create a new file upload session
     */
    async createFile(request) {
      const response = await makeRequest<any>(
        "POST",
        `${normalizedBaseURL}/upload/create`,
        {
          fileName: request.fileName,
          fileSize: request.fileSize,
          fileType: request.fileType,
          preferredChunkSize: request.preferredChunkSize,
        },
        {
          "Content-Type": "application/json",
        },
      );

      // Convert server response to protocol format
      return {
        uploadToken: {
          token: response.uploadToken,
          fileId: "",
          chunkSize: response.negotiatedChunkSize,
          expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        },
        negotiatedChunkSize: response.negotiatedChunkSize,
      };
    },

    /**
     * Verify file and chunk hashes
     */
    async verifyHash(request) {
      // Extract token string from UploadToken object or use string directly
      const token =
        typeof request.uploadToken === "string"
          ? request.uploadToken
          : (request.uploadToken as any).token;

      return makeRequest(
        "POST",
        `${normalizedBaseURL}/upload/verify`,
        {
          fileHash: request.fileHash,
          chunkHashes: request.chunkHashes,
          uploadToken: token,
        },
        {
          "Content-Type": "application/json",
        },
      );
    },

    /**
     * Upload a single chunk
     */
    async uploadChunk(request) {
      // Extract token string from UploadToken object or use string directly
      const token =
        typeof request.uploadToken === "string"
          ? request.uploadToken
          : (request.uploadToken as any).token;

      const formData = new FormData();
      formData.append("uploadToken", token);
      formData.append("chunkIndex", request.chunkIndex.toString());
      formData.append("chunkHash", request.chunkHash);

      // Handle both Blob and Buffer types
      if (request.chunk instanceof Blob) {
        formData.append("chunk", request.chunk);
      } else {
        // Convert Buffer to Blob for Node.js environments
        const blob = new Blob([request.chunk as unknown as BlobPart]);
        formData.append("chunk", blob);
      }

      return makeRequest("POST", `${normalizedBaseURL}/upload/chunk`, formData);
    },

    /**
     * Merge all chunks into final file
     */
    async mergeFile(request) {
      // Extract token string from UploadToken object or use string directly
      const token =
        typeof request.uploadToken === "string"
          ? request.uploadToken
          : (request.uploadToken as any).token;

      return makeRequest(
        "POST",
        `${normalizedBaseURL}/upload/merge`,
        {
          uploadToken: token,
          fileHash: request.fileHash,
          chunkHashes: request.chunkHashes,
        },
        {
          "Content-Type": "application/json",
        },
      );
    },
  };
}
