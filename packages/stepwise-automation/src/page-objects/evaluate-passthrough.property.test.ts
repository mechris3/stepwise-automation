import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { BasePage } from './base.page';
import { BrowserAdapter } from '../adapters/browser-adapter.interface';

/**
 * **Validates: Requirements 5.1**
 *
 * Feature: evaluate-method, Property 3: BasePage evaluate passthrough
 *
 * For any input (string or function) passed to BasePage.evaluate,
 * the call should delegate to this.adapter.evaluate with the same
 * input and return the same result.
 */

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Creates a mock BrowserAdapter with a spied evaluate */
function createMockAdapter(): BrowserAdapter {
  return {
    click: vi.fn().mockResolvedValue(undefined),
    fill: vi.fn().mockResolvedValue(undefined),
    getText: vi.fn().mockResolvedValue(''),
    waitForSelector: vi.fn().mockResolvedValue(undefined),
    isVisible: vi.fn().mockResolvedValue(true),
    waitForHidden: vi.fn().mockResolvedValue(undefined),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
    clickAndWaitForNavigation: vi.fn().mockResolvedValue(undefined),
    isDisabled: vi.fn().mockResolvedValue(false),
    getInputValue: vi.fn().mockResolvedValue(''),
    countElements: vi.fn().mockResolvedValue(0),
    getAttribute: vi.fn().mockResolvedValue(null),
    getCurrentUrl: vi.fn().mockResolvedValue('http://localhost'),
    goto: vi.fn().mockResolvedValue(undefined),
    evaluate: vi.fn(),
    readClipboard: vi.fn().mockResolvedValue(''),
    clearSession: vi.fn().mockResolvedValue(undefined),
    uploadFile: vi.fn().mockResolvedValue(undefined),
    selectByIndex: vi.fn().mockResolvedValue(undefined),
    selectByValue: vi.fn().mockResolvedValue(undefined),
    selectByText: vi.fn().mockResolvedValue(undefined),
    clickAndDownload: vi.fn().mockResolvedValue({ filePath: '', suggestedFilename: '' }),
    clearDownloads: vi.fn().mockResolvedValue(undefined),
  };
}

// ── Generators ───────────────────────────────────────────────────────────────

/** Generates random JS expression strings */
const jsStringArb = fc.oneof(
  fc.stringMatching(/^[a-zA-Z0-9+\-*/ '.()]+$/),
  fc.constantFrom("1+1", "'hello'", "document.title", "42", "true", "null", "Math.PI"),
);

/** Generates random primitive values that evaluate might return */
const primitiveArb = fc.oneof(
  fc.integer(),
  fc.double({ noNaN: true, noDefaultInfinity: true }),
  fc.string(),
  fc.boolean(),
  fc.constant(null),
);

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Property 3: BasePage evaluate passthrough', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('PBT: string input delegates to adapter.evaluate and returns the same result', async () => {
    // Feature: evaluate-method, Property 3: BasePage evaluate passthrough
    await fc.assert(
      fc.asyncProperty(jsStringArb, primitiveArb, async (script, returnValue) => {
        const adapter = createMockAdapter();
        (adapter.evaluate as ReturnType<typeof vi.fn>).mockResolvedValue(returnValue);
        const page = new BasePage(adapter);

        const result = await page.evaluate(script);

        expect(adapter.evaluate).toHaveBeenCalledWith(script);
        expect(result).toEqual(returnValue);
      }),
      { numRuns: 100 },
    );
  });

  it('PBT: function input delegates to adapter.evaluate and returns the same result', async () => {
    // Feature: evaluate-method, Property 3: BasePage evaluate passthrough
    await fc.assert(
      fc.asyncProperty(primitiveArb, async (returnValue) => {
        const adapter = createMockAdapter();
        (adapter.evaluate as ReturnType<typeof vi.fn>).mockResolvedValue(returnValue);
        const page = new BasePage(adapter);
        const fn = () => returnValue;

        const result = await page.evaluate(fn);

        expect(adapter.evaluate).toHaveBeenCalledWith(fn);
        expect(result).toEqual(returnValue);
      }),
      { numRuns: 100 },
    );
  });
});
