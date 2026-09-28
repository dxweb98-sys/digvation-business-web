export interface PlateParts {
  prefix: string;
  number: string;
  suffix: string;
}

export const EMPTY_PLATE: PlateParts = { prefix: '', number: '', suffix: '' };

const PART_LIMITS = { prefix: 2, number: 4, suffix: 3 } as const;

/** Keeps only what belongs in one segment: letters (uppercased) or digits, within the segment length. */
export function sanitizePlatePart(part: keyof PlateParts, value: string): string {
  const cleaned =
    part === 'number' ? value.replace(/\D/g, '') : value.replace(/[^a-zA-Z]/g, '').toUpperCase();
  return cleaned.slice(0, PART_LIMITS[part]);
}

/** "B", "1234", "ABC" -> "B 1234 ABC". The suffix is optional. Returns '' until prefix and number exist. */
export function composePlate({ prefix, number, suffix }: PlateParts): string {
  if (!prefix || !number) return '';
  return [prefix, number, suffix].filter(Boolean).join(' ');
}

/** Parses a canonical or loosely typed plate ("B1234ABC", "b 1234 abc"). Returns null when it is not a plate. */
export function parsePlate(value: string): PlateParts | null {
  const match = /^([A-Za-z]{1,2})\s*(\d{1,4})\s*([A-Za-z]{0,3})$/.exec(value.trim());
  if (!match) return null;
  return {
    prefix: match[1]!.toUpperCase(),
    number: match[2]!,
    suffix: (match[3] ?? '').toUpperCase(),
  };
}
