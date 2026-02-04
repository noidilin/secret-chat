import { Elysia } from 'elysia'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { redis } from '@/lib/redis'
import { authMiddleware } from './auth'

// time to live 10 minutes
const ROOM_TTL_SECONDS = 60 * 10

const rooms = new Elysia({ prefix: '/room' })
  .post('/create', async () => {
    const roomId = nanoid()

    // NOTE: create a room on upstash database
    await redis.hset(`meta:${roomId}`, {
      connected: [], // contains user's token to see which user is currently connected to room
      createdAt: Date.now(),
    })

    await redis.expire(`meta:${roomId}`, ROOM_TTL_SECONDS)

    return { roomId }
  })
  .use(authMiddleware) // define in auth.ts to act as a middleware

const messages = new Elysia({ prefix: '/messages' })
  // NOTE: since the middleware is executed before other method
  // the following method can access the return object from middleware
  .use(authMiddleware)
  .post(
    '/',
    async ({ body, auth }) => {
      const { sender, text } = body
      const { roomId } = auth

      const roomExists = await redis.exists(`meta:${roomId}`)
      if (!roomExists) throw new Error('Room does not exist')

      const message: Message = {
        id: nanoid(),
        sender,
        text,
        timestamp: Date.now(),
        roomId,
      }

      // NOTE: add message list (token is included in backend)
      await redis.rpush(`messages:${roomId}`, { ...message, token: auth.token })
      await realtime.channel(roomId).emit('chat.message', message)

      // NOTE: time to live
      const remaining = await redis.ttl(`meta:${roomId}`)
      await redis.expire(`messages:${roomId}`, remaining)
      await redis.expire(roomId, remaining)
    },
    {
      // PERF: define dedicated schema to validate every API request involves this data
      // the post handler function only executed if the data's shape pass the validator
      query: z.object({ roomId: z.string() }),
      body: z.object({
        sender: z.string().max(100),
        text: z.string().max(1000),
      }),
    },
  )

// NOTE: app is the main router and it use rooms + messages
export const app = new Elysia({ prefix: '/api' }).use(rooms).use(messages)

export const GET = app.fetch
export const POST = app.fetch
export const DELETE = app.fetch
