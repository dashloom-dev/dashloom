export function ingestionScopeAllowsProducts(scopedProductId: string | null, requestedProductIds: readonly string[]) {
  if (!requestedProductIds.length) return false;
  return scopedProductId === null || requestedProductIds.every((productId) => productId === scopedProductId);
}
