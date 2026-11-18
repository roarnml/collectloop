import type {
  AuthTokens,
  Business,
  CreateBusinessInput,
  CreatePaymentRequestInput,
  Customer,
  DashboardSummary,
  Money,
  PaymentRequest,
  PaymentRequestStatus,
  PaymentStatus,
  PaymentStatusResponse,
  PublicPaymentRequest,
  StartPaymentInput,
  StartPaymentResponse,
  User,
} from "@/lib/types";
import { clearSession, getTokens, setTokens } from "@/lib/auth/session";
import { DEFAULT_ASSET } from "@/lib/config";
import { isPastDue } from "@/lib/format/date";
import { add, parseAmount, toDecimalString, zero } from "@/lib/format/money";
import { ApiError, type PayTrainApi } from "./client";

/**
 * Client for the PayTrain Django API (backend/), translating its shapes to
 * the frontend's types. Matches the backend as of commit df80bad:
 *
 *   /api/v1/auth/{register,login,token/refresh,me}/
 *   /api/v1/{businesses,customers,payment-requests}/        (owner-scoped)
 *   /api/v1/public/payment-requests/{public_id}/            (public)
 *   /api/v1/public/payment-requests/{public_id}/attempts/   (Idempotency-Key header)
 *   /api/v1/public/payment-transactions/{key}/verify/       (POST)
 *
 * Money arrives as 2-decimal strings ("1500.00") plus a currency code and is
 * converted to integer minor units here. This client never handles Open
 * Payments keys or tokens; the backend's adapter does.
 */

// Deployed PayTrain API on Render. Override with NEXT_PUBLIC_API_BASE_URL (e.g. http://localhost:8000/api for local dev).
const DEFAULT_API_BASE_URL = "https://paytrain.onrender.com/api";
const BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, "");
const API_SCALE = 2; // DecimalField(decimal_places=2) on every backend amount.

// ---------- backend shapes ----------

type Decimal = string;

interface ApiUser {
  id: number;
  email: string;
  full_name: string;
}

interface ApiBusiness {
  id: number;
  name: string;
  description: string;
  email: string;
  phone: string;
  address: string;
}

interface ApiCustomer {
  id: number;
  business: number;
  full_name: string;
  email: string;
  phone: string;
}

type ApiRequestStatus = "pending" | "partially_paid" | "paid" | "expired" | "cancelled";
type ApiTxnStatus = "pending" | "succeeded" | "failed" | "cancelled";

interface ApiPaymentRequest {
  id: number;
  public_id: string;
  reference: string;
  business: number;
  customer: number;
  description: string;
  total_amount: Decimal;
  currency: string;
  due_date: string | null;
  status: ApiRequestStatus;
  amount_paid: Decimal;
  outstanding_amount: Decimal;
  created_at: string;
}

interface ApiPublicPaymentRequest {
  public_id: string;
  reference: string;
  business_name: string;
  description: string;
  total_amount: Decimal;
  currency: string;
  due_date: string | null;
  status: ApiRequestStatus;
  amount_paid: Decimal;
  outstanding_amount: Decimal;
}

interface ApiPaymentAttempt {
  idempotency_key: string;
  amount: Decimal;
  currency: string;
  status: ApiTxnStatus;
  created_at: string;
}

interface ApiAttemptResponse {
  message: string;
  payment: ApiPaymentAttempt;
  incoming_payment_url?: string;
  next_step: string;
}

interface ApiVerifyResponse {
  message: string;
  verification: {
    status: "pending" | "partially_received" | "overpayment_review" | "succeeded" | "failed" | "cancelled";
    message: string;
  };
  transaction: ApiPaymentAttempt;
}

// ---------- mapping ----------

function toMoney(value: Decimal, currency: string): Money {
  const minor = parseAmount(String(value), API_SCALE);
  if (minor === null) throw new ApiError("The server returned an invalid amount.", 500);
  return { value: minor.toString(), assetCode: currency, assetScale: API_SCALE };
}

function toApiDecimal(m: Money): Decimal {
  if (m.assetScale !== API_SCALE) throw new ApiError("Unsupported currency precision.", 400);
  return toDecimalString(m);
}

