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
| `live` | Calls the Django API at `NEXT_PUBLIC_API_BASE_URL` via `src/lib/api/live.ts`. |

The live routes are the **proposed** contract from the PayTrain foundational
guide (section 6). Align `src/lib/api/live.ts` and `src/lib/types` with the
backend's published OpenAPI schema before switching to live.

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
- Owners can switch business from the sidebar; data reloads for that business.
- Tokens live in localStorage via `src/lib/auth/session.ts` (the one place to
  change). Better for production: the backend sets the refresh token as an
  httpOnly cookie. The live client refreshes the access token once on a 401.
- Route protection here is UX only. The backend must reject unauthenticated
  and cross-business requests.
- Mock mode has a synthetic demo account (`MOCK_DEMO_ACCOUNT` in
  `src/lib/api/mock.ts`); the login page has a button that fills it in.

## Not built yet

Customers, transactions, reconciliation and settings pages.

## Currency

Amounts are in Nigerian naira (NGN, scale 2 = kobo), set in `src/lib/config.ts`.
Confirm during onboarding that the approved Open Payments test wallet supports
NGN; once the backend returns the business wallet's asset, use that instead.
