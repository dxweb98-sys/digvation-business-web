import { useState } from 'react';

/** Keeps the last non-null value so a dialog can finish its close transition with its content. */
export function useRetainedValue<T>(value: T | null): T | null {
  const [retained, setRetained] = useState<T | null>(value);
  if (value !== null && value !== retained) setRetained(value);
  return value ?? retained;
}
