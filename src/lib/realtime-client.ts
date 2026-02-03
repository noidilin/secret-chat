'use client'

import { createRealtime } from '@upstash/realtime/client'
import type { RealtimeEvents } from './realtime'

// NOTE: infer type from the schema we defined
export const { useRealtime } = createRealtime<RealtimeEvents>()
