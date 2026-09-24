import { useCallback, useRef, useState } from 'react';

type FormInitializer<T extends object> = T | (() => T);

/**
 * Lightweight state helper for simple forms.
 *
 * Use this when fields form one coherent draft but do not require coordinated
 * transitions. Complex editors with hydration/touched/step logic should use a
 * feature-specific reducer instead.
 */
export function useFormState<T extends object>(initializer: FormInitializer<T>) {
  const [values, setValues] = useState<T>(initializer);
  const initialValuesRef = useRef(values);

  const setField = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setValues((current) => ({
      ...current,
      [field]: value,
    }));
  }, []);

  const patch = useCallback((change: Partial<T>) => {
    setValues((current) => ({
      ...current,
      ...change,
    }));
  }, []);

  const reset = useCallback((nextValues?: T) => {
    const next = nextValues ?? initialValuesRef.current;
    initialValuesRef.current = next;
    setValues(next);
  }, []);

  return {
    values,
    setField,
    patch,
    reset,
    setValues,
  };
}
