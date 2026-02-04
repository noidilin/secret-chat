'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useUsername } from '@/hooks/use-username'
import { api } from '@/lib/api'
import { useRealtime } from '@/lib/realtime-client'
import { cn } from '@/lib/utils'

function formatTimeRemaining(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export default function Page() {
  const params = useParams()
  const roomId = params.roomId as string

  const router = useRouter()

  const { username } = useUsername()
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const [copyStatus, setCopyStatus] = useState('COPY')
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)

  const { data: ttlData } = useQuery({
    queryKey: ['ttl', roomId],
    queryFn: async () => {
      const res = await api.room.ttl.get({ query: { roomId } })
      return res.data
    },
  })

  useEffect(() => {
    if (ttlData?.ttl !== undefined) setTimeRemaining(ttlData.ttl)
  }, [ttlData])

  useEffect(() => {
    if (timeRemaining === null || timeRemaining < 0) return

    if (timeRemaining === 0) {
      router.push('/?destroyed=true')
      return
    }

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [timeRemaining, router])

  const { data: messages, refetch } = useQuery({
    queryKey: ['messages', roomId],
    queryFn: async () => {
      const res = await api.messages.get({ query: { roomId } })
      return res.data
    },
  })

  const { mutate: sendMessage, isPending } = useMutation({
    mutationFn: async ({ text }: { text: string }) => {
      await api.messages.post({ sender: username, text }, { query: { roomId } })

      setInput('')
    },
  })

  useRealtime({
    channels: [roomId],
    events: ['chat.message', 'chat.destroy'],
    onData: ({ event }) => {
      if (event === 'chat.message') refetch() // from tanstack query
      if (event === 'chat.destroy') router.push('/?destroyed=true') // state in url
    },
  })

  const { mutate: destroyRoom } = useMutation({
    mutationFn: async () => {
      await api.room.delete(null, { query: { roomId } })
    },
  })

  const copyLink = () => {
    const url = window.location.href
    navigator.clipboard.writeText(url)
    setCopyStatus('COPIED!')
    setTimeout(() => setCopyStatus('COPY'), 2000)
  }

  return (
    <main className="flex h-screen max-h-screen flex-col overflow-hidden">
      <header className="flex items-center justify-between border-muted border-b bg-zinc-900/30 p-4">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-muted-foreground text-xs uppercase">
              Room ID
            </span>
            <div className="flex items-center gap-2">
              <span className="truncate font-bold text-green-500">
                {`${roomId.slice(0, 10)}...`}
              </span>
              <Button
                type="button"
                onClick={copyLink}
                size="xs"
                className="rounded bg-muted text-foreground text-xs transition-colors hover:bg-muted/80 hover:text-primary"
              >
                {copyStatus}
              </Button>
            </div>
          </div>

          <div className="h-8 w-px bg-background/50" />

          <div className="flex flex-col">
            <span className="text-muted-foreground text-xs uppercase">
              Self-Destruct
            </span>
            <span
              className={cn(
                'flex items-center gap-2 font-bold text-sm',
                timeRemaining !== null && timeRemaining < 60
                  ? 'text-red-500'
                  : 'text-primary',
              )}
            >
              {timeRemaining !== null
                ? formatTimeRemaining(timeRemaining)
                : '--:--'}
            </span>
          </div>
        </div>

        <Button
          type="button"
          onClick={() => destroyRoom()}
          className="group flex items-center gap-2 rounded bg-primary-foreground px-3 py-1.5 font-bold text-foreground text-xs transition-all hover:bg-red-950 hover:text-primary disabled:opacity-50"
        >
          <span className="text-red-500 group-hover:animate-pulse">X</span>
          DESTROY NOW
        </Button>
      </header>

      {/* MESSAGES */}
      <div className="scrollbar-thin flex-1 space-y-4 overflow-y-auto p-4">
        {messages?.messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <p className="font-mono text-muted-foreground text-sm">
              No messages yet, start the conversation.
            </p>
          </div>
        )}

        {messages?.messages.map((msg) => (
          <div key={msg.id} className="flex flex-col items-start">
            <div className="group max-w-[80%]">
              <div className="mb-1 flex items-baseline gap-3">
                <span
                  className={`font-bold text-xs ${
                    msg.sender === username
                      ? 'text-green-500'
                      : 'text-amber-500'
                  }`}
                >
                  {msg.sender === username ? 'YOU' : msg.sender}
                </span>

                <span className="text-muted-foreground text-xs">
                  {format(msg.timestamp, 'HH:mm')}
                </span>
              </div>

              <p className="break-all text-foreground text-sm leading-relaxed">
                {msg.text}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="border-muted border-t p-4">
        <div className="flex gap-4">
          <div className="group relative flex-1">
            <span className="-translate-y-1/2 absolute top-1/2 left-4 animate-pulse text-green-500">
              {'>'}
            </span>
            <Input
              type="text"
              value={input}
              ref={inputRef}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && input.trim()) {
                  sendMessage({ text: input })
                  inputRef.current?.focus()
                }
              }}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type message..."
              className="w-full py-3 pr-4 pl-8 text-primary text-sm transition-colors focus:outline-none"
            />
          </div>

          <Button
            type="button"
            onClick={() => {
              sendMessage({ text: input })
              inputRef.current?.focus()
            }}
            disabled={!input.trim() || isPending}
            className="cursor-pointer bg-background/50 px-6 font-bold text-foreground text-sm transition-all hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            SEND
          </Button>
        </div>
      </div>
    </main>
  )
}
