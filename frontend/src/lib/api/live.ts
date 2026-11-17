import type {
  AuthTokens,
  Business,
  CreateBusinessInput,
  CreatePaymentRequestInput,
  Customer,
  DashboardSummary,
  PaymentRequest,
  PaymentStatusResponse,
  PublicPaymentRequest,
  StartPaymentInput,
  StartPaymentResponse,
  Transaction,
  User,
} from "@/lib/types";
import { clearSession, getActiveBusinessId, getTokens, setTokens } from "@/lib/auth/session";
import { ApiError, type PayTrainApi } from "./client";

/**
 * Real backend client.
 *
 * ROUTES ARE PROPOSED, NOT CONFIRMED. They follow section 6 of the PayTrain
 * foundational guide. Map each one to the actual Django router paths once the
 * backend publishes its OpenAPI schema, and adjust request/response shapes to
 * match the serializers. Auth assumes Simple JWT defaults ({access, refresh}).
 *
 * This client never handles Open Payments keys, grants or access tokens. The
 * backend owns all of that and only returns safe fields (e.g. redirect_url).
 */

const BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api").replace(/\/$/, "");

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
      const res = await send("/auth/refresh/", {
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

async function request<T>(path: string, init: RequestOptions = {}): Promise<T> {
  let res = await send(path, init);

  if (res.status === 401 && init.auth !== false) {
    if (await refreshAccessToken()) {
      res = await send(path, init);
    }
    if (res.status === 401) {
      clearSession();
      throw new ApiError("Your session has ended. Please sign in again.", 401);
    }
  }

  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // Non-JSON error body; fall through to a generic message.
    }
    throw toApiError(res.status, body);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Map a DRF-style error body ({detail} or {field: [msg]}) to ApiError. */
function toApiError(status: number, body: unknown): ApiError {
  const fieldErrors: Record<string, string> = {};
  let message = status === 404 ? "Not found." : status === 401 ? "Please sign in again." : "Request failed.";
  if (body && typeof body === "object") {
    for (const [key, val] of Object.entries(body as Record<string, unknown>)) {
      const text = Array.isArray(val) ? String(val[0]) : typeof val === "string" ? val : null;
      if (!text) continue;
      if (key === "detail" || key === "non_field_errors") message = text;
      else fieldErrors[key] = text;
    }
  }
  if (Object.keys(fieldErrors).length && message === "Request failed.") message = "Please fix the highlighted fields.";
  return new ApiError(message, status, fieldErrors);
}

/** TODO(backend): confirm how owner-scoped routes pick the business (query param, header, or nested route). */
function businessQuery(prefix: "?" | "&" = "?"): string {
  const id = getActiveBusinessId();
  return id ? `${prefix}business=${encodeURIComponent(id)}` : "";
}

export const liveApi: PayTrainApi = {
  mode: "live",

  async register(input) {
    await request("/auth/register/", { method: "POST", auth: false, body: JSON.stringify(input) });
    // Registration may not return tokens; sign in explicitly.
    await liveApi.login(input);
  },
  async login(input) {
    try {
      const tokens = await request<AuthTokens>("/auth/login/", {
        method: "POST",
        auth: false,
        body: JSON.stringify(input),
      });
      setTokens(tokens);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 400) && !Object.keys(err.fieldErrors).length) {
        throw new ApiError("Email or password is incorrect.", err.status);
      }
      throw err;
    }
  },
  async logout() {
    // TODO(backend): call the refresh-token blacklist endpoint if one is enabled.
    clearSession();
  },
  getCurrentUser: () => request<User>("/auth/me/"),

  listBusinesses: () => request<Business[]>("/businesses/"),
  createBusiness: (input: CreateBusinessInput) =>
    request<Business>("/businesses/", { method: "POST", body: JSON.stringify(input) }),

  getDashboardSummary: () => request<DashboardSummary>(`/dashboard/summary/${businessQuery()}`),
  listPaymentRequests: () => request<PaymentRequest[]>(`/payment-requests/${businessQuery()}`),
  getPaymentRequest: (id) => request<PaymentRequest>(`/payment-requests/${encodeURIComponent(id)}/`),
  createPaymentRequest: (input: CreatePaymentRequestInput) =>
    request<PaymentRequest>("/payment-requests/", {
      method: "POST",
      body: JSON.stringify({ ...input, business: getActiveBusinessId() }),
    }),
  listCustomers: () => request<Customer[]>(`/customers/${businessQuery()}`),
  listTransactions: (params) =>
    request<Transaction[]>(
      params?.requestId
        ? `/payments/transactions/?request=${encodeURIComponent(params.requestId)}`
        : `/payments/transactions/${businessQuery()}`,
    ),

  getPublicPaymentRequest: (publicUuid) =>
    request<PublicPaymentRequest>(`/public/payment-requests/${encodeURIComponent(publicUuid)}/`, { auth: false }),
  startPayment: (publicUuid, input: StartPaymentInput) =>
    request<StartPaymentResponse>(`/public/payment-requests/${encodeURIComponent(publicUuid)}/payments/`, {
      method: "POST",
      auth: false,
      idempotencyKey: input.idempotency_key,
      body: JSON.stringify(input),
    }),
  getPaymentStatus: (paymentId) =>
    request<PaymentStatusResponse>(`/public/payments/${encodeURIComponent(paymentId)}/status/`, { auth: false }),
};
