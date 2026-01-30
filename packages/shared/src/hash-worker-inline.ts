/**
 * Inline Web Worker code for hash calculation
 * This will be bundled with SparkMD5 by tsdown
 */

import SparkMD5 from "spark-md5";

// Worker message handler
self.onmessage = async (e: MessageEvent) => {
  const { type, fileData, chunkSize, totalSize } = e.data;

  if (type === "hash") {
    try {
      const spark = new SparkMD5.ArrayBuffer();
      const chunks = Math.ceil(totalSize / chunkSize);
      let currentChunk = 0;

      // Process the file data in chunks
      while (currentChunk < chunks) {
        const start = currentChunk * chunkSize;
        const end = Math.min(start + chunkSize, totalSize);
        const chunk = fileData.slice(start, end);

        spark.append(chunk);
        currentChunk++;

        // Report progress
        const progress = (currentChunk / chunks) * 100;
        self.postMessage({
          type: "progress",
          progress: Math.min(progress, 100),
        });

        // Yield to allow other operations
        if (currentChunk % 10 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }

      const hash = spark.end();

      // Send result back to main thread
      self.postMessage({
        type: "result",
        hash,
      });
    } catch (error) {
      // Send error back to main thread
      self.postMessage({
        type: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
};
