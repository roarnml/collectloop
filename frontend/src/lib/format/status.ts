import type { PaymentRequestStatus, PaymentStatus } from "@/lib/types";

export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

export const REQUEST_STATUS: Record<PaymentRequestStatus, { label: string; tone: Tone }> = {
  open: { label: "Awaiting payment", tone: "info" },
  partially_paid: { label: "Partially paid", tone: "warning" },
  paid: { label: "Paid", tone: "success" },
  overdue: { label: "Overdue", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  expired: { label: "Expired", tone: "neutral" },
};

export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; tone: Tone }> = {
  awaiting_authorization: { label: "Awaiting payment", tone: "info" },
  processing: { label: "Processing", tone: "info" },
  succeeded: { label: "Confirmed", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};
