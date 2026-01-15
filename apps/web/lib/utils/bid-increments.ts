/**
 * Calculates standard bid increments based on price ranges
 * Uses a common auction pattern to avoid fractional steps
 *
 * @param currentPrice - Current price or starting bid
 * @param minIncrement - Minimum increment from auction settings
 * @returns Standard increment amount (always a whole number)
 */
export function calculateStandardIncrement(
  currentPrice: number,
  minIncrement: number,
): number {
  // Ensure we have a valid price
  if (currentPrice < 0) {
    return Math.max(1, Math.ceil(minIncrement));
  }

  // Standard increment patterns based on price ranges
  // This follows common auction house practices
  let standardIncrement: number;

  if (currentPrice < 25) {
    // $0-$25: $1 increments
    standardIncrement = 1;
  } else if (currentPrice < 100) {
    // $25-$100: $5 increments
    standardIncrement = 5;
  } else if (currentPrice < 500) {
    // $100-$500: $10 increments
    standardIncrement = 10;
  } else if (currentPrice < 1000) {
    // $500-$1000: $25 increments
    standardIncrement = 25;
  } else if (currentPrice < 5000) {
    // $1000-$5000: $50 increments
    standardIncrement = 50;
  } else {
    // $5000+: $100 increments
    standardIncrement = 100;
  }

  // Use the larger of standard increment or minIncrement
  // Round minIncrement up to nearest whole number if needed
  const roundedMinIncrement = Math.ceil(minIncrement);
  return Math.max(standardIncrement, roundedMinIncrement);
}

/**
 * Calculates the next minimum bid amount using standard increments
 *
 * @param currentPrice - Current price or starting bid
 * @param minIncrement - Minimum increment from auction settings
 * @returns Next minimum bid amount (rounded to avoid fractional cents)
 */
export function calculateNextMinBid(
  currentPrice: number,
  minIncrement: number,
): number {
  const increment = calculateStandardIncrement(currentPrice, minIncrement);
  const nextBid = currentPrice + increment;
  
  // Round to 2 decimal places to avoid floating point issues
  return Math.round(nextBid * 100) / 100;
}
