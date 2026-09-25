# Port & process registry — delta-market-pulse + tv-recommendation-fullstack

Both projects run on this same machine under the same PM2 daemon. This file
is the single source of truth for every port and PM2 process name across
both, so a new service is never assigned a port or name another project is
already using. **Check this file before adding any new port, PM2 app, or
Tailscale route — in either project.**

## delta-market-pulse (this project)

| Port | Process | PM2 name | Status |
|---|---|---|---|
| **4000** | Backend API + poller | `delta-market-pulse` | Live |
| **4173** | Frontend (Vite preview) | `delta-market-pulse-client` | Reserved, not yet built |

4173 is deliberately Vite's own default `vite preview` port — chosen so the
frontend's dev tooling needs zero port config once it exists. Backend `.env`
`PORT` and this table must always agree; if `PORT` ever changes in `.env`,
update this file in the same commit.

**Client build note (2026-09-25):** `client/src/utils/api.js` only ever
calls relative paths (`/api/...`, `/health`) — never a hardcoded host. The
only place `localhost:4000` appears is `client/vite.config.js`'s dev-server
proxy, which is dev-only tooling and never runs in a production build. This
was a deliberate choice for cloud-portability: moving either project to a
VM/container/cloud host needs zero client code changes, as long as the
built client is served from the same origin as its API (or behind a
reverse proxy) — just update deployment config, not source. If `PORT` in
`.env` ever changes, update the proxy target in `vite.config.js` in the
same commit as this file.

## tv-recommendation-fullstack (the other project — read-only reference, do not edit its files)

| Port | Process | PM2 name | Notes |
|---|---|---|---|
| 3000 | Backend API + webhooks | `tv-backend` | Tampermonkey scripts POST here directly by hardcoded URL — never reassign |
| 5173 | Frontend (`vite preview`) | `tv-client` | Proxies `/api`, `/socket.io` etc. to 3000 |
| 3001 | MCP server | `mcp-server` | |
| 3010 | Backend (dev instance) | `tv-backend-dev` | |
| 5174 | Frontend (dev instance) | `tv-client-dev` | |
| 3011 | MCP server (dev instance) | `mcp-server-dev` | |

## Rule for picking a new port

Next free block for delta-market-pulse work is **4xxx** (matches the pattern
the old project already established: backend on x000, frontend on x173,
mcp/aux on x001). Never reuse anything in the table above. If a future
service is needed (e.g. a websocket push server), claim the next free 4xxx
port here first, in this same file, before writing any code against it.

## PM2

Both projects share one PM2 daemon (`pm2 list` shows all apps from both).
App names must stay globally unique across the whole daemon — `delta-*`
prefix for everything in this project, matching the `tv-*`/`mcp-*` pattern
already used by the other one. Never `pm2 delete`/`pm2 stop` a `tv-*` or
`mcp-*` process from this project's work.

## Tailscale (planned, not yet configured)

Not set up yet for this project. When it is: the old project's Tailscale
Funnel proxies its own frontend port (5173) at the tailnet root path — this
project's remote access must use either a **different subdomain/hostname**
or a **different path prefix**, never the same root path on the same
Tailscale node, to avoid the two projects' proxied UIs colliding. Decide and
document the exact routing here, in this section, before configuring it.

## Startup safety

`server/index.js` should fail loudly (not silently bind a random port) if
`PORT` is already in use — see the EADDRINUSE guard there. If you ever see
a port conflict, check this file first for what's supposed to be on that
port before killing anything.
