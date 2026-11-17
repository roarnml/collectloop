
import "dotenv/config";

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { createAuthenticatedClient } from "@interledger/open-payments";
import { refreshGrant } from "../refreshGrant.js";

const GRANT_CACHE_PATH = fileURLToPath(
  new URL("../../grant-cache.json", import.meta.url)
);

let clientPromise;
let walletPromise;

function validateConfiguration() {
  const required = [
    "OPEN_PAYMENTS_WALLET_ADDRESS",
    "OPEN_PAYMENTS_PRIVATE_KEY",
    "OPEN_PAYMENTS_KEY_ID",
  ];

  const missing = required.filter(
    (key) => !process.env[key]?.trim()
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing Open Payments configuration: ${missing.join(", ")}`
    );
  }
}

async function getClient() {
  if (!clientPromise) {
    clientPromise = (async () => {
      validateConfiguration();

      return createAuthenticatedClient({
        walletAddressUrl: process.env.OPEN_PAYMENTS_WALLET_ADDRESS,
        privateKey: process.env.OPEN_PAYMENTS_PRIVATE_KEY,
        keyId: process.env.OPEN_PAYMENTS_KEY_ID,
      });
    })().catch((error) => {
      clientPromise = null;
      throw error;
    });
  }

  return clientPromise;
}

async function getWallet() {
  if (!walletPromise) {
    walletPromise = (async () => {
      const client = await getClient();

      return client.walletAddress.get({
        url: process.env.OPEN_PAYMENTS_WALLET_ADDRESS,
      });
    })().catch((error) => {
      walletPromise = null;
      throw error;
    });
  }

  return walletPromise;
}

async function getGrant() {
  let grant;

  try {
    const cachedGrant = await readFile(GRANT_CACHE_PATH, "utf8");
    grant = JSON.parse(cachedGrant);
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(
        "Open Payments grant cache is missing. Run the grant setup process first."
      );
    }

    if (error instanceof SyntaxError) {
      throw new Error(
        "Open Payments grant cache contains invalid JSON."
      );
    }

    throw error;
  }

  const wallet = await getWallet();

  if (grant.walletAddress !== wallet.id) {
    throw new Error("Grant belongs to a different wallet.");
  }

  if (
    typeof grant.accessToken !== "string" ||
    !grant.accessToken.trim()
  ) {
    throw new Error(
      "Incoming-payment access token is missing."
    );
  }

  return grant;
}

function isInactiveTokenError(error) {
  const status = Number(error?.status ?? error?.statusCode);

  const providerDescription = [
    error?.message,
    error?.description,
    error?.details?.description,
  ]
    .filter(Boolean)
    .join(" ");

  if (status === 401) {
    return /unauthorized|invalid token|inactive token|expired token/i.test(
      providerDescription
    );
  }

  if (status === 403) {
    return /inactive token|invalid token|expired token/i.test(
      providerDescription
    );
  }

  return false;
}

/**
 * Executes an Open Payments operation with one grant-recovery retry.
 *
 * If the cached access token is rejected:
 * 1. Check whether another request has refreshed the grant.
 * 2. Refresh it only if the cached token is still the same.
 * 3. Retry the original operation once.
 */
async function executeWithGrant(operation) {
  const client = await getClient();
  const wallet = await getWallet();
  const originalGrant = await getGrant();

  try {
    return await operation(client, wallet, originalGrant);
  } catch (error) {
    if (!isInactiveTokenError(error)) {
      throw error;
    }

    console.warn(
      "Open Payments rejected the cached grant. Attempting recovery..."
    );

    let currentGrant = await getGrant();

    if (
      currentGrant.accessToken === originalGrant.accessToken
    ) {
      await refreshGrant();
      currentGrant = await getGrant();
    } else {
      console.log("Reusing a grant refreshed by another request.");
    }

    console.log("Retrying the original Open Payments operation.");

    return operation(client, wallet, currentGrant);
  }
}

export async function getWalletInformation() {
  const wallet = await getWallet();

  return {
    id: wallet.id,
    publicName: wallet.publicName,
    assetCode: wallet.assetCode,
    assetScale: wallet.assetScale,
    authServer: wallet.authServer,
    resourceServer: wallet.resourceServer,
  };
}

export async function createIncomingPayment({
  amount,
  description,
  expiresInMinutes = 60,
}) {
  if (!/^[1-9]\d*$/.test(String(amount))) {
    throw new Error(
      "Amount must be a positive integer in minor units."
    );
  }

  if (
    !Number.isInteger(expiresInMinutes) ||
    expiresInMinutes < 1 ||
    expiresInMinutes > 1440
  ) {
    throw new Error(
      "Expiry must be between 1 and 1440 minutes."
    );
  }

  return executeWithGrant(async (client, wallet, grant) => {
    return client.incomingPayment.create(
      {
        url: wallet.resourceServer,
        accessToken: grant.accessToken,
      },
      {
        walletAddress: wallet.id,
        incomingAmount: {
          value: String(amount),
          assetCode: wallet.assetCode,
          assetScale: wallet.assetScale,
        },
        expiresAt: new Date(
          Date.now() + expiresInMinutes * 60 * 1000
        ).toISOString(),
        metadata: {
          description:
            description || "PayTrain payment request",
        },
      }
    );
  });
}

export async function getIncomingPayment(url) {
  const wallet = await getWallet();

  let requestedUrl;
  let resourceServerUrl;

  try {
    requestedUrl = new URL(url);
    resourceServerUrl = new URL(wallet.resourceServer);
  } catch {
    throw new Error(
      "Invalid incoming-payment resource URL."
    );
  }

  const expectedPath =
    `${resourceServerUrl.pathname.replace(/\/$/, "")}/incoming-payments/`;

  if (
    requestedUrl.origin !== resourceServerUrl.origin ||
    !requestedUrl.pathname.startsWith(expectedPath) ||
    requestedUrl.username ||
    requestedUrl.password ||
    requestedUrl.hash
  ) {
    throw new Error(
      "Incoming-payment URL is outside the configured resource server."
    );
  }

  return executeWithGrant(async (client, wallet, grant) => {
    return client.incomingPayment.get({
      url: requestedUrl.toString(),
      accessToken: grant.accessToken,
    });
  });
}

export async function listIncomingPayments() {
  return executeWithGrant(async (client, wallet, grant) => {
    return client.incomingPayment.list(
      {
        url: wallet.resourceServer,
        walletAddress: wallet.id,
        accessToken: grant.accessToken,
      },
      {
        first: 10,
        last: undefined,
        cursor: undefined,
        "wallet-address": wallet.id,
      }
    );
  });
}
