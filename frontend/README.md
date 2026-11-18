# PayTrain frontend

Next.js (App Router) + React + TypeScript + Tailwind.

## Run

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000.

## API mode

| `NEXT_PUBLIC_API_MODE` | Behaviour |
|---|---|
| `mock` (default) | Simulated backend in `src/lib/api/mock.ts`, stored in browser localStorage. Every screen shows a "Simulated mode" banner, and simulated payments are labelled as such. |
| `live` | Calls the Django API in `backend/` at `NEXT_PUBLIC_API_BASE_URL` (e.g. `https://<railway-host>/api`) via `src/lib/api/live.ts`. |

`src/lib/api/live.ts` translates the backend's shapes to the frontend types:
2-decimal money strings ↔ integer minor units, `public_id`/`due_date`/
`full_name` field names, `pending` → open/overdue, and customer/business names
joined from their own endpoints. The backend must list the frontend's origin
in `CORS_ALLOWED_ORIGINS`.

### Live payment flow

1. Customer chooses an amount; the frontend POSTs `.../attempts/` with a UUID `Idempotency-Key`.
2. The backend creates an Open Payments incoming payment and returns its URL.
3. `/pay/return` shows that URL; the customer pays it from their own Open Payments wallet.
4. The page POSTs `.../verify/` every 5s (up to 5 minutes, then on demand). It shows "confirmed" only when the backend reports `succeeded`.

Not available from the API yet: per-payment history (request detail says so),
customer-side grants/quotes/outgoing payments, and a dashboard summary
endpoint (the frontend totals the request list).

## Routes

| Route | Who | Purpose |
|---|---|---|
| `/login`, `/register` | Business | Sign in / create an account (JWT via the API client) |
| `/setup` | Business | Create the first (or another) business profile |
| `/` | Business | Dashboard: collected, outstanding, overdue, recent requests |
| `/requests` | Business | List, filter and search payment requests |
| `/requests/new` | Business | Create a request (existing or new customer, part payments) |
| `/requests/[id]` | Business | Totals, paid vs outstanding, share link, payment history |
| `/pay/[publicId]` | Customer | Public request page; starts the payment |
| `/pay/return` | Customer | Polls backend for verified status after the wallet step |
| `/pay/mock-provider` | Mock only | Stand-in for the wallet consent screen |

## Rules this code follows

- Money is integer minor units (`value`, `assetCode`, `assetScale`); all maths uses BigInt.
- The return page never decides success. It polls the backend (2s, up to 10 times) then offers a manual check.
- Start-payment sends an idempotency key, and the button is disabled while working.
- No Open Payments keys, grants or tokens in the browser.

## Auth

- `AuthProvider` wraps the dashboard. Signed-out visitors go to `/login?next=…`
  and come back after signing in; owners with no business go to `/setup`.
- The backend allows one business per owner.
- Tokens live in localStorage via `src/lib/auth/session.ts` (the one place to
  change). Better for production: the backend sets the refresh token as an
  httpOnly cookie. The live client refreshes the access token once on a 401.
- Route protection here is UX only. The backend must reject unauthenticated
  and cross-business requests.
- In mock mode the login page has a button that opens the seeded demo business.

## Not built yet

Customers, transactions, reconciliation and settings pages.

## Currency

New requests use `NEXT_PUBLIC_DEFAULT_CURRENCY` (default NGN, scale 2 = kobo),
set in `src/lib/config.ts`. In live mode it must match the business wallet's
asset, or the backend rejects payment attempts with a currency mismatch.
