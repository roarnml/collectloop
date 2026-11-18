# PayTrain frontend

Next.js (App Router) + React + TypeScript + Tailwind, talking to the Django API in `../backend`.

## Run

```bash
cd frontend
npm install
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api npm run dev
```

Open http://localhost:3000. Without `NEXT_PUBLIC_API_BASE_URL` the app uses the
deployed API on Render. The backend must list the frontend's origin (e.g.
`https://paytrain.vercel.app`) in `CORS_ALLOWED_ORIGINS`.

## Environment

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Django API root (default: the deployed API, `https://paytrain.onrender.com/api`). Use `http://localhost:8000/api` for a local backend. |
| `NEXT_PUBLIC_DEFAULT_CURRENCY` | Currency for new requests (default `NGN`). Must match the business's Open Payments wallet, or the backend rejects payment attempts. |

## Routes

| Route | Who | Purpose |
|---|---|---|
| `/login`, `/register` | Business | Sign in / create an account (JWT) |
| `/setup` | Business | Create the business profile (one per owner) |
| `/` | Business | Dashboard: collected, outstanding, overdue, recent requests |
| `/requests` | Business | List, filter and search payment requests |
| `/requests/new` | Business | Create a request for an existing or new customer |
| `/requests/[id]` | Business | Totals, paid vs outstanding, share link |
| `/pay/[publicId]` | Customer | Public request page; starts a payment attempt |
| `/pay/return` | Customer | Shows the Open Payments payment link and polls for verified status |

## API client

`src/lib/api/live.ts` translates the backend's shapes to the frontend types:
2-decimal money strings ↔ integer minor units, `public_id`/`due_date`/
`full_name` field names, `pending` → open/overdue, and customer/business names
joined from their own endpoints.

### Payment flow

1. Customer chooses an amount; the frontend POSTs `.../attempts/` with a UUID `Idempotency-Key`.
2. The backend creates an Open Payments incoming payment and returns its URL.
3. `/pay/return` shows that URL; the customer pays it from their own Open Payments wallet.
4. The page POSTs `.../verify/` every 5s (up to 5 minutes, then on demand). It shows "confirmed" only when the backend reports `succeeded`.

Not available from the API yet: per-payment history (request detail says so),
customer-side grants/quotes/outgoing payments, and a dashboard summary endpoint
(the frontend totals the request list).

## Rules this code follows

- Money is integer minor units (`value`, `assetCode`, `assetScale`); all maths uses BigInt.
- The status page never decides success; only the backend's verified status counts.
- Payment attempts send an idempotency key, and the button is disabled while working.
- No Open Payments keys, grants or tokens in the browser.

## Auth

- `AuthProvider` wraps the dashboard. Signed-out visitors go to `/login?next=…`
  and come back after signing in; owners with no business go to `/setup`.
- Tokens live in localStorage via `src/lib/auth/session.ts` (the one place to
  change). Safer for production: the backend sets the refresh token as an
  httpOnly cookie. The client refreshes the access token once on a 401.
- Route protection here is UX only; the backend enforces auth and ownership.

## Not built yet

Customers, transactions, reconciliation and settings pages.
