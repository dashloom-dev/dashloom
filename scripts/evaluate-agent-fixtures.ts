import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { evaluateAgentOutput, type EvaluationOutput, type GoldenCase } from '../lib/agent-evaluation.ts';

const root = process.cwd();
const outputPath = resolve(root, process.argv[2] || 'evals/reference-outputs.json');
const cases = JSON.parse(await readFile(resolve(root, 'evals/agent-golden-cases.json'), 'utf8')) as GoldenCase[];
const outputs = JSON.parse(await readFile(outputPath, 'utf8')) as Record<string, EvaluationOutput>;
const results = cases.map((goldenCase) => outputs[goldenCase.id]
  ? evaluateAgentOutput(goldenCase, outputs[goldenCase.id])
  : { caseId: goldenCase.id, passed: false, score: 0, failures: ['No output supplied.'] });

for (const result of results) {
  console.log(`${result.passed ? 'PASS' : 'FAIL'} ${result.caseId} ${result.score}/100`);
  for (const failure of result.failures) console.log(`  - ${failure}`);
}
const average = Math.round(results.reduce((sum, result) => sum + result.score, 0) / Math.max(results.length, 1));
console.log(`Agent evaluation: ${results.filter((result) => result.passed).length}/${results.length} passed, average ${average}/100`);
if (results.some((result) => !result.passed)) process.exitCode = 1;
