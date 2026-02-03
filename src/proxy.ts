import { nanoid } from 'nanoid'
import { type NextRequest, NextResponse } from 'next/server'
import { redis } from './lib/redis'

export async function proxy(req: NextRequest) {
  // NOTE: regex to access room id in group 1
  const pathname = req.nextUrl.pathname
  const roomMatch = pathname.match(/^\/room\/([^/]+)$/)
  if (!roomMatch) return NextResponse.redirect(new URL('/', req.url))

  const roomId = roomMatch[1]

  // NOTE: get data from upstash
  // type is defined by elysiaJS route handler
  const meta = await redis.hgetall<{ connected: string[]; createdAt: number }>(
    `meta:${roomId}`,
  )
  if (!meta) {
    return NextResponse.redirect(new URL('/?error=room-not-found', req.url))
  }

  // PERF: prevent new token being generated everytime the proxy runs
  const existingToken = req.cookies.get('x-auth-token')?.value
  // If user is allowed to join room
  if (existingToken && meta.connected.includes(existingToken)) {
    return NextResponse.next()
  }
  // If user is not allowed to join (room is full)
  if (meta.connected.length >= 2) {
    return NextResponse.redirect(new URL('/?error=room-full', req.url))
  }

  // NOTE: use arbitrary token to handle auth
  const token = nanoid()
  const response = NextResponse.next()
  response.cookies.set('x-auth-token', token, {
    path: '/', // token will be send within any request across the whole website
    httpOnly: true, // client-side javascript can not read cookies
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  })
  // mark user as being connected to this room
  await redis.hset(`meta:${roomId}`, {
    connected: [...meta.connected, token],
  })
  return response
}

export const config = {
  matcher: '/room/:path*',
}
