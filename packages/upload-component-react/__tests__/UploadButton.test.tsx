/**
 * Unit tests for UploadButton component
 *
 * Tests file selection, validation (type and size), and error handling.
 * Validates requirement 11.6: File type and size limitation support.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UploadButton, FileValidationError } from "../src/UploadButton";

describe("UploadButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Basic Rendering", () => {
    it("should render with default text", () => {
      render(<UploadButton />);
      expect(screen.getByRole("button")).toHaveTextContent("Select Files");
    });

    it("should render with custom children", () => {
      render(<UploadButton>Upload Files</UploadButton>);
      expect(screen.getByRole("button")).toHaveTextContent("Upload Files");
    });

    it("should apply custom className", () => {
      render(<UploadButton className="custom-class" />);
      expect(screen.getByRole("button")).toHaveClass("custom-class");
    });

    it("should be disabled when disabled prop is true", () => {
      render(<UploadButton disabled />);
      expect(screen.getByRole("button")).toBeDisabled();
    });

    it("should render hidden file input", () => {
      const { container } = render(<UploadButton />);
      const input = container.querySelector('input[type="file"]');
      expect(input).toBeTruthy();
      expect(input).toHaveStyle({ display: "none" });
    });
  });

  describe("File Selection", () => {
    it("should trigger file input click when button is clicked", () => {
      const { container } = render(<UploadButton />);
      const button = screen.getByRole("button");
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;

      const clickSpy = vi.spyOn(input, "click");
      fireEvent.click(button);

      expect(clickSpy).toHaveBeenCalledOnce();
    });

    it("should not trigger file input click when disabled", () => {
      const { container } = render(<UploadButton disabled />);
      const button = screen.getByRole("button");
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;

      const clickSpy = vi.spyOn(input, "click");
      fireEvent.click(button);

      expect(clickSpy).not.toHaveBeenCalled();
    });

    it("should call onSelect with selected files", () => {
      const onSelect = vi.fn();
      const { container } = render(<UploadButton onSelect={onSelect} />);
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;

      const file = new File(["content"], "test.txt", { type: "text/plain" });
      Object.defineProperty(input, "files", {
        value: [file],
        writable: false,
      });

      fireEvent.change(input);

      expect(onSelect).toHaveBeenCalledOnce();
      expect(onSelect).toHaveBeenCalledWith([file]);
    });

    it("should handle multiple file selection", () => {
      const onSelect = vi.fn();
      const { container } = render(<UploadButton multiple onSelect={onSelect} />);
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;

      const file1 = new File(["content1"], "test1.txt", {
        type: "text/plain",
      });
      const file2 = new File(["content2"], "test2.txt", {
        type: "text/plain",
      });
      Object.defineProperty(input, "files", {
        value: [file1, file2],
        writable: false,
      });

      fireEvent.change(input);

      expect(onSelect).toHaveBeenCalledOnce();
      expect(onSelect).toHaveBeenCalledWith([file1, file2]);
    });

    it("should reset input value after selection", () => {
      const onSelect = vi.fn();
      const { container } = render(<UploadButton onSelect={onSelect} />);
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;

      const file = new File(["content"], "test.txt", { type: "text/plain" });
      Object.defineProperty(input, "files", {
        value: [file],
        writable: false,
      });

      fireEvent.change(input);

      expect(input.value).toBe("");
    });

    it("should not call onSelect when no files are selected", () => {
      const onSelect = vi.fn();
      const { container } = render(<UploadButton onSelect={onSelect} />);
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;

      Object.defineProperty(input, "files", {
        value: [],
        writable: false,
      });

      fireEvent.change(input);

      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe("File Size Validation", () => {
    it("should accept files within size limit", () => {
      const onSelect = vi.fn();
      const onError = vi.fn();
      const maxSize = 1024; // 1KB
      const { container } = render(
        <UploadButton maxSize={maxSize} onSelect={onSelect} onError={onError} />,
      );
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;

      const file = new File(["x".repeat(512)], "test.txt", {
        type: "text/plain",
      });
      Object.defineProperty(input, "files", {
        value: [file],
        writable: false,
      });

      fireEvent.change(input);

      expect(onSelect).toHaveBeenCalledWith([file]);
      expect(onError).not.toHaveBeenCalled();
    });

    it("should reject files exceeding size limit", () => {
      const onSelect = vi.fn();
      const onError = vi.fn();
      const maxSize = 100; // 100 bytes
      const { container } = render(
        <UploadButton maxSize={maxSize} onSelect={onSelect} onError={onError} />,
      );
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;

      const file = new File(["x".repeat(200)], "test.txt", {
        type: "text/plain",
      });
      Object.defineProperty(input, "files", {
        value: [file],
        writable: false,
      });

      fireEvent.change(input);

      expect(onSelect).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledOnce();
      const error = onError.mock.calls[0][0] as FileValidationError;
      expect(error).toBeInstanceOf(FileValidationError);
      expect(error.code).toBe("FILE_TOO_LARGE");
      expect(error.file).toBe(file);
    });

    it("should handle mixed valid and invalid files by size", () => {
      const onSelect = vi.fn();
      const onError = vi.fn();
      const maxSize = 100;
      const { container } = render(
        <UploadButton multiple maxSize={maxSize} onSelect={onSelect} onError={onError} />,
      );
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;

      const validFile = new File(["x".repeat(50)], "valid.txt", {
        type: "text/plain",
      });
      const invalidFile = new File(["x".repeat(200)], "invalid.txt", {
        type: "text/plain",
      });
      Object.defineProperty(input, "files", {
        value: [validFile, invalidFile],
        writable: false,
      });

      fireEvent.change(input);

      expect(onSelect).toHaveBeenCalledWith([validFile]);
      expect(onError).toHaveBeenCalledOnce();
      const error = onError.mock.calls[0][0] as FileValidationError;
      expect(error.file).toBe(invalidFile);
    });
  });

  describe("File Type Validation", () => {
    it("should accept files matching exact MIME type", () => {
      const onSelect = vi.fn();
      const onError = vi.fn();
      const { container } = render(
        <UploadButton accept="text/plain" onSelect={onSelect} onError={onError} />,
      );
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;

      const file = new File(["content"], "test.txt", { type: "text/plain" });
      Object.defineProperty(input, "files", {
        value: [file],
        writable: false,
      });

      fireEvent.change(input);

      expect(onSelect).toHaveBeenCalledWith([file]);
      expect(onError).not.toHaveBeenCalled();
    });

    it("should accept files matching wildcard MIME type", () => {
      const onSelect = vi.fn();
      const onError = vi.fn();
      const { container } = render(
        <UploadButton accept="image/*" onSelect={onSelect} onError={onError} />,
      );
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;

      const file = new File(["content"], "test.jpg", { type: "image/jpeg" });
      Object.defineProperty(input, "files", {
        value: [file],
        writable: false,
      });

      fireEvent.change(input);

      expect(onSelect).toHaveBeenCalledWith([file]);
      expect(onError).not.toHaveBeenCalled();
    });

    it("should accept files matching file extension", () => {
      const onSelect = vi.fn();
      const onError = vi.fn();
      const { container } = render(
        <UploadButton accept=".pdf" onSelect={onSelect} onError={onError} />,
      );
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;

      const file = new File(["content"], "test.pdf", {
        type: "application/pdf",
      });
      Object.defineProperty(input, "files", {
        value: [file],
        writable: false,
      });

      fireEvent.change(input);

      expect(onSelect).toHaveBeenCalledWith([file]);
      expect(onError).not.toHaveBeenCalled();
    });

    it("should accept files matching multiple patterns", () => {
      const onSelect = vi.fn();
      const onError = vi.fn();
      const { container } = render(
        <UploadButton accept=".pdf,.doc,image/*" onSelect={onSelect} onError={onError} />,
      );
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;

      const pdfFile = new File(["content"], "test.pdf", {
        type: "application/pdf",
      });
      const imageFile = new File(["content"], "test.jpg", {
        type: "image/jpeg",
      });
      Object.defineProperty(input, "files", {
        value: [pdfFile, imageFile],
        writable: false,
      });

      fireEvent.change(input);

      expect(onSelect).toHaveBeenCalledWith([pdfFile, imageFile]);
      expect(onError).not.toHaveBeenCalled();
    });

    it("should reject files not matching accept pattern", () => {
      const onSelect = vi.fn();
      const onError = vi.fn();
      const { container } = render(
        <UploadButton accept="image/*" onSelect={onSelect} onError={onError} />,
      );
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;

      const file = new File(["content"], "test.txt", { type: "text/plain" });
      Object.defineProperty(input, "files", {
        value: [file],
        writable: false,
      });

      fireEvent.change(input);

      expect(onSelect).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledOnce();
      const error = onError.mock.calls[0][0] as FileValidationError;
      expect(error).toBeInstanceOf(FileValidationError);
      expect(error.code).toBe("INVALID_FILE_TYPE");
      expect(error.file).toBe(file);
    });

    it("should handle mixed valid and invalid files by type", () => {
      const onSelect = vi.fn();
      const onError = vi.fn();
      const { container } = render(
        <UploadButton multiple accept="image/*" onSelect={onSelect} onError={onError} />,
      );
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;

      const validFile = new File(["content"], "test.jpg", {
        type: "image/jpeg",
      });
      const invalidFile = new File(["content"], "test.txt", {
        type: "text/plain",
      });
      Object.defineProperty(input, "files", {
        value: [validFile, invalidFile],
        writable: false,
      });

      fireEvent.change(input);

      expect(onSelect).toHaveBeenCalledWith([validFile]);
      expect(onError).toHaveBeenCalledOnce();
      const error = onError.mock.calls[0][0] as FileValidationError;
      expect(error.file).toBe(invalidFile);
    });

    it("should be case-insensitive for file extensions", () => {
      const onSelect = vi.fn();
      const onError = vi.fn();
      const { container } = render(
        <UploadButton accept=".PDF" onSelect={onSelect} onError={onError} />,
      );
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;

      const file = new File(["content"], "test.pdf", {
        type: "application/pdf",
      });
      Object.defineProperty(input, "files", {
        value: [file],
        writable: false,
      });

      fireEvent.change(input);

      expect(onSelect).toHaveBeenCalledWith([file]);
      expect(onError).not.toHaveBeenCalled();
    });
  });

  describe("Combined Validation", () => {
    it("should validate both size and type", () => {
      const onSelect = vi.fn();
      const onError = vi.fn();
      const { container } = render(
        <UploadButton accept="image/*" maxSize={1024} onSelect={onSelect} onError={onError} />,
      );
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;

      const validFile = new File(["x".repeat(512)], "valid.jpg", {
        type: "image/jpeg",
      });
      const invalidTypeFile = new File(["x".repeat(512)], "invalid.txt", {
        type: "text/plain",
      });
      const invalidSizeFile = new File(["x".repeat(2000)], "large.jpg", {
        type: "image/jpeg",
      });

      Object.defineProperty(input, "files", {
        value: [validFile, invalidTypeFile, invalidSizeFile],
        writable: false,
      });

      fireEvent.change(input);

      expect(onSelect).toHaveBeenCalledWith([validFile]);
      expect(onError).toHaveBeenCalledTimes(2);
    });
  });

  describe("Input Attributes", () => {
    it("should set accept attribute on input", () => {
      const { container } = render(<UploadButton accept="image/*" />);
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;
      expect(input.accept).toBe("image/*");
    });

    it("should set multiple attribute on input", () => {
      const { container } = render(<UploadButton multiple />);
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;
      expect(input.multiple).toBe(true);
    });

    it("should not set multiple attribute when false", () => {
      const { container } = render(<UploadButton multiple={false} />);
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;
      expect(input.multiple).toBe(false);
    });
  });

  describe("Edge Cases", () => {
    it("should handle files with no type", () => {
      const onSelect = vi.fn();
      const { container } = render(<UploadButton onSelect={onSelect} />);
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;

      const file = new File(["content"], "test", { type: "" });
      Object.defineProperty(input, "files", {
        value: [file],
        writable: false,
      });

      fireEvent.change(input);

      expect(onSelect).toHaveBeenCalledWith([file]);
    });

    it("should handle empty file name", () => {
      const onSelect = vi.fn();
      const { container } = render(<UploadButton onSelect={onSelect} />);
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;

      const file = new File(["content"], "", { type: "text/plain" });
      Object.defineProperty(input, "files", {
        value: [file],
        writable: false,
      });

      fireEvent.change(input);

      expect(onSelect).toHaveBeenCalledWith([file]);
    });

    it("should handle zero-size files", () => {
      const onSelect = vi.fn();
      const { container } = render(<UploadButton onSelect={onSelect} />);
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;

      const file = new File([], "empty.txt", { type: "text/plain" });
      Object.defineProperty(input, "files", {
        value: [file],
        writable: false,
      });

      fireEvent.change(input);

      expect(onSelect).toHaveBeenCalledWith([file]);
    });
  });
});
