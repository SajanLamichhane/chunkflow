/**
 * Built-in plugins for UploadManager
 *
 * This module provides example plugin implementations that demonstrate
 * how to extend the UploadManager with custom functionality.
 */

import type { UploadProgress } from "@chunkflowjs/protocol";
import type { Plugin } from "./upload-manager";
import type { UploadTask } from "./upload-task";

/**
 * Logger plugin for debugging and monitoring uploads
 *
 * Logs all task lifecycle events to the console with timestamps.
 * Useful for development and debugging.
 *
 * @remarks
 * - Validates: Requirement 6.5 (Plugin mechanism example)
 * - Validates: Requirement 8.5 (Plugin system example)
 * - Logs to console with timestamps
 * - Can be configured to log only specific events
 *
 * @example
 * ```typescript
 * const manager = new UploadManager({ requestAdapter });
 * manager.use(new LoggerPlugin());
 *
 * // With custom options
 * manager.use(new LoggerPlugin({
 *   logProgress: false, // Don't log progress updates
 *   prefix: '[Upload]'  // Custom log prefix
 * }));
 * ```
 */
export class LoggerPlugin implements Plugin {
  name = "logger";

  private options: {
    logProgress: boolean;
    logStart: boolean;
    logSuccess: boolean;
    logError: boolean;
    logPause: boolean;
    logResume: boolean;
    logCancel: boolean;
    prefix: string;
  };

  constructor(
    options?: Partial<{
      logProgress: boolean;
      logStart: boolean;
      logSuccess: boolean;
      logError: boolean;
      logPause: boolean;
      logResume: boolean;
      logCancel: boolean;
      prefix: string;
    }>,
  ) {
    this.options = {
      logProgress: options?.logProgress ?? true,
      logStart: options?.logStart ?? true,
      logSuccess: options?.logSuccess ?? true,
      logError: options?.logError ?? true,
      logPause: options?.logPause ?? true,
      logResume: options?.logResume ?? true,
      logCancel: options?.logCancel ?? true,
      prefix: options?.prefix ?? "[LoggerPlugin]",
    };
  }

  private log(message: string, ...args: unknown[]): void {
    const timestamp = new Date().toISOString();
    console.log(`${this.options.prefix} [${timestamp}]`, message, ...args);
  }

  install(): void {
    this.log("Plugin installed");
  }

  onTaskCreated(task: UploadTask): void {
    this.log(`Task created: ${task.id}`, {
      fileName: task.file.name,
      fileSize: task.file.size,
      fileType: task.file.type,
    });
  }

  onTaskStart(task: UploadTask): void {
    if (this.options.logStart) {
      this.log(`Task started: ${task.id}`, {
        fileName: task.file.name,
      });
    }
  }

  onTaskProgress(task: UploadTask, progress: UploadProgress): void {
    if (this.options.logProgress) {
      this.log(`Task progress: ${task.id}`, {
        percentage: `${progress.percentage.toFixed(2)}%`,
        uploadedBytes: progress.uploadedBytes,
        totalBytes: progress.totalBytes,
        speed: `${(progress.speed / 1024 / 1024).toFixed(2)} MB/s`,
        remainingTime: `${progress.remainingTime.toFixed(0)}s`,
      });
    }
  }

  onTaskSuccess(task: UploadTask, fileUrl: string): void {
    if (this.options.logSuccess) {
      this.log(`Task completed: ${task.id}`, {
        fileName: task.file.name,
        fileUrl,
      });
    }
  }

  onTaskError(task: UploadTask, error: Error): void {
    if (this.options.logError) {
      this.log(`Task error: ${task.id}`, {
        fileName: task.file.name,
        error: error.message,
        stack: error.stack,
      });
    }
  }

  onTaskPause(task: UploadTask): void {
    if (this.options.logPause) {
      this.log(`Task paused: ${task.id}`, {
        fileName: task.file.name,
      });
    }
  }

  onTaskResume(task: UploadTask): void {
    if (this.options.logResume) {
      this.log(`Task resumed: ${task.id}`, {
        fileName: task.file.name,
      });
    }
  }

  onTaskCancel(task: UploadTask): void {
    if (this.options.logCancel) {
      this.log(`Task cancelled: ${task.id}`, {
        fileName: task.file.name,
      });
    }
  }
}

/**
 * Statistics plugin for tracking upload metrics
 *
 * Collects statistics about uploads including success/error counts,
 * total bytes uploaded, average speed, etc.
 *
 * @remarks
 * - Validates: Requirement 6.5 (Plugin mechanism example)
 * - Validates: Requirement 8.5 (Plugin system example)
 * - Tracks upload statistics in memory
 * - Provides methods to retrieve and reset statistics
 * - Thread-safe for concurrent uploads
 *
 * @example
 * ```typescript
 * const stats = new StatisticsPlugin();
 * manager.use(stats);
 *
 * // Later, get statistics
 * const metrics = stats.getStats();
 * console.log(`Success rate: ${metrics.successRate}%`);
 * console.log(`Total uploaded: ${metrics.totalBytesUploaded} bytes`);
 * console.log(`Average speed: ${metrics.averageSpeed} bytes/s`);
 * ```
 */
