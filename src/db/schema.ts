import { sql } from 'drizzle-orm'
import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull().default(''),
  schoolCode: text('school_code'),
  fullname: text('fullname'),
  phoneNumber: text('phone_number'),
  principalsEmail: text('principals_email'),
  individual: integer('individual', { mode: 'boolean' }).notNull().default(false),
  institutionName: text('institution_name'),
  address: text('address'),
  principalsName: text('principals_name'),
  registrations: text('registrations').notNull().default('{}'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const events = sqliteTable('events', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  image: text('image'),
  openToAll: integer('open_to_all', { mode: 'boolean' }).notNull().default(false),
  eligibility: text('eligibility'),
  participants: integer('participants').notNull().default(1),
  mode: text('mode').notNull().default('online'),
  independentRegistration: integer('independent_registration', { mode: 'boolean' }).notNull().default(true),
  points: integer('points').notNull().default(0),
  dates: text('dates'),
  descriptionLong: text('description_long'),
  descriptionShort: text('description_short'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  nameIdx: index('idx_events_name').on(t.name),
}))


export const registrations = sqliteTable('registrations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventId: text('event_id').notNull().references(() => events.id),
  userId: integer('user_id').notNull().references(() => users.id),
  teamName: text('team_name'),
  status: text('status').notNull().default('pending'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  eventUserIdx: index('idx_registrations_event_user').on(t.eventId, t.userId),
  statusIdx: index('idx_registrations_status').on(t.status),
}))

export const individualRegistrations = sqliteTable('individual_registrations', {
  id: integer('id').primaryKey({ autoIncrement: true }),

  userId: integer('user_id')
    .notNull()
    .references(() => users.id),

  eventId: text('event_id'),

  fullname: text('fullname'),
  userEmail: text('user_email'),

  phoneNumber: text('phone_number'),
  className: text('class'),

  schoolName: text('school_name'),
  schoolCode: text('school_code'),
  address: text('address'),

  createdAt: text('created_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),

  updatedAt: text('updated_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  userEventIdx: index('idx_individual_regs_user_event').on(t.userId, t.eventId),
}))

export const logs = sqliteTable('logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  reason: text('reason').notNull(),
  content: text('content'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

// OAUTH
export const oauthTokens = sqliteTable('oauth_tokens', {
  provider: text('provider').primaryKey(),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  scope: text('scope'),
  tokenType: text('token_type'),
  expiresAt: text('expires_at'),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

function participantCols(n: number) {
  return {
    [`p${n}Name`]: text(`p${n}_name`),
    [`p${n}Email`]: text(`p${n}_email`),
    [`p${n}Class`]: text(`p${n}_class`),
    [`p${n}Phone`]: text(`p${n}_phone`),
  }
}

export const usrRegs = sqliteTable('usr_regs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username'),
  institution: text('institution'),
  eventId: text('event_id'),
  ...participantCols(1),
  ...participantCols(2),
  ...participantCols(3),
  ...participantCols(4),
  ...participantCols(5),
  ...participantCols(6),
  ...participantCols(7),
  ...participantCols(8),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  usernameEventIdx: uniqueIndex('idx_usr_regs_username_event').on(t.username, t.eventId),
}))

export const authSessions = sqliteTable('auth_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),

  email: text('email').notNull(),

  token: text('token').notNull().unique(),

  expiresAt: text('expires_at').notNull(),

  createdAt: text('created_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
})


// OTPS
export const passwordResetOtps = sqliteTable('password_reset_otps', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull(),
  otpHash: text('otp_hash').notNull(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),

  requestCount: integer('request_count').notNull().default(1),

  requestDay: text('request_day').notNull().default(''),

  attemptCount: integer('attempt_count').notNull().default(0),
})

export const conversations = sqliteTable('conversations', {
    id: text('id').primaryKey(),

    userId: integer('user_id')
        .notNull()
        .references(() => users.id),

    email: text('email').notNull(),

    title: text('title').notNull().default('New conversation'),

    status: text('status').notNull().default('active'),

    messageCount: integer('message_count').notNull().default(0),

    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
    userIdx: index('idx_conversations_user').on(t.userId),
}))

export const chatMessages = sqliteTable('chat_messages', {
    id: integer('id').primaryKey({ autoIncrement: true }),

    conversationId: text('conversation_id')
        .notNull()
        .references(() => conversations.id),

    role: text('role').notNull(),

    content: text('content').notNull(),

    edits: text('edits').notNull().default('[]'),

    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
    conversationIdx: index('idx_chat_messages_conversation').on(t.conversationId),
}))

export const kbSources = sqliteTable('kb_sources', {
    id: integer('id').primaryKey({ autoIncrement: true }),

    url: text('url').notNull().unique(),

    docId: text('doc_id').notNull(),

    title: text('title'),

    contentHash: text('content_hash'),

    chunkCount: integer('chunk_count').notNull().default(0),

    status: text('status').notNull().default('pending'),

    enabled: integer('enabled').notNull().default(1),

    errorMessage: text('error_message'),

    lastSyncedAt: text('last_synced_at'),

    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const kbChunks = sqliteTable('kb_chunks', {
    id: integer('id').primaryKey({ autoIncrement: true }),

    sourceId: integer('source_id')
        .notNull()
        .references(() => kbSources.id),

    chunkIndex: integer('chunk_index').notNull(),

    vectorId: text('vector_id').notNull().unique(),

    content: text('content').notNull(),

    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
    sourceIdx: index('idx_kb_chunks_source').on(t.sourceId),
}))

export const tickets = sqliteTable('tickets', {
    id: integer('id').primaryKey({ autoIncrement: true }),

    conversationId: text('conversation_id')
        .references(() => conversations.id),

    userEmail: text('user_email').notNull(),

    subject: text('subject').notNull(),

    message: text('message').notNull(),

    createdBy: text('created_by').notNull(),

    status: text('status').notNull().default('open'),

    category: text('category'),

    priority: text('priority').notNull().default('medium'),

    attachments: text('attachments').notNull().default('[]'),

    adminReply: text('admin_reply'),

    repliedBy: text('replied_by'),

    repliedAt: text('replied_at'),

    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
    statusIdx: index('idx_tickets_status').on(t.status),
    conversationIdx: index('idx_tickets_conversation').on(t.conversationId),
}))

// QUERY.ts Handler

export const queries = sqliteTable('queries', {
    id: integer('id').primaryKey({ autoIncrement: true }),

    email: text('email').notNull(),

    subject: text('subject').notNull(),

    message: text('message').notNull(),

    status: text('status')
        .notNull()
        .default('open'),

    createdAt: text('created_at')
        .notNull()
        .default(sql`CURRENT_TIMESTAMP`),

    updatedAt: text('updated_at')
        .notNull()
        .default(sql`CURRENT_TIMESTAMP`),
})