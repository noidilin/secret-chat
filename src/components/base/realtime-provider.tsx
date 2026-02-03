'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RealtimeProvider } from '@upstash/realtime/client'
import { useState } from 'react'

export default function RealtimeProviders({
  children,
}: {
  children: React.ReactNode
}) {
  // NOTE: initialize tanstack query
  const [queryClient] = useState(() => new QueryClient())

  return (
    <RealtimeProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </RealtimeProvider>
  )
}
