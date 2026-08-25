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
