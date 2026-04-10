/**
 * Formats test errors for better readability and AI/LLM analysis.
 */
/** Context metadata attached to a test error for structured reporting. */
interface ErrorContext {
    /** Name of the journey that failed. */
    journeyName?: string;
    /** ISO timestamp of the failure. */
    timestamp?: string;
    /** Elapsed time in milliseconds before the failure occurred. */
    duration?: number;
}
/**
 * Formats a test error with structured sections for easy diagnosis.
 * Separates application code from dependency stack traces and provides
 * context for AI/LLM analysis.
 *
 * @param error - The caught Error instance
 * @param context - Optional metadata (journey name, timestamp, duration)
 * @returns Multi-line formatted string with header, diagnosis, and stack traces
 */
export declare function formatTestError(error: Error, context?: ErrorContext): string;
/**
 * Returns a one-line summary of the error with the first application stack frame.
 *
 * @param error - The caught Error instance
 * @returns Compact string like `"message (ClassName.method)"`
 */
export declare function getErrorSummary(error: Error): string;
export {};
//# sourceMappingURL=error-formatter.d.ts.map