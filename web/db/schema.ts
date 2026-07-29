import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const profiles = sqliteTable("profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  description: text("description").notNull(),
  color: text("color").notNull().default("#0b6b4b"),
  createdAt: text("created_at").notNull(),
});

export const tools = sqliteTable("tools", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  category: text("category").notNull(),
});

export const profileTools = sqliteTable("profile_tools", {
  profileId: integer("profile_id").notNull().references(() => profiles.id),
  toolId: integer("tool_id").notNull().references(() => tools.id),
}, (table) => [uniqueIndex("profile_tools_unique").on(table.profileId, table.toolId)]);

export const notebooks = sqliteTable("notebooks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  assetTag: text("asset_tag").notNull().unique(),
  serial: text("serial").notNull().unique(),
  model: text("model").notNull(),
  status: text("status").notNull().default("available"),
  condition: text("condition").notNull().default("new"),
  location: text("location").notNull().default("Matriz"),
  warrantyUntil: text("warranty_until"),
  encrypted: integer("encrypted", { mode: "boolean" }).notNull().default(false),
  lastSeenAt: text("last_seen_at"),
  custodyLocation: text("custody_location").notNull().default("Estoque TI"),
  nextMaintenanceAt: text("next_maintenance_at"),
  createdAt: text("created_at").notNull(),
});

export const profileEntitlements = sqliteTable("profile_entitlements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  profileId: integer("profile_id").notNull().references(() => profiles.id),
  toolId: integer("tool_id").notNull().references(() => tools.id),
  role: text("role").notNull().default("user"),
  scope: text("scope").notNull().default("department"),
  restrictions: text("restrictions").notNull().default("Dispositivo gerenciado"),
});

export const accessRequests = sqliteTable("access_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  toolId: integer("tool_id").notNull().references(() => tools.id),
  requestedRole: text("requested_role").notNull(),
  justification: text("justification").notNull(),
  expiresAt: text("expires_at"),
  status: text("status").notNull().default("pending"),
  requestedBy: text("requested_by").notNull(),
  approvedBy: text("approved_by"),
  createdAt: text("created_at").notNull(),
});

export const recertificationCampaigns = sqliteTable("recertification_campaigns", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  dueAt: text("due_at").notNull(),
  status: text("status").notNull().default("active"),
  totalItems: integer("total_items").notNull(),
  reviewedItems: integer("reviewed_items").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const connectors = sqliteTable("connectors", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  category: text("category").notNull(),
  status: text("status").notNull().default("ready"),
  authType: text("auth_type").notNull(),
  description: text("description").notNull(),
});

export const assetEvents = sqliteTable("asset_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  notebookId: integer("notebook_id").notNull().references(() => notebooks.id),
  eventType: text("event_type").notNull(),
  details: text("details").notNull(),
  performedBy: text("performed_by").notNull(),
  createdAt: text("created_at").notNull(),
});

export const assetWorkOrders = sqliteTable("asset_work_orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  notebookId: integer("notebook_id").notNull().references(() => notebooks.id),
  orderType: text("order_type").notNull(),
  status: text("status").notNull().default("open"),
  assignee: text("assignee").notNull(),
  dueAt: text("due_at"),
  checklist: text("checklist").notNull().default("[]"),
  notes: text("notes").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
  completedAt: text("completed_at"),
});

export const adminAssignments = sqliteTable("admin_assignments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  role: text("role").notNull(),
  permissions: text("permissions").notNull(),
  status: text("status").notNull().default("active"),
});

export const installedApplications = sqliteTable("installed_applications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  notebookId: integer("notebook_id").notNull().references(() => notebooks.id),
  name: text("name").notNull(),
  version: text("version").notNull(),
  publisher: text("publisher").notNull(),
  policyStatus: text("policy_status").notNull().default("allowed"),
  detectedAt: text("detected_at").notNull(),
}, (table) => [uniqueIndex("installed_applications_notebook_name_unique").on(table.notebookId, table.name)]);

export const softwareCommands = sqliteTable("software_commands", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  notebookId: integer("notebook_id").notNull().references(() => notebooks.id),
  action: text("action").notNull(),
  applicationName: text("application_name").notNull(),
  targetVersion: text("target_version"),
  justification: text("justification").notNull(),
  status: text("status").notNull().default("queued"),
  executionMode: text("execution_mode").notNull().default("simulated"),
  requestedBy: text("requested_by").notNull(),
  result: text("result"),
  createdAt: text("created_at").notNull(),
  completedAt: text("completed_at"),
});

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  department: text("department").notNull(),
  deviceSerial: text("device_serial").notNull().unique(),
  profileId: integer("profile_id").references(() => profiles.id),
  notebookId: integer("notebook_id").references(() => notebooks.id),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull(),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  targetUser: text("target_user").notNull(),
  actionType: text("action_type").notNull(),
  details: text("details").notNull(),
  createdAt: text("created_at").notNull(),
});
