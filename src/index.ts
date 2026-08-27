import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import type { Bindings } from './types'
import { logger } from './middleware/logger'
import { setupRoutes } from './routes/routes'

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', logger)
app.use('*', cors({ origin: '*', credentials: true }))
app.use('*', secureHeaders({
    xFrameOptions: 'DENY',
    xContentTypeOptions: 'nosniff',
    referrerPolicy: 'strict-origin-when-cross-origin',
}))

app.route('/', setupRoutes())

export default app
