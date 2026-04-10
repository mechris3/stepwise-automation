"use strict";
/**
 * Formats test errors for better readability and AI/LLM analysis.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatTestError = formatTestError;
exports.getErrorSummary = getErrorSummary;
/**
 * Extracts the method/function name from a V8 stack trace line.
 *
 * @param stackLine - A single line from an Error stack trace (e.g. `"    at MyClass.method (/path:1:2)"`)
 * @returns The extracted method identifier, or the trimmed line if no match
 */
function extractMethodInfo(stackLine) {
    const match = stackLine.match(/at\s+(.+?)\s+\(/);
    return match ? match[1] : stackLine.trim();
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
function formatTestError(error, context) {
    const lines = error.stack?.split('\n') || [];
    // Extract only application code (filter out node_modules and internal Node.js)
    const appCodeLines = lines.filter(line => !line.includes('node_modules') &&
        !line.includes('internal/') &&
        line.trim().startsWith('at '));
    const pageObjectMatch = appCodeLines.find(line => line.includes('.page.ts') || line.includes('Page.'));
    const journeyMatch = appCodeLines.find(line => line.includes('.journey.ts') || line.includes('Journey.'));
    const sections = [];
    // Header
    sections.push('═'.repeat(80));
    sections.push('❌ TEST AUTOMATION FAILURE');
    sections.push('═'.repeat(80));
    sections.push('');
    // Context
    if (context?.journeyName)
        sections.push(`Journey: ${context.journeyName}`);
    if (context?.timestamp)
        sections.push(`Time: ${context.timestamp}`);
    if (context?.duration)
        sections.push(`Duration: ${context.duration}ms`);
    if (context?.journeyName || context?.timestamp || context?.duration)
        sections.push('');
    // Error message
    sections.push('ERROR MESSAGE:');
    sections.push(error.message);
    sections.push('');
    // Quick diagnosis
    sections.push('QUICK DIAGNOSIS:');
    if (pageObjectMatch)
        sections.push(`  Page Object: ${extractMethodInfo(pageObjectMatch)}`);
    if (journeyMatch)
        sections.push(`  Journey Step: ${extractMethodInfo(journeyMatch)}`);
    if (!pageObjectMatch && !journeyMatch) {
        sections.push('  Unable to identify page object or journey step');
    }
    sections.push('');
    // Application stack trace
    sections.push('APPLICATION STACK TRACE (Your Code):');
    sections.push('─'.repeat(80));
    if (appCodeLines.length > 0) {
        appCodeLines.forEach(line => sections.push(line));
    }
    else {
        sections.push('  (No application code in stack trace)');
    }
    sections.push('');
    // Full stack trace
    sections.push('FULL STACK TRACE (Including Dependencies):');
    sections.push('─'.repeat(80));
    sections.push(error.stack || '(No stack trace available)');
    sections.push('');
    // Footer
    sections.push('═'.repeat(80));
    return sections.join('\n');
}
/**
 * Returns a one-line summary of the error with the first application stack frame.
 *
 * @param error - The caught Error instance
 * @returns Compact string like `"message (ClassName.method)"`
 */
function getErrorSummary(error) {
    const lines = error.stack?.split('\n') || [];
    const appCodeLines = lines.filter(line => !line.includes('node_modules') &&
        !line.includes('internal/') &&
        line.trim().startsWith('at '));
    const firstAppLine = appCodeLines[0];
    if (firstAppLine) {
        return `${error.message} (${extractMethodInfo(firstAppLine)})`;
    }
    return error.message;
}
//# sourceMappingURL=error-formatter.js.map