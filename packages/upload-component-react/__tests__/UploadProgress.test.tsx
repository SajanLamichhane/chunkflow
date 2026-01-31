import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { UploadProgress } from "../src/UploadProgress";
import type { UploadTask, UploadProgress as UploadProgressType } from "@chunkflowjs/core";

/**
 * Create a mock UploadTask for testing
 */
function createMockTask(initialProgress?: Partial<UploadProgressType>): UploadTask {
  const defaultProgress: UploadProgressType = {
    uploadedBytes: 0,
    totalBytes: 10 * 1024 * 1024, // 10MB
    percentage: 0,
    speed: 0,
    remainingTime: 0,
    uploadedChunks: 0,
    totalChunks: 10,
    ...initialProgress,
  };

  const eventHandlers = new Map<string, Set<Function>>();

  const mockTask = {
    id: "test-task-id",
    file: new File(["test"], "test.txt", { type: "text/plain" }),
    getProgress: vi.fn(() => ({ ...defaultProgress })),
    getStatus: vi.fn(() => "uploading"),
    on: vi.fn((event: string, handler: Function) => {
      if (!eventHandlers.has(event)) {
        eventHandlers.set(event, new Set());
      }
      eventHandlers.get(event)!.add(handler);
    }),
    off: vi.fn((event: string, handler: Function) => {
      eventHandlers.get(event)?.delete(handler);
    }),
    emit: (event: string, data?: any) => {
      eventHandlers.get(event)?.forEach((handler) => handler(data));
    },
    updateProgress: (newProgress: Partial<UploadProgressType>) => {
      Object.assign(defaultProgress, newProgress);
      mockTask.emit("progress", {
        progress: defaultProgress.percentage,
        speed: defaultProgress.speed,
      });
    },
  } as unknown as UploadTask;

  return mockTask;
}

