# Agent Playbooks

An Agent Playbook tells each Dashloom specialist what kind of business it is supporting and how to prioritize its evidence. Open **Agent**, select a specialist, and configure the Playbook shown above the conversation workbench.

## What you can configure

- **Business model:** independent portfolio, SaaS, agency, internal platform, or private self-hosted deployment.
- **Primary objective:** a short operating outcome, such as improving retained MRR or reducing deployment regressions.
- **Priorities:** up to five bounded domains covering revenue, growth, retention, SEO, reliability, delivery, and client outcomes.
- **Change sensitivity:** whether the analyst should surface smaller changes or only material movement.
- **Response style and language:** concise, executive, or detailed output in English, Simplified Chinese, or the language of the question.

Only workspace owners and admins can change the shared Playbook. A member can run the Agent with the saved configuration.

## Evidence and safety boundary

Playbooks guide prioritization and presentation; they do not grant the model new access or authority. Dashloom treats the objective as untrusted context. It cannot override the system prompt, metric policy, citation validation, currency separation, truncation disclosure, or output contract.

Every new run freezes the effective Playbook inside its evidence snapshot. Historical runs therefore remain auditable after the workspace changes its objectives. Audit events record the configuration category and priorities, but do not copy the free-text objective into the audit log.

## A useful first setup

1. Select **Portfolio Analyst** and choose the business model closest to your operation.
2. Describe one measurable objective in plain language.
3. Select two or three priorities rather than every available option.
4. Keep standard sensitivity until you understand the normal volatility of your data.
5. Save, then choose a suggested decision question or write your own.
6. Inspect the frozen evidence link before acting on a consequential recommendation.

Playbooks also apply to scheduled daily, weekly, and monthly reports because those reports run the same evidence-bound Agent.
