import { type InferRealtimeEvents, Realtime } from '@upstash/realtime'
import z from 'zod'
import { redis } from '@/lib/redis'

// NOTE:only message and destory should be realtime
const message = z.object({
  id: z.string(),
  sender: z.string(),
  text: z.string(),
  timestamp: z.number(),
  roomId: z.string(),
  token: z.string().optional(),
})

const schema = {
  chat: {
    message,
    destroy: z.object({
      isDestroyed: z.literal(true),
    }),
  },
}

// NOTE: pass schema and db to realtime
export const realtime = new Realtime({ schema, redis })
export type RealtimeEvents = InferRealtimeEvents<typeof realtime>
export type Message = z.infer<typeof message>
