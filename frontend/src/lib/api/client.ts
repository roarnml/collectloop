import type {
  Business,
  CreateBusinessInput,
  CreateCustomerInput,
  CreatePaymentRequestInput,
  Customer,
  DashboardSummary,
  LoginInput,
  PaymentRequest,
  PaymentStatusResponse,
  PublicPaymentRequest,
  RegisterInput,
  StartPaymentInput,
  StartPaymentResponse,
  User,
} from "@/lib/types";

/** Everything the UI needs from the backend. Pages only talk to this interface. */
export interface PayTrainApi {
  // Auth. login/register store the session tokens; logout clears them.
  register(input: RegisterInput): Promise<void>;
  login(input: LoginInput): Promise<void>;
  logout(): Promise<void>;
  getCurrentUser(): Promise<User>;

  // Businesses owned by the signed-in user
  listBusinesses(): Promise<Business[]>;
  createBusiness(input: CreateBusinessInput): Promise<Business>;

  // Business owner (authenticated, scoped to the active business)
  getDashboardSummary(): Promise<DashboardSummary>;
  listPaymentRequests(): Promise<PaymentRequest[]>;
  getPaymentRequest(id: string): Promise<PaymentRequest>;
  createPaymentRequest(input: CreatePaymentRequestInput): Promise<PaymentRequest>;
  listCustomers(): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer>;
  createCustomer(input: CreateCustomerInput): Promise<Customer>;

  // Customer (public, no PayTrain account)
  getPublicPaymentRequest(publicUuid: string): Promise<PublicPaymentRequest>;
  startPayment(publicUuid: string, input: StartPaymentInput): Promise<StartPaymentResponse>;
  /** Asks the backend to verify the payment with the provider and report its status. */
  getPaymentStatus(paymentId: string, publicUuid: string | null): Promise<PaymentStatusResponse>;
}

/** Display-safe error. `fieldErrors` maps form fields to messages. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function isUnauthorized(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401;
}

export type ErrorKind = "offline" | "unreachable" | "server" | "unauthorized" | "not_found" | "invalid" | "unknown";

export interface ErrorDescription {
  kind: ErrorKind;
  title: string;
  body: string;
}

/**
 * Plain-language description of an API error for error screens.
 *
 * A browser can't tell "server down" from "blocked by CORS" from "no
 * internet": all arrive as a TypeError from fetch. We check navigator.onLine
 * to separate the user's connection from PayTrain's server.
 */
export function describeError(err: unknown): ErrorDescription {
  if (err instanceof ApiError) {
    if (err.status === 401) {
      return { kind: "unauthorized", title: "Your session has ended", body: "Please sign in again to continue." };
    }
    if (err.status === 404) {
      return { kind: "not_found", title: "Not found", body: err.message === "Not found." ? "We couldn't find what you were looking for." : err.message };
    }
    if (err.status === 503) {
      return {
        kind: "server",
        title: "Payment service is temporarily unavailable",
        body: `${err.message} Please wait a moment and try again.`,
      };
    }
    if (err.status >= 500) {
      return {
        kind: "server",
        title: "PayTrain ran into a problem",
        body: "Something went wrong on our side. Please try again in a moment.",
      };
    }
    return { kind: "invalid", title: "That didn't work", body: err.message };
  }

  if (err instanceof TypeError) {
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    return offline
      ? {
          kind: "offline",
          title: "You're offline",
          body: "Check your internet connection, then try again.",
        }
      : {
          kind: "unreachable",
          title: "Can't connect to PayTrain",
          body:
            "Your internet is working, but the PayTrain server didn't respond. It may be starting up (this can take up to a minute) or briefly unavailable. Please try again shortly.",
        };
  }

  return { kind: "unknown", title: "Something went wrong", body: "Please try again." };
}

/** One-line version for inline form errors. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  const d = describeError(err);
  return d.kind === "unknown" ? d.body : `${d.title}. ${d.body}`;
}
