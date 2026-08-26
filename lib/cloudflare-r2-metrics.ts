export type R2OperationRow = { dimensions?: { actionStatus?: string | null }; sum?: { requests?: number | null } };
export type R2StorageRow = { max?: { objectCount?: number | null; uploadCount?: number | null; payloadSize?: number | null; metadataSize?: number | null } };

function nonNegative(value: number | null | undefined) { return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0; }

export function normalizeR2Day(operations: R2OperationRow[], storage: R2StorageRow[]) {
  let requests = 0; let errors = 0;
  for (const row of operations) {
    const count = nonNegative(row.sum?.requests); requests += count;
    if (row.dimensions?.actionStatus === 'userError' || row.dimensions?.actionStatus === 'internalError') errors += count;
  }
  const stock = storage[0]?.max;
  return { requests, errors, payloadBytes: nonNegative(stock?.payloadSize), metadataBytes: nonNegative(stock?.metadataSize), objects: nonNegative(stock?.objectCount), pendingUploads: nonNegative(stock?.uploadCount) };
}
