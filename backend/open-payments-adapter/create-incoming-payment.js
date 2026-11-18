
import 'dotenv/config';
import { readFile, writeFile } from 'node:fs/promises';
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
    await readFile('./grant-cache.json', 'utf8'),
  );

  if (grant.walletAddress !== wallet.id) {
    throw new Error('Grant belongs to a different wallet');
  }

  const amount = {
    value: '1000',
    assetCode: wallet.assetCode,
    assetScale: wallet.assetScale,
  };

  console.log('Creating EUR 10.00 incoming-payment resource...');

  const incomingPayment = await client.incomingPayment.create(
    {
      url: wallet.resourceServer,
      accessToken: grant.accessToken,
    },
    {
      walletAddress: wallet.id,
      incomingAmount: amount,
      expiresAt: new Date(
        Date.now() + 30 * 60 * 1000,
      ).toISOString(),
      metadata: {
        description: 'CollectLoop test payment request',
      },
    },
  );

  await writeFile(
    './incoming-payment-cache.json',
    JSON.stringify({
      id: incomingPayment.id,
      walletAddress: wallet.id,
      amount,
      expiresAt: incomingPayment.expiresAt,
    }, null, 2),
    { mode: 0o600 },
  );

  console.log('Incoming-payment resource created!');
  console.log('Resource URL:', incomingPayment.id);
  console.log('Amount:', amount.value, amount.assetCode);
  console.log('Expires:', incomingPayment.expiresAt);
}

main().catch((error) => {
  console.error('Incoming-payment creation failed:');
  console.error(error.message);
  process.exitCode = 1;
});
