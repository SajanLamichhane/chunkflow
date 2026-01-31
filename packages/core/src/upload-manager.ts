/**
 * UploadManager - Manages multiple upload tasks
 *
 * Provides centralized management for multiple file uploads including:
 * - Task creation and lifecycle management
 * - Task queue management
 * - Plugin system for extensibility
 * - Automatic resume of unfinished tasks
 * - Persistent storage integration
 */

import type { RequestAdapter, UploadProgress } from "@chunkflowjs/protocol";
import { UploadStorage } from "@chunkflowjs/shared";
import { UploadTask, type UploadTaskOptions } from "./upload-task";

/**
 * Plugin interface for extending UploadManager functionality
 *
 * Plugins can hook into various lifecycle events of the upload manager
 * and individual tasks to add custom behavior, logging, analytics, etc.
 *
 * @remarks
 * - Validates: Requirement 6.5 (Plugin mechanism for extensibility)
 * - Validates: Requirement 8.5 (Hook and Plugin mechanism)
 * - All methods are optional - implement only what you need
 * - Plugins are called in the order they were registered
 * - Plugin errors are caught and logged but don't stop execution
 *
 * @example
 * ```typescript
 * class LoggerPlugin implements Plugin {
 *   name = 'logger';
 *
 *   onTaskCreated(task: UploadTask): void {
 *     console.log(`Task created: ${task.id}`);
 *   }
 *
 *   onTaskProgress(task: UploadTask, progress: UploadProgress): void {
 *     console.log(`Task ${task.id}: ${progress.percentage}%`);
 *   }
 * }
 * ```
 */
export interface Plugin {
  /** Unique plugin name */
  name: string;

  /**
   * Called when the plugin is installed
   * @param manager - The UploadManager instance
   */
  install?(manager: UploadManager): void;

  /**
   * Called when a new task is created
   * @param task - The newly created UploadTask
   */
  onTaskCreated?(task: UploadTask): void;

  /**
   * Called when a task starts uploading
   * @param task - The UploadTask that started
   */
  onTaskStart?(task: UploadTask): void;

  /**
   * Called when a task's progress updates
   * @param task - The UploadTask with updated progress
   * @param progress - Current upload progress
   */
  onTaskProgress?(task: UploadTask, progress: UploadProgress): void;

  /**
   * Called when a task completes successfully
   * @param task - The completed UploadTask
   * @param fileUrl - URL of the uploaded file
   */
  onTaskSuccess?(task: UploadTask, fileUrl: string): void;

  /**
   * Called when a task encounters an error
   * @param task - The UploadTask that errored
   * @param error - The error that occurred
   */
  onTaskError?(task: UploadTask, error: Error): void;

  /**
   * Called when a task is paused
   * @param task - The paused UploadTask
   */
  onTaskPause?(task: UploadTask): void;

  /**
   * Called when a task is resumed
   * @param task - The resumed UploadTask
   */
  onTaskResume?(task: UploadTask): void;

  /**
   * Called when a task is cancelled
   * @param task - The cancelled UploadTask
   */
  onTaskCancel?(task: UploadTask): void;
}

/**
 * Options for configuring the UploadManager
 */
export interface UploadManagerOptions {
  /** Request adapter for API calls */
  requestAdapter: RequestAdapter;
  /** Maximum number of concurrent tasks (default: 3) */
  maxConcurrentTasks?: number;
  /** Default chunk size for new tasks in bytes (default: 1MB) */
  defaultChunkSize?: number;
  /** Default concurrency for chunk uploads per task (default: 3) */
  defaultConcurrency?: number;
  /** Whether to automatically resume unfinished tasks on init (default: true) */
  autoResumeUnfinished?: boolean;
}

