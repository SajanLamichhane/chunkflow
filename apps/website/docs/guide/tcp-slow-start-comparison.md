# TCP Slow Start Comparison

This document compares ChunkFlow's current chunk size adjustment algorithm with the actual TCP slow start algorithm.

## Current Implementation

ChunkFlow's `ChunkSizeAdjuster` uses a simplified algorithm:

```typescript
adjust(uploadTimeMs: number): number {
  const { targetTime, minSize, maxSize } = this.options;

  // Fast upload: double chunk size
  if (uploadTimeMs < targetTime * 0.5) {
    this.currentSize = Math.min(this.currentSize * 2, maxSize);
  }
  // Slow upload: halve chunk size
  else if (uploadTimeMs > targetTime * 1.5) {
    this.currentSize = Math.max(this.currentSize / 2, minSize);
  }
  // Normal: keep current size

  return this.currentSize;
}
```

### Characteristics

- **Simple binary decision**: Fast → double, Slow → halve
- **No state machine**: Always uses the same logic
- **No threshold**: No distinction between growth phases
- **Aggressive**: Always exponential growth/reduction

## TCP Slow Start Algorithm

TCP's congestion control has multiple phases:

### 1. Slow Start Phase

- **Initial window**: Starts small (typically 1-10 MSS)
- **Growth**: Exponential - doubles every RTT
- **Trigger**: Continues until reaching `ssthresh` (slow start threshold)
- **Formula**: `cwnd += MSS` for each ACK received

### 2. Congestion Avoidance Phase

- **Trigger**: When `cwnd >= ssthresh`
- **Growth**: Linear - increases by 1 MSS per RTT
- **Formula**: `cwnd += MSS * MSS / cwnd` per ACK
- **Purpose**: More conservative growth to avoid congestion

### 3. Fast Recovery Phase

- **Trigger**: When packet loss detected (3 duplicate ACKs)
- **Action**: 
  - Set `ssthresh = cwnd / 2`
  - Set `cwnd = ssthresh`
  - Enter congestion avoidance
- **Purpose**: Quick recovery without full restart

## Key Differences

| Aspect | Current Implementation | TCP Slow Start |
|--------|----------------------|----------------|
| **States** | None (stateless) | 3 states (Slow Start, Congestion Avoidance, Fast Recovery) |
| **Threshold** | None | `ssthresh` determines phase transition |
| **Growth** | Always exponential (2x) | Exponential → Linear transition |
| **Reduction** | Always halve (0.5x) | Halve and enter recovery state |
| **Complexity** | Simple | More sophisticated |
| **Adaptability** | Binary (fast/slow) | Gradual with state awareness |

## Improved TCP-Like Implementation

We've created an improved implementation in `chunk-size-adjuster-tcp.ts`:

```typescript
enum CongestionState {
  SLOW_START = 'slow_start',
  CONGESTION_AVOIDANCE = 'congestion_avoidance',
  FAST_RECOVERY = 'fast_recovery',
}

class TCPChunkSizeAdjuster {
  private currentSize: number;
  private ssthresh: number;  // Slow start threshold
  private state: CongestionState;

  adjust(uploadTimeMs: number): number {
    const ratio = uploadTimeMs / targetTime;

    if (ratio < 0.5) {
      // Fast upload
      this.handleFastUpload();
    } else if (ratio > 1.5) {
      // Slow upload (congestion)
      this.handleSlowUpload();
    }

    return this.currentSize;
  }

  private handleFastUpload(): void {
    switch (this.state) {
      case CongestionState.SLOW_START:
        // Exponential growth
        const newSize = this.currentSize * 2;
        if (newSize >= this.ssthresh) {
          this.currentSize = this.ssthresh;
          this.state = CongestionState.CONGESTION_AVOIDANCE;
        } else {
          this.currentSize = newSize;
        }
        break;

      case CongestionState.CONGESTION_AVOIDANCE:
        // Linear growth (10% increment)
        const increment = Math.floor(this.currentSize * 0.1);
        this.currentSize += increment;
        break;

      case CongestionState.FAST_RECOVERY:
        // Exit recovery
        this.state = CongestionState.CONGESTION_AVOIDANCE;
        break;
    }
  }

  private handleSlowUpload(): void {
    // Congestion detected
    this.ssthresh = Math.floor(this.currentSize / 2);
    this.currentSize = this.ssthresh;
    this.state = CongestionState.FAST_RECOVERY;
  }
}
```

