import type { PayTrainApi } from "./client";
import { liveApi } from "./live";

export { ApiError, describeError, errorMessage, isUnauthorized } from "./client";
export type { ErrorDescription, ErrorKind } from "./client";
export type { PayTrainApi } from "./client";

/** PayTrain Django API at NEXT_PUBLIC_API_BASE_URL. */
export const api: PayTrainApi = liveApi;
