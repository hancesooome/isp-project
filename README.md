# ISP Platform

Foundation for an ISP customer management platform, organized as separate web
and API applications in an npm workspace.

## Prerequisites

- Node.js 22.12 or newer
- npm 11 or newer
- A Docker-compatible runtime for the local Supabase stack

## Setup

```sh
npm install
```

Create local environment files from the workspace-specific examples:

```sh
cp apps/web/.env.example apps/web/.env
cp apps/api/.env.example apps/api/.env
```

On PowerShell, use `Copy-Item` instead of `cp` if aliases are disabled. Replace
the web placeholder key with the browser-safe publishable key reported by
`npm run supabase:status`, or with a hosted project's publishable key. Variables
prefixed with `VITE_` are public and must never contain a Supabase secret key.

The API uses port `3000` by default. Never commit real environment files or
secrets.

## Commands

```sh
npm run dev        # Start the web and API development servers
npm run dev:web    # Start only the Vite web application
npm run dev:api    # Start only the Express API
npm run typecheck  # Type-check every workspace
npm run lint       # Lint the repository
npm run build      # Build every workspace
npm run supabase:start   # Start the local Supabase stack
npm run supabase:status  # Show local service URLs and keys
npm run supabase:stop    # Stop the local Supabase stack
npm run supabase:reset   # Rebuild the local database from migrations
```

The Supabase commands require Docker or another compatible container runtime.
`supabase:reset` destroys local database contents before rebuilding them; it
must not be used against a linked production project.

The web application is served at `http://localhost:5173`. The API is served at
`http://localhost:3000`, with a health check at `GET /health`.

## Structure

- `apps/web` — React, TypeScript, Vite, and Tailwind CSS frontend
- `apps/api` — Node.js, Express, and TypeScript API
- `supabase` — Local Supabase configuration and future database migrations

The web client uses only a browser-safe Supabase publishable key. Server-side
privileged clients, database tables, authentication, billing, payments, email,
and other domain features are intentionally deferred to their respective
tickets.