function requestStatus(status: ApiRequestStatus, dueDate: string | null): PaymentRequestStatus {
  if (status === "pending") return isPastDue(dueDate) ? "overdue" : "open";
  if (status === "partially_paid" && isPastDue(dueDate)) return "overdue";
  return status;
}

function txnStatus(status: ApiTxnStatus): PaymentStatus {
  // Backend "pending" = attempt created, provider hasn't reported the funds yet.
  return status === "pending" ? "awaiting_authorization" : status;
}

function mapUser(u: ApiUser): User {
  return { id: String(u.id), email: u.email, full_name: u.full_name };
}

function mapBusiness(b: ApiBusiness): Business {
  return {
    id: String(b.id),
    name: b.name,
    description: b.description || null,
    email: b.email || null,
    phone: b.phone || null,
    address: b.address || null,
  };
}

function mapCustomer(c: ApiCustomer): Customer {
  return { id: String(c.id), name: c.full_name, email: c.email || null, phone: c.phone || null };
}

function mapRequest(r: ApiPaymentRequest, customers: Map<string, Customer>, businesses: Map<string, Business>): PaymentRequest {
  const customer = customers.get(String(r.customer));
  return {
    id: String(r.id),
    public_uuid: r.public_id,
    reference: r.reference,
    business_name: businesses.get(String(r.business))?.name ?? "",
    customer: { id: String(r.customer), name: customer?.name ?? "Unknown customer" },
    description: r.description,
    amount: toMoney(r.total_amount, r.currency),
    amount_paid: toMoney(r.amount_paid, r.currency),
    outstanding_amount: toMoney(r.outstanding_amount, r.currency),
    due_date: r.due_date,
    status: requestStatus(r.status, r.due_date),
    created_at: r.created_at,
  };
}

function mapPublicRequest(r: ApiPublicPaymentRequest): PublicPaymentRequest {
  return {
    public_uuid: r.public_id,
    reference: r.reference,
    business_name: r.business_name,
    description: r.description,
    amount: toMoney(r.total_amount, r.currency),
    amount_paid: toMoney(r.amount_paid, r.currency),
    outstanding_amount: toMoney(r.outstanding_amount, r.currency),
    due_date: r.due_date,
    status: requestStatus(r.status, r.due_date),
  };
}

// ---------- transport ----------

type RequestOptions = RequestInit & { auth?: boolean; idempotencyKey?: string };

