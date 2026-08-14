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
  userId: integer('user_id').notNull().references(() => users.id),
  fullname: text('fullname'),
  userEmail: text('user_email'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const logs = sqliteTable('logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  reason: text('reason').notNull(),
  content: text('content'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

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
