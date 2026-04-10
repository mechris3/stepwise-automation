/**
 * In-memory breakpoint storage for journey-specific breakpoints.
 *
 * Stores breakpoint action indices per journey ID. Used by the server
 * to persist breakpoints set via the dashboard UI, and by the TestExecutor
 * to pass them to child processes via environment variables.
 */

const breakpoints = new Map<string, number[]>();

/**
 * Sets breakpoints for a specific journey, replacing any existing ones.
 *
 * @param journeyId - The journey identifier
 * @param indices - Array of 1-based action indices to break at
 */
export function setBreakpoints(journeyId: string, indices: number[]): void {
  breakpoints.set(journeyId, [...indices]);
}

/**
 * Gets the breakpoints for a specific journey.
 *
 * @param journeyId - The journey identifier
 * @returns Array of breakpoint action indices, or empty array if none set
 */
export function getBreakpoints(journeyId: string): number[] {
  return breakpoints.get(journeyId) ?? [];
}

/**
 * Clears breakpoints for a specific journey.
 *
 * @param journeyId - The journey identifier
 */
export function clearBreakpoints(journeyId: string): void {
  breakpoints.delete(journeyId);
}

/** Clears all breakpoints for every journey. */
export function clearAll(): void {
  breakpoints.clear();
}
