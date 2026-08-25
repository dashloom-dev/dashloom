CREATE TABLE `agent_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`ai_provider_account_id` text,
	`preset` text NOT NULL,
	`name` text NOT NULL,
	`instructions_json` text DEFAULT '{}' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ai_provider_account_id`) REFERENCES `ai_provider_accounts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_agent_profiles_workspace` ON `agent_profiles` (`workspace_id`,`preset`);--> statement-breakpoint
CREATE TABLE `ai_provider_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`mode` text NOT NULL,
	`provider` text NOT NULL,
	`display_name` text NOT NULL,
	`base_url` text,
	`model` text NOT NULL,
	`encrypted_api_key` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`last_checked_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_ai_providers_workspace_status` ON `ai_provider_accounts` (`workspace_id`,`status`);--> statement-breakpoint
CREATE TABLE `ai_usage_events` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`analysis_run_id` text,
	`idempotency_key` text NOT NULL,
	`source` text NOT NULL,
	`model` text NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`estimated_cost_micros` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`analysis_run_id`) REFERENCES `analysis_runs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_ai_usage_idempotency` ON `ai_usage_events` (`workspace_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_ai_usage_workspace_created` ON `ai_usage_events` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `analysis_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`agent_profile_id` text NOT NULL,
	`trigger` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`evidence_json` text DEFAULT '{}' NOT NULL,
	`findings_json` text,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`error_code` text,
	`started_at` text,
	`finished_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`agent_profile_id`) REFERENCES `agent_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_analysis_runs_workspace_created` ON `analysis_runs` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_analysis_runs_agent_status` ON `analysis_runs` (`agent_profile_id`,`status`);--> statement-breakpoint
CREATE TABLE `competitor_metric_points` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workspace_id` text NOT NULL,
	`competitor_id` text NOT NULL,
	`source` text NOT NULL,
	`metric` text NOT NULL,
	`metric_date` text NOT NULL,
	`value` real NOT NULL,
	`dimensions_json` text DEFAULT '{}' NOT NULL,
	`provenance_json` text DEFAULT '{}' NOT NULL,
	`collected_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`competitor_id`) REFERENCES `competitors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_competitor_metric_identity` ON `competitor_metric_points` (`competitor_id`,`source`,`metric`,`metric_date`,`dimensions_json`);--> statement-breakpoint
CREATE INDEX `idx_competitor_metrics_workspace_date` ON `competitor_metric_points` (`workspace_id`,`metric_date`);--> statement-breakpoint
CREATE TABLE `competitors` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`product_id` text,
	`name` text NOT NULL,
	`domain` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_competitors_workspace_product` ON `competitors` (`workspace_id`,`product_id`);--> statement-breakpoint
CREATE TABLE `dashboard_views` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`product_id` text,
	`preset` text NOT NULL,
	`name` text NOT NULL,
	`configuration_json` text DEFAULT '{}' NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_dashboard_views_workspace` ON `dashboard_views` (`workspace_id`,`preset`);--> statement-breakpoint
CREATE TABLE `delivery_channels` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`type` text NOT NULL,
	`display_name` text NOT NULL,
	`encrypted_configuration` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_delivery_channels_workspace` ON `delivery_channels` (`workspace_id`,`type`);--> statement-breakpoint
CREATE TABLE `report_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`report_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`provider_message_id` text,
	`error_message` text,
	`delivered_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`report_id`) REFERENCES `reports`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`channel_id`) REFERENCES `delivery_channels`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_report_delivery_channel` ON `report_deliveries` (`report_id`,`channel_id`);--> statement-breakpoint
CREATE INDEX `idx_report_deliveries_status` ON `report_deliveries` (`workspace_id`,`status`);--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`analysis_run_id` text,
	`cadence` text NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`content_markdown` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`analysis_run_id`) REFERENCES `analysis_runs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_reports_workspace_period` ON `reports` (`workspace_id`,`period_end`);--> statement-breakpoint
CREATE INDEX `idx_reports_status` ON `reports` (`status`);