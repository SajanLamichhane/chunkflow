/**
 * IndexedDB storage for upload records
 * Provides persistent storage for upload progress to enable resume functionality
 */

export interface FileInfo {
  name: string;
  size: number;
  type: string;
  hash?: string;
  lastModified: number;
}

export interface UploadRecord {
  taskId: string;
  fileInfo: FileInfo;
  uploadedChunks: number[];
  uploadToken: string;
  createdAt: number;
  updatedAt: number;
}

export class StorageError extends Error {
  constructor(
    message: string,
    public code: "QUOTA_EXCEEDED" | "STORAGE_UNAVAILABLE" | "OPERATION_FAILED",
  ) {
    super(message);
    this.name = "StorageError";
  }
}

export class UploadStorage {
  private dbName = "chunkflow-upload";
  private storeName = "uploads";
  private version = 1;
  private db: IDBDatabase | null = null;
  private isSupported: boolean = true;

  constructor() {
    // Check if IndexedDB is supported
    if (typeof indexedDB === "undefined") {
      this.isSupported = false;
      console.warn("IndexedDB is not supported in this environment");
    }
  }

  /**
   * Initialize the IndexedDB database
   * Creates the object store if it doesn't exist
   */
  async init(): Promise<void> {
    if (!this.isSupported) {
      throw new StorageError("IndexedDB is not supported", "STORAGE_UNAVAILABLE");
    }

    return new Promise((resolve, reject) => {
      try {
        const request = indexedDB.open(this.dbName, this.version);

        request.onerror = () => {
          const error = new StorageError(
            `Failed to open database: ${request.error?.message}`,
            "STORAGE_UNAVAILABLE",
          );
          reject(error);
        };

        request.onsuccess = () => {
          this.db = request.result;
          resolve();
        };

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;

          // Create object store if it doesn't exist
          if (!db.objectStoreNames.contains(this.storeName)) {
            const objectStore = db.createObjectStore(this.storeName, {
              keyPath: "taskId",
            });

            // Create indexes for efficient querying
            objectStore.createIndex("createdAt", "createdAt", { unique: false });
            objectStore.createIndex("updatedAt", "updatedAt", { unique: false });
          }
        };
      } catch (error) {
        reject(
          new StorageError(
            `Failed to initialize storage: ${(error as Error).message}`,
            "STORAGE_UNAVAILABLE",
          ),
        );
      }
    });
  }

  /**
   * Save an upload record to the database
   */
  async saveRecord(record: UploadRecord): Promise<void> {
    if (!this.isSupported || !this.db) {
      throw new StorageError("Storage is not initialized", "STORAGE_UNAVAILABLE");
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction([this.storeName], "readwrite");
        const objectStore = transaction.objectStore(this.storeName);
        const request = objectStore.put(record);

        request.onerror = () => {
          const error = request.error;
          if (error?.name === "QuotaExceededError") {
            reject(new StorageError("Storage quota exceeded", "QUOTA_EXCEEDED"));
          } else {
            reject(
              new StorageError(`Failed to save record: ${error?.message}`, "OPERATION_FAILED"),
            );
          }
        };

        request.onsuccess = () => {
          resolve();
        };

        transaction.onerror = () => {
          reject(
            new StorageError(
              `Transaction failed: ${transaction.error?.message}`,
              "OPERATION_FAILED",
            ),
          );
        };
      } catch (error) {
        reject(
          new StorageError(
            `Failed to save record: ${(error as Error).message}`,
            "OPERATION_FAILED",
          ),
        );
      }
    });
  }

  /**
   * Get an upload record by task ID
   */
  async getRecord(taskId: string): Promise<UploadRecord | null> {
    if (!this.isSupported || !this.db) {
      throw new StorageError("Storage is not initialized", "STORAGE_UNAVAILABLE");
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction([this.storeName], "readonly");
        const objectStore = transaction.objectStore(this.storeName);
        const request = objectStore.get(taskId);

        request.onerror = () => {
          reject(
            new StorageError(`Failed to get record: ${request.error?.message}`, "OPERATION_FAILED"),
          );
        };

        request.onsuccess = () => {
          resolve(request.result || null);
        };
      } catch (error) {
        reject(
          new StorageError(`Failed to get record: ${(error as Error).message}`, "OPERATION_FAILED"),
        );
      }
    });
  }

  /**
   * Update an upload record with partial data
   */
  async updateRecord(taskId: string, updates: Partial<UploadRecord>): Promise<void> {
    if (!this.isSupported || !this.db) {
      throw new StorageError("Storage is not initialized", "STORAGE_UNAVAILABLE");
    }

    // First get the existing record
    const existingRecord = await this.getRecord(taskId);
    if (!existingRecord) {
      throw new StorageError(`Record with taskId ${taskId} not found`, "OPERATION_FAILED");
    }

    // Merge updates with existing record
    const updatedRecord: UploadRecord = {
      ...existingRecord,
      ...updates,
      taskId, // Ensure taskId is not changed
      updatedAt: Date.now(), // Always update the timestamp
    };

    // Save the updated record
    await this.saveRecord(updatedRecord);
  }

  /**
   * Delete an upload record by task ID
   */
  async deleteRecord(taskId: string): Promise<void> {
    if (!this.isSupported || !this.db) {
      throw new StorageError("Storage is not initialized", "STORAGE_UNAVAILABLE");
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction([this.storeName], "readwrite");
        const objectStore = transaction.objectStore(this.storeName);
        const request = objectStore.delete(taskId);

        request.onerror = () => {
          reject(
            new StorageError(
              `Failed to delete record: ${request.error?.message}`,
              "OPERATION_FAILED",
            ),
          );
        };

        request.onsuccess = () => {
          resolve();
        };
      } catch (error) {
        reject(
          new StorageError(
            `Failed to delete record: ${(error as Error).message}`,
            "OPERATION_FAILED",
          ),
        );
      }
    });
  }

  /**
   * Get all upload records from the database
   */
  async getAllRecords(): Promise<UploadRecord[]> {
    if (!this.isSupported || !this.db) {
      throw new StorageError("Storage is not initialized", "STORAGE_UNAVAILABLE");
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction([this.storeName], "readonly");
        const objectStore = transaction.objectStore(this.storeName);
        const request = objectStore.getAll();

        request.onerror = () => {
          reject(
            new StorageError(
              `Failed to get all records: ${request.error?.message}`,
              "OPERATION_FAILED",
            ),
          );
        };

        request.onsuccess = () => {
          resolve(request.result || []);
        };
      } catch (error) {
        reject(
          new StorageError(
            `Failed to get all records: ${(error as Error).message}`,
            "OPERATION_FAILED",
          ),
        );
      }
    });
  }

  /**
   * Clear all records from the database (useful for cleanup)
   */
  async clearAll(): Promise<void> {
    if (!this.isSupported || !this.db) {
      throw new StorageError("Storage is not initialized", "STORAGE_UNAVAILABLE");
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction([this.storeName], "readwrite");
        const objectStore = transaction.objectStore(this.storeName);
        const request = objectStore.clear();

        request.onerror = () => {
          reject(
            new StorageError(
              `Failed to clear records: ${request.error?.message}`,
              "OPERATION_FAILED",
            ),
          );
        };

        request.onsuccess = () => {
          resolve();
        };
      } catch (error) {
        reject(
          new StorageError(
            `Failed to clear records: ${(error as Error).message}`,
            "OPERATION_FAILED",
          ),
        );
      }
    });
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Check if storage is available and initialized
   */
  isAvailable(): boolean {
    return this.isSupported && this.db !== null;
  }
}
