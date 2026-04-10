/**
 * Polls a condition until it's met or timeout is reached.
 *
 * Useful for waiting on async state updates in the UI where the exact
 * timing is unpredictable. Instead of arbitrary waits, this polls the
 * actual value until the expected condition is true.
 *
 * @template T - The type of value being polled
 * @param getValue - Async function that retrieves the current value to check
 * @param condition - Predicate function that returns true when the condition is met
 * @param options - Configuration options
 * @returns Promise that resolves with the value when condition is met
 * @throws Error if condition is not met within the timeout period
 */
export declare function waitForCondition<T>(getValue: () => Promise<T>, condition: (value: T) => boolean, options?: {
    timeout?: number;
    interval?: number;
    errorMessage?: string;
}): Promise<T>;
//# sourceMappingURL=wait-utils.d.ts.map