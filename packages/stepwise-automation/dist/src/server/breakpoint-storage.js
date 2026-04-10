"use strict";
/**
 * In-memory breakpoint storage for journey-specific breakpoints.
 *
 * Stores breakpoint action indices per journey ID. Used by the server
 * to persist breakpoints set via the dashboard UI, and by the TestExecutor
 * to pass them to child processes via environment variables.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.setBreakpoints = setBreakpoints;
exports.getBreakpoints = getBreakpoints;
exports.clearBreakpoints = clearBreakpoints;
exports.clearAll = clearAll;
const breakpoints = new Map();
/**
 * Sets breakpoints for a specific journey, replacing any existing ones.
 *
 * @param journeyId - The journey identifier
 * @param indices - Array of 1-based action indices to break at
 */
function setBreakpoints(journeyId, indices) {
    breakpoints.set(journeyId, [...indices]);
}
/**
 * Gets the breakpoints for a specific journey.
 *
 * @param journeyId - The journey identifier
 * @returns Array of breakpoint action indices, or empty array if none set
 */
function getBreakpoints(journeyId) {
    return breakpoints.get(journeyId) ?? [];
}
/**
 * Clears breakpoints for a specific journey.
 *
 * @param journeyId - The journey identifier
 */
function clearBreakpoints(journeyId) {
    breakpoints.delete(journeyId);
}
/** Clears all breakpoints for every journey. */
function clearAll() {
    breakpoints.clear();
}
//# sourceMappingURL=breakpoint-storage.js.map