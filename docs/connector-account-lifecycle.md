# Connector account lifecycle

Dashloom keeps every provider account inside one workspace and supports multiple accounts for the same provider. Open **Data sources** to review every configured account, its health, last validation time, and number of active product mappings.

## Connect or rotate a credential

Use the provider form on **Data sources**. Dashloom validates the credential against the real provider before marking the account connected. Submitting the same provider account again replaces the encrypted credential and preserves the existing account identity; this is the normal key-rotation path.

Create the replacement credential with the documented minimum read permissions. After Dashloom validates the replacement, revoke the old credential in the provider console.

## Disconnect an account

Owners and admins can select **Disconnect** in Account Control. Dashloom immediately:

1. marks the connector account disabled so synchronizers no longer select it;
2. permanently removes the stored encrypted credential;
3. disables every product mapping owned by that account;
4. records a credential-free audit event.

Historical aggregate metrics remain available for reports and comparisons. Connector resources also remain as non-secret metadata so the history can be explained. Reconnecting and remapping the account does not silently delete earlier evidence.

Dashloom cannot revoke an API key inside another provider. After disconnecting, revoke the original key in Cloudflare, Stripe, GitHub, or the relevant provider console. For Google OAuth, remove the Dashloom grant from the Google account when retiring access completely.

Disabled accounts are not counted as configured or healthy in the provider catalog. Read APIs and the UI never return encrypted credentials or external account identifiers from the lifecycle view.

## Diagnose and repair

Account Control combines the account state, active mapping count, and newest synchronization result into one diagnosis. When attention is required, it shows a provider-appropriate repair checklist: rotate or reconnect the credential, verify the documented read permissions and selected resource, restore a product mapping when missing, then run a manual sync and confirm that evidence was written.

The browser receives stable synchronization error codes only. Raw provider responses and stored credentials are not included in the lifecycle view.
