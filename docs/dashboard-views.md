# Reusable dashboard views

The five built-in dashboards remain stable analysis templates. Workspace members can save additional decision views from **Settings → Dashboard templates** without changing normalized source data.

A saved view can define:

- one of the five base templates;
- a display name, title, and supporting explanation;
- one to eight normalized metric names;
- all products or one workspace product;
- whether it is the default view for that base template.

Open a saved view from Settings. Default views also load when the base dashboard URL is opened without a `view` query parameter. View identifiers are always resolved together with the active workspace and preset; a link from another workspace cannot expose its configuration or product data.

Deleting a view does not delete metrics, products, Agent runs, or reports. Exported workspace backups include saved view configuration.
