import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { ParseResult } from "./types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Ensures backend summary always includes the required fields (totalClaims, partial, etc.)
 */
export const normalizeSummary = (
  s: Record<string, unknown>
): ParseResult['summary'] => ({
  total: (s.total as number) ?? 0,
  valid: (s.valid as number) ?? 0,
  invalid: (s.invalid as number) ?? 0,
  accepted: (s.accepted as number) ?? 0,
  rejected: (s.rejected as number) ?? 0,
  totalClaims: (s.totalClaims as number) ?? (s.total as number) ?? 0,
  partial: (s.partial as number) ?? 0,
});

/**
 * Triggers a browser download of a string as a text file.
 * Safely revokes the object URL after triggering.
 */
export const downloadString = (str: string, name: string) => {
  const blob = new Blob([str], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
