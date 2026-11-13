# Open Payments Flow

## Status

**Not implemented.** The exact flow must be confirmed during hackathon onboarding.

## Concepts to investigate

- Authorization grants.
- Incoming Payment resources.
- Quote resources.
- Outgoing Payment resources.
- Payment status verification.

## Onboarding checklist

- [ ] Confirm approved test environment and provider.
- [ ] Confirm supported currencies, wallets, and corridors.
- [ ] Confirm the required authorization sequence.
- [ ] Confirm resource creation and linking requirements.
- [ ] Confirm how payment status is authoritatively verified.
- [ ] Confirm callback/webhook or polling expectations.
- [ ] Obtain official examples, SDKs, and test credentials.
- [ ] Record limitations and supported scenarios.

## Non-negotiable integrity rule

Do not mark a request as paid based only on a frontend action or an unverified
client claim. Use authoritative provider status. If a scenario is simulated,
label it clearly as simulated.
