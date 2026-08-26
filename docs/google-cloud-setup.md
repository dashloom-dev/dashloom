# Prepare Google Analytics and Search Console access

Dashloom's Google connector uses OAuth 2.0 so every user authorizes their own Google account. Do not create a shared service account or place a refresh token in the repository.

## Enable the APIs

In [Google Cloud Console](https://console.cloud.google.com/), create or select a project, then enable:

- Google Analytics Data API
- Google Analytics Admin API
- Search Console API

The Admin API discovers GA4 properties and web streams, the Data API reads metrics, and the Search Console API discovers sites and reads search performance.

## Configure the OAuth consent screen

1. Open **Google Auth Platform** for the project.
2. Add the public Dashloom deployment URL as the application home page.
3. Add working privacy-policy and terms links for a public production application.
4. Choose **Internal** only if every intended user belongs to the same Google Workspace organization; otherwise choose **External**.
5. Request only these read-only scopes:
   - `https://www.googleapis.com/auth/analytics.readonly`
   - `https://www.googleapis.com/auth/webmasters.readonly`

Search Console requires OAuth 2.0 for private user data and documents the read-only scope in its [authorization guide](https://developers.google.com/webmaster-tools/v1/how-tos/authorizing).

Testing mode is suitable for development, but authorizations for non-basic scopes expire after seven days. Google documents this behavior in [Manage App Audience](https://support.google.com/cloud/answer/15549945).

## Create a Web application client

1. Open **APIs & Services → Credentials → Create credentials → OAuth client ID**.
2. Choose **Web application**.
3. Add the exact production callback URL:

   ```text
   https://YOUR_DASHLOOM_DOMAIN/api/connectors/google/callback
   ```

4. Add the matching local callback only for development:

   ```text
   http://localhost:3000/api/connectors/google/callback
   ```

5. Store the Client ID and Client Secret in the deployment's secret manager. Do not put either value in Git.

Use these runtime variable names:

```text
GOOGLE_OAUTH_CLIENT_ID
GOOGLE_OAUTH_CLIENT_SECRET
```

Dashloom uses `BETTER_AUTH_URL` as the trusted public origin when constructing the callback URL. It must exactly match the origin registered with Google.

## Connect and map resources

1. Open **Data sources → Google Acquisition**.
2. Select **Connect Google account** and approve the two read-only data scopes.
3. Dashloom discovers GA4 properties, GA4 web-stream domains, and Search Console sites.
4. A resource with exactly one matching product domain is mapped automatically.
5. Use **Discovered resource** to resolve missing or ambiguous mappings.
6. Select **Sync Google** to import 14 days of GA4 and Search Console evidence.

You can repeat the OAuth flow with another Google identity. Accounts, discovered resources, mappings, encrypted Refresh Tokens, and sync runs remain isolated to the current workspace.

For a public multi-user deployment, review Google's verification requirements before moving the consent screen to production. Self-hosted private deployments can keep their own independent Google Cloud project and client.
