# Community extension submissions

Create one directory named after the Agent Skill slug and add `submission.json`. Use [`submission.example.json`](submission.example.json) as the contract reference. Run `npm run validate:extensions` before opening a pull request.

Do not add `review.json` yourself. A reviewer who is independent from the publisher may add it only after inspecting the exact source commit, completing every checklist item, and approving the current pull-request head. The pull-request workflow verifies the GitHub approval; a JSON claim alone is not trusted.

Accepted submission does not automatically mean Marketplace publication. Maintainers publish the immutable reviewed manifest in the bundled catalog only after policy validation, provenance review, tests, and an explicit merge decision.
