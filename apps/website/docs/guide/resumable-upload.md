# Resumable Upload

ChunkFlow automatically saves upload progress and can resume from where it left off.

## How It Works

Upload progress is persisted to IndexedDB after each successful chunk upload. When the page reloads or the user returns, ChunkFlow can resume from the last saved state.

## Automatic Resume

```typescript
const manager = new UploadManager({
  requestAdapter: adapter,
  autoResumeUnfinished: true, // Default: true
});

await manager.init(); // Automatically resumes unfinished uploads
```

## Manual Pause/Resume

```typescript
const task = manager.createTask(file);
await task.start();

// Pause
task.pause();

// Resume later
await task.resume();
```

## Progress Persistence

Progress is saved to IndexedDB:

```typescript
interface UploadRecord {
  taskId: string;
  fileInfo: FileInfo;
  uploadedChunks: number[];
  uploadToken: string;
  createdAt: number;
  updatedAt: number;
}
```

## Best Practices

1. Enable auto-resume for better UX
2. Show resume UI for paused uploads
3. Handle storage quota errors gracefully
4. Clean up old records periodically

## See Also

- [Upload Strategies](/guide/upload-strategies)
- [Error Handling](/guide/error-handling)
