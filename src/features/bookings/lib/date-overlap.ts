/**
 * Closed-interval overlap for inclusive rental date windows.
 */
export function datesOverlap(
  existingDelivery: string,
  existingReturn: string,
  newDelivery: string,
  newReturn: string,
): boolean {
  return existingDelivery <= newReturn && existingReturn >= newDelivery;
}
