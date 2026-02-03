import { treaty } from '@elysiajs/eden'
import { app } from '../app/api/[[...slugs]]/route'

// Isomorphic client setup:
// - on server (SSR): calls Elysia directly without network
// - on client (browser): makes HTTP requests to the API

export const api =
  typeof window === 'undefined'
    ? treaty(app).api // server side: direct call
    : treaty<typeof app>(process.env.NEXT_PUBLIC_URL!).api // client-side

// this require .api to enter /api prefix
export const client = treaty<typeof app>('localhost:3000').api

// NOTE: export type for eden in client.ts
export type App = typeof app
