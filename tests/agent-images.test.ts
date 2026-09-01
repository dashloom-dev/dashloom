import assert from 'node:assert/strict';
import test from 'node:test';
import { AGENT_IMAGE_MAX_COUNT, agentImageEvidence, AgentImageValidationError, validateAgentImageFiles } from '../lib/agent-images.ts';

function pngFile(name = 'screen.png', type = 'image/png') {
  return new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])], name, { type });
}

test('validated image input produces bounded evidence without retaining raw content or filenames', async () => {
  const [image] = await validateAgentImageFiles([pngFile('private-customer-name.png')]);
  assert.equal(image?.mimeType, 'image/png');
  assert.match(image?.dataUrl || '', /^data:image\/png;base64,/);
  const evidence = agentImageEvidence([image!]);
  assert.equal(evidence[0]?.label, 'Image 1');
  assert.match(evidence[0]?.evidenceId || '', /^image:[a-f0-9]{64}$/);
  assert.equal('dataUrl' in evidence[0]!, false);
  assert.doesNotMatch(JSON.stringify(evidence), /private-customer-name|base64/);
});

test('image validation rejects disguised and excessive attachments', async () => {
  await assert.rejects(validateAgentImageFiles([pngFile('fake.jpg', 'image/jpeg')]), AgentImageValidationError);
  await assert.rejects(validateAgentImageFiles([new File([new Uint8Array([1, 2, 3])], 'fake.png', { type: 'image/png' })]), AgentImageValidationError);
  await assert.rejects(validateAgentImageFiles([pngFile('first.png'), pngFile('duplicate.png')]), AgentImageValidationError);
  await assert.rejects(validateAgentImageFiles(Array.from({ length: AGENT_IMAGE_MAX_COUNT + 1 }, (_, index) => pngFile(`${index}.png`))), AgentImageValidationError);
});
