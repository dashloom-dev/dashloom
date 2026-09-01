import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyAgentFailure } from '../lib/agent-errors.ts';
import { AgentOutputFormatError } from '../lib/agent-output.ts';
import { AgentImageValidationError, AgentVisionUnsupportedError } from '../lib/agent-images.ts';

test('agent failures expose stable actionable provider categories', () => {
  assert.equal(classifyAgentFailure({ statusCode: 401 }).code, 'PROVIDER_AUTH_FAILED');
  assert.equal(classifyAgentFailure({ statusCode: 400 }).code, 'PROVIDER_REQUEST_REJECTED');
  assert.equal(classifyAgentFailure({ statusCode: 404 }).code, 'PROVIDER_ENDPOINT_NOT_FOUND');
  assert.equal(classifyAgentFailure({ statusCode: 429 }).code, 'PROVIDER_RATE_LIMITED');
  assert.equal(classifyAgentFailure({ statusCode: 503 }).code, 'PROVIDER_UNAVAILABLE');
  assert.equal(classifyAgentFailure(new Error('upstream request timed out')).code, 'PROVIDER_TIMEOUT');
  assert.equal(classifyAgentFailure(new AgentOutputFormatError('bad output')).code, 'PROVIDER_OUTPUT_INVALID');
  assert.equal(classifyAgentFailure(new AgentImageValidationError('bad image')).code, 'IMAGE_INPUT_INVALID');
  assert.equal(classifyAgentFailure(new AgentVisionUnsupportedError(400)).code, 'PROVIDER_VISION_UNSUPPORTED');
});

test('unknown provider failures never expose raw provider details', () => {
  const failure = classifyAgentFailure(new Error('sk-secret provider detail'));
  assert.equal(failure.code, 'ANALYSIS_FAILED');
  assert.doesNotMatch(failure.message, /sk-secret/);
});
