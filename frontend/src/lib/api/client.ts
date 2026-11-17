import type {
  Business,
  CreateBusinessInput,
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
  Transaction,
  User,
} from "@/lib/types";

/**
 * Everything the UI needs from the backend. Pages only talk to this
 * interface, so swapping mock data for the real Django API is one switch
 * (NEXT_PUBLIC_API_MODE) rather than a rewrite.
 */
export interface PayTrainApi {
  readonly mode: "mock" | "live";

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
  listTransactions(params?: { requestId?: string }): Promise<Transaction[]>;

  // Customer (public, no PayTrain account)
  getPublicPaymentRequest(publicUuid: string): Promise<PublicPaymentRequest>;
  startPayment(publicUuid: string, input: StartPaymentInput): Promise<StartPaymentResponse>;
  getPaymentStatus(paymentId: string): Promise<PaymentStatusResponse>;
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

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof TypeError) return "Could not reach PayTrain. Check your connection and try again.";
  return "Something went wrong. Please try again.";
}
