import type {
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
  StartPaymentResponse,
  Transaction,
  User,
} from "@/lib/types";
import { add, money, subtractFloor, toMinor, zero } from "@/lib/format/money";
import { ApiError, type PayTrainApi } from "./client";
import { DEFAULT_ASSET } from "@/lib/config";
import { clearSession, getActiveBusinessId, getTokens, setTokens } from "@/lib/auth/session";

/**
 * SIMULATED BACKEND for building the UI before the Django API and Open
 * Payments integration are ready. Data lives in this browser's localStorage.
 * Every record it returns has `is_simulated: true` so the UI can label it.
 *
 * It models the agreed rules so the UI is built against the right behaviour:
 *  - only succeeded payments count toward amount paid
 *  - outstanding = total − paid, floored at zero
 *  - a redirect back from the "provider" is not success; status must be polled
 *  - repeated start-payment calls with the same idempotency key return the same payment
 *  - owner endpoints need a signed-in user and only see the active business's data
 *
 * Mock passwords are hashed with SHA-256 only so they are not kept in plain
 * text in localStorage. This is NOT real password security; the backend does that.
 */

const STORAGE_KEY = "paytrain.mock.v3"; // v3: users and businesses

/** Synthetic demo login for the mock backend only. Its hash is in the seed below. */
export const MOCK_DEMO_ACCOUNT = { email: "demo@paytrain.test", password: "demo-pass-2026" } as const;
const CURRENCY = DEFAULT_ASSET;
const AUTH_WINDOW_MS = 15 * 60 * 1000;
const POLLS_UNTIL_SETTLED = 2;

type ProviderDecision = "approve" | "decline" | "fail";

interface StoredUser extends User {
  password_hash: string;
}

interface StoredBusiness extends Business {
  owner_id: string;
}

interface StoredCustomer extends Customer {
  business_id: string;
}

interface StoredRequest {
  id: string;
  business_id: string;
  public_uuid: string;
  reference: string;
  customer_id: string;
  description: string;
  amount: Money;
  allow_partial: boolean;
  due_at: string | null;
  cancelled: boolean;
  created_at: string;
}

interface StoredPayment {
  id: string;
  request_id: string;
  amount: Money;
  status: PaymentStatus;
  idempotency_key: string;
  provider_reference: string | null;
  decision: ProviderDecision | null;
  polls: number;
  failure_message: string | null;
  created_at: string;
  verified_at: string | null;
}

interface Store {
  seq: number;
  users: StoredUser[];
  businesses: StoredBusiness[];
  /** access/refresh token → user id */
  sessions: Record<string, string>;
  customers: StoredCustomer[];
  requests: StoredRequest[];
  payments: StoredPayment[];
}

// ---------- persistence ----------

const daysFromNow = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();
const ngn = (naira: number) => money(BigInt(naira) * 100n, CURRENCY.assetCode, CURRENCY.assetScale);
const uuid = () => crypto.randomUUID();

