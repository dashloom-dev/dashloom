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
  { id: 'product', title: 'Add a product', description: 'Enter the name and domain of a product you run.', href: '/dashboard/products', isComplete: (input) => input.productCount > 0 },
  { id: 'source', title: 'Connect a data source', description: 'Connect an account, import a file, or use the Metrics API.', href: '/dashboard/sources', isComplete: (input) => input.sourceReady || input.recentEvidenceCount > 0 },
  { id: 'evidence', title: 'Import current data', description: 'Import at least one metric dated within the last 14 days.', href: '/dashboard/products', isComplete: (input) => input.recentEvidenceCount > 0 },
  { id: 'model', title: 'Enable an AI model', description: 'Connect BYOK AI or use an available managed allowance.', href: '/dashboard/agent#ai-provider', isComplete: (input) => input.modelReady },
  { id: 'analysis', title: 'Create a report', description: 'Generate the first report from your imported data.', href: '/dashboard/agent', isComplete: (input) => input.successfulAnalysisCount > 0 },
  { id: 'action', title: 'Assign a task', description: 'Give one report item an owner or mark it as in progress.', href: '/dashboard/actions', isComplete: (input) => input.actedOnFindingCount > 0 },
  { id: 'report', title: 'Schedule a report', description: 'Choose a daily, weekly, or monthly delivery schedule.', href: '/dashboard/reports', isComplete: (input) => input.reportScheduleCount > 0 },
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
    { id: 'product', title: 'Add your first product', description: 'Enter its name and domain.', href: '/dashboard/products', action: 'Add product', complete: input.productCount > 0 },
    { id: 'data', title: 'Connect a data source', description: input.sourceReady && input.recentEvidenceCount === 0 ? 'The connection is ready. Run the first sync to import data.' : 'Connect an account, import a CSV, or create a Metrics API key.', href: '/dashboard/sources', action: input.sourceReady && input.recentEvidenceCount === 0 ? 'Sync connected source' : 'Connect data', complete: input.recentEvidenceCount > 0 },
    { id: 'analysis', title: 'Create your first report', description: input.modelReady ? 'Generate a report from the data you imported.' : 'Choose an AI model, then generate the first report.', href: input.modelReady ? '/dashboard/agent' : '/dashboard/agent#ai-provider', action: input.modelReady ? 'Run first analysis' : 'Enable AI model', complete: input.successfulAnalysisCount > 0 },
  ];
  const firstIncomplete = definitions.findIndex((step) => !step.complete);
  const steps: FirstValueStep[] = definitions.map((step, index) => ({ ...step, state: step.complete ? 'complete' : index === firstIncomplete ? 'current' : 'upcoming' }));
  const completed = steps.filter((step) => step.complete).length;
  return { steps, completed, total: steps.length, next: steps.find((step) => step.state === 'current') || null, complete: completed === steps.length };
}
