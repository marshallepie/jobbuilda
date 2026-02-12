/**
 * HMRC-compliant VAT calculations with half-up rounding to nearest penny.
 * All monetary values are in GBP.
 */

const DEFAULT_VAT_RATE = 0.20; // UK standard VAT rate (20%)

/**
 * Round to nearest penny using half-up rounding (HMRC compliant)
 */
function roundToPenny(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * Calculate VAT amount from a net (ex-VAT) price
 * @param netAmount - Amount excluding VAT
 * @param vatRate - VAT rate as decimal (default 0.20 for 20%)
 * @returns VAT amount rounded to nearest penny
 */
export function calculateVAT(netAmount: number, vatRate: number = DEFAULT_VAT_RATE): number {
  return roundToPenny(netAmount * vatRate);
}

/**
 * Add VAT to a net (ex-VAT) price
 * @param netAmount - Amount excluding VAT
 * @param vatRate - VAT rate as decimal (default 0.20 for 20%)
 * @returns Gross amount (inc VAT) rounded to nearest penny
 */
export function addVAT(netAmount: number, vatRate: number = DEFAULT_VAT_RATE): number {
  return roundToPenny(netAmount * (1 + vatRate));
}

/**
 * Remove VAT from a gross (inc-VAT) price
 * @param grossAmount - Amount including VAT
 * @param vatRate - VAT rate as decimal (default 0.20 for 20%)
 * @returns Net amount (ex VAT) rounded to nearest penny
 */
export function removeVAT(grossAmount: number, vatRate: number = DEFAULT_VAT_RATE): number {
  return roundToPenny(grossAmount / (1 + vatRate));
}

/**
 * Extract VAT amount from a gross (inc-VAT) price
 * @param grossAmount - Amount including VAT
 * @param vatRate - VAT rate as decimal (default 0.20 for 20%)
 * @returns VAT amount rounded to nearest penny
 */
export function extractVAT(grossAmount: number, vatRate: number = DEFAULT_VAT_RATE): number {
  const netAmount = removeVAT(grossAmount, vatRate);
  return roundToPenny(grossAmount - netAmount);
}
