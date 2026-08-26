CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`issuer` text NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`id_token` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_account_issuer_identity` ON `account` (`issuer`,`account_id`);--> statement-breakpoint
CREATE INDEX `idx_account_user` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `agent_action_occurrences` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`action_id` text NOT NULL,
	`analysis_run_id` text NOT NULL,
	`finding_index` integer NOT NULL,
	`evidence_refs_json` text DEFAULT '[]' NOT NULL,
	`seen_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`action_id`) REFERENCES `agent_actions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`analysis_run_id`) REFERENCES `analysis_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_agent_action_occurrence_run_finding` ON `agent_action_occurrences` (`analysis_run_id`,`finding_index`);--> statement-breakpoint
CREATE INDEX `idx_agent_action_occurrences_action` ON `agent_action_occurrences` (`action_id`,`seen_at`);--> statement-breakpoint
CREATE INDEX `idx_agent_action_occurrences_workspace` ON `agent_action_occurrences` (`workspace_id`,`seen_at`);--> statement-breakpoint
CREATE TABLE `agent_action_outcomes` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`action_id` text NOT NULL,
	`source_analysis_run_id` text,
	`product_id` text,
	`metric` text,
	`source` text,
	`currency` text,
	`direction` text DEFAULT 'contextual' NOT NULL,
	`baseline_evidence_ref` text,
	`baseline_value` real,
	`baseline_date` text,
	`latest_value` real,
	`latest_date` text,
	`change_percent` real,
	`assessment` text DEFAULT 'awaiting' NOT NULL,
	`limitation` text NOT NULL,
	`completed_at` text NOT NULL,
	`measured_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`action_id`) REFERENCES `agent_actions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_analysis_run_id`) REFERENCES `analysis_runs`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_agent_action_outcome_completion` ON `agent_action_outcomes` (`action_id`,`completed_at`);--> statement-breakpoint
CREATE INDEX `idx_agent_action_outcomes_workspace_assessment` ON `agent_action_outcomes` (`workspace_id`,`assessment`,`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_agent_action_outcomes_action` ON `agent_action_outcomes` (`action_id`,`completed_at`);--> statement-breakpoint
CREATE TABLE `agent_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`fingerprint` text NOT NULL,
	`source_analysis_run_id` text,
	`source_finding_index` integer NOT NULL,
	`product_id` text,
	`title` text NOT NULL,
	`detail` text NOT NULL,
	`recommended_action` text NOT NULL,
	`severity` text NOT NULL,
	`confidence` real NOT NULL,
	`evidence_refs_json` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'suggested' NOT NULL,
	`occurrence_count` integer DEFAULT 0 NOT NULL,
	`assigned_user_id` text,
	`due_at` text,
	`completed_at` text,
	`dismissed_reason` text,
	`first_seen_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_analysis_run_id`) REFERENCES `analysis_runs`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_agent_actions_workspace_fingerprint` ON `agent_actions` (`workspace_id`,`fingerprint`);--> statement-breakpoint
CREATE INDEX `idx_agent_actions_workspace_status` ON `agent_actions` (`workspace_id`,`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_agent_actions_product_status` ON `agent_actions` (`product_id`,`status`);--> statement-breakpoint
CREATE TABLE `agent_comparison_results` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`comparison_run_id` text NOT NULL,
	`ai_provider_account_id` text,
	`provider_name` text NOT NULL,
	`provider_mode` text NOT NULL,
	`model` text NOT NULL,
	`prompt_version` text NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`findings_json` text,
	`evaluation_json` text,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`latency_ms` integer DEFAULT 0 NOT NULL,
	`error_code` text,
	`started_at` text NOT NULL,
	`finished_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`comparison_run_id`) REFERENCES `agent_comparison_runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ai_provider_account_id`) REFERENCES `ai_provider_accounts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_agent_comparison_provider` ON `agent_comparison_results` (`comparison_run_id`,`ai_provider_account_id`);--> statement-breakpoint
CREATE INDEX `idx_agent_comparison_results_workspace` ON `agent_comparison_results` (`workspace_id`,`comparison_run_id`);--> statement-breakpoint
CREATE TABLE `agent_comparison_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`agent_preset` text NOT NULL,
	`question` text NOT NULL,
	`prompt_version` text NOT NULL,
	`evidence_json` text NOT NULL,
	`provider_count` integer NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`created_by_user_id` text NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_agent_comparisons_workspace_created` ON `agent_comparison_runs` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `agent_conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`scope_mode` text DEFAULT 'workspace' NOT NULL,
	`product_id` text,
	`agent_preset` text NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_by_user_id` text NOT NULL,
	`last_message_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_agent_conversations_workspace_recent` ON `agent_conversations` (`workspace_id`,`status`,`last_message_at`);--> statement-breakpoint
