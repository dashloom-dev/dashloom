# Agent task center

`/dashboard/tasks` is the workspace-scoped execution ledger for the latest 50 Agent analysis runs. It shows queued, running, successful, failed, and cancelled states; trigger and product scope; elapsed time; input and output token totals; stable error codes; and the current managed-AI daily allowance. Connected BYOK capacity is reported separately because BYOK runs do not consume the managed allowance.

A failed or cancelled chat run is retryable only when Dashloom can recover the exact original question from its frozen evidence, the conversation is still active, and its locked product still exists. Retrying reuses the existing analysis endpoint, so membership, tenant scope, evidence freshness, model availability, and current quota are checked again. Scheduled, legacy, archived-conversation, missing-product, and malformed-evidence runs are never silently reconstructed; the task center explains why they require a manual restart.

The list does not persist raw model or provider errors. It exposes stable error categories and links to the run's frozen-evidence audit page.
