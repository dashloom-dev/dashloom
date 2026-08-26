import { z } from 'zod';

export const AGENT_SKILL_POLICY_VERSION = 1;

export const agentSkillManifestSchema = z.object({
  slug: z.string().trim().regex(/^[a-z][a-z0-9-]{1,63}$/),
  name: z.string().trim().min(2).max(100),
  version: z.string().trim().regex(/^\d+\.\d+\.\d+$/),
  basePreset: z.enum(['portfolio_analyst', 'revenue_analyst', 'seo_growth_analyst', 'operations_analyst', 'client_reporting_analyst']),
  instructions: z.string().trim().min(10).max(2000),
  requiredMetrics: z.array(z.string().regex(/^[a-z][a-z0-9_]{1,79}$/)).max(40).default([]),
}).strict();

export type AgentSkillManifest = z.infer<typeof agentSkillManifestSchema>;
export type AgentSkillPolicyIssue = { code: string; message: string };

const unsafeInstructionPatterns: Array<[string, RegExp, string]> = [
  ['instruction_override', /\b(ignore|disregard|override|replace)\b.{0,50}\b(previous|system|platform|developer|safety|instruction|rule)s?\b/i, 'Skill guidance cannot override platform or evidence instructions.'],
  ['secret_access', /\b(reveal|expose|return|print|read|extract)\b.{0,50}\b(secret|credential|password|api[ _-]?key|token)s?\b/i, 'Skills cannot request credentials or secrets.'],
  ['external_execution', /\b(call|invoke|execute|run|fetch|browse|request)\b.{0,40}\b(tool|function|command|shell|url|endpoint|api)s?\b/i, 'Skills cannot call tools, commands, URLs, or external APIs.'],
  ['embedded_url', /https?:\/\//i, 'Skill instructions cannot embed remote URLs.'],
  ['prompt_exfiltration', /\b(system prompt|hidden prompt|chain of thought|internal instruction)s?\b/i, 'Skills cannot request hidden prompts or internal reasoning.'],
  ['instruction_override_zh', /(忽略|覆盖|替换).{0,20}(系统|平台|安全|指令|规则)/, 'Skill 不能覆盖平台或证据规则。'],
  ['secret_access_zh', /(泄露|输出|读取|提取).{0,20}(密钥|密码|凭证|令牌)/, 'Skill 不能请求凭证或密钥。'],
];

export function validateAgentSkillPolicy(manifest: AgentSkillManifest) {
  const issues: AgentSkillPolicyIssue[] = [];
  for (const [code, pattern, message] of unsafeInstructionPatterns) if (pattern.test(manifest.instructions)) issues.push({ code, message });
  if (new Set(manifest.requiredMetrics).size !== manifest.requiredMetrics.length) issues.push({ code: 'duplicate_metrics', message: 'Required metrics must be unique.' });
  return issues;
}

export function compareSemanticVersions(left: string, right: string) {
  const leftParts = left.split('.').map(Number); const rightParts = right.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) if (leftParts[index] !== rightParts[index]) return leftParts[index] - rightParts[index];
  return 0;
}

export async function agentSkillInstructionHash(instructions: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(instructions.trim()));
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}
