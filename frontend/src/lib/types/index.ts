/**
 * Frontend DTOs for the PayTrain API.
 *
 * PROVISIONAL: these follow the "minimum response fields" in the PayTrain
 * Frontend & Open Payments Foundational Guide (section 6). The Django
 * serializers, status enums and route paths are not published yet. When the
 * backend OpenAPI schema lands, regenerate or align these types with it.
 */

/**
 * Money in Open Payments form: `value` is an integer string in minor units
 * (e.g. "150000" with assetScale 2 = 1,500.00). Never use floats for money.
 */
export interface Money {
  value: string;
  assetCode: string;
  assetScale: number;
}

/** Status of a payment request (the thing the business is collecting). */
export type PaymentRequestStatus =
  | "open"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "cancelled"
  | "expired";

/** Status of a single payment attempt against a request. */
export type PaymentStatus =
  | "awaiting_authorization"
  | "processing"
  | "succeeded"
  | "failed"
  | "cancelled";

export const TERMINAL_PAYMENT_STATUSES: readonly PaymentStatus[] = ["succeeded", "failed", "cancelled"];

// ---------- auth & business ----------

export interface User {
  id: string;
  email: string;
  full_name: string;
}

/** Simple JWT pair. PROVISIONAL: confirm field names with the backend. */
export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput extends LoginInput {
  full_name: string;
}

export interface Business {
  id: string;
  name: string;
  description: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
}

export interface CreateBusinessInput {
  name: string;
  description?: string;
  email?: string;
  phone?: string;
  address?: string;
}

// ---------- customers & requests ----------

export interface CustomerRef {
  id: string;
  name: string;
}

export interface Customer extends CustomerRef {
  email: string | null;
  phone: string | null;
}

/** Owner-scoped payment request, as seen on the business dashboard. */
export interface PaymentRequest {
  id: string;
  public_uuid: string;
  reference: string;
  business_name: string;
  customer: CustomerRef;
  description: string;
  amount: Money;
  amount_paid: Money;
  outstanding_amount: Money;
  /** Local calendar date, "YYYY-MM-DD". */
  due_date: string | null;
  status: PaymentRequestStatus;
  created_at: string;
}

/** Safe public subset shown to a customer without a PayTrain account. */
export interface PublicPaymentRequest {
  public_uuid: string;
  reference: string;
  business_name: string;
  description: string;
  amount: Money;
  amount_paid: Money;
  outstanding_amount: Money;
  /** Local calendar date, "YYYY-MM-DD". */
  due_date: string | null;
  status: PaymentRequestStatus;
}

export interface CreatePaymentRequestInput {
  /** Use an existing customer, or create one inline via `new_customer`. */
  customer_id?: string;
  new_customer?: { name: string; email?: string; phone?: string };
  description: string;
  amount: Money;
  /** Local calendar date, "YYYY-MM-DD". */
  due_date: string | null;
}

export interface StartPaymentInput {
  /** Omit to pay the full outstanding amount. */
  amount?: Money;
  /** Generated once per checkout attempt so double clicks do not create two payments. */
  idempotency_key: string;
}

export interface StartPaymentResponse {
  payment_id: string;
  status: PaymentStatus;
  /**
   * pay_to_url: the customer pays `payment_url` (an Open Payments
   *   incoming-payment URL) from their own wallet, then PayTrain verifies it.
   */
  next_action_type: "pay_to_url" | "none";
  payment_url: string | null;
  expires_at: string | null;
}

/** Backend-verified status. The frontend never decides success on its own. */
export interface PaymentStatusResponse {
  payment_id: string;
  request_public_uuid: string;
  request_reference: string;
  business_name: string;
  status: PaymentStatus;
  amount: Money;
  verified_at: string | null;
  failure_message: string | null;
  /** Extra provider detail for non-final states, e.g. partly received. */
  status_message: string | null;
}


export interface DashboardSummary {
  collected_total: Money;
  outstanding_total: Money;
  overdue_total: Money;
  paid_request_count: number;
  /** Null when the backend can't report it. */
  pending_count: number | null;
  recent_requests: PaymentRequest[];
}
