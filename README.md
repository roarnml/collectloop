# CollectLoop

Payment collection and reconciliation for microbusinesses.

> **CU Next Gen Hackathon — pre-onboarding repository scaffold**
>
> This repository currently contains project documentation and empty application
> structure only. Product implementation should begin after the hackathon
> onboarding, in accordance with the participant guide. Disclose this scaffold
> if required by the organisers.

## Project direction

- **Primary track:** Payment Automation and Financial Workflows
- **Audience:** Microbusinesses
- **Initial demonstration persona:** An independent service provider collecting a
  deposit and a remaining balance
- **Core journey:** Create request → customer authorisation → verify payment
  result → reconcile → update outstanding balance

## Proposed stack

- Frontend: Next.js, React, TypeScript
- Backend: Python, Django REST Framework
- Database: PostgreSQL
- Payments: Interledger Open Payments through the approved test environment

The payment provider, supported currencies, wallets, corridors, and exact API
sequence are intentionally **not assumed**. Confirm them during onboarding.

## Repository layout

```text
collectloop/
├── frontend/
├── backend/
├── docs/
├── .env.example
├── .gitignore
└── README.md
```

## Pre-onboarding status

This scaffold is for organisation and planning. It does not implement payment
logic, business workflows, API integrations, or production authentication.

## After onboarding

1. Confirm the approved Open Payments test environment and provider.
2. Agree on the supported payment journey and authorization sequence.
3. Implement the smallest end-to-end workflow.
4. Verify transaction status before updating payment records.
5. Use synthetic data and test funds only.
6. Document implemented, simulated, and planned functionality separately.

## Security

- Never commit `.env` files, credentials, private keys, access tokens, or real
  customer information.
- Keep secrets on the backend.
- Use `.env.example` only for variable names and safe placeholder values.
- Do not represent simulated transactions as real provider-confirmed payments.

## Current status

**Pre-onboarding scaffold — no payment integration or product functionality
implemented yet.**
