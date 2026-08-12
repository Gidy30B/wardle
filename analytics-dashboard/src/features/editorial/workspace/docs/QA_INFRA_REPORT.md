# QA Infrastructure Report

Date: 2026-06-30  
Status: Blocked — host Docker/WSL recovery required

## Root cause

The QA API is configured to use `redis://localhost:6379`, matching the Redis
port published by `doctordle-cache` in the root `docker-compose.yml`.

The failure is not a Redis hostname, IPv4/IPv6, BullMQ retry, or Compose startup
ordering mismatch:

- TCP port 6379 remained open on both IPv4 and IPv6.
- The listeners were owned by Docker's backend and the WSL relay.
- Redis protocol probes through both `localhost` and `127.0.0.1` were accepted,
  then immediately reset with `ECONNRESET`.
- Docker engine inspection commands could not query the Redis container and
  hung against the Docker Desktop Linux engine pipe.
- Docker Desktop's normal restart, shutdown helper, direct process termination,
  and the WSL service restart all hung.

This identifies a wedged Docker Desktop/WSL VM with a stale port-forward. The
port accepts TCP but no healthy Redis server is reachable behind it. The API's
subsequent Redis errors are a consequence of that host failure.

## Fix applied

No repository runtime or workflow code was changed. The existing Compose file
already provides:

- Redis 7 with a `redis-cli ping` healthcheck;
- API and worker dependencies gated on Redis health;
- a stable `redis://cache:6379` connection inside the Compose network.

Host recovery was attempted through Docker Desktop's supported restart path and
then progressively narrower Windows recovery paths. None completed because the
Docker/WSL VM was unresponsive. Adding retry code, disabling queues, mocking
Redis, or changing workflow behavior would conceal rather than fix this fault.

The browser QA report was corrected to identify the API dependency failure
instead of the earlier browser-permission blocker.

## Validation

| Check | Result | Evidence |
|---|---|---|
| Redis TCP listener | Misleading pass | Port 6379 accepts TCP through Docker/WSL forwarding. |
| Redis protocol `PING` via `localhost` | Fail | Connection reset/closed before `PONG`. |
| Redis protocol `PING` via `127.0.0.1` | Fail | Connection reset/closed before `PONG`. |
| Docker engine/container inspection | Fail | Docker Linux-engine pipe call hangs. |
| QA API continuity | Fail | API cannot retain a healthy Redis connection. |
| Local QA diagnoses endpoint | Blocked | API is not stable enough for continuous polling. |
| Edge launch | Pass | Escalated Playwright previously launched Edge successfully. |
| Gated workflow shell reached | Blocked | Fixture retrieval fails before navigation. |

## Remaining blocker

Docker Desktop/WSL must be recovered outside this session, most likely with a
Windows restart. After recovery:

1. Confirm `docker inspect doctordle-cache` reports `running` and `healthy`.
2. Confirm a Redis `PING` returns `PONG` continuously on port 6379.
3. Start the QA API and poll `/api/auth/local-qa/diagnoses` for an extended run.
4. Rerun Playwright and confirm it reaches the gated workflow shell.

Until those checks pass, browser QA remains blocked and the workflow shell is
not ready to proceed to an editor pilot.

## Scope confirmation

- No editorial workspace or workflow runtime file changed.
- No workflow action was enabled or bypassed.
- The workflow shell remains gated.
- Phase 6 was not started.
