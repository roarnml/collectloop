import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { createAuthenticatedClient } from '@interledger/open-payments';

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

  const grant = JSON.parse(
    await readFile('./grant-cache.json', 'utf8')
  );

  const payments = await client.incomingPayment.list(
    {
      url: wallet.resourceServer,
      walletAddress: wallet.id,
      accessToken: grant.accessToken,
    },
    {
      first: 10,
      last: undefined,
      cursor: undefined,
      'wallet-address': wallet.id,
    }
  );

  console.log('Incoming payments retrieved successfully.');

  console.log(JSON.stringify(payments, null, 2));
}

main().catch(error => {
  console.error('Listing failed:', error.message);
  process.exitCode = 1;
});