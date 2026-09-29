import { useCallback, useState } from 'react';

/**
 * Parent-owned lifecycle of the customer picker's temporary draft (typed name, phone, NIK,
 * member search and selection). The revision only changes when a NEW transaction starts, so
 * closing, reopening or switching tabs inside one transaction keeps the unfinished input, and a
 * failed save never discards it. Persisted Sale customer history is not part of this state.
 */
export function useCustomerPickerSession() {
  const [revision, setRevision] = useState(0);
  const startNewTransaction = useCallback(() => setRevision((current) => current + 1), []);
  return { revision, startNewTransaction };
}
