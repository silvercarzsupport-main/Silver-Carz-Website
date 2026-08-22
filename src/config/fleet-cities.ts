/**
 * Fleet city helpers shared across admin and customer flows.
 *
 * Vehicle.city is free text (staff can add new cities). Nagpur is the launch
 * city — every existing vehicle is backfilled to it.
 */

export const DEFAULT_FLEET_CITY = 'Nagpur';

/** Trim, collapse whitespace, and title-case a city name. */
export function normalizeCityName(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function citiesMatch(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const a = left ? normalizeCityName(left) : '';
  const b = right ? normalizeCityName(right) : '';
  return a.length > 0 && a === b;
}

export function uniqueCityOptions(cities: readonly string[]): string[] {
  const seen = new Set<string>();
  const options: string[] = [];

  for (const city of [...cities, DEFAULT_FLEET_CITY]) {
    const normalized = normalizeCityName(city);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    options.push(normalized);
  }

  return options.sort((left, right) => left.localeCompare(right, 'en-IN'));
}
