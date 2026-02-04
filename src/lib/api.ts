import { treaty } from '@elysiajs/eden'
import { app } from '../app/api/[[...slugs]]/route'

// Isomorphic client setup:
// - on server (SSR): calls Elysia directly without network
// - on client (browser): makes HTTP requests to the API
export const api =
  typeof window === 'undefined'
    ? treaty(app).api // server side: direct call
    : treaty<typeof app>(process.env.NEXT_PUBLIC_URL!).api // client-side

export type App = typeof app
