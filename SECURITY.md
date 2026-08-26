# Security Policy

Please do not disclose suspected vulnerabilities in public issues.

Send a minimal reproduction and impact description to `security@dashloom.dev`. Do not include production credentials, access tokens, personal data, or customer datasets.

Dashloom stores connector, AI provider, and delivery credentials encrypted with AES-GCM and never returns plaintext secrets from read APIs. Workspace authorization is resolved server-side; custom outbound endpoints are restricted to public HTTPS destinations and revalidated before use.

If a secret may have been exposed, revoke it at the provider, replace the Dashloom record, rotate `CREDENTIALS_ENCRYPTION_KEY` through a controlled credential re-encryption procedure, and invalidate affected sessions. Do not post logs containing authorization headers or encrypted credential envelopes.

Supported releases receive security fixes on the current `main` branch. Operators are responsible for applying database migrations, rotating deployment secrets, and verifying their own Cloudflare, Google, Stripe, email, and model-provider configurations.
