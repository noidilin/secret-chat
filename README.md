## Overview

This project is a private, self-destructing chat app built with Next.js 16 (App Router), Elysia for the API layer, and Upstash Redis plus Upstash Realtime for data and live updates. The core behavior is controlled by a small Redis schema, a room access guard (Next.js 16 `proxy.ts`), and a typed Elysia API that both the client and server can call safely.

Key files to orient yourself:

- `src/app/api/[[...slugs]]/route.ts` Elysia API routes for rooms and messages
- `src/app/api/[[...slugs]]/auth.ts` auth middleware that validates room access
- `src/app/api/realtime/route.ts` Upstash Realtime HTTP handler
- `src/lib/realtime.ts` realtime schema and server instance
- `src/lib/realtime-client.ts` client realtime hook
- `src/lib/redis.ts` Redis client
- `src/lib/api.ts` Eden treaty client for typed API access
- `src/proxy.ts` Next.js 16 middleware (renamed to proxy) for room access guard
- `src/app/page.tsx` lobby UI and room creation
- `src/app/room/[roomId]/page.tsx` chat room UI

## Tech Stack

- Next.js 16 App Router for UI and API routing
- Elysia for the API server embedded in Next.js routes
- @elysiajs/eden (treaty) for type-safe API calls from client and server
- Upstash Redis as the data store
- Upstash Realtime for pub/sub updates
- Zod for input and event schema validation
- TanStack Query for client caching and refetch

## Data Schema (Redis + Realtime)

All core behavior is driven by a tiny Redis schema and a realtime event schema.

Redis keys and shapes:

1) Room metadata

- Key: `meta:${roomId}` (hash)
- Shape: `{ connected: string[], createdAt: number }`
- TTL: 10 minutes (`ROOM_TTL_SECONDS` in `src/app/api/[[...slugs]]/route.ts`)

2) Message list

- Key: `messages:${roomId}` (list)
- Each item is a `Message` with a server-only `token` field
- TTL: kept in sync with `meta:${roomId}`

3) Auth token

- Cookie: `x-auth-token` (httpOnly)
- Stored per user; used to authorize room access

Realtime event schema (`src/lib/realtime.ts`):

- `chat.message` payload
  - `{ id, sender, text, timestamp, roomId, token? }`
- `chat.destroy` payload
  - `{ isDestroyed: true }`

The schema is enforced on both server and client via Zod and Upstash Realtime typing.

## Room Lifecycle

### 1) Room creation

Entry point: `POST /api/room/create` in `src/app/api/[[...slugs]]/route.ts`.

Flow:

- Generate `roomId` with `nanoid()`.
- Create `meta:${roomId}` hash with:
  - `connected: []` (token list of connected users)
  - `createdAt: Date.now()`
- Set TTL to 10 minutes on the room metadata.
- Return `{ roomId }` to the client.

Client usage: `src/app/page.tsx` calls `api.room.create.post()` and routes to `/room/${roomId}`.

### 2) Invite / join another user

Invite mechanism is share-the-link. The room URL is the invite.

- The room URL looks like `/room/:roomId`.
- `src/app/room/[roomId]/page.tsx` provides a copy button for the URL.

When a new user visits `/room/:roomId`, the Next.js 16 middleware (`src/proxy.ts`) runs and:

- Reads `meta:${roomId}` from Redis.
- If it does not exist, redirect to `/?error=room-not-found`.
- If the user already has a cookie token in `connected`, allow access.
- If `connected` already has 2 users, redirect to `/?error=room-full`.
- Otherwise, create a new token, set `x-auth-token` cookie, and append the token to `connected`.

This makes the invite flow a pure URL-share plus automatic token enrollment.

### 3) Authorization

Every protected Elysia route uses `authMiddleware` (`src/app/api/[[...slugs]]/auth.ts`).

Middleware logic:

- Reads `roomId` from query and `x-auth-token` from cookies.
- Loads `connected` from `meta:${roomId}`.
- Rejects with 401 if token is missing or not in `connected`.
- On success, injects `auth = { roomId, token, connected }` into the handler.

Effect:

- If you cannot pass the room guard in `src/proxy.ts`, you also cannot use the API.
- Both server and client API calls remain type-safe through Eden treaty.

### 4) Room destruction and TTL

There are two destruction paths:

1) Manual destroy (user action)

