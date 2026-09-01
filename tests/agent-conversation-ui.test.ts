import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Agent conversation UI keeps history inside the page and guards active runs', async () => {
  const [page, form, route, styles] = await Promise.all([
    readFile(new URL('../app/dashboard/agent/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/dashboard/agent/agent-form.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/agent/analyze/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/dashboard/product.css', import.meta.url), 'utf8'),
  ]);

  assert.match(page, /agent-conversation-rail/);
  assert.match(page, /<ConversationList[^>]+zh=\{zh\}/);
  assert.match(page, /parseAnalysisRequestQuestion/);
  assert.match(page, /AgentRunTrace/);
  assert.match(page, /AgentReasoningSummary/);
  assert.match(page, /AgentConversationPane/);
  assert.doesNotMatch(page, /subscriptionCreditsRemaining|purchasedCreditsRemaining/);

  assert.match(form, /beforeunload/);
  assert.match(form, /Leaving this page will interrupt this conversation/);
  assert.match(form, /requestBody\.set\('stream', 'true'\)/);
  assert.match(form, /AbortController/);
  assert.match(form, /Shift \+ Enter/);
  assert.match(form, /requestAnimationFrame/);
  assert.match(form, /startsNewConversation/);
  assert.match(form, /nextConversationId && nextConversationId !== conversationId/);
  assert.match(form, /router\.push\(`\/dashboard\/agent\?conversation=\$\{nextConversationId\}`\);[\s\S]+else \{[\s\S]+router\.refresh\(\)/);
  assert.match(form, /Changing scope creates a new conversation/);

  assert.match(route, /application\/x-ndjson/);
  assert.match(route, /type: 'progress'/);
  assert.match(form, /item\.stage === event\.progress/);
  assert.match(styles, /agent-trace-step\[data-status='completed'\]/);
  assert.match(styles, /agent-reasoning-summary/);
  assert.match(styles, /\.agent-turn-pair/);
  assert.match(styles, /\.agent-live-turn/);
});
