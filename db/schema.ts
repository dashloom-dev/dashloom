import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

const timestamps = {
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
};

// Better Auth owns identity. Keep these schema property names aligned with
// Better Auth's core Drizzle contract; product tables only reference user IDs.
export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => [uniqueIndex('uq_user_email').on(table.email)]);

export const session = sqliteTable('session', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  token: text('token').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => [uniqueIndex('uq_session_token').on(table.token), index('idx_session_user').on(table.userId)]);

export const account = sqliteTable('account', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  issuer: text('issuer').notNull(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp' }),
  refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp' }),
  scope: text('scope'),
  idToken: text('id_token'),
  password: text('password'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => [uniqueIndex('uq_account_issuer_identity').on(table.issuer, table.accountId), index('idx_account_user').on(table.userId)]);

export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => [index('idx_verification_identifier').on(table.identifier)]);

export const workspaces = sqliteTable('workspaces', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  ownerUserId: text('owner_user_id').notNull(),
  plan: text('plan', { enum: ['community'] }).notNull().default('community'),
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

export const workspacePreferences = sqliteTable('workspace_preferences', {
  userId: text('user_id').primaryKey(),
  activeWorkspaceId: text('active_workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const auditEvents = sqliteTable('audit_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  actorUserId: text('actor_user_id'),
  action: text('action').notNull(),
  targetType: text('target_type').notNull(),
  targetId: text('target_id'),
  metadataJson: text('metadata_json').notNull().default('{}'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index('idx_audit_events_workspace_created').on(table.workspaceId, table.createdAt), index('idx_audit_events_actor').on(table.actorUserId, table.createdAt)]);

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

export const productGoals = sqliteTable('product_goals', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  metric: text('metric').notNull(),
  source: text('source'),
  currency: text('currency'),
  direction: text('direction', { enum: ['at_least', 'at_most'] }).notNull().default('at_least'),
  period: text('period', { enum: ['daily', 'weekly', 'monthly', 'quarterly'] }).notNull().default('monthly'),
  targetValue: real('target_value').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  createdByUserId: text('created_by_user_id').notNull(),
  ...timestamps,
}, (table) => [index('idx_product_goals_workspace_enabled').on(table.workspaceId, table.enabled), index('idx_product_goals_product_metric').on(table.productId, table.metric)]);

export const connectorAccounts = sqliteTable('connector_accounts', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  provider: text('provider', { enum: ['cloudflare', 'cloudflare_pages', 'cloudflare_queues', 'google', 'd1', 'stripe', 'lemonsqueezy', 'creem', 'polar', 'paddle', 'supabase', 'github', 'vercel', 'custom'] }).notNull(),
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
  source: text('source', { enum: ['cloudflare', 'cloudflare_r2', 'cloudflare_pages', 'cloudflare_queues', 'ga4', 'gsc', 'd1', 'stripe', 'lemonsqueezy', 'creem', 'polar', 'paddle', 'supabase', 'github', 'vercel', 'business', 'custom'] }).notNull(),
  resourceId: text('resource_id').notNull(),
  resourceLabel: text('resource_label'),
  configurationJson: text('configuration_json').notNull().default('{}'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  ...timestamps,
}, (table) => [uniqueIndex('uq_product_source_resource').on(table.productId, table.source, table.resourceId), index('idx_product_mappings_workspace').on(table.workspaceId, table.productId)]);

export const connectorResources = sqliteTable('connector_resources', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  connectorAccountId: text('connector_account_id').notNull().references(() => connectorAccounts.id, { onDelete: 'cascade' }),
  type: text('type', { enum: ['ga4', 'gsc', 'worker', 'database', 'custom'] }).notNull(),
  resourceId: text('resource_id').notNull(),
  displayName: text('display_name').notNull(),
  domainsJson: text('domains_json').notNull().default('[]'),
  permissionLevel: text('permission_level'),
  discoveredAt: text('discovered_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex('uq_connector_resource').on(table.connectorAccountId, table.type, table.resourceId), index('idx_connector_resources_workspace_type').on(table.workspaceId, table.type)]);

export const oauthStates = sqliteTable('oauth_states', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  provider: text('provider', { enum: ['google'] }).notNull(),
  stateHash: text('state_hash').notNull(),
  encryptedVerifier: text('encrypted_verifier').notNull(),
  redirectUri: text('redirect_uri').notNull(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex('uq_oauth_states_hash').on(table.stateHash), index('idx_oauth_states_expiry').on(table.provider, table.expiresAt)]);

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

export const calculatedMetricDefinitions = sqliteTable('calculated_metric_definitions', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  metric: text('metric').notNull(),
  leftSource: text('left_source').notNull(),
  leftMetric: text('left_metric').notNull(),
  operator: text('operator', { enum: ['add', 'subtract', 'multiply', 'divide'] }).notNull(),
  rightSource: text('right_source'),
  rightMetric: text('right_metric'),
  constantValue: real('constant_value'),
  scale: real('scale').notNull().default(1),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  createdByUserId: text('created_by_user_id').notNull(),
  ...timestamps,
}, (table) => [uniqueIndex('uq_calculated_metrics_workspace_metric').on(table.workspaceId, table.metric), index('idx_calculated_metrics_workspace_enabled').on(table.workspaceId, table.enabled)]);

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

export const automationRuns = sqliteTable('automation_runs', {
  id: text('id').primaryKey(),
  executionKey: text('execution_key').notNull(),
  kind: text('kind', { enum: ['quarter_hourly', 'daily', 'manual_reports', 'manual_sync', 'manual_alerts', 'manual_retention', 'manual_billing'] }).notNull(),
  trigger: text('trigger', { enum: ['scheduled', 'manual'] }).notNull(),
  cron: text('cron'),
  scheduledTime: text('scheduled_time'),
  status: text('status', { enum: ['running', 'success', 'partial', 'error'] }).notNull().default('running'),
  summaryJson: text('summary_json').notNull().default('{"tasks":[]}'),
  startedAt: text('started_at').notNull(),
  finishedAt: text('finished_at'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex('uq_automation_runs_execution').on(table.executionKey), index('idx_automation_runs_created').on(table.createdAt), index('idx_automation_runs_kind_status').on(table.kind, table.status)]);

export const aiProviderAccounts = sqliteTable('ai_provider_accounts', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  mode: text('mode', { enum: ['byok'] }).notNull(),
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
  sourceAnalysisRunId: text('source_analysis_run_id').references(() => analysisRuns.id, { onDelete: 'set null' }),
  origin: text('origin', { enum: ['manual', 'agent'] }).notNull().default('manual'),
  preset: text('preset', { enum: ['indie_hacker', 'saas_revenue', 'seo_growth', 'cloudflare_operations', 'agency_client'] }).notNull(),
  name: text('name').notNull(),
  configurationJson: text('configuration_json').notNull().default('{}'),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  ...timestamps,
}, (table) => [index('idx_dashboard_views_workspace').on(table.workspaceId, table.preset), uniqueIndex('uq_dashboard_views_analysis_run').on(table.sourceAnalysisRunId)]);

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

export const agentConversations = sqliteTable('agent_conversations', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  scopeMode: text('scope_mode', { enum: ['workspace', 'product'] }).notNull().default('workspace'),
  productId: text('product_id').references(() => products.id, { onDelete: 'set null' }),
  agentPreset: text('agent_preset', { enum: ['portfolio_analyst', 'revenue_analyst', 'seo_growth_analyst', 'operations_analyst', 'client_reporting_analyst'] }).notNull(),
  title: text('title').notNull(),
  status: text('status', { enum: ['active', 'archived'] }).notNull().default('active'),
  createdByUserId: text('created_by_user_id').notNull(),
  lastMessageAt: text('last_message_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  ...timestamps,
}, (table) => [index('idx_agent_conversations_workspace_recent').on(table.workspaceId, table.status, table.lastMessageAt), index('idx_agent_conversations_product_recent').on(table.productId, table.status, table.lastMessageAt)]);

export const analysisRuns = sqliteTable('analysis_runs', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  agentProfileId: text('agent_profile_id').notNull().references(() => agentProfiles.id, { onDelete: 'cascade' }),
  conversationId: text('conversation_id').references(() => agentConversations.id, { onDelete: 'set null' }),
  trigger: text('trigger', { enum: ['chat', 'manual', 'daily', 'weekly', 'monthly', 'alert'] }).notNull(),
  status: text('status', { enum: ['queued', 'running', 'success', 'error', 'cancelled'] }).notNull().default('queued'),
  evidenceJson: text('evidence_json').notNull().default('{}'),
  findingsJson: text('findings_json'),
  inputTokens: integer('input_tokens').notNull().default(0),
  outputTokens: integer('output_tokens').notNull().default(0),
  errorCode: text('error_code'),
  actionsMaterializedAt: text('actions_materialized_at'),
  actionsErrorCode: text('actions_error_code'),
  startedAt: text('started_at'),
  finishedAt: text('finished_at'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index('idx_analysis_runs_workspace_created').on(table.workspaceId, table.createdAt), index('idx_analysis_runs_agent_status').on(table.agentProfileId, table.status), index('idx_analysis_runs_conversation_created').on(table.conversationId, table.createdAt)]);

export const agentExecutiveBriefs = sqliteTable('agent_executive_briefs', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  scopeMode: text('scope_mode', { enum: ['workspace', 'product'] }).notNull().default('workspace'),
  productId: text('product_id').references(() => products.id, { onDelete: 'set null' }),
  question: text('question').notNull(),
  requestedPresetsJson: text('requested_presets_json').notNull(),
  analysisRunIdsJson: text('analysis_run_ids_json').notNull().default('[]'),
  digestJson: text('digest_json'),
  failuresJson: text('failures_json').notNull().default('[]'),
  status: text('status', { enum: ['running', 'success', 'partial', 'error'] }).notNull().default('running'),
  successCount: integer('success_count').notNull().default(0),
  failureCount: integer('failure_count').notNull().default(0),
  createdByUserId: text('created_by_user_id').notNull(),
  startedAt: text('started_at').notNull(),
  finishedAt: text('finished_at'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index('idx_agent_executive_briefs_workspace_created').on(table.workspaceId, table.createdAt), index('idx_agent_executive_briefs_status').on(table.workspaceId, table.status), index('idx_agent_executive_briefs_product_created').on(table.productId, table.createdAt)]);

export const agentActions = sqliteTable('agent_actions', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  fingerprint: text('fingerprint').notNull(),
  sourceAnalysisRunId: text('source_analysis_run_id').references(() => analysisRuns.id, { onDelete: 'set null' }),
  sourceFindingIndex: integer('source_finding_index').notNull(),
  productId: text('product_id').references(() => products.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  detail: text('detail').notNull(),
  recommendedAction: text('recommended_action').notNull(),
  severity: text('severity', { enum: ['info', 'opportunity', 'warning', 'critical'] }).notNull(),
  confidence: real('confidence').notNull(),
  evidenceRefsJson: text('evidence_refs_json').notNull().default('[]'),
  status: text('status', { enum: ['suggested', 'planned', 'in_progress', 'done', 'dismissed'] }).notNull().default('suggested'),
  occurrenceCount: integer('occurrence_count').notNull().default(0),
  assignedUserId: text('assigned_user_id'),
  dueAt: text('due_at'),
  completedAt: text('completed_at'),
  dismissedReason: text('dismissed_reason'),
  firstSeenAt: text('first_seen_at').notNull(),
  lastSeenAt: text('last_seen_at').notNull(),
  ...timestamps,
}, (table) => [uniqueIndex('uq_agent_actions_workspace_fingerprint').on(table.workspaceId, table.fingerprint), index('idx_agent_actions_workspace_status').on(table.workspaceId, table.status, table.updatedAt), index('idx_agent_actions_product_status').on(table.productId, table.status)]);

export const agentActionOccurrences = sqliteTable('agent_action_occurrences', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  actionId: text('action_id').notNull().references(() => agentActions.id, { onDelete: 'cascade' }),
  analysisRunId: text('analysis_run_id').notNull().references(() => analysisRuns.id, { onDelete: 'cascade' }),
  findingIndex: integer('finding_index').notNull(),
  evidenceRefsJson: text('evidence_refs_json').notNull().default('[]'),
  seenAt: text('seen_at').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex('uq_agent_action_occurrence_run_finding').on(table.analysisRunId, table.findingIndex), index('idx_agent_action_occurrences_action').on(table.actionId, table.seenAt), index('idx_agent_action_occurrences_workspace').on(table.workspaceId, table.seenAt)]);

export const agentActionOutcomes = sqliteTable('agent_action_outcomes', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  actionId: text('action_id').notNull().references(() => agentActions.id, { onDelete: 'cascade' }),
  sourceAnalysisRunId: text('source_analysis_run_id').references(() => analysisRuns.id, { onDelete: 'set null' }),
  productId: text('product_id').references(() => products.id, { onDelete: 'set null' }),
  metric: text('metric'),
  source: text('source'),
  currency: text('currency'),
  direction: text('direction', { enum: ['increase_good', 'decrease_good', 'contextual'] }).notNull().default('contextual'),
  baselineEvidenceRef: text('baseline_evidence_ref'),
  baselineValue: real('baseline_value'),
  baselineDate: text('baseline_date'),
  latestValue: real('latest_value'),
  latestDate: text('latest_date'),
  changePercent: real('change_percent'),
  assessment: text('assessment', { enum: ['awaiting', 'improved', 'regressed', 'unchanged', 'changed', 'insufficient'] }).notNull().default('awaiting'),
  limitation: text('limitation').notNull(),
  completedAt: text('completed_at').notNull(),
  measuredAt: text('measured_at'),
  ...timestamps,
}, (table) => [uniqueIndex('uq_agent_action_outcome_completion').on(table.actionId, table.completedAt), index('idx_agent_action_outcomes_workspace_assessment').on(table.workspaceId, table.assessment, table.updatedAt), index('idx_agent_action_outcomes_action').on(table.actionId, table.completedAt)]);

export const agentGrowthMissions = sqliteTable('agent_growth_missions', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  sourceActionId: text('source_action_id').references(() => agentActions.id, { onDelete: 'set null' }),
  sourceActionOccurrenceCount: integer('source_action_occurrence_count').notNull(),
  sourceAnalysisRunId: text('source_analysis_run_id').references(() => analysisRuns.id, { onDelete: 'set null' }),
  productId: text('product_id').references(() => products.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  hypothesis: text('hypothesis').notNull(),
  metric: text('metric').notNull(),
  source: text('source').notNull(),
  currency: text('currency'),
  baselineEvidenceRef: text('baseline_evidence_ref').notNull(),
  baselineValue: real('baseline_value').notNull(),
  baselineDate: text('baseline_date').notNull(),
  targetValue: real('target_value').notNull(),
  latestValue: real('latest_value'),
  latestDate: text('latest_date'),
  changePercent: real('change_percent'),
  progressPercent: real('progress_percent').notNull().default(0),
  status: text('status', { enum: ['active', 'achieved', 'missed', 'insufficient', 'cancelled'] }).notNull().default('active'),
  assessment: text('assessment', { enum: ['awaiting', 'on_track', 'off_track', 'achieved', 'missed', 'insufficient', 'cancelled'] }).notNull().default('awaiting'),
  limitation: text('limitation').notNull(),
  assignedUserId: text('assigned_user_id'),
  createdByUserId: text('created_by_user_id').notNull(),
  startsAt: text('starts_at').notNull(),
  dueAt: text('due_at').notNull(),
  finishedAt: text('finished_at'),
  measuredAt: text('measured_at'),
  ...timestamps,
}, (table) => [
  uniqueIndex('uq_agent_growth_mission_action_cycle').on(table.sourceActionId, table.sourceActionOccurrenceCount),
  index('idx_agent_growth_missions_workspace_status').on(table.workspaceId, table.status, table.dueAt),
  index('idx_agent_growth_missions_product').on(table.productId, table.status),
]);

export const agentComparisonRuns = sqliteTable('agent_comparison_runs', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  agentPreset: text('agent_preset', { enum: ['portfolio_analyst', 'revenue_analyst', 'seo_growth_analyst', 'operations_analyst', 'client_reporting_analyst'] }).notNull(),
  question: text('question').notNull(),
  promptVersion: text('prompt_version').notNull(),
  evidenceJson: text('evidence_json').notNull(),
  providerCount: integer('provider_count').notNull(),
  status: text('status', { enum: ['running', 'success', 'partial', 'error'] }).notNull().default('running'),
  createdByUserId: text('created_by_user_id').notNull(),
  startedAt: text('started_at').notNull(),
  finishedAt: text('finished_at'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index('idx_agent_comparisons_workspace_created').on(table.workspaceId, table.createdAt)]);

export const agentComparisonResults = sqliteTable('agent_comparison_results', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  comparisonRunId: text('comparison_run_id').notNull().references(() => agentComparisonRuns.id, { onDelete: 'cascade' }),
  aiProviderAccountId: text('ai_provider_account_id').references(() => aiProviderAccounts.id, { onDelete: 'set null' }),
  providerName: text('provider_name').notNull(),
  providerMode: text('provider_mode', { enum: ['byok', 'managed'] }).notNull(),
  model: text('model').notNull(),
  promptVersion: text('prompt_version').notNull(),
  status: text('status', { enum: ['running', 'success', 'error'] }).notNull().default('running'),
  findingsJson: text('findings_json'),
  evaluationJson: text('evaluation_json'),
  inputTokens: integer('input_tokens').notNull().default(0),
  outputTokens: integer('output_tokens').notNull().default(0),
  latencyMs: integer('latency_ms').notNull().default(0),
  errorCode: text('error_code'),
  startedAt: text('started_at').notNull(),
  finishedAt: text('finished_at'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex('uq_agent_comparison_provider').on(table.comparisonRunId, table.aiProviderAccountId), index('idx_agent_comparison_results_workspace').on(table.workspaceId, table.comparisonRunId)]);

export const aiUsageEvents = sqliteTable('ai_usage_events', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  analysisRunId: text('analysis_run_id').references(() => analysisRuns.id, { onDelete: 'set null' }),
  idempotencyKey: text('idempotency_key').notNull(),
  source: text('source', { enum: ['byok'] }).notNull(),
  model: text('model').notNull(),
  inputTokens: integer('input_tokens').notNull().default(0),
  outputTokens: integer('output_tokens').notNull().default(0),
  estimatedCostMicros: integer('estimated_cost_micros').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex('uq_ai_usage_idempotency').on(table.workspaceId, table.idempotencyKey), index('idx_ai_usage_workspace_created').on(table.workspaceId, table.createdAt)]);

export const reports = sqliteTable('reports', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  scopeMode: text('scope_mode', { enum: ['workspace', 'product'] }).notNull().default('workspace'),
  productId: text('product_id').references(() => products.id, { onDelete: 'set null' }),
  analysisRunId: text('analysis_run_id').references(() => analysisRuns.id, { onDelete: 'set null' }),
  executiveBriefId: text('executive_brief_id').references(() => agentExecutiveBriefs.id, { onDelete: 'set null' }),
  idempotencyKey: text('idempotency_key'),
  cadence: text('cadence', { enum: ['daily', 'weekly', 'monthly', 'manual'] }).notNull(),
  periodStart: text('period_start').notNull(),
  periodEnd: text('period_end').notNull(),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  contentMarkdown: text('content_markdown').notNull(),
  status: text('status', { enum: ['draft', 'ready', 'delivering', 'delivered', 'error'] }).notNull().default('draft'),
  ...timestamps,
}, (table) => [uniqueIndex('uq_reports_workspace_idempotency').on(table.workspaceId, table.idempotencyKey), index('idx_reports_workspace_period').on(table.workspaceId, table.periodEnd), index('idx_reports_status').on(table.status), index('idx_reports_product_period').on(table.productId, table.periodEnd)]);