function seed(): Store {
  // Demo account for the mock backend (see frontend/README.md).
  const users: StoredUser[] = [
    {
      id: "usr_1",
      email: "demo@paytrain.test",
      password_hash: "d06c720638e159e9f297d4198fde6926d4c2e8ced90c6ec5a40e2dc80f0c4fc4",
    },
  ];
  const businesses: StoredBusiness[] = [
    {
      id: "biz_1", owner_id: "usr_1", name: "Lumen Studio (demo business)",
      description: "Photography and event styling", email: "hello@lumen.example.test", phone: null, address: null,
    },
  ];
  const customers: StoredCustomer[] = [
    { id: "cus_1", business_id: "biz_1", name: "Tola Bankole", email: "tola@example.test", phone: null },
    { id: "cus_2", business_id: "biz_1", name: "Chidi Nwosu", email: "chidi@example.test", phone: "+000 000 0002" },
    { id: "cus_3", business_id: "biz_1", name: "Amaka Eze", email: null, phone: "+000 000 0003" },
  ];
  const requests: StoredRequest[] = [
    {
      id: "req_1", public_uuid: "8f1c2a4e-1b7d-4c55-9a51-3e7d0c1f2a01", business_id: "biz_1", reference: "PT-1001",
      customer_id: "cus_1", description: "Wedding photography — deposit and balance",
      amount: ngn(450_000), allow_partial: true, due_at: daysFromNow(10), cancelled: false, created_at: daysFromNow(-6),
    },
    {
      id: "req_2", public_uuid: "2b9e7f10-6c3a-4f2e-8d4b-5a6c7d8e9f02", business_id: "biz_1", reference: "PT-1002",
      customer_id: "cus_2", description: "Maths tutoring — November (8 sessions)",
      amount: ngn(80_000), allow_partial: false, due_at: daysFromNow(-2), cancelled: false, created_at: daysFromNow(-12),
    },
    {
      id: "req_3", public_uuid: "c4d5e6f7-0a1b-4c2d-9e3f-4a5b6c7d8e03", business_id: "biz_1", reference: "PT-1003",
      customer_id: "cus_3", description: "Laptop screen replacement",
      amount: ngn(65_000), allow_partial: false, due_at: daysFromNow(-3), cancelled: false, created_at: daysFromNow(-9),
    },
    {
      id: "req_4", public_uuid: "e1f2a3b4-5c6d-4e7f-8a9b-0c1d2e3f4a04", business_id: "biz_1", reference: "PT-1004",
      customer_id: "cus_1", description: "Event booth styling — Saturday market",
      amount: ngn(200_000), allow_partial: true, due_at: daysFromNow(5), cancelled: false, created_at: daysFromNow(-1),
    },
  ];
  const settled = (id: string, request_id: string, amount: Money, daysAgo: number): StoredPayment => ({
    id, request_id, amount, status: "succeeded", idempotency_key: uuid(), provider_reference: `sim_${id}`,
    decision: "approve", polls: POLLS_UNTIL_SETTLED, failure_message: null,
    created_at: daysFromNow(-daysAgo), verified_at: daysFromNow(-daysAgo),
  });
  const payments: StoredPayment[] = [
    settled("pay_1", "req_1", ngn(150_000), 5),
    settled("pay_2", "req_2", ngn(80_000), 3),
    {
      id: "pay_3", request_id: "req_4", amount: ngn(200_000), status: "failed", idempotency_key: uuid(),
      provider_reference: "sim_pay_3", decision: "fail", polls: POLLS_UNTIL_SETTLED,
      failure_message: "The wallet provider rejected the payment.", created_at: daysFromNow(-1), verified_at: null,
    },
  ];
  return { seq: 1004, users, businesses, sessions: {}, customers, requests, payments };
}

function load(): Store {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Store;
  } catch {
    // Storage blocked or corrupt; fall back to fresh seed data.
  }
  const fresh = seed();
  save(fresh);
  return fresh;
}

function save(store: Store) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Storage unavailable (private mode); data lives for this page only.
  }
}

export function resetMockData() {
  save(seed());
  clearSession();
}

const latency = () => new Promise((r) => setTimeout(r, 250 + Math.random() * 250));

// ---------- auth helpers ----------

