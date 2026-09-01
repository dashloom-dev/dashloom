# Quick start: from an empty workspace to your first analysis

To get value from Dashloom, do three things: add a product, import one real data source, and ask an Agent a specific question. If you already have a read-only credential, this should take only a few minutes.

## Before you start

Choose the data source that is easiest for you to connect. Common starting points are Cloudflare, Google Analytics, Stripe, GitHub, or Vercel. You will need a read-only token or an OAuth authorization for that provider.

A new Dashloom workspace is empty by design. Dashloom does not add sample products or made-up metrics.

## Step 1: add a product

1. Open **Products**.
2. Create a product with its real name and domain.
3. After saving, the product card shows **not connected** and points you to data sources.

Use one product for one business or customer scope. Do not mix unrelated businesses, customers, or currencies in a single product.

## Step 2: connect and sync data

1. Select **Fix data coverage** on the product card, or open **Data sources**.
2. Choose the provider you use and follow its setup guide to create the smallest required permission set.
3. Map the provider account or resource to the product you just created.
4. Select **Sync** and wait for the run to finish.
5. Return to **Products** and confirm that the card shows a data-point count and a recent data date.

A connected account is not the same as imported data. This step is complete only after a successful sync writes real metrics.

## Step 3: run your first analysis

1. Open **Agent**.
2. Choose an analyst that matches your data, such as Revenue, SEO, or Operations.
3. Select the product you created.
4. Ask a decision-oriented question, for example: “What should I address first based on the last seven days?”
5. Open the data links in the answer and confirm that the product, metrics, and dates are correct.

If an Agent is unavailable, the page tells you which kind of data is missing. Return to the data source and complete a sync instead of connecting unrelated metrics just to enable the button.

## How to verify the setup

You should now see:

- a **live** product card with a recent data date;
- a matching data-point count on the Agent page;
- at least one successful analysis whose conclusions link back to data;
- a follow-up item under **Agent actions**.

## What to do next

A useful next sequence is:

1. create an automatic sync schedule for your main data source;
2. move one Agent action to planned and assign an owner;
3. schedule a weekly report that compares the same time window every week;
4. connect a second data category, such as revenue next to traffic or errors next to deployments.

The home page later tracks seven milestones: product, source mapping, recent data, AI model, Agent analysis, planned action, and recurring report. These are calculated from real data and completed work; they are not tutorial checkboxes.
