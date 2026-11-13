# Architecture

## Proposed components

- **Next.js frontend:** business dashboard and customer-facing payment request page.
- **Django REST backend:** business/customer records, payment requests, transaction
  records, reconciliation, and server-side integration.
- **PostgreSQL:** persistent application records.
- **Open Payments provider:** approved test-environment payment flow.

## Conceptual request flow

1. Business owner creates a payment request through the frontend.
2. Backend validates and stores the request.
3. Customer opens the request page.
4. Backend coordinates the supported Open Payments flow.
5. Backend verifies the authoritative payment result.
6. Reconciliation updates the request's paid and outstanding amounts.

## Decisions intentionally deferred

Confirm during onboarding:
- Approved provider and test environment.
- Supported payment instruments, currencies, and corridors.
- Exact authorization and resource-creation sequence.
- Whether status updates use callbacks, polling, or both.
- Deployment and hosting requirements.

## Integrity and security

- Verify provider state server-side.
- Make status processing idempotent.
- Keep secrets out of source control.
- Use synthetic data and test funds only.
- Keep simulated states visibly distinct from provider-confirmed states.