export const reportSchedules = sqliteTable('report_schedules', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  scopeMode: text('scope_mode', { enum: ['workspace', 'product'] }).notNull().default('workspace'),
  productId: text('product_id').references(() => products.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  cadence: text('cadence', { enum: ['daily', 'weekly', 'monthly'] }).notNull(),
  kind: text('kind', { enum: ['specialist', 'executive'] }).notNull().default('specialist'),
  agentPreset: text('agent_preset', { enum: ['portfolio_analyst', 'revenue_analyst', 'seo_growth_analyst', 'operations_analyst', 'client_reporting_analyst'] }).notNull(),
  executivePresetsJson: text('executive_presets_json').notNull().default('[]'),
  executiveQuestion: text('executive_question'),
  createdByUserId: text('created_by_user_id'),
  timezone: text('timezone').notNull().default('UTC'),
  hourLocal: integer('hour_local').notNull().default(8),
  dayOfWeek: integer('day_of_week'),
  dayOfMonth: integer('day_of_month'),
  channelIdsJson: text('channel_ids_json').notNull().default('[]'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  nextRunAt: text('next_run_at').notNull(),
  lastRunAt: text('last_run_at'),
  lastStatus: text('last_status', { enum: ['never', 'success', 'error'] }).notNull().default('never'),
  lastErrorCode: text('last_error_code'),
  consecutiveFailures: integer('consecutive_failures').notNull().default(0),
  activeOccurrenceAt: text('active_occurrence_at'),
  ...timestamps,
}, (table) => [index('idx_report_schedules_due').on(table.enabled, table.nextRunAt), index('idx_report_schedules_workspace').on(table.workspaceId, table.cadence), index('idx_report_schedules_product').on(table.productId, table.enabled, table.nextRunAt)]);

export const ingestionApiKeys = sqliteTable('ingestion_api_keys', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  productId: text('product_id').references(() => products.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  tokenPrefix: text('token_prefix').notNull(),
  tokenHash: text('token_hash').notNull(),
  lastUsedAt: text('last_used_at'),
  revokedAt: text('revoked_at'),
  createdByUserId: text('created_by_user_id').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex('uq_ingestion_api_key_hash').on(table.tokenHash), index('idx_ingestion_api_keys_workspace').on(table.workspaceId, table.createdAt), index('idx_ingestion_api_keys_product').on(table.productId, table.createdAt)]);

export const agentSkillManifests = sqliteTable('agent_skill_manifests', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  version: text('version').notNull(),
  basePreset: text('base_preset', { enum: ['portfolio_analyst', 'revenue_analyst', 'seo_growth_analyst', 'operations_analyst', 'client_reporting_analyst'] }).notNull(),
  instructions: text('instructions').notNull(),
  requiredMetricsJson: text('required_metrics_json').notNull().default('[]'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  createdByUserId: text('created_by_user_id').notNull(),
  ...timestamps,
}, (table) => [uniqueIndex('uq_agent_skills_workspace_slug').on(table.workspaceId, table.slug), index('idx_agent_skills_workspace_preset').on(table.workspaceId, table.basePreset, table.enabled)]);

export const syncSchedules = sqliteTable('sync_schedules', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  source: text('source', { enum: ['cloudflare', 'cloudflare_r2', 'cloudflare_pages', 'cloudflare_queues', 'google', 'd1', 'stripe', 'lemonsqueezy', 'creem', 'polar', 'paddle', 'supabase', 'github', 'vercel', 'custom'] }).notNull(),
  frequencyMinutes: integer('frequency_minutes').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  nextRunAt: text('next_run_at').notNull(),
  lastRunAt: text('last_run_at'),
  lastSuccessAt: text('last_success_at'),
  retryAttempt: integer('retry_attempt').notNull().default(0),
  lastError: text('last_error'),
  ...timestamps,
}, (table) => [uniqueIndex('uq_sync_schedule_workspace_source').on(table.workspaceId, table.source), index('idx_sync_schedules_due').on(table.enabled, table.nextRunAt)]);
