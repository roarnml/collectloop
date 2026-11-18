import { timingSafeEqual } from "node:crypto";

export function authenticateAdapter(req, res, next) {
  const expectedKey = process.env.ADAPTER_API_KEY;
  const suppliedKey = req.headers["x-adapter-key"];

  if (!expectedKey) {
    console.error("ADAPTER_API_KEY is not configured.");

    return res.status(500).json({
      success: false,
      error: "Adapter authentication is not configured.",
    });
  }

    if (typeof suppliedKey !== "string") {
    return res.status(401).json({
      success: false,
      error: "Unauthorized adapter request.",
    });
  }

  const expectedBuffer = Buffer.from(expectedKey, "utf8");
  const suppliedBuffer = Buffer.from(suppliedKey, "utf8");

  if (
    expectedBuffer.length !== suppliedBuffer.length ||
    !timingSafeEqual(expectedBuffer, suppliedBuffer)
  ) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized adapter request.",
    });
  }

  next();
}