
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { createAuthenticatedClient } from '@interledger/open-payments';

async function main() {
  const client = await createAuthenticatedClient({
    walletAddressUrl: process.env.OPEN_PAYMENTS_WALLET_ADDRESS,
    privateKey: process.env.OPEN_PAYMENTS_PRIVATE_KEY,
    keyId: process.env.OPEN_PAYMENTS_KEY_ID,
  });

  const payment = JSON.parse(
    await readFile('./incoming-payment-cache.json', 'utf8')
  );

  try {
    const result = await client.incomingPayment.getPublic({
      url: payment.id,
    });

    console.log('Public retrieval succeeded:');
    console.log({
      id: result.id,
      incomingAmount: result.incomingAmount,
      receivedAmount: result.receivedAmount,
      completed: result.completed,
      expiresAt: result.expiresAt,
    });
  } catch (error) {
    console.error('Public retrieval failed:');
    console.error('Message:', error.message);
    console.error('Description:', error.description);
    console.error('HTTP status:', error.status);
    console.error('Error code:', error.code);
    console.error('Details:', error.details);
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
