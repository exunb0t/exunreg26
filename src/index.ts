import { Hono } from 'hono'
import type { Bindings } from './types'
import { logger } from './middleware/logger'
import { setupRoutes } from './routes/routes'

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', logger)

app.route('/', setupRoutes())

export default app
