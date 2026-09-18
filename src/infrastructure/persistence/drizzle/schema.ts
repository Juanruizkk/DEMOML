import {
  pgTable, text, integer, boolean, timestamp, doublePrecision,
  serial, bigint, uniqueIndex, index,
} from 'drizzle-orm/pg-core';

export const tenants = pgTable('tenants', {
  id: text('id').primaryKey(),
  sellerId: text('seller_id').notNull().unique(),
  nickname: text('nickname'),
  email: text('email'),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token').notNull(),
  expiresAt: bigint('expires_at', { mode: 'number' }).notNull(),
  settingsJson: text('settings_json').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  billingStatus: text('billing_status').default('active'),
  nextBillingDate: timestamp('next_billing_date'),
});

export const questions = pgTable('questions', {
  questionId: text('question_id').primaryKey(),
  sellerId: text('seller_id').notNull().default('default'),
  itemId: text('item_id').notNull(),
  buyerId: text('buyer_id'),
  text: text('text').notNull(),
  mlStatus: text('ml_status'),
  intent: text('intent'),
  confidence: doublePrecision('confidence'),
  requiresHuman: boolean('requires_human').default(false),
  reason: text('reason'),
  suggestedAnswer: text('suggested_answer'),
  finalAnswer: text('final_answer'),
  appStatus: text('app_status').notNull(),
  receivedAt: timestamp('received_at').defaultNow(),
  answeredAt: timestamp('answered_at'),
  latencyMs: integer('latency_ms'),
  mlError: text('ml_error'),
}, (table) => [
  index('idx_questions_seller').on(table.sellerId),
  index('idx_questions_status').on(table.appStatus),
]);

export const itemsCache = pgTable('items_cache', {
  itemId: text('item_id').primaryKey(),
  sellerId: text('seller_id'),
  payloadJson: text('payload_json').notNull(),
  cachedAt: bigint('cached_at', { mode: 'number' }).notNull(),
});

export const events = pgTable('events', {
  id: serial('id').primaryKey(),
  sellerId: text('seller_id'),
  questionId: text('question_id'),
  type: text('type').notNull(),
  message: text('message').notNull(),
  durationMs: integer('duration_ms'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('idx_events_seller').on(table.sellerId),
]);

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  sellerId: text('seller_id'),
  status: text('status').notNull().default('active'),
  activationToken: text('activation_token'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index('idx_users_email').on(table.email),
  index('idx_users_seller').on(table.sellerId),
]);

export const appConfig = pgTable('app_config', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export const claims = pgTable('claims', {
  id: text('id').primaryKey(),
  sellerId: text('seller_id').notNull(),
  orderId: text('order_id').notNull(),
  type: text('type').notNull(),
  stage: text('stage').notNull(),
  status: text('status').notNull(),
  reason: text('reason').notNull(),
  reasonDetail: text('reason_detail'),
  buyerId: text('buyer_id'),
  buyerNickname: text('buyer_nickname'),
  itemId: text('item_id'),
  itemTitle: text('item_title'),
  itemPrice: doublePrecision('item_price'),
  itemQuantity: integer('item_quantity'),
  complainantMessage: text('complainant_message'),
  actionsJson: text('actions_json').notNull().default('[]'),
  dueDate: timestamp('due_date').notNull(),
  notifiedAt: timestamp('notified_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index('idx_claims_seller').on(table.sellerId),
  index('idx_claims_due_date').on(table.dueDate),
]);

export const itemKnowledge = pgTable('item_knowledge', {
  id: text('id').primaryKey(),
  sellerId: text('seller_id').notNull(),
  itemId: text('item_id').notNull(),
  customInstructions: text('custom_instructions').default(''),
  faqsJson: text('faqs_json').default('[]'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  uniqueIndex('item_knowledge_seller_item_key').on(table.sellerId, table.itemId),
  index('idx_item_knowledge_seller').on(table.sellerId),
]);

export const orderMessages = pgTable('order_messages', {
  id: text('id').primaryKey(),
  sellerId: text('seller_id').notNull(),
  packId: text('pack_id').notNull(),
  orderId: text('order_id'),
  buyerId: text('buyer_id').notNull(),
  buyerNickname: text('buyer_nickname'),
  itemId: text('item_id'),
  itemTitle: text('item_title'),
  messageText: text('message_text').notNull(),
  senderRole: text('sender_role').notNull(),
  intent: text('intent'),
  confidence: doublePrecision('confidence'),
  requiresHuman: boolean('requires_human').default(false),
  reason: text('reason'),
  suggestedAnswer: text('suggested_answer'),
  finalAnswer: text('final_answer'),
  status: text('status').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  repliedAt: timestamp('replied_at'),
  latencyMs: integer('latency_ms'),
  mlError: text('ml_error'),
}, (table) => [
  index('idx_order_messages_seller').on(table.sellerId),
  index('idx_order_messages_pack').on(table.packId),
  index('idx_order_messages_status').on(table.status),
]);

export const llmUsageLogs = pgTable('llm_usage_logs', {
  id: serial('id').primaryKey(),
  sellerId: text('seller_id').notNull(),
  channel: text('channel').notNull(),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  tokensIn: integer('tokens_in').notNull().default(0),
  tokensOut: integer('tokens_out').notNull().default(0),
  tokensEstimated: boolean('tokens_estimated').notNull().default(false),
  costUsd: doublePrecision('cost_usd').notNull().default(0),
  latencyMs: integer('latency_ms').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('idx_llm_usage_logs_seller_date').on(table.sellerId, table.createdAt),
]);

export const llmUsageMonthly = pgTable('llm_usage_monthly', {
  id: serial('id').primaryKey(),
  sellerId: text('seller_id').notNull(),
  yearMonth: text('year_month').notNull(),
  totalCalls: integer('total_calls').notNull().default(0),
  totalTokens: integer('total_tokens').notNull().default(0),
  totalCostUsd: doublePrecision('total_cost_usd').notNull().default(0),
  spendingLimitUsd: doublePrecision('spending_limit_usd'),
  alertSentAt: timestamp('alert_sent_at'),
}, (table) => [
  uniqueIndex('llm_usage_monthly_seller_month_key').on(table.sellerId, table.yearMonth),
  index('idx_llm_usage_monthly_seller').on(table.sellerId, table.yearMonth),
]);

export const goldenDataset = pgTable('golden_dataset', {
  id: text('id').primaryKey(),
  sellerId: text('seller_id').notNull(),
  sourceQuestionId: text('source_question_id').notNull(),
  questionText: text('question_text').notNull(),
  itemSnapshot: text('item_snapshot').notNull(), // JSON.stringify del ítem completo
  llmIntent: text('llm_intent').notNull(),
  humanIntent: text('human_intent').notNull(),
  llmAnswer: text('llm_answer').notNull(),
  finalAnswer: text('final_answer').notNull(),
  decision: text('decision').notNull(), // 'approved' | 'edited' | 'edited_from_scratch'
  qualityRating: integer('quality_rating'), // 1-5, nullable
  reviewerId: text('reviewer_id'),
  reasoningNote: text('reasoning_note'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('idx_golden_seller').on(table.sellerId),
  index('idx_golden_intent').on(table.humanIntent),
  index('idx_golden_decision').on(table.decision),
  index('idx_golden_source_question').on(table.sourceQuestionId),
]);
