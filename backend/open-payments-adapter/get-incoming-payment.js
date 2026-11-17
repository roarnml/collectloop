
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { createAuthenticatedClient } from '@interledger/open-payments';

async function main() {
  const client = await createAuthenticatedClient({
    walletAddressUrl: process.env.OPEN_PAYMENTS_WALLET_ADDRESS,
    privateKey: process.env.OPEN_PAYMENTS_PRIVATE_KEY,
    keyId: process.env.OPEN_PAYMENTS_KEY_ID,
  });

  const grant = JSON.parse(
    await readFile('./grant-cache.json', 'utf8')
  );

  const payment = JSON.parse(
    await readFile('./incoming-payment-cache.json', 'utf8')
  );

  console.log('Retrieving incoming payment with authentication...');

  const result = await client.incomingPayment.get({
    url: payment.id,
    accessToken: grant.accessToken,
  });

  console.log('Incoming payment retrieved successfully:');

  console.log({
    id: result.id,
    incomingAmount: result.incomingAmount,
    receivedAmount: result.receivedAmount,
    completed: result.completed,
    expiresAt: result.expiresAt,
    createdAt: result.createdAt,
  });
}

main().catch((error) => {
  console.error('Retrieval failed:');
  console.error('Message:', error.message);
  console.error('Description:', error.description);
  console.error('HTTP status:', error.status);
  console.error('Details:', error.details);
  process.exitCode = 1;
});
