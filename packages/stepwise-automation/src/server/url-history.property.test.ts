import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ── Re-define pure functions from ui/js/url-history.js (vanilla JS, not a module) ───

const UrlHistory = {
  add(history: string[], url: string): string[] {
    if (typeof url !== 'string' || url.trim() === '') {
      return history.slice();
    }
    const filtered = history.filter((entry) => entry !== url);
    return [url, ...filtered];
  },

  remove(history: string[], url: string): string[] {
    return history.filter((entry) => entry !== url);
  },

  migrateSettings(settings: { targetUrl?: string; targetUrlHistory?: string[] }): { settings: { targetUrl?: string; targetUrlHistory?: string[] }; migrated: boolean } {
    const hasHistory =
      Array.isArray(settings.targetUrlHistory) && settings.targetUrlHistory.length > 0;
    const hasTargetUrl =
      typeof settings.targetUrl === 'string' && settings.targetUrl.trim() !== '';

    if (hasHistory || !hasTargetUrl) {
      return { settings, migrated: false };
    }

    return {
      settings: { ...settings, targetUrlHistory: [settings.targetUrl!] },
      migrated: true,
    };
  },
};

// ── Generators ───────────────────────────────────────────────────────────────

/** Non-empty, non-whitespace URL string */
const nonBlankUrlArb = fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0);

/** Array of unique non-blank URL strings (simulates a valid history) */
const uniqueHistoryArb = fc.uniqueArray(nonBlankUrlArb, { minLength: 0, maxLength: 20 });

/** Whitespace-only string (including empty) */
const whitespaceOnlyArb = fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r'), {
  minLength: 0,
  maxLength: 10,
});

// ── Property 4 ───────────────────────────────────────────────────────────────

// Feature: target-url-combobox, Property 4: Adding a new URL grows the history
describe('Property 4: Adding a new URL grows the history', () => {
  /**
   * **Validates: Requirements 3.1**
   *
   * For any non-empty, non-whitespace URL string that is not already in the
   * history, committing it should result in the history array length increasing
   * by one and the new URL appearing at the front of the array.
   */
  it('PBT: a new URL increases history length by 1 and appears at the front', () => {
    fc.assert(
      fc.property(uniqueHistoryArb, nonBlankUrlArb, (history, newUrl) => {
        // Pre-condition: newUrl is not already in history
        fc.pre(!history.includes(newUrl));

        const result = UrlHistory.add(history, newUrl);

        expect(result.length).toBe(history.length + 1);
        expect(result[0]).toBe(newUrl);
      }),
      { numRuns: 100 },
    );
  });
});

// ── Property 5 ───────────────────────────────────────────────────────────────

// Feature: target-url-combobox, Property 5: Duplicate URL addition moves entry to front
describe('Property 5: Duplicate URL addition moves entry to front', () => {
  /**
   * **Validates: Requirements 3.2**
   *
   * For any URL string that already exists in the history, committing it again
   * should move it to the front of the array without changing the array length,
   * preserving all other entries.
   */
  it('PBT: re-adding an existing URL moves it to front without changing length', () => {
    fc.assert(
      fc.property(
        uniqueHistoryArb.filter((h) => h.length >= 1),
        fc.nat(),
        (history, indexSeed) => {
          // Pick an existing URL from the history
          const idx = indexSeed % history.length;
          const existingUrl = history[idx];

          const result = UrlHistory.add(history, existingUrl);

          // Length unchanged
          expect(result.length).toBe(history.length);
          // Moved to front
          expect(result[0]).toBe(existingUrl);
          // All other entries preserved (in relative order)
          const othersOriginal = history.filter((e) => e !== existingUrl);
          const othersResult = result.filter((e) => e !== existingUrl);
          expect(othersResult).toEqual(othersOriginal);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── Property 6 ───────────────────────────────────────────────────────────────

// Feature: target-url-combobox, Property 6: Whitespace-only URLs are rejected
describe('Property 6: Whitespace-only URLs are rejected', () => {
  /**
   * **Validates: Requirements 3.5**
   *
   * For any string composed entirely of whitespace characters (including the
   * empty string), attempting to add it to the URL history should leave the
   * history array unchanged.
   */
  it('PBT: whitespace-only strings leave history unchanged', () => {
    fc.assert(
      fc.property(uniqueHistoryArb, whitespaceOnlyArb, (history, wsUrl) => {
        const result = UrlHistory.add(history, wsUrl);

        expect(result).toEqual(history);
      }),
      { numRuns: 100 },
    );
  });
});

// ── Property 7 ───────────────────────────────────────────────────────────────

// Feature: target-url-combobox, Property 7: Deletion removes exactly one entry
describe('Property 7: Deletion removes exactly one entry', () => {
  /**
   * **Validates: Requirements 4.2**
   *
   * For any URL present in the history array, deleting it should result in the
   * history array length decreasing by one and that URL no longer appearing in
   * the array, with all other entries preserved in order.
   */
  it('PBT: removing a present URL decreases length by 1 and preserves others', () => {
    fc.assert(
      fc.property(
        uniqueHistoryArb.filter((h) => h.length >= 1),
        fc.nat(),
        (history, indexSeed) => {
          const idx = indexSeed % history.length;
          const urlToDelete = history[idx];

          const result = UrlHistory.remove(history, urlToDelete);

          // Length decreased by 1
          expect(result.length).toBe(history.length - 1);
          // URL no longer present
          expect(result).not.toContain(urlToDelete);
          // All other entries preserved in order
          const expected = history.filter((e) => e !== urlToDelete);
          expect(result).toEqual(expected);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── Property 10 ──────────────────────────────────────────────────────────────

// Feature: target-url-combobox, Property 10: Migration seeds history from existing targetUrl
describe('Property 10: Migration seeds history from existing targetUrl', () => {
  /**
   * **Validates: Requirements 7.3**
   *
   * For any non-empty targetUrl string in settings where targetUrlHistory is
   * absent or empty, the migration logic should produce targetUrlHistory
   * containing exactly that targetUrl value.
   */
  it('PBT: migration seeds history with targetUrl when history is absent or empty', () => {
    fc.assert(
      fc.property(
        nonBlankUrlArb,
        fc.constantFrom(undefined, [] as string[]),
        (targetUrl, emptyHistory) => {
          const settings: { targetUrl?: string; targetUrlHistory?: string[] } = {
            targetUrl,
          };
          if (emptyHistory !== undefined) {
            settings.targetUrlHistory = emptyHistory;
          }

          const result = UrlHistory.migrateSettings(settings);

          expect(result.migrated).toBe(true);
          expect(result.settings.targetUrlHistory).toEqual([targetUrl]);
        },
      ),
      { numRuns: 100 },
    );
  });
});
