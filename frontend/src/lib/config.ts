/**
 * Default currency for new payment requests: Nigerian naira, in kobo
 * (assetScale 2, so "1500000" = ₦15,000.00).
 *
 * Still to confirm: the approved Open Payments test wallet must support NGN.
 * Once the backend returns the business wallet's assetCode/assetScale, use
 * that instead of this constant.
 */
export const DEFAULT_ASSET = { assetCode: "NGN", assetScale: 2 } as const;