async function send(path: string, init: RequestOptions): Promise<Response> {
  const { auth = true, idempotencyKey, headers, ...rest } = init;
  const access = auth ? getTokens()?.access : undefined;
  return fetch(`${BASE_URL}/v1${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(access ? { Authorization: `Bearer ${access}` } : {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      ...headers,
    },
  });
}

// One refresh at a time, shared by concurrent requests that all got 401.
let refreshing: Promise<boolean> | null = null;

function refreshAccessToken(): Promise<boolean> {
  refreshing ??= (async () => {
    const tokens = getTokens();
    if (!tokens) return false;
    try {
      const res = await send("/auth/token/refresh/", {
        method: "POST",
        auth: false,
        body: JSON.stringify({ refresh: tokens.refresh }),
      });
      if (!res.ok) return false;
      const body = (await res.json()) as Partial<AuthTokens>;
      if (!body.access) return false;
      // Simple JWT returns a new refresh token only when rotation is enabled.
      setTokens({ access: body.access, refresh: body.refresh ?? tokens.refresh });
      return true;
    } catch {
      return false;
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

async function readBody(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function request<T>(path: string, init: RequestOptions = {}): Promise<T> {
  let res = await send(path, init);

  if (res.status === 401 && init.auth !== false) {
    if (await refreshAccessToken()) res = await send(path, init);
    if (res.status === 401) {
      clearSession();
      throw new ApiError("Your session has ended. Please sign in again.", 401);
    }
  }

  if (!res.ok) throw toApiError(res.status, await readBody(res));
  if (res.status === 204) return undefined as T;
  return (await readBody(res)) as T;
}

function firstText(val: unknown): string | null {
  if (typeof val === "string") return val;
  if (Array.isArray(val) && val.length) return firstText(val[0]);
  return null;
}

/** Map DRF error bodies ({detail}, {message}, {field: [msg]} or ["msg"]) to ApiError. */
function toApiError(status: number, body: unknown): ApiError {
  const fieldErrors: Record<string, string> = {};
  let message: string | null = firstText(body);

  if (body && typeof body === "object" && !Array.isArray(body)) {
    for (const [key, val] of Object.entries(body as Record<string, unknown>)) {
      const text = firstText(val);
      if (!text) continue;
      if (key === "detail" || key === "non_field_errors" || key === "message") message = text;
      else if (key !== "next_step" && key !== "payment") fieldErrors[key] = text;
    }
  }

  if (!message) {
    if (Object.keys(fieldErrors).length) message = "Please fix the highlighted fields.";
    else if (status === 404) message = "Not found.";
    else if (status === 401) message = "Please sign in again.";
    else if (status === 503) message = "The payment provider is temporarily unavailable. Please try again.";
    else if (status >= 500) message = "PayTrain had a problem. Please try again.";
    else message = "Request failed.";
  }
  return new ApiError(message, status, fieldErrors);
}

/** Rename backend field names in validation errors to the form's field names. */
function renameFields(err: unknown, map: Record<string, string>): never {
  if (err instanceof ApiError && Object.keys(err.fieldErrors).length) {
    const fe: Record<string, string> = {};
    for (const [k, v] of Object.entries(err.fieldErrors)) fe[map[k] ?? k] = v;
    throw new ApiError(err.message, err.status, fe);
  }
  throw err;
}

// ---------- lookups used to fill names the request serializer omits ----------

async function lookups() {
  const [customers, businesses] = await Promise.all([
    request<ApiCustomer[]>("/customers/"),
    request<ApiBusiness[]>("/businesses/"),
  ]);
  return {
    customers: new Map(customers.map((c) => [String(c.id), mapCustomer(c)])),
    businesses: new Map(businesses.map((b) => [String(b.id), mapBusiness(b)])),
    firstBusinessId: businesses[0] ? String(businesses[0].id) : null,
  };
}

async function listRequests(): Promise<PaymentRequest[]> {
  const [rows, l] = await Promise.all([request<ApiPaymentRequest[]>("/payment-requests/"), lookups()]);
  return rows
    .map((r) => mapRequest(r, l.customers, l.businesses))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

// ---------- API ----------

export const liveApi: PayTrainApi = {
  async register(input) {
    try {
      await request("/auth/register/", {
        method: "POST",
        auth: false,
        body: JSON.stringify({ email: input.email, full_name: input.full_name, password: input.password }),
      });
    } catch (err) {
      renameFields(err, {});
    }
    await liveApi.login(input);
  },

  async login(input) {
    try {
      const tokens = await request<AuthTokens>("/auth/login/", {
        method: "POST",
        auth: false,
        body: JSON.stringify({ email: input.email, password: input.password }),
      });
      setTokens({ access: tokens.access, refresh: tokens.refresh });
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 400) && !Object.keys(err.fieldErrors).length) {
        throw new ApiError("Email or password is incorrect.", err.status);
      }
      throw err;
    }
  },

  async logout() {
    clearSession();
  },

  getCurrentUser: async () => mapUser(await request<ApiUser>("/auth/me/")),

  listBusinesses: async () => (await request<ApiBusiness[]>("/businesses/")).map(mapBusiness),

  async createBusiness(input: CreateBusinessInput) {
    const body = {
      name: input.name,
      description: input.description ?? "",
      email: input.email ?? "",
      phone: input.phone ?? "",
      address: input.address ?? "",
    };
    try {
      return mapBusiness(await request<ApiBusiness>("/businesses/", { method: "POST", body: JSON.stringify(body) }));
    } catch (err) {
      renameFields(err, {});
    }
  },

  async getDashboardSummary(): Promise<DashboardSummary> {
    const rows = await listRequests();
    // Totals are only meaningful in one currency; use the most common one.
    const asset = rows[0]?.amount ?? { ...DEFAULT_ASSET, value: "0" };
    const same = rows.filter((r) => r.amount.assetCode === asset.assetCode);
    const z = zero(asset);
    return {
      collected_total: same.reduce((s, r) => add(s, r.amount_paid), z),
      outstanding_total: same.filter((r) => r.status !== "cancelled" && r.status !== "expired").reduce((s, r) => add(s, r.outstanding_amount), z),
      overdue_total: same.filter((r) => r.status === "overdue").reduce((s, r) => add(s, r.outstanding_amount), z),
      paid_request_count: rows.filter((r) => r.status === "paid").length,
      pending_count: null,
      recent_requests: rows.slice(0, 5),
    };
  },

  listPaymentRequests: listRequests,

  async getPaymentRequest(id) {
    const [row, l] = await Promise.all([
      request<ApiPaymentRequest>(`/payment-requests/${encodeURIComponent(id)}/`),
      lookups(),
    ]);
    return mapRequest(row, l.customers, l.businesses);
  },

  async createPaymentRequest(input: CreatePaymentRequestInput) {
    const l = await lookups();
    const business = l.firstBusinessId; // One business per owner in the backend.
    if (!business) throw new ApiError("Set up your business first.", 400);

    let customerId = input.customer_id;
    if (!customerId && input.new_customer) {
      try {
        const c = await request<ApiCustomer>("/customers/", {
          method: "POST",
          body: JSON.stringify({
            business: Number(business),
            full_name: input.new_customer.name,
            email: input.new_customer.email ?? "",
            phone: input.new_customer.phone ?? "",
          }),
        });
        customerId = String(c.id);
        l.customers.set(customerId, mapCustomer(c));
      } catch (err) {
        renameFields(err, { full_name: "new_name", email: "new_email" });
      }
    }

    try {
      const row = await request<ApiPaymentRequest>("/payment-requests/", {
        method: "POST",
        body: JSON.stringify({
          business: Number(business),
          customer: Number(customerId),
          description: input.description,
          total_amount: toApiDecimal(input.amount),
          currency: input.amount.assetCode,
          due_date: input.due_date,
        }),
      });
      return mapRequest(row, l.customers, l.businesses);
    } catch (err) {
      renameFields(err, { total_amount: "amount", due_date: "due" });
    }
  },

  listCustomers: async () =>
    (await request<ApiCustomer[]>("/customers/")).map(mapCustomer).sort((a, b) => a.name.localeCompare(b.name)),

  getPublicPaymentRequest: async (publicUuid) =>
    mapPublicRequest(
      await request<ApiPublicPaymentRequest>(`/public/payment-requests/${encodeURIComponent(publicUuid)}/`, { auth: false }),
    ),

  async startPayment(publicUuid, input: StartPaymentInput): Promise<StartPaymentResponse> {
    let amount = input.amount;
    if (!amount) amount = (await liveApi.getPublicPaymentRequest(publicUuid)).outstanding_amount;
    try {
      const res = await request<ApiAttemptResponse>(
        `/public/payment-requests/${encodeURIComponent(publicUuid)}/attempts/`,
        {
          method: "POST",
          auth: false,
          idempotencyKey: input.idempotency_key,
          body: JSON.stringify({ amount: toApiDecimal(amount) }),
        },
      );
      const paymentUrl = res.incoming_payment_url ?? null;
      return {
        payment_id: res.payment.idempotency_key,
        status: txnStatus(res.payment.status),
        next_action_type: paymentUrl ? "pay_to_url" : "none",
        payment_url: paymentUrl,
        expires_at: null,
      };
    } catch (err) {
      renameFields(err, {});
    }
  },

  async getPaymentStatus(paymentId, publicUuid): Promise<PaymentStatusResponse> {
    const [res, req] = await Promise.all([
      request<ApiVerifyResponse>(`/public/payment-transactions/${encodeURIComponent(paymentId)}/verify/`, {
        method: "POST",
        auth: false,
      }),
      publicUuid ? liveApi.getPublicPaymentRequest(publicUuid).catch(() => null) : Promise.resolve(null),
    ]);

    const t = res.transaction;
    const v = res.verification?.status;
    let status = txnStatus(t.status);
    let statusMessage: string | null = null;
    if (v === "partially_received" || v === "overpayment_review") {
      status = "processing";
      statusMessage = res.verification.message;
    }

    return {
      payment_id: t.idempotency_key,
      request_public_uuid: req?.public_uuid ?? publicUuid ?? "",
      request_reference: req?.reference ?? "—",
      business_name: req?.business_name ?? "",
      status,
      amount: toMoney(t.amount, t.currency),
      verified_at: null, // Not returned by the verify endpoint.
      failure_message: status === "failed" || status === "cancelled" ? res.message : null,
      status_message: statusMessage,
    };
  },
};