async function hashPassword(password: string): Promise<string> {
  const bytes = new TextEncoder().encode(`paytrain-mock:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function issueTokens(store: Store, userId: string) {
  const access = `mock-access.${uuid()}`;
  const refresh = `mock-refresh.${uuid()}`;
  store.sessions[access] = userId;
  store.sessions[refresh] = userId;
  save(store);
  setTokens({ access, refresh });
}

function requireUser(store: Store): StoredUser {
  const access = getTokens()?.access;
  const userId = access ? store.sessions[access] : undefined;
  const user = userId ? store.users.find((u) => u.id === userId) : undefined;
  if (!user) {
    clearSession();
    throw new ApiError("Your session has ended. Please sign in again.", 401);
  }
  return user;
}

/** The signed-in user's active business. Owner endpoints only see this business's data. */
function requireBusiness(store: Store): StoredBusiness {
  const user = requireUser(store);
  const id = getActiveBusinessId();
  const biz = store.businesses.find((b) => b.id === id && b.owner_id === user.id);
  if (!biz) throw new ApiError("Choose a business to continue.", 403);
  return biz;
}

function businessDto(b: StoredBusiness): Business {
  return { id: b.id, name: b.name, description: b.description, email: b.email, phone: b.phone, address: b.address };
}

function customerDto(c: StoredCustomer): Customer {
  return { id: c.id, name: c.name, email: c.email, phone: c.phone };
}

function businessName(store: Store, businessId: string): string {
  return store.businesses.find((b) => b.id === businessId)?.name ?? "Unknown business";
}

// ---------- reconciliation (mirrors the agreed backend rules) ----------

function amountPaid(store: Store, req: StoredRequest): Money {
  return store.payments
    .filter((p) => p.request_id === req.id && p.status === "succeeded")
    .reduce((sum, p) => add(sum, p.amount), zero(req.amount));
}

function requestStatus(req: StoredRequest, paid: Money): PaymentRequestStatus {
  if (req.cancelled) return "cancelled";
  const outstanding = subtractFloor(req.amount, paid);
  if (toMinor(outstanding) === 0n) return "paid";
  if (req.due_at && new Date(req.due_at).getTime() < Date.now()) return "overdue";
  if (toMinor(paid) > 0n) return "partially_paid";
  return "open";
}

function toDto(store: Store, req: StoredRequest): PaymentRequest {
  const paid = amountPaid(store, req);
  const customer = store.customers.find((c) => c.id === req.customer_id);
  return {
    id: req.id,
    public_uuid: req.public_uuid,
    reference: req.reference,
    business_name: businessName(store, req.business_id),
    customer: { id: req.customer_id, name: customer?.name ?? "Unknown customer" },
    description: req.description,
    amount: req.amount,
    amount_paid: paid,
    outstanding_amount: subtractFloor(req.amount, paid),
    allow_partial: req.allow_partial,
    due_at: req.due_at,
    status: requestStatus(req, paid),
    created_at: req.created_at,
    is_simulated: true,
  };
}

function toPublicDto(store: Store, req: StoredRequest): PublicPaymentRequest {
  const d = toDto(store, req);
  return {
    public_uuid: d.public_uuid, reference: d.reference, business_name: d.business_name,
    description: d.description, amount: d.amount, amount_paid: d.amount_paid,
    outstanding_amount: d.outstanding_amount, allow_partial: d.allow_partial,
    due_at: d.due_at, status: d.status, is_simulated: true,
  };
}

function toTransaction(store: Store, p: StoredPayment): Transaction {
  const req = store.requests.find((r) => r.id === p.request_id);
  return {
    id: p.id, request_id: p.request_id, request_reference: req?.reference ?? "—",
    provider: "Simulated wallet", provider_reference: p.provider_reference, amount: p.amount,
    status: p.status, verified_at: p.verified_at, created_at: p.created_at,
    failure_message: p.failure_message, is_simulated: true,
  };
}

function findRequest(store: Store, pred: (r: StoredRequest) => boolean): StoredRequest {
  const req = store.requests.find(pred);
  if (!req) throw new ApiError("This payment request could not be found.", 404);
  return req;
}

function findPayment(store: Store, id: string): StoredPayment {
  const p = store.payments.find((x) => x.id === id);
  if (!p) throw new ApiError("This payment could not be found.", 404);
  return p;
}

/** Advance a payment the way a backend poll of the provider would. */
function advance(store: Store, p: StoredPayment) {
  if (p.status === "awaiting_authorization" && Date.now() - new Date(p.created_at).getTime() > AUTH_WINDOW_MS) {
    p.status = "expired";
    p.failure_message = "The authorisation window expired before the payment was approved.";
    return;
  }
  if (p.status !== "processing") return;
  p.polls += 1;
  if (p.polls < POLLS_UNTIL_SETTLED) return;

  const req = findRequest(store, (r) => r.id === p.request_id);
  const outstanding = subtractFloor(req.amount, amountPaid(store, req));
  if (p.decision === "fail") {
    p.status = "failed";
    p.failure_message = "The wallet provider rejected the payment.";
  } else if (toMinor(p.amount) > toMinor(outstanding)) {
    p.status = "failed";
    p.failure_message = "This amount is more than the remaining balance, so it was not applied.";
  } else {
    p.status = "succeeded";
    p.verified_at = new Date().toISOString();
  }
}

function statusDto(store: Store, p: StoredPayment): PaymentStatusResponse {
  const req = findRequest(store, (r) => r.id === p.request_id);
  return {
    payment_id: p.id, request_public_uuid: req.public_uuid, request_reference: req.reference,
    business_name: businessName(store, req.business_id), status: p.status, amount: p.amount, verified_at: p.verified_at,
    failure_message: p.failure_message, is_simulated: true,
  };
}

// ---------- API ----------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const mockApi: PayTrainApi = {
  mode: "mock",

  async register(input) {
    await latency();
    const store = load();
    const email = input.email.trim().toLowerCase();
    const fieldErrors: Record<string, string> = {};
    if (!EMAIL_RE.test(email)) fieldErrors.email = "Enter a valid email address.";
    else if (store.users.some((u) => u.email === email)) fieldErrors.email = "An account with this email already exists.";
    if (input.password.length < 8) fieldErrors.password = "Use at least 8 characters.";
    if (Object.keys(fieldErrors).length) throw new ApiError("Please fix the highlighted fields.", 400, fieldErrors);

    const user: StoredUser = { id: `usr_${uuid().slice(0, 8)}`, email, password_hash: await hashPassword(input.password) };
    store.users.push(user);
    issueTokens(store, user.id);
  },

  async login(input) {
    await latency();
    const store = load();
    const email = input.email.trim().toLowerCase();
    const user = store.users.find((u) => u.email === email);
    if (!user || user.password_hash !== (await hashPassword(input.password))) {
      throw new ApiError("Email or password is incorrect.", 401);
    }
    issueTokens(store, user.id);
  },

  async logout() {
    const store = load();
    const tokens = getTokens();
    if (tokens) {
      delete store.sessions[tokens.access];
      delete store.sessions[tokens.refresh];
      save(store);
    }
    clearSession();
  },

  async getCurrentUser() {
    await latency();
    const u = requireUser(load());
    return { id: u.id, email: u.email };
  },

  async listBusinesses() {
    await latency();
    const store = load();
    const user = requireUser(store);
    return store.businesses.filter((b) => b.owner_id === user.id).map(businessDto);
  },

  async createBusiness(input: CreateBusinessInput) {
    await latency();
    const store = load();
    const user = requireUser(store);
    const fieldErrors: Record<string, string> = {};
    if (!input.name.trim()) fieldErrors.name = "Enter your business name.";
    if (input.email && !EMAIL_RE.test(input.email.trim())) fieldErrors.email = "Enter a valid email address.";
    if (Object.keys(fieldErrors).length) throw new ApiError("Please fix the highlighted fields.", 400, fieldErrors);
    const b: StoredBusiness = {
      id: `biz_${uuid().slice(0, 8)}`,
      owner_id: user.id,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      address: input.address?.trim() || null,
    };
    store.businesses.push(b);
    save(store);
    return businessDto(b);
  },

  async getDashboardSummary(): Promise<DashboardSummary> {
    await latency();
    const store = load();
    const biz = requireBusiness(store);
    const own = store.requests.filter((r) => r.business_id === biz.id);
    const ownIds = new Set(own.map((r) => r.id));
    const ownPayments = store.payments.filter((p) => ownIds.has(p.request_id));
    const dtos = own.map((r) => toDto(store, r));
    const z = zero(CURRENCY);
    return {
      collected_total: dtos.reduce((s, d) => add(s, d.amount_paid), z),
      outstanding_total: dtos.filter((d) => d.status !== "cancelled").reduce((s, d) => add(s, d.outstanding_amount), z),
      overdue_total: dtos.filter((d) => d.status === "overdue").reduce((s, d) => add(s, d.outstanding_amount), z),
      successful_count: ownPayments.filter((p) => p.status === "succeeded").length,
      pending_count: ownPayments.filter((p) => p.status === "processing" || p.status === "awaiting_authorization").length,
      recent_requests: [...dtos].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5),
    };
  },

  async listPaymentRequests() {
    await latency();
    const store = load();
    const biz = requireBusiness(store);
    return store.requests
      .filter((r) => r.business_id === biz.id)
      .map((r) => toDto(store, r))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  async getPaymentRequest(id) {
    await latency();
    const store = load();
    const biz = requireBusiness(store);
    return toDto(store, findRequest(store, (r) => r.id === id && r.business_id === biz.id));
  },

  async createPaymentRequest(input: CreatePaymentRequestInput) {
    await latency();
    const store = load();
    const biz = requireBusiness(store);
    const fieldErrors: Record<string, string> = {};
    if (!input.description.trim()) fieldErrors.description = "Describe what this payment is for.";
    if (toMinor(input.amount) <= 0n) fieldErrors.amount = "Amount must be greater than zero.";
    if (!input.customer_id && !input.new_customer?.name.trim()) fieldErrors.customer = "Choose or add a customer.";
    if (input.customer_id && !store.customers.some((c) => c.id === input.customer_id && c.business_id === biz.id)) {
      fieldErrors.customer = "That customer no longer exists.";
    }
    if (Object.keys(fieldErrors).length) throw new ApiError("Please fix the highlighted fields.", 400, fieldErrors);

    let customerId = input.customer_id;
    if (!customerId && input.new_customer) {
      const c: StoredCustomer = {
        id: `cus_${uuid().slice(0, 8)}`,
        business_id: biz.id,
        name: input.new_customer.name.trim(),
        email: input.new_customer.email?.trim() || null,
        phone: input.new_customer.phone?.trim() || null,
      };
      store.customers.push(c);
      customerId = c.id;
    }

    store.seq += 1;
    const req: StoredRequest = {
      id: `req_${uuid().slice(0, 8)}`,
      business_id: biz.id,
      public_uuid: uuid(),
      reference: `PT-${store.seq}`,
      customer_id: customerId!,
      description: input.description.trim(),
      amount: { ...input.amount, assetCode: CURRENCY.assetCode, assetScale: CURRENCY.assetScale },
      allow_partial: input.allow_partial,
      due_at: input.due_at,
      cancelled: false,
      created_at: new Date().toISOString(),
    };
    store.requests.push(req);
    save(store);
    return toDto(store, req);
  },

  async listCustomers() {
    await latency();
    const store = load();
    const biz = requireBusiness(store);
    return store.customers
      .filter((c) => c.business_id === biz.id)
      .map(customerDto)
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  async listTransactions(params) {
    await latency();
    const store = load();
    const biz = requireBusiness(store);
    const ownIds = new Set(store.requests.filter((r) => r.business_id === biz.id).map((r) => r.id));
    return store.payments
      .filter((p) => ownIds.has(p.request_id) && (!params?.requestId || p.request_id === params.requestId))
      .map((p) => toTransaction(store, p))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  async getPublicPaymentRequest(publicUuid) {
    await latency();
    const store = load();
    return toPublicDto(store, findRequest(store, (r) => r.public_uuid === publicUuid));
  },

  async startPayment(publicUuid, input): Promise<StartPaymentResponse> {
    await latency();
    const store = load();
    const req = findRequest(store, (r) => r.public_uuid === publicUuid);

    const existing = store.payments.find((p) => p.idempotency_key === input.idempotency_key);
    if (existing) return startResponse(existing);

    const dto = toDto(store, req);
    if (dto.status === "paid") throw new ApiError("This request has already been paid in full.", 409);
    if (dto.status === "cancelled" || dto.status === "expired") {
      throw new ApiError("This request is no longer accepting payments.", 409);
    }
    const amount = input.amount ?? dto.outstanding_amount;
    if (toMinor(amount) <= 0n) throw new ApiError("Enter an amount greater than zero.", 400, { amount: "Enter an amount greater than zero." });
    if (toMinor(amount) > toMinor(dto.outstanding_amount)) {
      throw new ApiError("That is more than the remaining balance.", 400, { amount: "That is more than the remaining balance." });
    }
    if (!req.allow_partial && toMinor(amount) !== toMinor(dto.outstanding_amount)) {
      throw new ApiError("This request must be paid in full.", 400, { amount: "This request must be paid in full." });
    }

    const p: StoredPayment = {
      id: `pay_${uuid().slice(0, 8)}`, request_id: req.id, amount, status: "awaiting_authorization",
      idempotency_key: input.idempotency_key, provider_reference: null, decision: null, polls: 0,
      failure_message: null, created_at: new Date().toISOString(), verified_at: null,
    };
    store.payments.push(p);
    save(store);
    return startResponse(p);
  },

  async getPaymentStatus(paymentId) {
    await latency();
    const store = load();
    const p = findPayment(store, paymentId);
    advance(store, p);
    save(store);
    return statusDto(store, p);
  },
};

function startResponse(p: StoredPayment): StartPaymentResponse {
  return {
    payment_id: p.id,
    status: p.status,
    next_action_type: p.status === "awaiting_authorization" ? "redirect" : "none",
    redirect_url: p.status === "awaiting_authorization" ? `/pay/mock-provider?payment=${encodeURIComponent(p.id)}` : null,
    expires_at: new Date(new Date(p.created_at).getTime() + AUTH_WINDOW_MS).toISOString(),
    is_simulated: true,
  };
}

/**
 * Stand-in for the customer's wallet/provider consent screen. Only used by
 * /pay/mock-provider. In live mode the real provider hosts this step.
 */
export const mockProvider = {
  async getPayment(paymentId: string): Promise<PaymentStatusResponse> {
    await latency();
    const store = load();
    return statusDto(store, findPayment(store, paymentId));
  },

  async decide(paymentId: string, decision: ProviderDecision): Promise<void> {
    await latency();
    const store = load();
    const p = findPayment(store, paymentId);
    if (p.status !== "awaiting_authorization") return; // Already decided; ignore repeats.
    p.decision = decision;
    p.provider_reference = `sim_${p.id}`;
    if (decision === "decline") {
      p.status = "cancelled";
      p.failure_message = "You cancelled the payment at your wallet provider.";
    } else {
      p.status = "processing";
    }
    save(store);
  },
};
