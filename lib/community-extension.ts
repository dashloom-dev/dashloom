import { z } from 'zod';
import { AGENT_SKILL_POLICY_VERSION, agentSkillManifestSchema, validateAgentSkillPolicy } from './agent-skill-validation.ts';

const githubLogin = z.string().trim().regex(/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/);
const commitSha = z.string().trim().regex(/^[a-f0-9]{40}$/);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}, 'Invalid review date');

export const communitySkillSubmissionSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal('agent_skill'),
  publisher: z.object({ name: z.string().trim().min(2).max(100), github: githubLogin }).strict(),
  summary: z.string().trim().min(20).max(300),
  license: z.string().trim().regex(/^[A-Za-z0-9-.+]{2,40}$/),
  source: z.object({ repository: z.string().url().refine((value) => /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/.test(value), 'Source must be a GitHub repository URL'), commit: commitSha }).strict(),
  manifest: agentSkillManifestSchema,
}).strict();

export const communityReviewSchema = z.object({
  schemaVersion: z.literal(1),
  submissionSlug: z.string().regex(/^[a-z][a-z0-9-]{1,63}$/),
  reviewerGithub: githubLogin,
  pullRequest: z.number().int().positive(),
  reviewedCommit: commitSha,
  reviewedAt: isoDate,
  policyVersion: z.literal(AGENT_SKILL_POLICY_VERSION),
  checks: z.object({ identity: z.literal(true), source: z.literal(true), license: z.literal(true), permissions: z.literal(true), policy: z.literal(true), tests: z.literal(true) }).strict(),
  notes: z.string().trim().min(10).max(1000),
}).strict();

export type CommunitySkillSubmission = z.infer<typeof communitySkillSubmissionSchema>;
export type CommunityReview = z.infer<typeof communityReviewSchema>;

export function validateCommunitySubmission(value: unknown) {
  const submission = communitySkillSubmissionSchema.parse(value);
  const issues = validateAgentSkillPolicy(submission.manifest);
  if (issues.length) throw new Error(issues.map((issue) => `${issue.code}: ${issue.message}`).join('; '));
  if (submission.manifest.slug !== submission.manifest.slug.toLowerCase()) throw new Error('Manifest slug must be lowercase.');
  return submission;
}

export function validateCommunityReview(submission: CommunitySkillSubmission, value: unknown) {
  const review = communityReviewSchema.parse(value);
  if (review.submissionSlug !== submission.manifest.slug) throw new Error('Review submissionSlug does not match the submitted manifest.');
  if (review.reviewedCommit !== submission.source.commit) throw new Error('Review must attest the exact submitted source commit.');
  if (review.reviewerGithub.toLowerCase() === submission.publisher.github.toLowerCase()) throw new Error('Publisher cannot independently review their own extension.');
  return review;
}
