# Dynamic Chunking

ChunkFlow dynamically adjusts chunk size based on network performance, similar to TCP slow start.

## Algorithm

- **Fast upload** (< 50% of target time) → Increase chunk size
- **Slow upload** (> 150% of target time) → Decrease chunk size
- **Normal upload** → Keep current size

## Configuration

```typescript
const task = manager.createTask(file, {
  chunkSize: 1024 * 1024, // Initial: 1MB
  // Min: 256KB, Max: 10MB (automatic)
});
```

## Benefits

- Adapts to network conditions
- Optimizes upload speed
- Reduces retry overhead
- Better resource utilization

## See Also

- [Upload Strategies](/guide/upload-strategies)
- [Performance](/guide/performance)
