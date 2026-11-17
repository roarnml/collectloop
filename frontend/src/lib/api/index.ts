import type { PayTrainApi } from "./client";
import { liveApi } from "./live";
import { mockApi } from "./mock";

export { ApiError, errorMessage, isUnauthorized } from "./client";
export type { PayTrainApi } from "./client";

/**
 * NEXT_PUBLIC_API_MODE=live talks to the Django API at NEXT_PUBLIC_API_BASE_URL.
 * Anything else (including unset) uses the clearly labelled mock backend.
 */
export const API_MODE: "mock" | "live" = process.env.NEXT_PUBLIC_API_MODE === "live" ? "live" : "mock";

export const api: PayTrainApi = API_MODE === "live" ? liveApi : mockApi;
