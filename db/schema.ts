import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

const timestamps = {
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
};

export const workspaces = sqliteTable('workspaces', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  ownerUserId: text('owner_user_id').notNull(),
  plan: text('plan', { enum: ['community', 'free', 'solo', 'studio', 'agency'] }).notNull().default('community'),
  locale: text('locale', { enum: ['en', 'zh'] }).notNull().default('en'),
  timezone: text('timezone').notNull().default('UTC'),
  ...timestamps,
}, (table) => [uniqueIndex('uq_workspaces_slug').on(table.slug), index('idx_workspaces_owner').on(table.ownerUserId)]);

export const workspaceMembers = sqliteTable('workspace_members', {
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  role: text('role', { enum: ['owner', 'admin', 'member', 'viewer'] }).notNull().default('member'),
  joinedAt: text('joined_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [primaryKey({ columns: [table.workspaceId, table.userId] }), index('idx_workspace_members_user').on(table.userId)]);

export const products = sqliteTable('products', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  category: text('category'),
  domain: text('domain'),
  status: text('status', { enum: ['active', 'paused', 'archived'] }).notNull().default('active'),
  ...timestamps,
}, (table) => [uniqueIndex('uq_products_workspace_slug').on(table.workspaceId, table.slug), index('idx_products_workspace_status').on(table.workspaceId, table.status)]);

export const connectorAccounts = sqliteTable('connector_accounts', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  provider: text('provider', { enum: ['cloudflare', 'google', 'd1', 'custom'] }).notNull(),
  externalAccountId: text('external_account_id'),
  displayName: text('display_name').notNull(),
  encryptedCredentials: text('encrypted_credentials'),
  status: text('status', { enum: ['pending', 'connected', 'attention', 'disabled'] }).notNull().default('pending'),
  lastCheckedAt: text('last_checked_at'),
  ...timestamps,
}, (table) => [uniqueIndex('uq_connector_accounts_external').on(table.workspaceId, table.provider, table.externalAccountId), index('idx_connector_accounts_workspace_status').on(table.workspaceId, table.status)]);

export const productConnectorMappings = sqliteTable('product_connector_mappings', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  connectorAccountId: text('connector_account_id').notNull().references(() => connectorAccounts.id, { onDelete: 'cascade' }),
  source: text('source', { enum: ['cloudflare', 'ga4', 'gsc', 'd1', 'business', 'custom'] }).notNull(),
  resourceId: text('resource_id').notNull(),
  resourceLabel: text('resource_label'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  ...timestamps,
}, (table) => [uniqueIndex('uq_product_source_resource').on(table.productId, table.source, table.resourceId), index('idx_product_mappings_workspace').on(table.workspaceId, table.productId)]);

export const metricPoints = sqliteTable('metric_points', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  source: text('source').notNull(),
  metric: text('metric').notNull(),
  metricDate: text('metric_date').notNull(),
  value: real('value').notNull(),
  dimensionsJson: text('dimensions_json').notNull().default('{}'),
  collectedAt: text('collected_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex('uq_metric_points_identity').on(table.workspaceId, table.productId, table.source, table.metric, table.metricDate, table.dimensionsJson), index('idx_metric_points_workspace_date').on(table.workspaceId, table.metricDate), index('idx_metric_points_product_metric').on(table.productId, table.metric, table.metricDate)]);

export const competitors = sqliteTable('competitors', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  productId: text('product_id').references(() => products.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  domain: text('domain'),
  status: text('status', { enum: ['active', 'paused', 'archived'] }).notNull().default('active'),
  ...timestamps,
}, (table) => [index('idx_competitors_workspace_product').on(table.workspaceId, table.productId)]);

export const competitorMetricPoints = sqliteTable('competitor_metric_points', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  competitorId: text('competitor_id').notNull().references(() => competitors.id, { onDelete: 'cascade' }),
  source: text('source').notNull(),
  metric: text('metric').notNull(),
  metricDate: text('metric_date').notNull(),
  value: real('value').notNull(),
  dimensionsJson: text('dimensions_json').notNull().default('{}'),
  provenanceJson: text('provenance_json').notNull().default('{}'),
  collectedAt: text('collected_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex('uq_competitor_metric_identity').on(table.competitorId, table.source, table.metric, table.metricDate, table.dimensionsJson), index('idx_competitor_metrics_workspace_date').on(table.workspaceId, table.metricDate)]);

export const syncRuns = sqliteTable('sync_runs', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  connectorAccountId: text('connector_account_id').references(() => connectorAccounts.id, { onDelete: 'set null' }),
  source: text('source').notNull(),
  status: text('status', { enum: ['queued', 'running', 'success', 'partial', 'error'] }).notNull().default('queued'),
  recordsWritten: integer('records_written').notNull().default(0),
  errorCode: text('error_code'),
  errorMessage: text('error_message'),
  startedAt: text('started_at'),
  finishedAt: text('finished_at'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index('idx_sync_runs_workspace_created').on(table.workspaceId, table.createdAt), index('idx_sync_runs_connector_status').on(table.connectorAccountId, table.status)]);

export const aiProviderAccounts = sqliteTable('ai_provider_accounts', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  mode: text('mode', { enum: ['byok', 'managed'] }).notNull(),
  provider: text('provider', { enum: ['openai_compatible', 'openai', 'anthropic', 'google', 'workers_ai'] }).notNull(),
  displayName: text('display_name').notNull(),
  baseUrl: text('base_url'),
  model: text('model').notNull(),
  encryptedApiKey: text('encrypted_api_key'),
  status: text('status', { enum: ['pending', 'connected', 'attention', 'disabled'] }).notNull().default('pending'),
  lastCheckedAt: text('last_checked_at'),
  ...timestamps,
}, (table) => [index('idx_ai_providers_workspace_status').on(table.workspaceId, table.status)]);

export const dashboardViews = sqliteTable('dashboard_views', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  productId: text('product_id').references(() => products.id, { onDelete: 'cascade' }),
  preset: text('preset', { enum: ['indie_hacker', 'saas_revenue', 'seo_growth', 'cloudflare_operations', 'agency_client'] }).notNull(),
  name: text('name').notNull(),
  configurationJson: text('configuration_json').notNull().default('{}'),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  ...timestamps,
}, (table) => [index('idx_dashboard_views_workspace').on(table.workspaceId, table.preset)]);

export const agentProfiles = sqliteTable('agent_profiles', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  aiProviderAccountId: text('ai_provider_account_id').references(() => aiProviderAccounts.id, { onDelete: 'set null' }),
  preset: text('preset', { enum: ['portfolio_analyst', 'revenue_analyst', 'seo_growth_analyst', 'operations_analyst', 'client_reporting_analyst'] }).notNull(),
  name: text('name').notNull(),
  instructionsJson: text('instructions_json').notNull().default('{}'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  ...timestamps,
}, (table) => [index('idx_agent_profiles_workspace').on(table.workspaceId, table.preset)]);

export const analysisRuns = sqliteTable('analysis_runs', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  agentProfileId: text('agent_profile_id').notNull().references(() => agentProfiles.id, { onDelete: 'cascade' }),
  trigger: text('trigger', { enum: ['chat', 'manual', 'daily', 'weekly', 'monthly', 'alert'] }).notNull(),
  status: text('status', { enum: ['queued', 'running', 'success', 'error', 'cancelled'] }).notNull().default('queued'),
  evidenceJson: text('evidence_json').notNull().default('{}'),
  findingsJson: text('findings_json'),
  inputTokens: integer('input_tokens').notNull().default(0),
  outputTokens: integer('output_tokens').notNull().default(0),
  errorCode: text('error_code'),
  startedAt: text('started_at'),
  finishedAt: text('finished_at'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index('idx_analysis_runs_workspace_created').on(table.workspaceId, table.createdAt), index('idx_analysis_runs_agent_status').on(table.agentProfileId, table.status)]);

export const aiUsageEvents = sqliteTable('ai_usage_events', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  analysisRunId: text('analysis_run_id').references(() => analysisRuns.id, { onDelete: 'set null' }),
  idempotencyKey: text('idempotency_key').notNull(),
  source: text('source', { enum: ['byok', 'managed'] }).notNull(),
  model: text('model').notNull(),
  inputTokens: integer('input_tokens').notNull().default(0),
  outputTokens: integer('output_tokens').notNull().default(0),
  estimatedCostMicros: integer('estimated_cost_micros').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex('uq_ai_usage_idempotency').on(table.workspaceId, table.idempotencyKey), index('idx_ai_usage_workspace_created').on(table.workspaceId, table.createdAt)]);

export const reports = sqliteTable('reports', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  analysisRunId: text('analysis_run_id').references(() => analysisRuns.id, { onDelete: 'set null' }),
  cadence: text('cadence', { enum: ['daily', 'weekly', 'monthly', 'manual'] }).notNull(),
  periodStart: text('period_start').notNull(),
  periodEnd: text('period_end').notNull(),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  contentMarkdown: text('content_markdown').notNull(),
  status: text('status', { enum: ['draft', 'ready', 'delivering', 'delivered', 'error'] }).notNull().default('draft'),
  ...timestamps,
}, (table) => [index('idx_reports_workspace_period').on(table.workspaceId, table.periodEnd), index('idx_reports_status').on(table.status)]);

export const deliveryChannels = sqliteTable('delivery_channels', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  type: text('type', { enum: ['email', 'slack', 'discord', 'webhook'] }).notNull(),
  displayName: text('display_name').notNull(),
  encryptedConfiguration: text('encrypted_configuration').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  ...timestamps,
}, (table) => [index('idx_delivery_channels_workspace').on(table.workspaceId, table.type)]);

export const reportDeliveries = sqliteTable('report_deliveries', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  reportId: text('report_id').notNull().references(() => reports.id, { onDelete: 'cascade' }),
  channelId: text('channel_id').notNull().references(() => deliveryChannels.id, { onDelete: 'cascade' }),
  status: text('status', { enum: ['queued', 'sending', 'delivered', 'error'] }).notNull().default('queued'),
  attemptCount: integer('attempt_count').notNull().default(0),
  providerMessageId: text('provider_message_id'),
  errorMessage: text('error_message'),
  deliveredAt: text('delivered_at'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex('uq_report_delivery_channel').on(table.reportId, table.channelId), index('idx_report_deliveries_status').on(table.workspaceId, table.status)]);
