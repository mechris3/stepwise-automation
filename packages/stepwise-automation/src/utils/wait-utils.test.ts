import { describe, it, expect } from 'vitest';
import { waitForCondition } from './wait-utils';

describe('waitForCondition', () => {
  it('resolves immediately when condition is already met', async () => {
    const result = await waitForCondition(
      async () => 42,
      value => value === 42,
      { timeout: 1000, interval: 50 },
    );
    expect(result).toBe(42);
  });

  it('polls until condition is met', async () => {
    let counter = 0;
    const result = await waitForCondition(
      async () => ++counter,
      value => value >= 3,
      { timeout: 2000, interval: 50 },
    );
    expect(result).toBeGreaterThanOrEqual(3);
  });

  it('throws when timeout is reached', async () => {
    await expect(
      waitForCondition(
        async () => 'nope',
        value => value === 'yes',
        { timeout: 200, interval: 50, errorMessage: 'Custom error' },
      ),
    ).rejects.toThrow('Custom error');
  });

  it('uses default error message', async () => {
    await expect(
      waitForCondition(
        async () => false,
        value => value === true,
        { timeout: 100, interval: 50 },
      ),
    ).rejects.toThrow('Condition not met within timeout');
  });

  it('includes actual value in error message', async () => {
    await expect(
      waitForCondition(
        async () => 'actual',
        value => value === 'expected',
        { timeout: 100, interval: 50 },
      ),
    ).rejects.toThrow('Actual value: "actual"');
  });
});
