
import "dotenv/config";

import express from "express";

import { authenticateAdapter } from "./middleware/authenticate.js";

import {
  getWalletInformation,
  createIncomingPayment,
  getIncomingPayment,
  listIncomingPayments,
} from "./services/openPayments.js";

const app = express();

app.disable("x-powered-by");

app.use(
  express.json({
    limit: "32kb",
    strict: true,
  })
);

// Public health check.
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    service: "paytrain-open-payments-adapter",
    status: "running",
  });
});

// Protect all integration endpoints.
app.use("/api/v1", authenticateAdapter);

// Retrieve configured wallet information.
app.get("/api/v1/wallet", async (req, res) => {
  const wallet = await getWalletInformation();

  return res.status(200).json({
    success: true,
    data: wallet,
  });
});

// Create an incoming payment resource.
app.post("/api/v1/incoming-payments", async (req, res) => {
  const { amount, description, expiresInMinutes } = req.body ?? {};

  // Validate amount before calling the provider.
  if (
    !(
      (typeof amount === "string" && /^[1-9]\d*$/.test(amount)) ||
      (typeof amount === "number" &&
        Number.isSafeInteger(amount) &&
        amount > 0)
    )
  ) {
    return res.status(400).json({
      success: false,
      error: "Amount must be a positive integer in minor units.",
    });
  }

  if (
    description !== undefined &&
    (typeof description !== "string" ||
      description.length > 500)
  ) {
    return res.status(400).json({
      success: false,
      error: "Description must be a string of at most 500 characters.",
    });
  }

  const expiry = expiresInMinutes ?? 60;

  if (
    !Number.isInteger(expiry) ||
    expiry < 1 ||
    expiry > 1440
  ) {
    return res.status(400).json({
      success: false,
      error: "Expiry must be between 1 and 1440 minutes.",
    });
  }

  const payment = await createIncomingPayment({
    amount: String(amount),
    description,
    expiresInMinutes: expiry,
  });

  return res.status(201).json({
    success: true,
    data: {
      id: payment.id,
      walletAddress: payment.walletAddress,
      incomingAmount: payment.incomingAmount,
      receivedAmount: payment.receivedAmount,
      completed: payment.completed,
      expiresAt: payment.expiresAt,
    },
  });
});

// Retrieve an incoming payment resource.
app.get("/api/v1/incoming-payment", async (req, res) => {
  const { url } = req.query;

  if (!url || typeof url !== "string") {
    return res.status(400).json({
      success: false,
      error: "A valid incoming-payment URL is required.",
    });
  }

  const payment = await getIncomingPayment(url);

  return res.status(200).json({
    success: true,
    data: payment,
  });
});

// List incoming payments.
app.get("/api/v1/incoming-payments", async (req, res) => {
  const payments = await listIncomingPayments();

  return res.status(200).json({
    success: true,
    data: payments,
  });
});

// Consistent JSON response for unknown routes.
app.use((req, res) => {
  return res.status(404).json({
    success: false,
    error: "Adapter endpoint not found.",
  });
});

// Centralized error handling.
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  // Malformed JSON and oversized request bodies.
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({
      success: false,
      error: "Invalid JSON request body.",
    });
  }

  if (err.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      error: "Request body is too large.",
    });
  }

  // Log useful diagnostic information without dumping
  // provider response details or potentially sensitive payloads.
  console.error("Adapter request failed:", {
    method: req.method,
    path: req.path,
    status: err.status ?? err.statusCode ?? 502,
    message: err.message,
  });

  const status =
    Number.isInteger(err.status) &&
    err.status >= 400 &&
    err.status < 500
      ? err.status
      : 502;

  return res.status(status).json({
    success: false,
    error: "Open Payments operation failed.",
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : "The payment provider operation could not be completed.",
  });
});

const PORT = Number(process.env.PORT) || 4000;

app.listen(PORT, () => {
  console.log(
    `PayTrain Open Payments adapter running on port ${PORT}`
  );
});
