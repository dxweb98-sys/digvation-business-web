export interface DraftCommitGate<T> {
  run(operation: () => Promise<T>): Promise<T>;
}

export function createDraftCommitGate<T>(): DraftCommitGate<T> {
  let inFlight: Promise<T> | null = null;

  return {
    run(operation) {
      if (inFlight) return inFlight;
      inFlight = operation().finally(() => {
        inFlight = null;
      });
      return inFlight;
    },
  };
}
