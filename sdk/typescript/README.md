# @dashloom/client

Zero-dependency TypeScript client for Dashloom's normalized metric ingestion API. Copy `src/index.ts` into an integration or import the local package while developing.

```ts
import { DashloomClient } from '@dashloom/client';

const dashloom = new DashloomClient({ baseUrl: 'https://your-dashloom.example', apiKey: process.env.DASHLOOM_API_KEY! });
await dashloom.pushMetrics([{ productId: 'PRODUCT_UUID', source: 'billing', metric: 'mrr', metricDate: '2026-08-26', value: 1299 }]);
```

Keep ingestion keys server-side. Each request accepts 1–1000 rows and is scoped to the key's workspace.
