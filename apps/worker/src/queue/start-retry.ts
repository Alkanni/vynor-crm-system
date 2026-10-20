/** The first retry of a failed queue start waits this long; each further failure doubles it. */
const START_RETRY_BASE_MS = 5_000;
const START_RETRY_MAX_MS = 60_000;

/**
 * Delay before the next start attempt after `failedStarts` failures in a row, shared by the
 * pg-boss and BullMQ transports (NF-02): 5 s, 10 s, 20 s, 40 s, then 60 s.
 */
export function startRetryDelayMs(failedStarts: number): number {
  return Math.min(START_RETRY_BASE_MS * 2 ** (failedStarts - 1), START_RETRY_MAX_MS);
}
