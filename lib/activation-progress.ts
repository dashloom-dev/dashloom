export type ActivationInput = {
  productCount: number;
  sourceReady: boolean;
  recentEvidenceCount: number;
  modelReady: boolean;
  successfulAnalysisCount: number;
  actedOnFindingCount: number;
  reportScheduleCount: number;
};

export type ActivationMilestone = {
  id: 'product' | 'source' | 'evidence' | 'model' | 'analysis' | 'action' | 'report';
  title: string;
  description: string;
  href: string;
  complete: boolean;
  state: 'complete' | 'current' | 'upcoming';
};

export type FirstValueStep = {
  id: 'product' | 'data' | 'analysis';
  title: string;
  description: string;
  href: string;
  action: string;
  complete: boolean;
  state: 'complete' | 'current' | 'upcoming';
};

const definitions: Array<Omit<ActivationMilestone, 'complete' | 'state'> & { isComplete: (input: ActivationInput) => boolean }> = [
  { id: 'product', title: 'Add a real product', description: 'Define the product whose signals the Agent should understand.', href: '/dashboard/products', isComplete: (input) => input.productCount > 0 },
  { id: 'source', title: 'Map or import a source', description: 'Connect a provider resource or use authenticated ingestion.', href: '/dashboard/sources', isComplete: (input) => input.sourceReady || input.recentEvidenceCount > 0 },
  { id: 'evidence', title: 'Collect recent evidence', description: 'Store at least one real metric point from the last 14 days.', href: '/dashboard/products', isComplete: (input) => input.recentEvidenceCount > 0 },
  { id: 'model', title: 'Enable an AI model', description: 'Connect BYOK AI or use an available managed allowance.', href: '/dashboard/agent#ai-provider', isComplete: (input) => input.modelReady },
  { id: 'analysis', title: 'Run the Agent', description: 'Create the first evidence-linked specialist analysis.', href: '/dashboard/agent', isComplete: (input) => input.successfulAnalysisCount > 0 },
  { id: 'action', title: 'Plan an Agent action', description: 'Turn a finding into an owned, trackable next move.', href: '/dashboard/actions', isComplete: (input) => input.actedOnFindingCount > 0 },
  { id: 'report', title: 'Schedule the loop', description: 'Enable a daily, weekly, or monthly recurring report.', href: '/dashboard/reports', isComplete: (input) => input.reportScheduleCount > 0 },
];

export function buildActivationProgress(input: ActivationInput) {
  const completion = definitions.map((definition) => definition.isComplete(input));
  const firstIncomplete = completion.findIndex((complete) => !complete);
  const milestones: ActivationMilestone[] = definitions.map((definition, index) => ({
    id: definition.id,
    title: definition.title,
    description: definition.description,
    href: definition.href,
    complete: completion[index],
    state: completion[index] ? 'complete' : index === firstIncomplete ? 'current' : 'upcoming',
  }));
  const completed = completion.filter(Boolean).length;
  return { milestones, completed, total: milestones.length, next: milestones.find((milestone) => milestone.state === 'current') || null, activated: completed === milestones.length };
}

export function buildFirstValueGuide(input: Pick<ActivationInput, 'productCount' | 'sourceReady' | 'recentEvidenceCount' | 'modelReady' | 'successfulAnalysisCount'>) {
  const definitions: Array<Omit<FirstValueStep, 'complete' | 'state'> & { complete: boolean }> = [
    { id: 'product', title: 'Create your first product', description: 'Name the real product whose performance you want Dashloom to understand.', href: '/dashboard/products', action: 'Create product', complete: input.productCount > 0 },
    { id: 'data', title: 'Connect real data', description: input.sourceReady && input.recentEvidenceCount === 0 ? 'Your source is connected. Run its first sync so Dashloom has current evidence.' : 'Map a provider, import metrics, or create a scoped ingestion key.', href: '/dashboard/sources', action: input.sourceReady && input.recentEvidenceCount === 0 ? 'Sync connected source' : 'Connect data', complete: input.recentEvidenceCount > 0 },
    { id: 'analysis', title: 'See your first analysis', description: input.modelReady ? 'Ask a specialist Agent to explain what changed and cite the underlying evidence.' : 'Enable an AI model, then run a specialist Agent against the evidence you collected.', href: input.modelReady ? '/dashboard/agent' : '/dashboard/agent#ai-provider', action: input.modelReady ? 'Run first analysis' : 'Enable AI model', complete: input.successfulAnalysisCount > 0 },
  ];
  const firstIncomplete = definitions.findIndex((step) => !step.complete);
  const steps: FirstValueStep[] = definitions.map((step, index) => ({ ...step, state: step.complete ? 'complete' : index === firstIncomplete ? 'current' : 'upcoming' }));
  const completed = steps.filter((step) => step.complete).length;
  return { steps, completed, total: steps.length, next: steps.find((step) => step.state === 'current') || null, complete: completed === steps.length };
}
