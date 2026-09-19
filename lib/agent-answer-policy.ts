type Series = { productId: string; evidenceId: string; currentSamples?: number; previousSamples?: number; dimension?: unknown };

export function observedChange(current: number, previous: number, currentSamples: number, previousSamples: number) {
  return currentSamples > 0 && previousSamples > 0 && previous !== 0 ? ((current - previous) / Math.abs(previous)) * 100 : null;
}

/** Round robin after ranking, so high-volume products cannot consume every slot. */
export function balancedEvidence<T>(items: T[], limit: number, productId: (item: T) => string): T[] {
  const groups = new Map<string, T[]>();
  for (const item of items) { const id = productId(item); const group = groups.get(id) || []; group.push(item); groups.set(id, group); }
  const result: T[] = [];
  for (let index = 0; result.length < limit; index++) {
    let added = false;
    for (const group of groups.values()) {
      if (index < group.length && result.length < limit) { result.push(group[index]); added = true; }
    }
    if (!added) break;
  }
  return result;
}

export function answerLanguage(question: string): 'zh' | 'en' {
  if (/(?:用|使用|请以)英文|(?:answer|respond|reply) in English/i.test(question)) return 'en';
  if (/(?:用|使用|请以)中文|(?:answer|respond|reply) in Chinese/i.test(question)) return 'zh';
  return /[\u3400-\u9fff]/u.test(question) ? 'zh' : 'en';
}

export function productCoverage(products: Array<{ id: string; name: string }>, series: Series[], omittedProducts: string[] = []) {
  return products.map((product) => {
    const records = series.filter((item) => item.productId === product.id && !item.dimension);
    const comparable = records.filter((item) => (item.currentSamples || 0) > 0 && (item.previousSamples || 0) > 0);
    return { ...product, status: omittedProducts.includes(product.id) ? 'limited' : comparable.length ? 'comparable' : records.length ? 'partial' : 'no_data', evidenceRefs: comparable.map((item) => item.evidenceId), aggregateSeriesCount: records.length };
  });
}

/** Discard an overflowing partition rather than invent totals from a partial period. */
export async function loadProductEvidence<T>(ids: string[], totalBudget: number, load: (id: string, limit: number) => Promise<T[]>) {
  const rows: T[] = [];
  let pending = [...ids];
  while (pending.length) {
    const limit = Math.floor((totalBudget - rows.length) / pending.length);
    if (limit < 1) break;
    const overflow: string[] = [];
    for (const id of pending) {
      const records = await load(id, limit + 1);
      if (records.length > limit) overflow.push(id);
      else rows.push(...records);
    }
    const progressed = overflow.length < pending.length;
    pending = overflow;
    if (!progressed) break;
  }
  return { rows, omittedProducts: pending };
}

export function validateAnswerLanguage(result: { summary: string; findings: Array<{ title: string; detail: string; action: string }> }, language: 'zh' | 'en') {
  if (language === 'zh' && [result.summary, ...result.findings.flatMap((item) => [item.title, item.detail, item.action])].some((text) => text.trim() && !/[\u3400-\u9fff]/u.test(text))) {
    throw new Error('Answer language mismatch: write summary, finding titles, details and actions in Chinese; preserve proper names and evidence IDs.');
  }
}

export function validatePortfolioCoverage(result: { findings: Array<{ evidenceRefs: string[] }>; reasoningSummary?: Array<{ evidenceRefs: string[] }> }, coverage: ReturnType<typeof productCoverage>, question: string) {
  if (!/portfolio|across.{0,30}products|all products|组合|全部产品|所有产品|各产品|跨产品|产品之间/i.test(question)) return;
  // A named-product follow-up may deliberately narrow a workspace conversation.
  if (coverage.some((product) => product.name.length > 1 && question.toLowerCase().includes(product.name.toLowerCase()))) return;
  const comparable = coverage.filter((product) => product.status === 'comparable');
  const refs = new Set([...result.findings, ...(result.reasoningSummary || [])].flatMap((item) => item.evidenceRefs));
  const represented = comparable.filter((product) => product.evidenceRefs.some((ref) => refs.has(ref)));
  if (represented.length < Math.min(3, comparable.length)) throw new Error('Portfolio coverage mismatch: compare aggregate evidence from at least three available products (or all if fewer than three); do not substitute one product SEO analysis for a portfolio overview. Use supplied aggregate evidence, never invent missing data.');
}

export function coverageDisclosure(coverage: ReturnType<typeof productCoverage>, language: 'zh' | 'en') {
  const comparable = coverage.filter((item) => item.status === 'comparable');
  const missing = coverage.filter((item) => item.status !== 'comparable');
  return language === 'zh'
    ? `分析范围：全部 ${coverage.length} 个产品；其中 ${comparable.length} 个产品有两期可比较的汇总数据${comparable.length ? `（${comparable.map((item) => item.name).join('、')}）` : ''}。${missing.length ? `缺少完整对比数据或取数受限：${missing.map((item) => item.name).join('、')}。不能据此判断这些产品没有变化。` : ''}`
    : `Scope: all ${coverage.length} products; ${comparable.length} have aggregate data in both periods${comparable.length ? ` (${comparable.map((item) => item.name).join(', ')})` : ''}.${missing.length ? ` Incomplete or limited comparison data: ${missing.map((item) => item.name).join(', ')}. Missing data does not mean no change.` : ''}`;
}
