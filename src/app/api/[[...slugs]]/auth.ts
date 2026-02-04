import Elysia from 'elysia'
import { redis } from '@/lib/redis'

class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

// NOTE: Elysia plugin that will be executed before the route handler
// `.derive` is used to compute and attach `auth` to the request context
export const authMiddleware = new Elysia({ name: 'auth' })
  .error({ AuthError })
  // NOTE: define error detail for error in .derive
  .onError(({ code, set }) => {
    if (code === 'AuthError') {
      set.status = 401
      return { error: 'Unauthorized' }
    }
  })
  .derive({ as: 'scoped' }, async ({ query, cookie }) => {
    const roomId = query.roomId
    const token = cookie['x-auth-token'].value as string | undefined

    if (!roomId || !token) {
      throw new AuthError('Missing roomId or token.')
    }

    // retrieve only connected property in upstash
    const connected = await redis.hget<string[]>(`meta:${roomId}`, 'connected')

    if (!connected?.includes(token)) {
      throw new AuthError('Invalid token')
    }

    // NOTE: auth will be available in route handler
    return { auth: { roomId, token, connected } }
  })
