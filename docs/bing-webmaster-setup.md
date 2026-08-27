# Connect Bing Webmaster Tools

Dashloom connects Bing Webmaster Tools with a user-level API key. One key can discover every verified site available to that Bing Webmaster account.

## Create the key

1. Sign in to [Bing Webmaster Tools](https://www.bing.com/webmasters/).
2. Add and verify each site you want Dashloom to read.
3. Open **Settings → API Access → API Key**.
4. Generate or copy the user API key.

Microsoft supports both OAuth 2.0 and API-key access. Dashloom uses the API-key flow so self-hosted installations need no deployment-wide Bing OAuth configuration. The key is encrypted at rest, isolated to the current workspace, and never returned by workspace exports.

## Connect and map sites

1. Open **Data sources → Bing Search**.
2. Enter a connection name and the Bing Webmaster API key.
3. Dashloom validates the key and discovers all verified sites.
4. A site is mapped automatically when its domain uniquely matches a product domain.
5. Use **Discovered site** to resolve unmatched or ambiguous sites.

The first synchronization runs automatically when at least one mapping exists. Later runs can be started with **Sync Bing** or an automatic synchronization schedule.

## Imported evidence

- Daily clicks, impressions, and CTR.
- Query clicks, impressions, and average position.
- Page clicks, impressions, and average position.

Dashloom uses Bing's JSON/HTTP endpoints. If the key is regenerated in Bing, reconnect it in Dashloom. Disconnecting a local account removes its encrypted credential but cannot revoke a Bing API key remotely.