## Advantages of TCP-Like Approach

### 1. Gradual Growth

Instead of always doubling, the algorithm transitions from exponential to linear growth:

- **Early stage**: Fast exponential growth to find optimal size quickly
- **Later stage**: Conservative linear growth to avoid overshooting

### 2. Better Congestion Handling

When congestion is detected:

- Sets a threshold based on current performance
- Reduces size but remembers the threshold
- Avoids repeated overshooting

### 3. State Awareness

The algorithm "remembers" past performance:

- Knows if it's in exploration phase (slow start)
- Knows if it's in optimization phase (congestion avoidance)
- Knows if it's recovering from congestion

### 4. More Stable

Reduces oscillation between extreme values:

- Current: 1MB → 2MB → 4MB → 2MB → 4MB → 2MB (oscillating)
- TCP-like: 1MB → 2MB → 4MB → 5MB → 5.5MB → 6MB (stable growth)

## Performance Comparison

### Scenario 1: Fast Network

**Current Implementation**:
```
1MB → 2MB → 4MB → 8MB → 10MB (max)
```
- Reaches max in 4 steps
- May overshoot optimal size

**TCP-Like Implementation**:
```
1MB → 2MB → 4MB (ssthresh) → 4.4MB → 4.8MB → 5.3MB
```
- More gradual approach to optimal size
- Less likely to cause congestion

### Scenario 2: Variable Network

**Current Implementation**:
```
1MB → 2MB → 1MB → 2MB → 1MB (oscillating)
```
- Unstable, keeps oscillating

**TCP-Like Implementation**:
```
1MB → 2MB → 1MB (ssthresh) → 1.1MB → 1.2MB (stable)
```
- Finds stable point
- Remembers threshold

### Scenario 3: Degrading Network

**Current Implementation**:
```
4MB → 2MB → 4MB → 2MB (no learning)
```
- Doesn't learn from congestion

**TCP-Like Implementation**:
```
4MB → 2MB (ssthresh) → 2.2MB → 1MB (ssthresh) → 1.1MB
```
- Adapts threshold based on experience
- More conservative after congestion

## When to Use Each

### Current Implementation (Simple)

**Pros**:
- Simple to understand
- Low overhead
- Works well for stable networks

**Cons**:
- Can oscillate on variable networks
- No learning from past performance
- May overshoot optimal size

**Best for**:
- Stable network conditions
- Simple use cases
- When simplicity is preferred

### TCP-Like Implementation

**Pros**:
- More stable on variable networks
- Learns from past performance
- Better congestion handling
- Closer to proven TCP algorithm

**Cons**:
- More complex
- Slightly higher overhead
- Requires tuning ssthresh

**Best for**:
- Variable network conditions
- Production environments
- When stability is critical
- Large file uploads

## Recommendation

For ChunkFlow, we recommend:

1. **Keep current implementation as default** for simplicity
2. **Offer TCP-like implementation as option** for advanced users
3. **Add configuration** to choose between algorithms:

```typescript
const manager = new UploadManager({
  requestAdapter: adapter,
  chunkSizeStrategy: 'simple', // or 'tcp-like'
  chunkSizeOptions: {
    initialSize: 1024 * 1024,
    minSize: 256 * 1024,
    maxSize: 10 * 1024 * 1024,
    // TCP-like specific options
    initialSsthresh: 5 * 1024 * 1024,
  },
});
```

## Conclusion

While ChunkFlow's current implementation is **inspired by** TCP slow start, it's a **simplified version** that captures the core idea (exponential growth when fast, reduction when slow) but lacks the sophistication of the full TCP algorithm.

The TCP-like implementation provides better stability and adaptability at the cost of increased complexity. Both have their place depending on the use case.

## See Also

- [Dynamic Chunking Guide](/guide/dynamic-chunking)
- [Performance Optimization](/guide/performance)
- [TCP Congestion Control (RFC 5681)](https://tools.ietf.org/html/rfc5681)
