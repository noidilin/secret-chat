'use client'

import { useMutation } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useUsername } from '@/hooks/use-username'
import { api } from '@/lib/api'

export default function Page() {
  return (
    <Suspense>
      <Lobby />
    </Suspense>
  )
}

function Lobby() {
  const { username } = useUsername()
  const router = useRouter()

  const searchParams = useSearchParams()
  const wasDestroyed = searchParams.get('destroyed') === 'true'
  const error = searchParams.get('error')

  const { mutate: createRoom } = useMutation({
    mutationFn: async () => {
      // NOTE: client comes from elysia backend
      // the method we are allowed to use is fully type-safe
      const res = await api.room.create.post()

      if (res.status === 200) {
        router.push(`/room/${res.data?.roomId}`) // also fully type-safe
      }
    },
  })

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {wasDestroyed && (
          <Card className="border border-red-900 bg-red-950/50 text-center">
            <CardHeader>
              <CardTitle className="font-bold text-red-500">
                ROOM DESTROYED
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              All messages were permanently deleted.
            </CardContent>
          </Card>
        )}
        {error === 'room-not-found' && (
          <Card className="border border-red-900 bg-red-950/50 text-center">
            <CardHeader>
              <CardTitle className="font-bold text-red-500">
                ROOM NOT FOUND
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              This room may have expired or never existed.
            </CardContent>
          </Card>
        )}
        {error === 'room-full' && (
          <Card className="border border-red-900 bg-red-950/50 text-center">
            <CardHeader>
              <CardTitle className="font-bold text-red-500">
                ROOM FULL
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              This room is at maximum capacity.
            </CardContent>
          </Card>
        )}

        <div className="space-y-2 text-center">
          <h1 className="font-bold text-2xl text-green-500 tracking-tight">
            {'>'}private_chat
          </h1>
          <p className="text-muted-foreground text-sm">
            A private, self-destructing chat room.
          </p>
        </div>

        <Card className="border border-muted/60 bg-background/50 p-6 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="font-semibold text-muted-foreground">
              Your Identity
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3">
            <div className="w-full border border-muted/60 bg-primary-foreground p-3 text-foreground text-sm">
              {username}
            </div>
            <Button
              type="button"
              onClick={() => createRoom()}
              className="mt-2 w-full cursor-pointer bg-foreground p-3 font-bold text-background text-sm transition-colors hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
            >
              CREATE SECURE ROOM
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