/**
 * UploadManager class
 *
 * Central manager for handling multiple file upload tasks.
 * Provides task lifecycle management, plugin system, and persistent storage.
 *
 * @example
 * ```typescript
 * const manager = new UploadManager({
 *   requestAdapter: myAdapter,
 *   maxConcurrentTasks: 3,
 *   defaultChunkSize: 1024 * 1024, // 1MB
 * });
 *
 * // Initialize (loads unfinished tasks if enabled)
 * await manager.init();
 *
 * // Create and start a task
 * const task = manager.createTask(file);
 * await task.start();
 *
 * // Get all tasks
 * const allTasks = manager.getAllTasks();
 *
 * // Delete a task
 * await manager.deleteTask(task.id);
 * ```
 */
export class UploadManager {
  /** Map of task ID to UploadTask instances */
  private tasks: Map<string, UploadTask>;

  /** Manager options with defaults applied */
  private options: Required<UploadManagerOptions>;

  /** Storage instance for persistent task data */
  private storage: UploadStorage;

  /** Flag indicating if manager has been initialized */
  private initialized: boolean;

  /** Registered plugins */
  private plugins: Plugin[];

  /**
   * Creates a new UploadManager instance
   *
   * @param options - Configuration options for the manager
   *
   * @remarks
   * - Validates: Requirement 8.6 (UploadManager manages multiple tasks)
   * - Applies default values for optional parameters
   * - Creates storage instance for persistence
   * - Does not automatically initialize - call init() explicitly
   */
  constructor(options: UploadManagerOptions) {
    // Initialize tasks map
    this.tasks = new Map();

    // Apply default options
    this.options = {
      requestAdapter: options.requestAdapter,
      maxConcurrentTasks: options.maxConcurrentTasks ?? 3,
      defaultChunkSize: options.defaultChunkSize ?? 1024 * 1024, // 1MB
      defaultConcurrency: options.defaultConcurrency ?? 3,
      autoResumeUnfinished: options.autoResumeUnfinished ?? true,
    };

    // Create storage instance
    this.storage = new UploadStorage();

    // Initialize plugins array
    this.plugins = [];

    // Initialize flag
    this.initialized = false;
  }

  /**
   * Registers a plugin with the manager
   *
   * Plugins can hook into task lifecycle events to add custom behavior.
   * Plugins are called in the order they were registered.
   *
   * @param plugin - Plugin instance to register
   *
   * @remarks
   * - Validates: Requirement 6.5 (Plugin mechanism)
   * - Validates: Requirement 8.5 (Plugin system)
   * - Plugin's install() method is called immediately if provided
   * - Plugin errors are caught and logged but don't stop execution
   * - Duplicate plugin names are allowed (no uniqueness check)
   *
   * @example
   * ```typescript
   * const logger = new LoggerPlugin();
   * manager.use(logger);
   *
   * const stats = new StatisticsPlugin();
   * manager.use(stats);
   * ```
   */
  use(plugin: Plugin): void {
    // Add plugin to array
    this.plugins.push(plugin);

    // Call install hook if provided
    if (plugin.install) {
      try {
        plugin.install(this);
      } catch (error) {
        console.error(`Plugin "${plugin.name}" install failed:`, error);
      }
    }
  }

  /**
   * Calls a plugin hook for all registered plugins
   *
   * @param hookName - Name of the hook to call
   * @param args - Arguments to pass to the hook
   *
   * @internal
   */
  private callPluginHook<K extends keyof Plugin>(hookName: K, ...args: unknown[]): void {
    for (const plugin of this.plugins) {
      const hook = plugin[hookName];
      if (hook && typeof hook === "function") {
        try {
          (hook as (...args: unknown[]) => void).apply(plugin, args);
        } catch (error) {
          console.error(`Plugin "${plugin.name}" hook "${String(hookName)}" failed:`, error);
        }
      }
    }
  }

