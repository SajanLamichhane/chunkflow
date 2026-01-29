/**
 * Test setup file for mocking browser APIs in Node.js environment
 * This file provides FileReader mock for hash calculation tests
 */

import { vi } from "vitest";
import "fake-indexeddb/auto";

// Mock FileReader for Node.js environment
if (typeof FileReader === "undefined") {
  class MockFileReader {
    result: ArrayBuffer | string | null = null;
    error: Error | null = null;
    readyState: number = 0;
    onload: ((event: ProgressEvent) => void) | null = null;
    onerror: ((event: ProgressEvent) => void) | null = null;
    onprogress: ((event: ProgressEvent) => void) | null = null;

    readAsArrayBuffer(blob: Blob): void {
      this.readyState = 1; // LOADING

      // Simulate async reading
      setTimeout(() => {
        // Convert blob to ArrayBuffer
        blob
          .arrayBuffer()
          .then((buffer) => {
            this.result = buffer;
            this.readyState = 2; // DONE

            if (this.onload) {
              const event = {
                target: this,
                loaded: buffer.byteLength,
                total: buffer.byteLength,
              } as ProgressEvent;
              this.onload(event);
            }
          })
          .catch((error) => {
            this.error = error as Error;
            this.readyState = 2; // DONE

            if (this.onerror) {
              const event = {
                target: this,
              } as ProgressEvent;
              this.onerror(event);
            }
          });
      }, 0);
    }

    readAsText(blob: Blob): void {
      this.readyState = 1; // LOADING

      setTimeout(() => {
        blob
          .text()
          .then((text) => {
            this.result = text;
            this.readyState = 2; // DONE

            if (this.onload) {
              const event = {
                target: this,
                loaded: text.length,
                total: text.length,
              } as ProgressEvent;
              this.onload(event);
            }
          })
          .catch((error) => {
            this.error = error as Error;
            this.readyState = 2; // DONE

            if (this.onerror) {
              const event = {
                target: this,
              } as ProgressEvent;
              this.onerror(event);
            }
          });
      }, 0);
    }

    abort(): void {
      this.readyState = 2; // DONE
    }
  }

  // Add FileReader to global scope
  (global as any).FileReader = MockFileReader;
}
