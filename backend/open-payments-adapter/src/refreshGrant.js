
import "dotenv/config";

import { resolve } from "node:path";
import {
  writeFile,
  rename,
  unlink,
} from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
  createAuthenticatedClient,
  isFinalizedGrantWithAccessToken,
} from "@interledger/open-payments";

const GRANT_CACHE_PATH = fileURLToPath(
  new URL("../grant-cache.json", import.meta.url)
);

let refreshPromise = null;

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

async function saveGrantCache(cache) {
  const temporaryPath =
    `${GRANT_CACHE_PATH}.${process.pid}.tmp`;

  try {
    await writeFile(
      temporaryPath,
      JSON.stringify(cache, null, 2),
      {
        encoding: "utf8",
        mode: 0o600,
        flag: "wx",
      }
    );

    await rename(temporaryPath, GRANT_CACHE_PATH);
  } catch (error) {
    await unlink(temporaryPath).catch(() => {});
    throw error;
  }
}

async function createFreshGrant() {
  validateConfiguration();

  const walletAddressUrl =
    process.env.OPEN_PAYMENTS_WALLET_ADDRESS;

  const privateKey =
    process.env.OPEN_PAYMENTS_PRIVATE_KEY;

  const keyId =
    process.env.OPEN_PAYMENTS_KEY_ID;

  const client = await createAuthenticatedClient({
    walletAddressUrl,
    privateKey,
    keyId,
  });

  const wallet = await client.walletAddress.get({
    url: walletAddressUrl,
  });

  if (!wallet?.id || !wallet?.authServer) {
    throw new Error(
      "The configured wallet returned incomplete wallet information."
    );
  }

  console.log("Requesting a new incoming-payment grant...");

  const grant = await client.grant.request(
    {
      url: wallet.authServer,
    },
    {
      access_token: {
        access: [
          {
            type: "incoming-payment",
            actions: ["create", "read", "list", "complete"],
          },
        ],
      },
    }
  );

  if (!isFinalizedGrantWithAccessToken(grant)) {
    throw new Error(
      "Incoming-payment grant was not finalized. Check the authorization server response."
    );
  }

  const cache = {
    walletAddress: wallet.id,
    accessToken: grant.access_token.value,
    accessTokenManage: grant.access_token.manage,
    refreshedAt: new Date().toISOString(),
  };

  if (
    typeof cache.accessToken !== "string" ||
    !cache.accessToken.trim()
  ) {
    throw new Error(
      "The finalized grant does not contain a valid access token."
    );
  }

  await saveGrantCache(cache);

  console.log(
    "Incoming-payment grant saved successfully."
  );

  console.log(
    "Granted actions: create, read, list, complete"
  );

  return cache;
}

export async function refreshGrant() {
  // Prevent concurrent refresh attempts within this process.
  if (!refreshPromise) {
    refreshPromise = createFreshGrant().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

// Allow manual execution:
// node src/refreshGrant.js
const isMainModule =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  try {
    await refreshGrant();
  } catch (error) {
    console.error(
      "Grant request failed:",
      error.message
    );

    process.exitCode = 1;
  }
}
