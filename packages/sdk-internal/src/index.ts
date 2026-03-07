export * from './client.js';
export * from './endpoints/auth.js';
export * from './endpoints/bookings.js';
export * from './endpoints/payments.js';
export * from './endpoints/catalog.js';
export * from './endpoints/providers.js';
export * from './endpoints/admin.js';
export * from './endpoints/charges.js';
export * from './endpoints/payouts.js';

/** Factory to create a configured client with all endpoint groups */
import { FelixApiClient, type ClientConfig } from './client.js';
import { authEndpoints } from './endpoints/auth.js';
import { bookingEndpoints } from './endpoints/bookings.js';
import { paymentEndpoints } from './endpoints/payments.js';
import { catalogEndpoints } from './endpoints/catalog.js';
import { providerEndpoints } from './endpoints/providers.js';
import { adminEndpoints } from './endpoints/admin.js';
import { chargesEndpoints } from './endpoints/charges.js';
import { payoutEndpoints } from './endpoints/payouts.js';

export function createFelixClient(config: ClientConfig) {
  const client = new FelixApiClient(config);
  return {
    http: client,
    auth: authEndpoints(client),
    bookings: bookingEndpoints(client),
    payments: paymentEndpoints(client),
    catalog: catalogEndpoints(client),
    providers: providerEndpoints(client),
    admin: adminEndpoints(client),
    charges: chargesEndpoints(client),
    payouts: payoutEndpoints(client),
  };
}

export type FelixClient = ReturnType<typeof createFelixClient>;
