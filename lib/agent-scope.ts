export type AgentProductScope = { mode: 'workspace' | 'product'; productId: string | null };
export type AgentScopeReadiness = Record<string, Record<string, boolean>>;

export function normalizeAgentProductScope(scope: AgentProductScope): AgentProductScope {
  return scope.mode === 'workspace' ? { mode: 'workspace', productId: null } : { mode: 'product', productId: scope.productId };
}

/** Existing conversations own their scope; request bodies cannot silently widen or switch it. */
export function resolveAgentProductScope(requestedProductId: string | null | undefined, conversationScope?: AgentProductScope): AgentProductScope {
  if (conversationScope) return normalizeAgentProductScope(conversationScope);
  return requestedProductId ? { mode: 'product', productId: requestedProductId } : { mode: 'workspace', productId: null };
}

export function agentScopeLabel(scope: AgentProductScope, products: Array<{ id: string; name: string }>) {
  if (scope.mode === 'workspace') return 'All products';
  if (!scope.productId) return 'Removed product';
  return products.find((product) => product.id === scope.productId)?.name || 'Selected product';
}

export function isAgentScopeReady(readinessByScope: AgentScopeReadiness, productId: string | null | undefined, preset: string) {
  return Boolean(readinessByScope[productId || 'workspace']?.[preset]);
}
