
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

  console.log('Creating fresh diagnostic resource...');

  const created = await client.incomingPayment.create(
    {
      url: wallet.resourceServer,
      accessToken: grant.accessToken,
    },
    {
      walletAddress: wallet.id,
      incomingAmount: {
        value: '1000',
        assetCode: wallet.assetCode,
        assetScale: wallet.assetScale,
      },
      expiresAt: new Date(
        Date.now() + 60 * 60 * 1000
      ).toISOString(),
      metadata: {
        description: 'CollectLoop immediate retrieval diagnostic',
      },
    }
  );

  console.log('Resource created:', created.id);
  console.log('Attempting immediate retrieval...');

  try {
    const retrieved = await client.incomingPayment.get({
      url: created.id,
      accessToken: grant.accessToken,
    });

    console.log('SUCCESS: Resource retrieved.');
    console.log({
      id: retrieved.id,
      incomingAmount: retrieved.incomingAmount,
      receivedAmount: retrieved.receivedAmount,
      completed: retrieved.completed,
      expiresAt: retrieved.expiresAt,
    });
  } catch (error) {
    console.error('IMMEDIATE RETRIEVAL FAILED');
    console.error({
      message: error.message,
      description: error.description,
      status: error.status,
      details: error.details,
    });
  }
}

main().catch(error => {
  console.error('Diagnostic failed:', error.message);
  process.exitCode = 1;
});
