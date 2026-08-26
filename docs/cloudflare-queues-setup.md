# Cloudflare Queues setup

Dashloom captures a privacy-minimized operational snapshot for a Queue: approximate backlog messages and bytes, the age of the oldest unacknowledged message, and whether delivery is paused. It never reads, peeks, pulls, acknowledges, retries, purges, sends, or stores messages.

## Create a least-privilege token

1. In Cloudflare, open **My Profile → API Tokens → Create Token → Create Custom Token**.
2. Add the account permission **Queues: Read**. Do not grant Queues Write.
3. Restrict **Account Resources** to the account that owns the Queue.
4. Create the token and copy it once.

Copy the account ID and Queue ID from the Cloudflare dashboard or a read-only Queue listing. In Dashloom, open **Data sources → Cloudflare Queues**, select the product, and enter the account ID, Queue ID, connection name, and token.

Dashloom validates both the Queue identity and metrics endpoint before encrypting the token. The Queue credential is isolated from broader Workers, R2, or Pages connectors.

## Evidence semantics

Cloudflare describes realtime Queue metrics as best-effort and approximate. Dashloom records that limitation in every point and treats all four values as latest-state metrics, not additive daily totals. Repeated synchronization builds a daily series whose value is the most recent snapshot collected that day.

Operations Agent and product health can flag paused delivery, large backlog, or an old pending message. Those signals indicate queue pressure; they do not prove the cause. Confirm consumer health, retry configuration, dead-letter behavior, and current Cloudflare status before changing production.

If validation fails, confirm the token has the required account's **Queues: Read** permission, the Queue ID belongs to that account, and the Queue still exists. Rotate or erase the token from the unified connector account controls when access changes.