export class StatisticsPlugin implements Plugin {
  name = "statistics";

  private stats = {
    totalFiles: 0,
    successCount: 0,
    errorCount: 0,
    cancelledCount: 0,
    totalBytesUploaded: 0,
    totalUploadTime: 0, // milliseconds
    startTimes: new Map<string, number>(),
  };

  install(): void {
    // No initialization needed
  }

  onTaskCreated(_task: UploadTask): void {
    this.stats.totalFiles++;
  }

  onTaskStart(task: UploadTask): void {
    // Record start time for this task
    this.stats.startTimes.set(task.id, Date.now());
  }

  onTaskSuccess(task: UploadTask, _fileUrl: string): void {
    this.stats.successCount++;
    this.stats.totalBytesUploaded += task.file.size;

    // Calculate upload time
    const startTime = this.stats.startTimes.get(task.id);
    if (startTime) {
      const uploadTime = Date.now() - startTime;
      this.stats.totalUploadTime += uploadTime;
      this.stats.startTimes.delete(task.id);
    }
  }

  onTaskError(task: UploadTask, _error: Error): void {
    this.stats.errorCount++;

    // Clean up start time
    this.stats.startTimes.delete(task.id);
  }

  onTaskCancel(task: UploadTask): void {
    this.stats.cancelledCount++;

    // Clean up start time
    this.stats.startTimes.delete(task.id);
  }

  /**
   * Gets current statistics
   *
   * @returns Object containing upload statistics
   *
   * @example
   * ```typescript
   * const stats = plugin.getStats();
   * console.log(`Success rate: ${stats.successRate}%`);
   * ```
   */
  getStats(): {
    totalFiles: number;
    successCount: number;
    errorCount: number;
    cancelledCount: number;
    totalBytesUploaded: number;
    averageSpeed: number; // bytes per second
    averageUploadTime: number; // milliseconds
    successRate: number; // percentage
    errorRate: number; // percentage
  } {
    const completedCount =
      this.stats.successCount + this.stats.errorCount + this.stats.cancelledCount;
    const averageSpeed =
      this.stats.totalUploadTime > 0
        ? (this.stats.totalBytesUploaded / this.stats.totalUploadTime) * 1000
        : 0;
    const averageUploadTime =
      this.stats.successCount > 0 ? this.stats.totalUploadTime / this.stats.successCount : 0;
    const successRate = completedCount > 0 ? (this.stats.successCount / completedCount) * 100 : 0;
    const errorRate = completedCount > 0 ? (this.stats.errorCount / completedCount) * 100 : 0;

    return {
      totalFiles: this.stats.totalFiles,
      successCount: this.stats.successCount,
      errorCount: this.stats.errorCount,
      cancelledCount: this.stats.cancelledCount,
      totalBytesUploaded: this.stats.totalBytesUploaded,
      averageSpeed,
      averageUploadTime,
      successRate,
      errorRate,
    };
  }

  /**
   * Resets all statistics to zero
   *
   * @example
   * ```typescript
   * plugin.reset();
   * ```
   */
  reset(): void {
    this.stats = {
      totalFiles: 0,
      successCount: 0,
      errorCount: 0,
      cancelledCount: 0,
      totalBytesUploaded: 0,
      totalUploadTime: 0,
      startTimes: new Map(),
    };
  }

  /**
   * Gets a formatted summary of statistics
   *
   * @returns Human-readable statistics summary
   *
   * @example
   * ```typescript
   * console.log(plugin.getSummary());
   * // Output:
   * // Upload Statistics:
   * //   Total Files: 10
   * //   Success: 8 (80.00%)
   * //   Errors: 1 (10.00%)
   * //   Cancelled: 1 (10.00%)
   * //   Total Uploaded: 52.43 MB
   * //   Average Speed: 2.15 MB/s
   * //   Average Time: 24.5s
   * ```
   */
  getSummary(): string {
    const stats = this.getStats();
    const formatBytes = (bytes: number): string => {
      const mb = bytes / 1024 / 1024;
      return `${mb.toFixed(2)} MB`;
    };
    const formatSpeed = (bytesPerSecond: number): string => {
      const mbps = bytesPerSecond / 1024 / 1024;
      return `${mbps.toFixed(2)} MB/s`;
    };
    const formatTime = (ms: number): string => {
      const seconds = ms / 1000;
      return `${seconds.toFixed(1)}s`;
    };

    return `Upload Statistics:
  Total Files: ${stats.totalFiles}
  Success: ${stats.successCount} (${stats.successRate.toFixed(2)}%)
  Errors: ${stats.errorCount} (${stats.errorRate.toFixed(2)}%)
  Cancelled: ${stats.cancelledCount}
  Total Uploaded: ${formatBytes(stats.totalBytesUploaded)}
  Average Speed: ${formatSpeed(stats.averageSpeed)}
  Average Time: ${formatTime(stats.averageUploadTime)}`;
  }
}
