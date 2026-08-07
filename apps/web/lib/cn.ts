import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Сглобява класове и маха противоречащите си Tailwind правила. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
