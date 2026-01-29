import { useEffect, useState, CSSProperties } from "react";
import type { UploadTask } from "@chunkflow/core";
import { formatFileSize } from "@chunkflow/shared";

/**
 * Props for the UploadProgress component
 */
export interface UploadProgressProps {
  /**
   * The upload task to display progress for
   */
  task: UploadTask;

  /**
   * Whether to show upload speed
   * @default true
   */
  showSpeed?: boolean;

  /**
   * Whether to show remaining time
   * @default true
   */
  showRemainingTime?: boolean;

  /**
   * CSS class name for the container
   */
  className?: string;

  /**
   * Custom styles for the container
   */
  style?: CSSProperties;

  /**
   * CSS class name for the progress bar
   */
  progressBarClassName?: string;

  /**
   * CSS class name for the progress fill
   */
  progressFillClassName?: string;

  /**
   * CSS class name for the progress info
   */
  progressInfoClassName?: string;
}

/**
 * Format time in seconds to human-readable format
 *
 * @param seconds - Time in seconds
 * @returns Formatted string (e.g., "1m 30s", "45s")
 */
function formatTime(seconds: number): string {
  if (seconds <= 0 || !isFinite(seconds)) {
    return "0s";
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }
  if (secs > 0 || parts.length === 0) {
    parts.push(`${secs}s`);
  }

  return parts.join(" ");
}

/**
 * UploadProgress component
 *
 * Displays upload progress with a progress bar, percentage, speed, and remaining time.
 * Automatically updates as the upload progresses.
 *
 * @example
 * ```tsx
 * <UploadProgress
 *   task={uploadTask}
 *   showSpeed={true}
 *   showRemainingTime={true}
 * />
 * ```
 */
export function UploadProgress({
  task,
  showSpeed = true,
  showRemainingTime = true,
  className,
  style,
  progressBarClassName,
  progressFillClassName,
  progressInfoClassName,
}: UploadProgressProps) {
  const [progress, setProgress] = useState(task.getProgress());

  useEffect(() => {
    // Update progress when the task emits progress events
    const handleProgress = () => {
      setProgress(task.getProgress());
    };

    // Subscribe to progress events
    task.on("progress", handleProgress);

    // Also update on other state changes that might affect progress
    task.on("start", handleProgress);
    task.on("success", handleProgress);
    task.on("error", handleProgress);
    task.on("pause", handleProgress);
    task.on("resume", handleProgress);

    // Initial update
    handleProgress();

    // Cleanup: unsubscribe from events
    return () => {
      task.off("progress", handleProgress);
      task.off("start", handleProgress);
      task.off("success", handleProgress);
      task.off("error", handleProgress);
      task.off("pause", handleProgress);
      task.off("resume", handleProgress);
    };
  }, [task]);

  const defaultStyles = {
    container: {
      width: "100%",
      padding: "8px",
    } as CSSProperties,
    progressBar: {
      width: "100%",
      height: "8px",
      backgroundColor: "#e0e0e0",
      borderRadius: "4px",
      overflow: "hidden",
      marginBottom: "8px",
    } as CSSProperties,
    progressFill: {
      height: "100%",
      backgroundColor: "#4caf50",
      transition: "width 0.3s ease",
      borderRadius: "4px",
    } as CSSProperties,
    progressInfo: {
      display: "flex",
      justifyContent: "space-between",
      fontSize: "14px",
      color: "#666",
    } as CSSProperties,
  };

  return (
    <div
      className={className}
      style={style || defaultStyles.container}
      data-testid="upload-progress"
    >
      {/* Progress bar */}
      <div
        className={progressBarClassName}
        style={progressBarClassName ? undefined : defaultStyles.progressBar}
        data-testid="progress-bar"
      >
        <div
          className={progressFillClassName}
          style={
            progressFillClassName
              ? { width: `${progress.percentage}%` }
              : { ...defaultStyles.progressFill, width: `${progress.percentage}%` }
          }
          data-testid="progress-fill"
        />
      </div>

      {/* Progress info */}
      <div
        className={progressInfoClassName}
        style={progressInfoClassName ? undefined : defaultStyles.progressInfo}
        data-testid="progress-info"
      >
        <span data-testid="progress-percentage">{progress.percentage.toFixed(1)}%</span>

        <div style={{ display: "flex", gap: "16px" }}>
          {showSpeed && progress.speed > 0 && (
            <span data-testid="progress-speed">{formatFileSize(progress.speed)}/s</span>
          )}

          {showRemainingTime && progress.remainingTime > 0 && (
            <span data-testid="progress-remaining-time">
              {formatTime(progress.remainingTime)} remaining
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
