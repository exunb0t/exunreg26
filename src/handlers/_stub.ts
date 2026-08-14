import type { AppContext } from '../types'
import { jsonError } from '../lib/response'

export function notImplemented(c: AppContext) {
  return jsonError(c, 'Not implemented', 501)
}
