# View and retry Agent tasks

Open **Agent → Tasks** when an analysis is stuck, a run failed, or you want to see what happened. The page shows the 50 most recent tasks in the current workspace.

## What the task list shows

- queued, running, successful, failed, and cancelled states;
- whether a person, report, alert, or another feature started the task;
- all-products or single-product scope;
- duration and input/output token usage;
- a safe, stable error category;
- whether the deployment currently has a usable BYOK model connection.

Community runs Agents through your own OpenAI-compatible provider. It does not use Dashloom managed credits.

## When you can retry

A failed task shows **Retry** only when Dashloom can safely recover the original question and scope. Retrying uses the same question, then checks your current permission, data freshness, and model connection again.

Automatic retry is unavailable when:

- a schedule created the original task;
- the conversation is archived;
- the selected product was deleted;
- the task is too old or its saved data is incomplete.

The page explains the reason. Return to the original feature and start a new task instead of guessing the old parameters.

## Troubleshooting order

1. Check the error category and product scope.
2. Open the task's saved data snapshot and verify its dates and references.
3. Check the source connection and BYOK model connection.
4. Retry once after the underlying condition is fixed.

The task center does not store provider raw errors or display API keys. When contacting support, send the task time, stable error code, and a screenshot—never a credential.
