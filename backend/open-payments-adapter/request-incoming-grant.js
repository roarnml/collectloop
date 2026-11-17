
import 'dotenv/config';
import { writeFile } from 'node:fs/promises';

import {
  createAuthenticatedClient,
  isFinalizedGrantWithAccessToken,
} from '@interledger/open-payments';

async function main() {
  const walletUrl = process.env.OPEN_PAYMENTS_WALLET_ADDRESS;

  const client = await createAuthenticatedClient({
    walletAddressUrl: walletUrl,
    privateKey: process.env.OPEN_PAYMENTS_PRIVATE_KEY,
    keyId: process.env.OPEN_PAYMENTS_KEY_ID,
  });

  const wallet = await client.walletAddress.get({
    url: walletUrl,
  });

  console.log('Requesting incoming-payment grant...');

  const grant = await client.grant.request(
    { url: wallet.authServer },
    {
      access_token: {
        access: [
          {
            type: 'incoming-payment',
            actions: ['create', 'read', 'list', 'complete'],
          },
        ],
      },
    },
  );

  if (!isFinalizedGrantWithAccessToken(grant)) {
    console.log('Grant requires further interaction.');
    console.log('Grant response type:', Object.keys(grant).join(', '));
    return;
  }

  await writeFile(
    './grant-cache.json',
    JSON.stringify({
      accessToken: grant.access_token.value,
      manageUrl: grant.access_token.manage,
      walletAddress: wallet.id,
      resourceServer: wallet.resourceServer,
    }, null, 2),
    { mode: 0o600 },
  );

  console.log('Incoming-payment grant successfully obtained.');
  console.log('Wallet:', wallet.id);
  console.log('Grant permissions: create, read, list, complete');
  console.log('Grant credentials saved locally.');
}

main().catch((error) => {
  console.error('Grant request failed:', error.message);
  process.exitCode = 1;
});
