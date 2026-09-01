# Agent Growth Missions

Growth Missions turn an evidence-linked Agent recommendation into measurable, approved work. Each mission freezes one product, metric, source, currency, baseline date, baseline value, target, owner, and deadline. Later product data updates progress without spending another AI run.

## Launch a mission

1. Sync a real product source and run a matching Dashloom Agent.
2. Open **Agent actions** and find a product-scoped recommendation.
3. Expand **Launch a measurable growth mission**.
4. Write the hypothesis, choose an increase or decrease target, set a deadline, and optionally assign a workspace member.
5. Review the frozen baseline and computed target on **Growth missions**.

One action occurrence can launch one mission. If the same recommendation reappears with new evidence, its occurrence count advances and a new mission cycle can be launched without overwriting the earlier learning record.

## Measurement policy

Dashloom preserves the exact metric identity from the Agent run, including the source and currency boundary. Flow and ratio metrics use the latest complete UTC day before launch; stock metrics can use the launch day. Percentage targets cannot start from a zero baseline.

After every scheduled source synchronization, Dashloom looks for a later observation of the same metric identity:

- a target reached before the deadline becomes **achieved**;
- movement toward the target remains **on track**;
- movement away from the target becomes **off track**;
- an unreached target after the deadline becomes **missed**;
- a deadline with no later comparable evidence becomes **insufficient**.

Refresh can also be requested from the Missions page. Updates use workspace and active-state guards, so a cancelled or already finished mission cannot be overwritten by a stale refresh.

## Agent evidence

Active and recently finished missions are included in later frozen Agent evidence bundles as `mission:<id>`. The Agent may cite the mission target and observed progress, but mission titles and hypotheses are treated as untrusted data. The system prompt requires a non-causal disclosure: movement after launch does not prove that the recommended action caused it.

Mission creation, cancellation, assignment, provenance, measurements, and status are workspace scoped. Owners, admins, and members can operate missions; viewers remain read-only. Customer-safe workspace exports include mission history, while model and connector credentials remain excluded.
