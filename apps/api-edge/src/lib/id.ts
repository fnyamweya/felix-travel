/** Generate a new UUID v4 for entity IDs */
export function newId(): string {
  return crypto.randomUUID();
}

/** Generate a human-readable booking reference: BK-YYYY-NNNNN */
export function generateBookingReference(counter: number): string {
  const year = new Date().getFullYear();
  return `BK-${year}-${counter.toString().padStart(5, '0')}`;
}

/** Generate an idempotency-safe merchant transaction ID */
export function generateMerchantTxId(bookingId: string): string {
  return `MTX-${bookingId.slice(-8).toUpperCase()}-${Date.now()}`;
}