- API: `DELETE /api/room?roomId=...` in `src/app/api/[[...slugs]]/route.ts`.
- Emits realtime event `chat.destroy` to the room channel.
- Deletes keys: `meta:${roomId}`, `messages:${roomId}`, and a plain `roomId` key (cleanup).

2) Automatic TTL expiration

- `meta:${roomId}` has a 10 minute TTL.
- Message list TTL is kept in sync with `meta` during message writes.
- On the client, a countdown is displayed by polling `GET /api/room/ttl`.

Client reaction:

- `chat.destroy` event or TTL reaching 0 redirects to `/?destroyed=true`.

## Message Lifecycle

### 1) Sending messages (realtime)

API: `POST /api/messages?roomId=...` in `src/app/api/[[...slugs]]/route.ts`.

Flow:

- Validate body with Zod: `{ sender: string <= 100, text: string <= 1000 }`.
- Verify `meta:${roomId}` exists (room still alive).
- Build a `Message` object:
  - `id`, `sender`, `text`, `timestamp`, `roomId`
- Push message into Redis list `messages:${roomId}` with `token` included server-side.
- Emit `chat.message` to the Upstash Realtime channel for the room.
- Sync TTL of `messages:${roomId}` and a plain `roomId` key to the room TTL.

Client flow: `src/app/room/[roomId]/page.tsx` uses `useMutation` to call `api.messages.post()`.

### 2) Message schema

From `src/lib/realtime.ts`:

```
Message = {
  id: string
  sender: string
  text: string
  timestamp: number
  roomId: string
  token?: string
}
```

Notes:

- `token` is only stored in Redis and not broadcast in realtime.
- `token` helps the API identify which messages are authored by the current user.

### 3) Query and mutate

Query:

- API: `GET /api/messages?roomId=...`
- Returns all messages from the Redis list.
- The `token` field is stripped out unless it matches the requester token.

Mutate:

- API: `POST /api/messages?roomId=...`
- Validates body, writes to Redis, emits realtime event.

Client handling:

- `useRealtime` subscribes to `chat.message`.
- On event, the client refetches the message list via TanStack Query.

## Realtime Wiring (Upstash)

Server side:

- `src/lib/realtime.ts` defines the event schema and creates the Realtime instance.
- `src/app/api/realtime/route.ts` exposes the Upstash Realtime handler.

Client side:

- `src/lib/realtime-client.ts` creates typed `useRealtime` hooks.
- `src/components/base/realtime-provider.tsx` installs `RealtimeProvider` globally.
- `src/app/room/[roomId]/page.tsx` subscribes to room channel:
  - `channels: [roomId]`
  - `events: ['chat.message', 'chat.destroy']`

## Additional Important Features

### Username identity

- `src/hooks/use-username.ts` generates a stable, local identity using `localStorage`.
- This is purely client-side and not tied to authentication.

### Error handling and UX

- Lobby UI handles `room-not-found`, `room-full`, and `destroyed` states.
- Room header shows TTL countdown and a manual destroy button.

### Type-safe API calls

- `src/lib/api.ts` uses Eden treaty.
- On server: calls Elysia directly without HTTP.
- On client: calls HTTP via `NEXT_PUBLIC_URL`.

## Running Locally

1) Install dependencies

```
bun install
```

2) Configure environment

- Upstash Redis environment variables must be present because `Redis.fromEnv()` is used.
- Set the same env vars for local and deployed environments.

3) Start dev server

```
bun dev
```

## Extending the Project

Common extension points:

- Add new realtime events in `src/lib/realtime.ts` and update subscribers.
- Add new Elysia routes in `src/app/api/[[...slugs]]/route.ts`.
- Expand room metadata by adding fields to `meta:${roomId}`.

Recommended practice:

- Keep all validation in Zod schemas so that both API and realtime contracts are enforced.
- Any new protected route should use `authMiddleware`.

## Quick Reference: API Routes

- `POST /api/room/create` Create a room.
- `GET /api/room/ttl?roomId=...` Get remaining TTL.
- `DELETE /api/room?roomId=...` Destroy a room.
- `GET /api/messages?roomId=...` Fetch all messages.
- `POST /api/messages?roomId=...` Send a message.

## Troubleshooting

- If room links redirect to `/?error=room-not-found`, the `meta:${roomId}` key expired or never existed.
- If you see `/?error=room-full`, the room already has two connected tokens.
- If realtime updates do not arrive, check `src/app/api/realtime/route.ts` and Upstash credentials.
