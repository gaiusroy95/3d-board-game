/**
 * Client M4: ~25% store-price discount for other players via generated codes.
 * Full Steam commerce / redeem is Milestone 5 — this is a local code generator only.
 */

export interface StoreDiscountCode {
  readonly code: string;
  readonly percentOff: number;
  readonly createdAtUtc: string;
  readonly note: string;
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomChunk(len: number, rng: () => number): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += ALPHABET[Math.floor(rng() * ALPHABET.length)]!;
  }
  return out;
}

/** Generate a single-use-style promo code (local demo; Steam redeem later). */
export function generateStoreDiscountCode(
  percentOff = 25,
  rng: () => number = Math.random,
): StoreDiscountCode {
  const pct = Math.min(90, Math.max(1, Math.round(percentOff)));
  const code = `BIC20-${pct}-${randomChunk(4, rng)}-${randomChunk(4, rng)}`;
  return {
    code,
    percentOff: pct,
    createdAtUtc: new Date().toISOString(),
    note: "Store market discount code — redeem on Steam when published (M5).",
  };
}
