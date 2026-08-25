CREATE TABLE `connector_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`provider` text NOT NULL,
	`external_account_id` text,
	`display_name` text NOT NULL,
	`encrypted_credentials` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`last_checked_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_connector_accounts_external` ON `connector_accounts` (`workspace_id`,`provider`,`external_account_id`);--> statement-breakpoint
CREATE INDEX `idx_connector_accounts_workspace_status` ON `connector_accounts` (`workspace_id`,`status`);--> statement-breakpoint
CREATE TABLE `metric_points` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workspace_id` text NOT NULL,
	`product_id` text NOT NULL,
	`source` text NOT NULL,
	`metric` text NOT NULL,
	`metric_date` text NOT NULL,
	`value` real NOT NULL,
	`dimensions_json` text DEFAULT '{}' NOT NULL,
	`collected_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_metric_points_identity` ON `metric_points` (`workspace_id`,`product_id`,`source`,`metric`,`metric_date`,`dimensions_json`);--> statement-breakpoint
CREATE INDEX `idx_metric_points_workspace_date` ON `metric_points` (`workspace_id`,`metric_date`);--> statement-breakpoint
CREATE INDEX `idx_metric_points_product_metric` ON `metric_points` (`product_id`,`metric`,`metric_date`);--> statement-breakpoint
CREATE TABLE `product_connector_mappings` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`product_id` text NOT NULL,
	`connector_account_id` text NOT NULL,
	`source` text NOT NULL,
	`resource_id` text NOT NULL,
	`resource_label` text,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`connector_account_id`) REFERENCES `connector_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_product_source_resource` ON `product_connector_mappings` (`product_id`,`source`,`resource_id`);--> statement-breakpoint
CREATE INDEX `idx_product_mappings_workspace` ON `product_connector_mappings` (`workspace_id`,`product_id`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`category` text,
	`domain` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_products_workspace_slug` ON `products` (`workspace_id`,`slug`);--> statement-breakpoint
CREATE INDEX `idx_products_workspace_status` ON `products` (`workspace_id`,`status`);--> statement-breakpoint
CREATE TABLE `sync_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`connector_account_id` text,
	`source` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`records_written` integer DEFAULT 0 NOT NULL,
	`error_code` text,
	`error_message` text,
	`started_at` text,
	`finished_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`connector_account_id`) REFERENCES `connector_accounts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_sync_runs_workspace_created` ON `sync_runs` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_sync_runs_connector_status` ON `sync_runs` (`connector_account_id`,`status`);--> statement-breakpoint
CREATE TABLE `workspace_members` (
	`workspace_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`joined_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`workspace_id`, `user_id`),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_workspace_members_user` ON `workspace_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`plan` text DEFAULT 'community' NOT NULL,
	`locale` text DEFAULT 'en' NOT NULL,
	`timezone` text DEFAULT 'UTC' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_workspaces_slug` ON `workspaces` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_workspaces_owner` ON `workspaces` (`owner_user_id`);