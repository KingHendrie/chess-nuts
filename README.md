Chess Nuts - README

Optional runtime features
-------------------------
This project includes several optional features that can be enabled via environment variables. They are safe to leave disabled in development.

Environment variables:

- REDIS_URL: When set, enables Redis-backed session store, EventBus pub/sub, and the Socket.io Redis adapter. Example: redis://localhost:6379
- ENABLE_SOCKETS: Set to 'true' to enable Socket.io real-time functionality.
- ENABLE_MATCHMAKER: Set to 'true' to run the matchmaker worker in-process when the server starts.
- ENABLE_STOCKFISH_WORKER: Set to 'true' to start the Stockfish background worker (processes computer move jobs).
- ENABLE_CSRF: Set to 'true' to enable csurf protection for non-API forms.
- ENABLE_METRICS: Set to 'true' to expose /metrics for Prometheus using prom-client.
- SENTRY_DSN: If set, Sentry will be initialized for error tracking.
- COOKIE_SECURE: If 'true', session cookies will be marked secure (use behind HTTPS in production).

Workers and queues
------------------
When REDIS_URL is set the Stockfish worker uses a Redis list named 'stockfish:jobs' for job queuing. You can enqueue jobs via the API endpoint POST /api/game/session/:id/computer-move.

Quick start (development):

1. Install dependencies: npm ci
2. Run migrations (development DB) using your configured knex setup.
3. Start server: node app.js

To enable matchmaker and sockets locally without Redis, set ENABLE_SOCKETS=true and ENABLE_MATCHMAKER=true in your .env. For production, set REDIS_URL and COOKIE_SECURE=true.

