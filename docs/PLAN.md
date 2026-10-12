# BudgetWise — MVP plan

Personal finance app: sign up, link a sandbox bank through Plaid Link, sync
transactions, auto-categorise them with rules you can override, set monthly
budgets per category, and see spending charts. Runs on iOS/Android (Expo Go)
and on the web (Expo web export on Netlify).

## Architecture

```
apps/web      Expo SDK 57 + Expo Router universal app (iOS, Android, web export)
apps/api      Node 22 + Fastify API, the only holder of the Plaid secret
packages/core Shared TypeScript: domain types, categorisation engine, budget
              maths, chart aggregation, deterministic sandbox data generator
```

- **Auth:** Firebase Auth (email/password). The API verifies Firebase ID tokens
  on every request. "Try the demo" asks the API for a Firebase custom token for
  the shared demo user (re-seeded when stale), so no demo password ships in the bundle.
- **Data:** Firestore. Clients get **read-only** access to `users/{uid}/**`
  (security rules) and stream it live. **All writes go through the API**, which
  validates input with zod. One write path, one validation layer, and a rules
  file that is trivial to audit.
- **Secrets:** Plaid access tokens live in `itemSecrets/{itemId}`, a collection
  clients cannot read at all, AES-256-GCM encrypted at rest with
  `TOKEN_ENCRYPTION_KEY`.
- **Plaid:** `PLAID_PROVIDER=plaid|mock`. The real provider uses the official
  `plaid` Node client against the sandbox (`/link/token/create`,
  `/item/public_token/exchange`, `/transactions/sync`, `/item/remove`,
  `/link/token/get`). The mock provider generates deterministic, realistic
  transactions so the app, the tests and the demo work without keys. Each linked
  item remembers which provider created it.
  - Web: Plaid Link JS (`link-initialize.js`).
  - Expo Go: Plaid Hosted Link opened in an auth session; the API finishes the
    exchange via `/link/token/get`.
  - Mock: an in-app "sandbox bank" sheet that returns a mock public token.
- **Categorisation precedence:** manual override > user rules (ordered) >
  curated merchant keywords (high precision, e.g. Netflix → Subscriptions) >
  Plaid personal-finance category > Other.
  Creating, editing or deleting a rule re-categorises every non-manual transaction.
- **Budgets:** one recurring monthly limit per expense category; progress is
  computed for any selected month, net of refunds.
- **Charts:** Victory Native (Skia). On web, CanvasKit WASM is lazy-loaded
  only when the Insights screen opens.
- **Free-tier hosting:** Netlify (web), Render free web service (API; it sleeps
  when idle, so the app pings `/health` on start and shows "Waking server…"
  when a request is slow), Firebase Spark plan (Auth + Firestore).

## Firestore model

```
users/{uid}                       profile, isDemo, lastSyncedAt
users/{uid}/items/{itemId}        institution, accounts, status (no secrets)
users/{uid}/transactions/{txId}   amountCents (+ = money out, Plaid sign), date,
                                  month, merchant, category, categorySource, ruleId
users/{uid}/rules/{ruleId}        field, operator, pattern, category, priority
users/{uid}/budgets/{category}    limitCents
itemSecrets/{itemId}              uid, provider, encrypted access token, cursor  (server only)
linkSessions/{sha256(linkToken)}  uid, createdAt                                  (server only)
```

## API surface

| Method            | Path                           | Purpose                                              |
| ----------------- | ------------------------------ | ---------------------------------------------------- |
| GET               | /health                        | liveness + provider (also used to wake the server)   |
| POST              | /v1/demo/session               | custom token for the demo user (re-seeds when stale) |
| POST              | /v1/plaid/link-token           | create a Link token (web or hosted)                  |
| POST              | /v1/plaid/exchange             | public token → access token, then initial sync       |
| POST              | /v1/plaid/hosted-link/complete | finish a Hosted Link session                         |
| POST              | /v1/sync                       | `/transactions/sync` for all of the user's items     |
| DELETE            | /v1/items/:id                  | unlink a bank and drop its transactions              |
| PATCH             | /v1/transactions/:id           | manual category override (optionally create a rule)  |
| POST/PATCH/DELETE | /v1/rules[/:id]                | manage rules, re-categorise                          |
| PUT/DELETE        | /v1/budgets/:category          | set / clear a monthly budget                         |

## Testing

- `packages/core`: vitest unit tests for categorisation, budgets, charts,
  dates/money and the mock generator.
- `apps/api`: vitest route tests via `fastify.inject` with an in-memory repo,
  fake auth and the mock provider; Plaid provider tests with a stubbed client;
  crypto tests.
- `e2e/`: Playwright smoke test of the main flow against the web export, the API
  (mock provider) and the Firebase Auth + Firestore emulators.
- CI: install → lint → typecheck → unit tests → e2e → `docker compose build`.

## Delivery steps

1. Monorepo scaffold, shared config, this plan.
2. `packages/core` + tests.
3. `apps/api` + tests, Dockerfile, `render.yaml`.
4. `apps/web` screens: auth, link, transactions, rules, budgets, insights.
5. docker-compose (emulators + API + web), CI, e2e, README.
