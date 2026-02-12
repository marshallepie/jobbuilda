/**
 * Markup calculation utilities for cost-plus pricing
 */

/**
 * Round to nearest penny using half-up rounding
 */
function roundToPenny(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * Apply markup percentage to a cost
 * @param cost - Base cost
 * @param markupPercent - Markup as percentage (e.g., 25 for 25%)
 * @returns Total price with markup applied, rounded to nearest penny
 */
export function applyMarkup(cost: number, markupPercent: number): number {
  return roundToPenny(cost * (1 + markupPercent / 100));
}

/**
 * Calculate markup amount from cost and markup percentage
 * @param cost - Base cost
 * @param markupPercent - Markup as percentage (e.g., 25 for 25%)
 * @returns Markup amount rounded to nearest penny
 */
export function calculateMarkupAmount(cost: number, markupPercent: number): number {
  return roundToPenny(cost * (markupPercent / 100));
}

/**
 * Remove markup from a price to get original cost
 * @param price - Price with markup
 * @param markupPercent - Markup as percentage (e.g., 25 for 25%)
 * @returns Original cost rounded to nearest penny
 */
export function removeMarkup(price: number, markupPercent: number): number {
  return roundToPenny(price / (1 + markupPercent / 100));
}