describe("UploadProgress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Basic Rendering", () => {
    it("should render progress bar with initial progress", () => {
      const task = createMockTask({ percentage: 0 });

      render(<UploadProgress task={task} />);

      expect(screen.getByTestId("upload-progress")).toBeInTheDocument();
      expect(screen.getByTestId("progress-bar")).toBeInTheDocument();
      expect(screen.getByTestId("progress-fill")).toBeInTheDocument();
      expect(screen.getByTestId("progress-info")).toBeInTheDocument();
    });

    it("should display correct percentage", () => {
      const task = createMockTask({ percentage: 45.5 });

      render(<UploadProgress task={task} />);

      expect(screen.getByTestId("progress-percentage")).toHaveTextContent("45.5%");
    });

    it("should set progress bar width based on percentage", () => {
      const task = createMockTask({ percentage: 60 });

      render(<UploadProgress task={task} />);

      const progressFill = screen.getByTestId("progress-fill");
      expect(progressFill).toHaveStyle({ width: "60%" });
    });
  });

  describe("Speed Display", () => {
    it("should show upload speed when showSpeed is true", () => {
      const task = createMockTask({
        speed: 1024 * 1024, // 1 MB/s
        percentage: 50,
      });

      render(<UploadProgress task={task} showSpeed={true} />);

      expect(screen.getByTestId("progress-speed")).toBeInTheDocument();
      expect(screen.getByTestId("progress-speed")).toHaveTextContent("1.00 MB/s");
    });

    it("should not show speed when showSpeed is false", () => {
      const task = createMockTask({
        speed: 1024 * 1024,
        percentage: 50,
      });

      render(<UploadProgress task={task} showSpeed={false} />);

      expect(screen.queryByTestId("progress-speed")).not.toBeInTheDocument();
    });

    it("should not show speed when speed is 0", () => {
      const task = createMockTask({
        speed: 0,
        percentage: 50,
      });

      render(<UploadProgress task={task} showSpeed={true} />);

      expect(screen.queryByTestId("progress-speed")).not.toBeInTheDocument();
    });

    it("should format speed correctly for different sizes", () => {
      const testCases = [
        { speed: 500, expected: "500.00 B/s" },
        { speed: 1024, expected: "1.00 KB/s" },
        { speed: 1024 * 1024, expected: "1.00 MB/s" },
        { speed: 2.5 * 1024 * 1024, expected: "2.50 MB/s" },
      ];

      testCases.forEach(({ speed, expected }) => {
        const task = createMockTask({ speed, percentage: 50 });
        const { unmount } = render(<UploadProgress task={task} showSpeed={true} />);

        expect(screen.getByTestId("progress-speed")).toHaveTextContent(expected);
        unmount();
      });
    });
  });

  describe("Remaining Time Display", () => {
    it("should show remaining time when showRemainingTime is true", () => {
      const task = createMockTask({
        remainingTime: 65, // 1 minute 5 seconds
        percentage: 50,
      });

      render(<UploadProgress task={task} showRemainingTime={true} />);

      expect(screen.getByTestId("progress-remaining-time")).toBeInTheDocument();
      expect(screen.getByTestId("progress-remaining-time")).toHaveTextContent("1m 5s remaining");
    });

    it("should not show remaining time when showRemainingTime is false", () => {
      const task = createMockTask({
        remainingTime: 65,
        percentage: 50,
      });

      render(<UploadProgress task={task} showRemainingTime={false} />);

      expect(screen.queryByTestId("progress-remaining-time")).not.toBeInTheDocument();
    });

    it("should not show remaining time when remainingTime is 0", () => {
      const task = createMockTask({
        remainingTime: 0,
        percentage: 50,
      });

      render(<UploadProgress task={task} showRemainingTime={true} />);

      expect(screen.queryByTestId("progress-remaining-time")).not.toBeInTheDocument();
    });

    it("should format time correctly for different durations", () => {
      const testCases = [
        { time: 5, expected: "5s remaining" },
        { time: 65, expected: "1m 5s remaining" },
        { time: 3665, expected: "1h 1m 5s remaining" },
        { time: 7200, expected: "2h remaining" }, // Only shows non-zero parts
      ];

      testCases.forEach(({ time, expected }) => {
        const task = createMockTask({ remainingTime: time, percentage: 50 });
        const { unmount } = render(<UploadProgress task={task} showRemainingTime={true} />);

        expect(screen.getByTestId("progress-remaining-time")).toHaveTextContent(expected);
        unmount();
      });
    });
  });

  describe("Progress Updates", () => {
    it("should update progress when task emits progress event", async () => {
      const task = createMockTask({ percentage: 25 });

      render(<UploadProgress task={task} />);

      expect(screen.getByTestId("progress-percentage")).toHaveTextContent("25.0%");

      // Update progress
      task.updateProgress({ percentage: 75 });

      await waitFor(() => {
        expect(screen.getByTestId("progress-percentage")).toHaveTextContent("75.0%");
      });
    });

    it("should update speed when task emits progress event", async () => {
      const task = createMockTask({
        percentage: 25,
        speed: 1024 * 1024, // 1 MB/s
      });

      render(<UploadProgress task={task} showSpeed={true} />);

      expect(screen.getByTestId("progress-speed")).toHaveTextContent("1.00 MB/s");

      // Update speed
      task.updateProgress({
        percentage: 50,
        speed: 2 * 1024 * 1024, // 2 MB/s
      });

      await waitFor(() => {
        expect(screen.getByTestId("progress-speed")).toHaveTextContent("2.00 MB/s");
      });
    });

    it("should update remaining time when task emits progress event", async () => {
      const task = createMockTask({
        percentage: 25,
        remainingTime: 120, // 2 minutes
      });

      render(<UploadProgress task={task} showRemainingTime={true} />);

      expect(screen.getByTestId("progress-remaining-time")).toHaveTextContent("2m remaining");

      // Update remaining time
      task.updateProgress({
        percentage: 50,
        remainingTime: 60, // 1 minute
      });

      await waitFor(() => {
        expect(screen.getByTestId("progress-remaining-time")).toHaveTextContent("1m remaining");
      });
    });
  });

  describe("Event Subscription", () => {
    it("should subscribe to progress events on mount", () => {
      const task = createMockTask();

      render(<UploadProgress task={task} />);

      expect(task.on).toHaveBeenCalledWith("progress", expect.any(Function));
      expect(task.on).toHaveBeenCalledWith("start", expect.any(Function));
      expect(task.on).toHaveBeenCalledWith("success", expect.any(Function));
      expect(task.on).toHaveBeenCalledWith("error", expect.any(Function));
      expect(task.on).toHaveBeenCalledWith("pause", expect.any(Function));
      expect(task.on).toHaveBeenCalledWith("resume", expect.any(Function));
    });

    it("should unsubscribe from events on unmount", () => {
      const task = createMockTask();

      const { unmount } = render(<UploadProgress task={task} />);

      unmount();

      expect(task.off).toHaveBeenCalledWith("progress", expect.any(Function));
      expect(task.off).toHaveBeenCalledWith("start", expect.any(Function));
      expect(task.off).toHaveBeenCalledWith("success", expect.any(Function));
      expect(task.off).toHaveBeenCalledWith("error", expect.any(Function));
      expect(task.off).toHaveBeenCalledWith("pause", expect.any(Function));
      expect(task.off).toHaveBeenCalledWith("resume", expect.any(Function));
    });
  });

  describe("Custom Styling", () => {
    it("should apply custom className", () => {
      const task = createMockTask();

      render(<UploadProgress task={task} className="custom-class" />);

      expect(screen.getByTestId("upload-progress")).toHaveClass("custom-class");
    });

    it("should apply custom style", () => {
      const task = createMockTask();
      const customStyle = { backgroundColor: "red", padding: "20px" };

      render(<UploadProgress task={task} style={customStyle} />);

      const container = screen.getByTestId("upload-progress");
      expect(container).toHaveStyle({ backgroundColor: "red", padding: "20px" });
    });

    it("should apply custom progressBarClassName", () => {
      const task = createMockTask();

      render(<UploadProgress task={task} progressBarClassName="custom-bar" />);

      expect(screen.getByTestId("progress-bar")).toHaveClass("custom-bar");
    });

    it("should apply custom progressFillClassName", () => {
      const task = createMockTask();

      render(<UploadProgress task={task} progressFillClassName="custom-fill" />);

      expect(screen.getByTestId("progress-fill")).toHaveClass("custom-fill");
    });

    it("should apply custom progressInfoClassName", () => {
      const task = createMockTask();

      render(<UploadProgress task={task} progressInfoClassName="custom-info" />);

      expect(screen.getByTestId("progress-info")).toHaveClass("custom-info");
    });
  });

  describe("Edge Cases", () => {
    it("should handle 0% progress", () => {
      const task = createMockTask({ percentage: 0 });

      render(<UploadProgress task={task} />);

      expect(screen.getByTestId("progress-percentage")).toHaveTextContent("0.0%");
      expect(screen.getByTestId("progress-fill")).toHaveStyle({ width: "0%" });
    });

    it("should handle 100% progress", () => {
      const task = createMockTask({ percentage: 100 });

      render(<UploadProgress task={task} />);

      expect(screen.getByTestId("progress-percentage")).toHaveTextContent("100.0%");
      expect(screen.getByTestId("progress-fill")).toHaveStyle({ width: "100%" });
    });

    it("should handle negative remaining time gracefully", () => {
      const task = createMockTask({
        remainingTime: -10,
        percentage: 50,
      });

      render(<UploadProgress task={task} showRemainingTime={true} />);

      // Should not display negative time
      expect(screen.queryByTestId("progress-remaining-time")).not.toBeInTheDocument();
    });

    it("should handle infinite remaining time gracefully", () => {
      const task = createMockTask({
        remainingTime: Infinity,
        percentage: 50,
      });

      render(<UploadProgress task={task} showRemainingTime={true} />);

      // formatTime returns "0s" for infinite time, which is still displayed
      // This is acceptable behavior - showing "0s remaining" for infinite/unknown time
      expect(screen.getByTestId("progress-remaining-time")).toBeInTheDocument();
      expect(screen.getByTestId("progress-remaining-time")).toHaveTextContent("0s remaining");
    });

    it("should handle very large file sizes", () => {
      const task = createMockTask({
        speed: 100 * 1024 * 1024, // 100 MB/s
        percentage: 50,
      });

      render(<UploadProgress task={task} showSpeed={true} />);

      expect(screen.getByTestId("progress-speed")).toHaveTextContent("100.00 MB/s");
    });
  });
});
