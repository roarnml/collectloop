
import 'dotenv/config';
import { createAuthenticatedClient } from '@interledger/open-payments';

async function main() {
  const walletAddressUrl =
    process.env.OPEN_PAYMENTS_WALLET_ADDRESS;

  const privateKey =
    process.env.OPEN_PAYMENTS_PRIVATE_KEY;

  const keyId =
    process.env.OPEN_PAYMENTS_KEY_ID;

  if (!walletAddressUrl || !privateKey || !keyId) {
    throw new Error('Missing Open Payments configuration');
  }

  const client = await createAuthenticatedClient({
    walletAddressUrl,
    privateKey,
    keyId,
  });

  const wallet = await client.walletAddress.get({
    url: walletAddressUrl,
  });

  console.log('Authenticated Open Payments client initialized.');
  console.log('Wallet:', wallet.id);
  console.log('Asset:', wallet.assetCode);
  console.log('Asset scale:', wallet.assetScale);
  console.log('Authorization server:', wallet.authServer);
  console.log('Resource server:', wallet.resourceServer);
}

main().catch((error) => {
  console.error('Open Payments initialization failed:');
  console.error(error.message);
  process.exitCode = 1;
});
