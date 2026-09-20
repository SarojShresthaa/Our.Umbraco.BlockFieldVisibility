const DEFAULT_DELAYS_MS = [300, 900];

export function scheduleVisibilityResync(
  run: () => void | Promise<void>,
  delaysMs = DEFAULT_DELAYS_MS,
): () => void {
  const timerIds: number[] = [];

  for (const delay of delaysMs) {
    timerIds.push(
      window.setTimeout(() => {
        void run();
      }, delay),
    );
  }

  return () => {
    for (const id of timerIds) {
      window.clearTimeout(id);
    }
  };
}
