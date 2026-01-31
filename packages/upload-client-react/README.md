# @chunkflowjs/upload-client-react

React adapter for ChunkFlow Upload SDK with hooks and context providers.

## Installation

```bash
pnpm add @chunkflowjs/upload-client-react
```

## Usage

```tsx
import { UploadProvider, useUpload } from "@chunkflowjs/upload-client-react";

function App() {
  return (
    <UploadProvider requestAdapter={adapter}>
      <UploadComponent />
    </UploadProvider>
  );
}
```

## License

MIT
