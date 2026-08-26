# Community workspace and portable data

A Community installation creates an owner-controlled workspace and keeps authorization checks server-side. Team invitations and hosted collaboration are not part of this repository.

`GET /api/workspace/export` produces a portable JSON file containing products, product goals, normalized metric points, competitors, and competitor metric points. It never exports connector credentials, user identities, roles, sessions, BYOK keys, reports, Agent history, tokens, or audit records.