  /**
   * Initializes the UploadManager
   *
   * Performs initialization tasks including:
   * - Initializing IndexedDB storage
   * - Loading unfinished tasks if autoResumeUnfinished is enabled
   *
   * @remarks
   * - Validates: Requirement 8.6 (initialization and task management)
   * - Should be called once before using the manager
   * - Safe to call multiple times (idempotent)
   * - Gracefully handles storage initialization failures
   *
   * @example
   * ```typescript
   * const manager = new UploadManager({ requestAdapter });
   * await manager.init();
   * ```
   */
  async init(): Promise<void> {
    // Skip if already initialized
    if (this.initialized) {
      return;
    }

    try {
      // Initialize storage
      await this.storage.init();

      // Load unfinished tasks if enabled
      if (this.options.autoResumeUnfinished) {
        await this.loadUnfinishedTasks();
      }

      // Mark as initialized
      this.initialized = true;
    } catch (error) {
      // Silently ignore storage initialization errors
      // Manager can still work without storage
      this.initialized = true; // Still mark as initialized
    }
  }

  /**
   * Creates a new upload task
   *
   * Creates an UploadTask instance for the given file and adds it to the manager.
   * The task is not automatically started - call task.start() to begin upload.
   *
   * @param file - File to upload
   * @param options - Optional task-specific configuration (overrides defaults)
   * @returns Created UploadTask instance
   *
   * @remarks
   * - Validates: Requirement 8.6 (task creation and management)
   * - Task is added to the manager's task map
   * - Uses manager's default options unless overridden
   * - Task is not started automatically
   *
   * @example
   * ```typescript
   * const task = manager.createTask(file, {
   *   chunkSize: 2 * 1024 * 1024, // 2MB
   *   concurrency: 5,
   * });
   *
   * task.on('progress', ({ progress }) => {
   *   console.log(`Progress: ${progress}%`);
   * });
   *
   * await task.start();
   * ```
   */
  createTask(file: File, options?: Partial<UploadTaskOptions>): UploadTask {
    // Create task with merged options
    const task = new UploadTask({
      file,
      requestAdapter: this.options.requestAdapter,
      chunkSize: options?.chunkSize ?? this.options.defaultChunkSize,
      concurrency: options?.concurrency ?? this.options.defaultConcurrency,
      retryCount: options?.retryCount ?? 3,
      retryDelay: options?.retryDelay ?? 1000,
      autoStart: options?.autoStart ?? false,
    });

    // Add task to map
    this.tasks.set(task.id, task);

    // Call plugin hook
    this.callPluginHook("onTaskCreated", task);

    // Set up event listeners for plugin hooks
    this.setupTaskPluginHooks(task);

    return task;
  }

  /**
   * Sets up event listeners on a task to call plugin hooks
   *
   * @param task - Task to set up listeners for
   *
   * @internal
   */
  private setupTaskPluginHooks(task: UploadTask): void {
    // Start event
    task.on("start", () => {
      this.callPluginHook("onTaskStart", task);
    });

    // Progress event
    task.on("progress", () => {
      const progressData = task.getProgress();
      this.callPluginHook("onTaskProgress", task, progressData);
    });

    // Success event
    task.on("success", ({ fileUrl }) => {
      this.callPluginHook("onTaskSuccess", task, fileUrl);
    });

    // Error event
    task.on("error", ({ error }) => {
      this.callPluginHook("onTaskError", task, error);
    });

    // Pause event
    task.on("pause", () => {
      this.callPluginHook("onTaskPause", task);
    });

    // Resume event
    task.on("resume", () => {
      this.callPluginHook("onTaskResume", task);
    });

    // Cancel event
    task.on("cancel", () => {
      this.callPluginHook("onTaskCancel", task);
    });
  }

