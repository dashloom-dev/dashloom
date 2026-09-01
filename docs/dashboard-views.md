# Save a dashboard you use often

Save a dashboard view when you repeatedly check the same products and metrics. You can reopen it from settings instead of rebuilding the filters each time.

## Create a view

1. Open **Settings → Dashboard templates**.
2. Choose one of the five built-in dashboard templates.
3. Enter a view name, page title, and description.
4. Select between one and eight normalized metrics.
5. Choose all products or one product.
6. Optionally make it the default view for that template.
7. Save and open it, then confirm that the product scope and metrics are correct.

A saved view stores display settings on top of existing metrics. It does not copy or change the underlying data.

## How the default view works

When a view is the default, opening the base dashboard without a `view` query parameter loads it automatically. A link with an explicit `view` parameter still opens the requested saved view.

Dashloom checks the view ID, workspace, and template together. A link copied from another workspace cannot expose that workspace's configuration or product data.

## Edit or delete a view

Edit the view when you need a different product or metric selection. Deleting it removes only the saved display settings; it does not delete products, metrics, Agent runs, or reports. Workspace exports include saved dashboard configuration.
