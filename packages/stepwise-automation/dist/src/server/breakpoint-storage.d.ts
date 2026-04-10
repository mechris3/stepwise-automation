/**
 * In-memory breakpoint storage for journey-specific breakpoints.
 *
 * Stores breakpoint action indices per journey ID. Used by the server
 * to persist breakpoints set via the dashboard UI, and by the TestExecutor
 * to pass them to child processes via environment variables.
 */
/**
 * Sets breakpoints for a specific journey, replacing any existing ones.
 *
 * @param journeyId - The journey identifier
 * @param indices - Array of 1-based action indices to break at
 */
export declare function setBreakpoints(journeyId: string, indices: number[]): void;
/**
 * Gets the breakpoints for a specific journey.
 *
 * @param journeyId - The journey identifier
 * @returns Array of breakpoint action indices, or empty array if none set
 */
export declare function getBreakpoints(journeyId: string): number[];
/**
 * Clears breakpoints for a specific journey.
 *
 * @param journeyId - The journey identifier
 */
export declare function clearBreakpoints(journeyId: string): void;
/** Clears all breakpoints for every journey. */
export declare function clearAll(): void;
//# sourceMappingURL=breakpoint-storage.d.ts.map