CREATE INDEX `idx_agent_conversations_product_recent` ON `agent_conversations` (`product_id`,`status`,`last_message_at`);--> statement-breakpoint
CREATE TABLE `agent_executive_briefs` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`scope_mode` text DEFAULT 'workspace' NOT NULL,
	`product_id` text,
	`question` text NOT NULL,
	`requested_presets_json` text NOT NULL,
	`analysis_run_ids_json` text DEFAULT '[]' NOT NULL,
	`digest_json` text,
	`failures_json` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`success_count` integer DEFAULT 0 NOT NULL,
	`failure_count` integer DEFAULT 0 NOT NULL,
	`created_by_user_id` text NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_agent_executive_briefs_workspace_created` ON `agent_executive_briefs` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_agent_executive_briefs_status` ON `agent_executive_briefs` (`workspace_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_agent_executive_briefs_product_created` ON `agent_executive_briefs` (`product_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `agent_growth_missions` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`source_action_id` text,
	`source_action_occurrence_count` integer NOT NULL,
	`source_analysis_run_id` text,
	`product_id` text,
	`title` text NOT NULL,
	`hypothesis` text NOT NULL,
	`metric` text NOT NULL,
	`source` text NOT NULL,
	`currency` text,
	`baseline_evidence_ref` text NOT NULL,
	`baseline_value` real NOT NULL,
	`baseline_date` text NOT NULL,
	`target_value` real NOT NULL,
	`latest_value` real,
	`latest_date` text,
	`change_percent` real,
	`progress_percent` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`assessment` text DEFAULT 'awaiting' NOT NULL,
	`limitation` text NOT NULL,
	`assigned_user_id` text,
	`created_by_user_id` text NOT NULL,
	`starts_at` text NOT NULL,
	`due_at` text NOT NULL,
	`finished_at` text,
	`measured_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_action_id`) REFERENCES `agent_actions`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`source_analysis_run_id`) REFERENCES `analysis_runs`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_agent_growth_mission_action_cycle` ON `agent_growth_missions` (`source_action_id`,`source_action_occurrence_count`);--> statement-breakpoint
CREATE INDEX `idx_agent_growth_missions_workspace_status` ON `agent_growth_missions` (`workspace_id`,`status`,`due_at`);--> statement-breakpoint
CREATE INDEX `idx_agent_growth_missions_product` ON `agent_growth_missions` (`product_id`,`status`);--> statement-breakpoint
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
CREATE TABLE `agent_skill_manifests` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`version` text NOT NULL,
	`base_preset` text NOT NULL,
	`instructions` text NOT NULL,
	`required_metrics_json` text DEFAULT '[]' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_agent_skills_workspace_slug` ON `agent_skill_manifests` (`workspace_id`,`slug`);--> statement-breakpoint
CREATE INDEX `idx_agent_skills_workspace_preset` ON `agent_skill_manifests` (`workspace_id`,`base_preset`,`enabled`);--> statement-breakpoint
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
	`conversation_id` text,
	`trigger` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`evidence_json` text DEFAULT '{}' NOT NULL,
	`findings_json` text,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`error_code` text,
	`actions_materialized_at` text,
	`actions_error_code` text,
	`started_at` text,
	`finished_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`agent_profile_id`) REFERENCES `agent_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`conversation_id`) REFERENCES `agent_conversations`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_analysis_runs_workspace_created` ON `analysis_runs` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_analysis_runs_agent_status` ON `analysis_runs` (`agent_profile_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_analysis_runs_conversation_created` ON `analysis_runs` (`conversation_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workspace_id` text NOT NULL,
	`actor_user_id` text,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_audit_events_workspace_created` ON `audit_events` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_audit_events_actor` ON `audit_events` (`actor_user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `automation_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`execution_key` text NOT NULL,
	`kind` text NOT NULL,
	`trigger` text NOT NULL,
	`cron` text,
	`scheduled_time` text,
	`status` text DEFAULT 'running' NOT NULL,
	`summary_json` text DEFAULT '{"tasks":[]}' NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_automation_runs_execution` ON `automation_runs` (`execution_key`);--> statement-breakpoint
CREATE INDEX `idx_automation_runs_created` ON `automation_runs` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_automation_runs_kind_status` ON `automation_runs` (`kind`,`status`);--> statement-breakpoint
CREATE TABLE `calculated_metric_definitions` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`metric` text NOT NULL,
	`left_source` text NOT NULL,
	`left_metric` text NOT NULL,
	`operator` text NOT NULL,
	`right_source` text,
	`right_metric` text,
	`constant_value` real,
	`scale` real DEFAULT 1 NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_calculated_metrics_workspace_metric` ON `calculated_metric_definitions` (`workspace_id`,`metric`);--> statement-breakpoint
CREATE INDEX `idx_calculated_metrics_workspace_enabled` ON `calculated_metric_definitions` (`workspace_id`,`enabled`);--> statement-breakpoint
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
CREATE TABLE `connector_resources` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`connector_account_id` text NOT NULL,
	`type` text NOT NULL,
	`resource_id` text NOT NULL,
	`display_name` text NOT NULL,
	`domains_json` text DEFAULT '[]' NOT NULL,
	`permission_level` text,
	`discovered_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`connector_account_id`) REFERENCES `connector_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_connector_resource` ON `connector_resources` (`connector_account_id`,`type`,`resource_id`);--> statement-breakpoint
CREATE INDEX `idx_connector_resources_workspace_type` ON `connector_resources` (`workspace_id`,`type`);--> statement-breakpoint
CREATE TABLE `dashboard_views` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`product_id` text,
	`source_analysis_run_id` text,
	`origin` text DEFAULT 'manual' NOT NULL,
	`preset` text NOT NULL,
	`name` text NOT NULL,
	`configuration_json` text DEFAULT '{}' NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_analysis_run_id`) REFERENCES `analysis_runs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_dashboard_views_workspace` ON `dashboard_views` (`workspace_id`,`preset`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_dashboard_views_analysis_run` ON `dashboard_views` (`source_analysis_run_id`);--> statement-breakpoint
CREATE TABLE `ingestion_api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`product_id` text,
	`name` text NOT NULL,
	`token_prefix` text NOT NULL,
	`token_hash` text NOT NULL,
	`last_used_at` text,
	`revoked_at` text,
	`created_by_user_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_ingestion_api_key_hash` ON `ingestion_api_keys` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_ingestion_api_keys_workspace` ON `ingestion_api_keys` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_ingestion_api_keys_product` ON `ingestion_api_keys` (`product_id`,`created_at`);--> statement-breakpoint
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
CREATE TABLE `oauth_states` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`state_hash` text NOT NULL,
	`encrypted_verifier` text NOT NULL,
	`redirect_uri` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_oauth_states_hash` ON `oauth_states` (`state_hash`);--> statement-breakpoint
CREATE INDEX `idx_oauth_states_expiry` ON `oauth_states` (`provider`,`expires_at`);--> statement-breakpoint
CREATE TABLE `product_connector_mappings` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`product_id` text NOT NULL,
	`connector_account_id` text NOT NULL,
	`source` text NOT NULL,
	`resource_id` text NOT NULL,
	`resource_label` text,
	`configuration_json` text DEFAULT '{}' NOT NULL,
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
CREATE TABLE `product_goals` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`product_id` text NOT NULL,
	`name` text NOT NULL,
	`metric` text NOT NULL,
	`source` text,
	`currency` text,
	`direction` text DEFAULT 'at_least' NOT NULL,
	`period` text DEFAULT 'monthly' NOT NULL,
	`target_value` real NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_product_goals_workspace_enabled` ON `product_goals` (`workspace_id`,`enabled`);--> statement-breakpoint
CREATE INDEX `idx_product_goals_product_metric` ON `product_goals` (`product_id`,`metric`);--> statement-breakpoint
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
CREATE TABLE `report_schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`scope_mode` text DEFAULT 'workspace' NOT NULL,
	`product_id` text,
	`name` text NOT NULL,
	`cadence` text NOT NULL,
	`kind` text DEFAULT 'specialist' NOT NULL,
	`agent_preset` text NOT NULL,
	`executive_presets_json` text DEFAULT '[]' NOT NULL,
	`executive_question` text,
	`created_by_user_id` text,
	`timezone` text DEFAULT 'UTC' NOT NULL,
	`hour_local` integer DEFAULT 8 NOT NULL,
	`day_of_week` integer,
	`day_of_month` integer,
	`channel_ids_json` text DEFAULT '[]' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`next_run_at` text NOT NULL,
	`last_run_at` text,
	`last_status` text DEFAULT 'never' NOT NULL,
	`last_error_code` text,
	`consecutive_failures` integer DEFAULT 0 NOT NULL,
	`active_occurrence_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_report_schedules_due` ON `report_schedules` (`enabled`,`next_run_at`);--> statement-breakpoint
CREATE INDEX `idx_report_schedules_workspace` ON `report_schedules` (`workspace_id`,`cadence`);--> statement-breakpoint
CREATE INDEX `idx_report_schedules_product` ON `report_schedules` (`product_id`,`enabled`,`next_run_at`);--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`scope_mode` text DEFAULT 'workspace' NOT NULL,
	`product_id` text,
	`analysis_run_id` text,
	`executive_brief_id` text,
	`idempotency_key` text,
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
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`analysis_run_id`) REFERENCES `analysis_runs`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`executive_brief_id`) REFERENCES `agent_executive_briefs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_reports_workspace_idempotency` ON `reports` (`workspace_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_reports_workspace_period` ON `reports` (`workspace_id`,`period_end`);--> statement-breakpoint
CREATE INDEX `idx_reports_status` ON `reports` (`status`);--> statement-breakpoint
CREATE INDEX `idx_reports_product_period` ON `reports` (`product_id`,`period_end`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_session_token` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `idx_session_user` ON `session` (`user_id`);--> statement-breakpoint
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
CREATE TABLE `sync_schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`source` text NOT NULL,
	`frequency_minutes` integer NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`next_run_at` text NOT NULL,
	`last_run_at` text,
	`last_success_at` text,
	`retry_attempt` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_sync_schedule_workspace_source` ON `sync_schedules` (`workspace_id`,`source`);--> statement-breakpoint
CREATE INDEX `idx_sync_schedules_due` ON `sync_schedules` (`enabled`,`next_run_at`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_user_email` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_verification_identifier` ON `verification` (`identifier`);--> statement-breakpoint
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
CREATE TABLE `workspace_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`active_workspace_id` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`active_workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
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