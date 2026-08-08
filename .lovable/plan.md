# Make Kloak's WebSocket + presence layer production-solid

## What I found

The `kloak-ws` service works, but it is a **single-process, memory-only** server. There is **no Redis in the project at all** — no dependency, no config, no client code. Everything the socket layer knows lives in one Node process:

- `SocketHub` keeps topics, subscribers and the per-topic replay buffer in a plain in-memory `Map`.
- Presence lives only on the socket object (`currentPresence`) and is fanned out to recipients connected to the *same* process.
- Nothing writes `users.status` / `users.last_seen` from the socket service.

Consequences today:

1. **Fan-out breaks the moment there is more than one machine.** `fly.toml` allows auto-start with a 250-connection hard limit, so a second machine will eventually boot. Two users on different machines will not see each other's messages, typing, or status.
2. **Every deploy or restart wipes presence and replay.** All users appear offline until each client re-pushes presence; reconnect cursors (`afterSeq`) point at a sequence counter that has reset to 0, so gap-recovery silently returns nothing.
3. **Presence flaps with multiple tabs/devices.** There is no per-user connection count — closing one tab publishes "offline" while another tab is still connected.
4. **Presence fan-out is expensive.** Each status change runs the `get_socket_presence_recipients` RPC for that socket, then publishes N times. Idle/online transitions multiply this across every user.
5. **The topic map never shrinks.** Empty topics are never deleted and replay buffers persist per channel forever — a slow memory leak on a long-lived machine.
6. **Two overlapping delivery paths.** `realtimeBridge` also relays Supabase broadcast `messages` into `channel:*`, in addition to the hub's own publish on send — a duplicate-delivery risk.

## The fix

### 1. Fly Valkey backplane (same region)
Provision a Valkey/Redis instance in `sin` and give `kloak-ws` a `REDIS_URL` secret over Fly private networking. Add `ioredis` to the service with two connections (one publisher, one subscriber) plus a lazy, non-fatal fallback: if Redis is unreachable the server keeps serving locally and logs loudly rather than crashing.

### 2. Cross-machine event fan-out
`SocketHub.publish` gains a Redis pub/sub layer:
- Local delivery stays synchronous (no added latency for same-machine subscribers).
- The event is also published to a Redis channel keyed by topic; every other machine delivers it to its local subscribers only, with an origin-instance id so the publishing machine never double-delivers.
- Sequence numbers move to a Redis `INCR` per topic so `afterSeq` gap-recovery is globally correct.
- Replay buffers move to a capped Redis list per topic (`LPUSH` + `LTRIM` to 1000, TTL ~1h) so a reconnect to a different machine still replays missed events.

### 3. Presence with TTL + write-back
- On connect / heartbeat, write `presence:{userId}` in Redis (status, custom status, last seen, connection count) with a TTL of ~2x the heartbeat interval; refresh on every ping.
- Track connections per user with a Redis set of socket ids so multi-tab works: a user only goes offline when the **last** connection drops or the TTL expires.
- A single sweeper (one machine, via a Redis lock) expires stale presence and publishes `user.presence` offline events for users whose keys lapsed — this covers hard crashes and killed machines.
- Batched write-back to Postgres: `users.status` and `users.last_seen` flushed every ~30s for changed users only, plus an immediate flush on last-disconnect. This keeps `getEffectivePresence`'s `last_seen` heuristic accurate and makes presence survive a full service restart.
- Cache `get_socket_presence_recipients` results in Redis (short TTL, invalidated on friend/member changes) so repeated status changes stop hammering PostgREST.

### 4. Hub hygiene
- Delete topic state when the last local subscriber leaves and no Redis replay is pending.
- Keep the existing backpressure close (4008) but log a metric instead of failing silently.
- Add a dedupe guard on `message.created` so the `realtimeBridge` relay and the direct publish cannot deliver the same message id twice; long term the bridge only handles rows written outside the socket path.

### 5. Fly + client
- Set explicit `KLOAK_WS_*` env for Redis, keep `min_machines_running = 1`, and raise the connection soft/hard limits now that multiple machines are safe.
- Extend `/healthz` to report Redis connectivity so Fly health checks catch a broken backplane.
- Client (`src/lib/kloakSocket.ts`): resubscribe with the stored per-topic cursor after reconnect (already partly there) and re-push presence immediately on `hello`, so a machine restart repopulates status without waiting for the idle timer.

## Technical notes

- New files: `services/kloak-ws/src/redis.ts` (connection factory + health), `services/kloak-ws/src/presenceStore.ts` (TTL presence, connection counting, DB write-back).
- Changed: `hub.ts` (Redis-backed publish/replay/seq), `server.ts` (presence lifecycle, heartbeat refresh, healthz), `config.ts` (`REDIS_URL`, TTL/flush intervals), `realtimeBridge.ts` (dedupe), `fly.toml`, `package.json` (`ioredis`).
- No schema migration required — `users.status` and `users.last_seen` already exist and are what the write-back targets.
- Everything degrades gracefully: with `REDIS_URL` unset the service behaves exactly as it does today, so this can ship before the Valkey instance exists.

## What you need to do

Create the Fly Valkey instance in `sin` and set `REDIS_URL` as a secret on the `kloak-ws` app. I'll write all the code so it activates automatically once that secret is present.
