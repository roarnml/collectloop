# Testing Plan

## Pre-onboarding

No application behavior is implemented in this scaffold. Prepare test cases
only; do not treat these as completed tests.

## Planned scenarios

1. Business owner creates a valid payment request.
2. Required fields and invalid amounts are rejected.
3. Customer can view the correct request details.
4. Supported authorization flow can be initiated.
5. Provider-confirmed success updates the correct request.
6. Pending payment remains pending.
7. Failed or incomplete payment is not marked successful.
8. Duplicate status events do not double-count a payment.
9. Partial payment leaves the correct outstanding balance.
10. A user cannot access another business's private records.

## Test-data policy

Use synthetic users, synthetic customer information, and test funds only.
Never put real customer information or secrets in fixtures, screenshots, logs,
or the public repository.
