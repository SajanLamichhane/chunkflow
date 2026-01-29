import { describe, it, expect, vi } from "vitest";
import { createEventBus } from "../src/event-bus";

describe("Event Bus", () => {
  describe("createEventBus", () => {
    it("should create an event bus instance", () => {
      const eventBus = createEventBus();

      expect(eventBus).toBeDefined();
      expect(typeof eventBus.on).toBe("function");
      expect(typeof eventBus.emit).toBe("function");
      expect(typeof eventBus.off).toBe("function");
    });

    it("should emit and receive start event", () => {
      const eventBus = createEventBus();
      const handler = vi.fn();
      const mockFile = new File(["test"], "test.txt", { type: "text/plain" });

      eventBus.on("start", handler);
      eventBus.emit("start", { taskId: "task-1", file: mockFile });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({ taskId: "task-1", file: mockFile });
    });

    it("should emit and receive progress event", () => {
      const eventBus = createEventBus();
      const handler = vi.fn();

      eventBus.on("progress", handler);
      eventBus.emit("progress", { taskId: "task-1", progress: 50, speed: 1024000 });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({
        taskId: "task-1",
        progress: 50,
        speed: 1024000,
      });
    });

    it("should emit and receive chunkSuccess event", () => {
      const eventBus = createEventBus();
      const handler = vi.fn();

      eventBus.on("chunkSuccess", handler);
      eventBus.emit("chunkSuccess", { taskId: "task-1", chunkIndex: 0 });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({ taskId: "task-1", chunkIndex: 0 });
    });

    it("should emit and receive chunkError event", () => {
      const eventBus = createEventBus();
      const handler = vi.fn();
      const error = new Error("Upload failed");

      eventBus.on("chunkError", handler);
      eventBus.emit("chunkError", { taskId: "task-1", chunkIndex: 0, error });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({
        taskId: "task-1",
        chunkIndex: 0,
        error,
      });
    });

    it("should emit and receive hashProgress event", () => {
      const eventBus = createEventBus();
      const handler = vi.fn();

      eventBus.on("hashProgress", handler);
      eventBus.emit("hashProgress", { taskId: "task-1", progress: 75 });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({ taskId: "task-1", progress: 75 });
    });

    it("should emit and receive hashComplete event", () => {
      const eventBus = createEventBus();
      const handler = vi.fn();

      eventBus.on("hashComplete", handler);
      eventBus.emit("hashComplete", { taskId: "task-1", hash: "abc123" });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({ taskId: "task-1", hash: "abc123" });
    });

    it("should emit and receive success event", () => {
      const eventBus = createEventBus();
      const handler = vi.fn();

      eventBus.on("success", handler);
      eventBus.emit("success", { taskId: "task-1", fileUrl: "https://example.com/file" });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({
        taskId: "task-1",
        fileUrl: "https://example.com/file",
      });
    });

    it("should emit and receive error event", () => {
      const eventBus = createEventBus();
      const handler = vi.fn();
      const error = new Error("Upload failed");

      eventBus.on("error", handler);
      eventBus.emit("error", { taskId: "task-1", error });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({ taskId: "task-1", error });
    });

    it("should emit and receive pause event", () => {
      const eventBus = createEventBus();
      const handler = vi.fn();

      eventBus.on("pause", handler);
      eventBus.emit("pause", { taskId: "task-1" });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({ taskId: "task-1" });
    });

    it("should emit and receive resume event", () => {
      const eventBus = createEventBus();
      const handler = vi.fn();

      eventBus.on("resume", handler);
      eventBus.emit("resume", { taskId: "task-1" });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({ taskId: "task-1" });
    });

    it("should emit and receive cancel event", () => {
      const eventBus = createEventBus();
      const handler = vi.fn();

      eventBus.on("cancel", handler);
      eventBus.emit("cancel", { taskId: "task-1" });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({ taskId: "task-1" });
    });

    it("should support multiple listeners for the same event", () => {
      const eventBus = createEventBus();
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.on("start", handler1);
      eventBus.on("start", handler2);

      const mockFile = new File(["test"], "test.txt", { type: "text/plain" });
      eventBus.emit("start", { taskId: "task-1", file: mockFile });

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it("should remove listener with off", () => {
      const eventBus = createEventBus();
      const handler = vi.fn();

      eventBus.on("progress", handler);
      eventBus.emit("progress", { taskId: "task-1", progress: 50, speed: 1024000 });

      expect(handler).toHaveBeenCalledTimes(1);

      eventBus.off("progress", handler);
      eventBus.emit("progress", { taskId: "task-1", progress: 75, speed: 1024000 });

      // Should still be 1, not 2
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("should support wildcard listener", () => {
      const eventBus = createEventBus();
      const handler = vi.fn();

      eventBus.on("*", handler);

      const mockFile = new File(["test"], "test.txt", { type: "text/plain" });
      eventBus.emit("start", { taskId: "task-1", file: mockFile });
      eventBus.emit("progress", { taskId: "task-1", progress: 50, speed: 1024000 });

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it("should clear all listeners", () => {
      const eventBus = createEventBus();
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.on("start", handler1);
      eventBus.on("progress", handler2);

      eventBus.all.clear();

      const mockFile = new File(["test"], "test.txt", { type: "text/plain" });
      eventBus.emit("start", { taskId: "task-1", file: mockFile });
      eventBus.emit("progress", { taskId: "task-1", progress: 50, speed: 1024000 });

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });

    it("should handle multiple events in sequence", () => {
      const eventBus = createEventBus();
      const events: string[] = [];

      eventBus.on("start", () => events.push("start"));
      eventBus.on("progress", () => events.push("progress"));
      eventBus.on("success", () => events.push("success"));

      const mockFile = new File(["test"], "test.txt", { type: "text/plain" });
      eventBus.emit("start", { taskId: "task-1", file: mockFile });
      eventBus.emit("progress", { taskId: "task-1", progress: 50, speed: 1024000 });
      eventBus.emit("progress", { taskId: "task-1", progress: 100, speed: 1024000 });
      eventBus.emit("success", { taskId: "task-1", fileUrl: "https://example.com/file" });

      expect(events).toEqual(["start", "progress", "progress", "success"]);
    });
  });
});