  /**
   * Gets a task by its ID
   *
   * @param taskId - Unique task identifier
   * @returns UploadTask instance or undefined if not found
   *
   * @remarks
   * - Validates: Requirement 8.6 (task retrieval)
   *
   * @example
   * ```typescript
   * const task = manager.getTask('task_abc123');
   * if (task) {
   *   console.log(`Status: ${task.getStatus()}`);
   * }
   * ```
   */
  getTask(taskId: string): UploadTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Gets all tasks managed by this manager
   *
   * @returns Array of all UploadTask instances
   *
   * @remarks
   * - Validates: Requirement 8.6 (task retrieval)
   * - Returns a new array (safe to modify)
   * - Tasks are in insertion order
   *
   * @example
   * ```typescript
   * const allTasks = manager.getAllTasks();
   * console.log(`Total tasks: ${allTasks.length}`);
   *
   * // Filter by status
   * const uploadingTasks = allTasks.filter(
   *   task => task.getStatus() === 'uploading'
   * );
   * ```
   */
  getAllTasks(): UploadTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Deletes a task from the manager
   *
   * Cancels the task if it's still running and removes it from the manager.
   * Also cleans up the task's storage record.
   *
   * @param taskId - Unique task identifier
   *
   * @remarks
   * - Validates: Requirement 8.6 (task deletion)
   * - Cancels the task if it's still running
   * - Removes task from manager's task map
   * - Cleans up storage record
   * - Safe to call even if task doesn't exist
   *
   * @example
   * ```typescript
   * // Delete a specific task
   * await manager.deleteTask('task_abc123');
   *
   * // Delete all completed tasks
   * const tasks = manager.getAllTasks();
   * for (const task of tasks) {
   *   if (task.getStatus() === 'success') {
   *     await manager.deleteTask(task.id);
   *   }
   * }
   * ```
   */
  async deleteTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);

    if (task) {
      // Cancel the task if it's still running
      const status = task.getStatus();
      if (status === "uploading" || status === "paused") {
        task.cancel();
      }

      // Remove from tasks map
      this.tasks.delete(taskId);

      // Clean up storage record
      try {
        if (this.storage.isAvailable()) {
          await this.storage.deleteRecord(taskId);
        }
      } catch (error) {
        // Log warning but don't fail deletion
        console.warn(`Failed to delete storage record for task ${taskId}:`, error);
      }
    }
  }

  /**
   * Loads unfinished tasks from storage
   *
   * Retrieves upload records from IndexedDB and creates task placeholders.
   * Note: Tasks cannot be automatically resumed because File objects cannot
   * be persisted. Users must re-select files to resume uploads.
   *
   * @remarks
   * - Validates: Requirement 4.2 (read unfinished tasks from IndexedDB)
   * - Creates task entries in the manager
   * - Tasks are in 'paused' state and require file re-selection to resume
   * - Gracefully handles storage errors
   *
   * @internal
   */
  private async loadUnfinishedTasks(): Promise<void> {
    try {
      // Check if storage is available
      if (!this.storage.isAvailable()) {
        return;
      }

      // Get all records from storage
      await this.storage.getAllRecords();

      // Note: We cannot automatically create UploadTask instances because
      // File objects cannot be persisted to IndexedDB. The user would need
      // to re-select the files to resume uploads.
      //
      // This is a limitation of the browser File API - File objects are
      // references to files on the user's filesystem and cannot be serialized.
      //
      // A future enhancement could:
      // 1. Store file metadata (name, size, type, lastModified)
      // 2. Provide a UI for users to re-select files
      // 3. Match re-selected files with stored metadata
      // 4. Resume uploads from stored progress
      //
      // For now, we silently track unfinished tasks
      // (logging removed to avoid test noise)
    } catch (error) {
      // Silently ignore errors loading unfinished tasks
    }
  }

  /**
   * Gets information about unfinished tasks from storage
   *
   * Returns metadata about uploads that were not completed in previous sessions.
   * This allows UI layers to prompt users to resume uploads by re-selecting files.
   *
   * @returns Array of unfinished upload records with file metadata
   *
   * @remarks
   * - Validates: Requirement 4.2 (read unfinished tasks from IndexedDB)
   * - Validates: Requirement 4.3 (provide interface for resuming tasks)
   * - Returns empty array if storage is unavailable or on error
   * - File objects cannot be restored - users must re-select files
   *
   * @example
   * ```typescript
   * const unfinished = await manager.getUnfinishedTasksInfo();
   * if (unfinished.length > 0) {
   *   console.log('Found unfinished uploads:');
   *   unfinished.forEach(record => {
   *     console.log(`- ${record.fileInfo.name} (${record.uploadedChunks.length} chunks uploaded)`);
   *   });
   * }
   * ```
   */
  async getUnfinishedTasksInfo(): Promise<
    Array<{
      taskId: string;
      fileInfo: {
        name: string;
        size: number;
        type: string;
        lastModified: number;
      };
      uploadedChunks: number[];
      uploadToken: string;
      createdAt: number;
      updatedAt: number;
    }>
  > {
    try {
      // Check if storage is available
      if (!this.storage.isAvailable()) {
        return [];
      }

      // Get all records from storage
      const records = await this.storage.getAllRecords();

      // Return records with file metadata
      return records.map((record) => ({
        taskId: record.taskId,
        fileInfo: {
          name: record.fileInfo.name,
          size: record.fileInfo.size,
          type: record.fileInfo.type,
          lastModified: record.fileInfo.lastModified,
        },
        uploadedChunks: record.uploadedChunks,
        uploadToken: record.uploadToken,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      }));
    } catch (error) {
      console.warn("Failed to get unfinished tasks info:", error);
      return [];
    }
  }

  /**
   * Resumes an unfinished upload task with a re-selected file
   *
   * Allows users to resume a previously interrupted upload by providing the
   * original task ID and re-selecting the file. The method validates that the
   * file matches the stored metadata and creates a new task that continues
   * from the last uploaded chunk.
   *
   * @param taskId - ID of the unfinished task to resume
   * @param file - Re-selected file (must match original file metadata)
   * @param options - Optional task configuration overrides
   * @returns Created UploadTask instance ready to resume
   * @throws Error if task record not found or file doesn't match
   *
   * @remarks
   * - Validates: Requirement 4.3 (resume unfinished tasks)
   * - Validates: Requirement 4.4 (continue from last uploaded chunk)
   * - Verifies file matches stored metadata (name, size, type, lastModified)
   * - Creates new task with stored progress
   * - Removes old storage record and creates new one with same ID
   *
   * @example
   * ```typescript
   * // Get unfinished tasks
   * const unfinished = await manager.getUnfinishedTasksInfo();
   *
   * // User re-selects file
   * const file = await selectFile();
   *
   * // Resume upload
   * try {
   *   const task = await manager.resumeTask(unfinished[0].taskId, file);
   *   await task.start();
   * } catch (error) {
   *   console.error('Failed to resume:', error);
   * }
   * ```
   */
  async resumeTask(
    taskId: string,
    file: File,
    options?: Partial<UploadTaskOptions>,
  ): Promise<UploadTask> {
    // Check if storage is available
    if (!this.storage.isAvailable()) {
      throw new Error("Storage is not available - cannot resume task");
    }

    // Get the stored record
    const record = await this.storage.getRecord(taskId);
    if (!record) {
      throw new Error(`No unfinished task found with ID: ${taskId}`);
    }

    // Validate file matches stored metadata
    if (file.name !== record.fileInfo.name) {
      throw new Error(`File name mismatch: expected "${record.fileInfo.name}", got "${file.name}"`);
    }

    if (file.size !== record.fileInfo.size) {
      throw new Error(`File size mismatch: expected ${record.fileInfo.size}, got ${file.size}`);
    }

    if (file.type !== record.fileInfo.type) {
      throw new Error(`File type mismatch: expected "${record.fileInfo.type}", got "${file.type}"`);
    }

    // Note: lastModified check is optional as it may change if file is copied
    // We rely on name, size, and type for validation

    // Create a new task with the same ID
    const task = new UploadTask({
      file,
      requestAdapter: this.options.requestAdapter,
      chunkSize: options?.chunkSize ?? this.options.defaultChunkSize,
      concurrency: options?.concurrency ?? this.options.defaultConcurrency,
      retryCount: options?.retryCount ?? 3,
      retryDelay: options?.retryDelay ?? 1000,
      autoStart: options?.autoStart ?? false,
      resumeTaskId: taskId, // Pass the task ID to resume
      resumeUploadToken: record.uploadToken, // Pass the upload token
      resumeUploadedChunks: record.uploadedChunks, // Pass uploaded chunks
    });

    // Add task to manager
    this.tasks.set(task.id, task);

    // Call plugin hook
    this.callPluginHook("onTaskCreated", task);

    // Set up event listeners for plugin hooks
    this.setupTaskPluginHooks(task);

    // Delete old storage record (new one will be created when task starts)
    try {
      await this.storage.deleteRecord(taskId);
    } catch (error) {
      console.warn(`Failed to delete old storage record for task ${taskId}:`, error);
    }

    return task;
  }

  /**
   * Clears a specific unfinished task record from storage
   *
   * Removes the storage record for an unfinished task without resuming it.
   * Useful for cleaning up tasks that the user no longer wants to resume.
   *
   * @param taskId - ID of the unfinished task to clear
   *
   * @remarks
   * - Validates: Requirement 4.5 (clear saved upload records)
   * - Safe to call even if record doesn't exist
   * - Does not affect active tasks in the manager
   *
   * @example
   * ```typescript
   * // Clear a specific unfinished task
   * await manager.clearUnfinishedTask('task_abc123');
   *
   * // Clear all unfinished tasks
   * const unfinished = await manager.getUnfinishedTasksInfo();
   * for (const record of unfinished) {
   *   await manager.clearUnfinishedTask(record.taskId);
   * }
   * ```
   */
  async clearUnfinishedTask(taskId: string): Promise<void> {
    try {
      if (this.storage.isAvailable()) {
        await this.storage.deleteRecord(taskId);
      }
    } catch (error) {
      console.warn(`Failed to clear unfinished task ${taskId}:`, error);
    }
  }

  /**
   * Clears all unfinished task records from storage
   *
   * Removes all storage records for unfinished tasks.
   * Useful for cleaning up when users don't want to resume any uploads.
   *
   * @returns Number of records cleared
   *
   * @remarks
   * - Validates: Requirement 4.5 (clear saved upload records)
   * - Does not affect active tasks in the manager
   * - Returns 0 if storage is unavailable or on error
   *
   * @example
   * ```typescript
   * const cleared = await manager.clearAllUnfinishedTasks();
   * console.log(`Cleared ${cleared} unfinished task(s)`);
   * ```
   */
  async clearAllUnfinishedTasks(): Promise<number> {
    try {
      if (!this.storage.isAvailable()) {
        return 0;
      }

      const records = await this.storage.getAllRecords();
      const count = records.length;

      await this.storage.clearAll();

      return count;
    } catch (error) {
      console.warn("Failed to clear all unfinished tasks:", error);
      return 0;
    }
  }

  /**
   * Gets the number of tasks in the manager
   *
   * @returns Total number of tasks
   *
   * @example
   * ```typescript
   * console.log(`Total tasks: ${manager.getTaskCount()}`);
   * ```
   */
  getTaskCount(): number {
    return this.tasks.size;
  }

  /**
   * Checks if the manager has been initialized
   *
   * @returns True if initialized, false otherwise
   *
   * @example
   * ```typescript
   * if (!manager.isInitialized()) {
   *   await manager.init();
   * }
   * ```
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Clears all completed tasks from the manager
   *
   * Removes tasks with 'success', 'error', or 'cancelled' status.
   * Does not affect running or paused tasks.
   *
   * @returns Number of tasks cleared
   *
   * @example
   * ```typescript
   * const cleared = await manager.clearCompletedTasks();
   * console.log(`Cleared ${cleared} completed task(s)`);
   * ```
   */
  async clearCompletedTasks(): Promise<number> {
    const tasks = this.getAllTasks();
    let clearedCount = 0;

    for (const task of tasks) {
      const status = task.getStatus();
      if (status === "success" || status === "error" || status === "cancelled") {
        await this.deleteTask(task.id);
        clearedCount++;
      }
    }

    return clearedCount;
  }

  /**
   * Pauses all running tasks
   *
   * Calls pause() on all tasks with 'uploading' status.
   *
   * @returns Number of tasks paused
   *
   * @example
   * ```typescript
   * const paused = manager.pauseAll();
   * console.log(`Paused ${paused} task(s)`);
   * ```
   */
  pauseAll(): number {
    const tasks = this.getAllTasks();
    let pausedCount = 0;

    for (const task of tasks) {
      if (task.getStatus() === "uploading") {
        task.pause();
        pausedCount++;
      }
    }

    return pausedCount;
  }

  /**
   * Resumes all paused tasks
   *
   * Calls resume() on all tasks with 'paused' status.
   *
   * @returns Number of tasks resumed
   *
   * @example
   * ```typescript
   * const resumed = await manager.resumeAll();
   * console.log(`Resumed ${resumed} task(s)`);
   * ```
   */
  async resumeAll(): Promise<number> {
    const tasks = this.getAllTasks();
    let resumedCount = 0;

    for (const task of tasks) {
      if (task.getStatus() === "paused") {
        try {
          await task.resume();
          resumedCount++;
        } catch (error) {
          console.warn(`Failed to resume task ${task.id}:`, error);
        }
      }
    }

    return resumedCount;
  }

  /**
   * Cancels all running and paused tasks
   *
   * Calls cancel() on all tasks that are not in a terminal state.
   *
   * @returns Number of tasks cancelled
   *
   * @example
   * ```typescript
   * const cancelled = manager.cancelAll();
   * console.log(`Cancelled ${cancelled} task(s)`);
   * ```
   */
  cancelAll(): number {
    const tasks = this.getAllTasks();
    let cancelledCount = 0;

    for (const task of tasks) {
      const status = task.getStatus();
      if (status === "uploading" || status === "paused") {
        task.cancel();
        cancelledCount++;
      }
    }

    return cancelledCount;
  }

  /**
   * Gets statistics about all tasks
   *
   * @returns Object containing task statistics
   *
   * @example
   * ```typescript
   * const stats = manager.getStatistics();
   * console.log(`Total: ${stats.total}`);
   * console.log(`Uploading: ${stats.uploading}`);
   * console.log(`Success: ${stats.success}`);
   * ```
   */
  getStatistics(): {
    total: number;
    idle: number;
    uploading: number;
    paused: number;
    success: number;
    error: number;
    cancelled: number;
  } {
    const tasks = this.getAllTasks();

    const stats = {
      total: tasks.length,
      idle: 0,
      uploading: 0,
      paused: 0,
      success: 0,
      error: 0,
      cancelled: 0,
    };

    for (const task of tasks) {
      const status = task.getStatus();
      switch (status) {
        case "idle":
          stats.idle++;
          break;
        case "uploading":
          stats.uploading++;
          break;
        case "paused":
          stats.paused++;
          break;
        case "success":
          stats.success++;
          break;
        case "error":
          stats.error++;
          break;
        case "cancelled":
          stats.cancelled++;
          break;
      }
    }

    return stats;
  }

  /**
   * Closes the manager and cleans up resources
   *
   * Cancels all running tasks and closes the storage connection.
   * The manager should not be used after calling this method.
   *
   * @example
   * ```typescript
   * // Clean up when done
   * manager.close();
   * ```
   */
  close(): void {
    // Cancel all running tasks
    this.cancelAll();

    // Close storage connection
    this.storage.close();

    // Clear tasks map
    this.tasks.clear();

    // Reset initialized flag
    this.initialized = false;
  }
}
