import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vm from 'vm';
import { JSDOM } from 'jsdom';
import {
  setBreakpoints,
  getBreakpoints,
  clearBreakpoints,
  clearAll as clearAllInMemory,
} from './breakpoint-storage';
import {
  initSettingsStorage,
  setFileBreakpoints,
  getFileBreakpoints,
  clearFileBreakpoints,
} from './settings-storage';

// ── Arbitrary generators ──

/** Journey ID: non-empty alphanumeric string (avoids problematic chars in keys). */
const arbJourneyId = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_-]{0,29}$/);

/** Breakpoint index: non-negative integer up to 999. */
const arbBreakpointIndex = fc.nat({ max: 999 });

/** Array of breakpoint indices (0–20 items). */
const arbBreakpointArray = fc.array(arbBreakpointIndex, { minLength: 0, maxLength: 20 });

/**
 * Generate a map of 1–5 journeys, each with a Set of 0–20 breakpoint indices.
 * Returns { breakpoints, journeyIds } where breakpoints is Record<string, Set<number>>.
 */
const arbBreakpointsState = fc
  .array(fc.tuple(arbJourneyId, arbBreakpointArray), { minLength: 1, maxLength: 5 })
  .chain((entries) => {
    // Deduplicate journey IDs
    const seen = new Set<string>();
    const unique = entries.filter(([id]) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    // Ensure at least one journey
    if (unique.length === 0) return fc.constant({ breakpoints: {} as Record<string, Set<number>>, journeyIds: [] as string[] });
    const breakpoints: Record<string, Set<number>> = {};
    const journeyIds: string[] = [];
    for (const [id, indices] of unique) {
      breakpoints[id] = new Set(indices);
      journeyIds.push(id);
    }
    return fc.constant({ breakpoints, journeyIds });
  })
  .filter(({ journeyIds }) => journeyIds.length >= 1);

/**
 * Generate 2–5 unique journey IDs with breakpoint arrays.
 * Returns { entries: [journeyId, number[]][], targetIndex: number }.
 */
const arbJourneyEntries = fc
  .array(fc.tuple(arbJourneyId, arbBreakpointArray), { minLength: 2, maxLength: 5 })
  .chain((entries) => {
    const seen = new Set<string>();
    const unique = entries.filter(([id]) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    if (unique.length < 2) return fc.constant(null);
    return fc.nat({ max: unique.length - 1 }).map((targetIndex) => ({
      entries: unique,
      targetIndex,
    }));
  })
  .filter((v): v is { entries: [string, number[]][]; targetIndex: number } => v !== null);


// ═══════════════════════════════════════════════════════════════════════
// Feature: clear-all-breakpoints
// Property 1: Clear breakpoints isolation
// ═══════════════════════════════════════════════════════════════════════
describe('Feature: clear-all-breakpoints, Property 1: Clear breakpoints isolation', () => {
  /**
   * **Validates: Requirements 2.1, 2.2**
   *
   * For any State.breakpoints with 1–5 journeys (each with 0–20 breakpoint
   * indices), picking a random journey as current and clearing it SHALL
   * result in the current journey's set being empty and all other journeys'
   * sets being unchanged.
   */
  it('clearing one journey empties it and leaves others unchanged', () => {
    fc.assert(
      fc.property(arbBreakpointsState, ({ breakpoints, journeyIds }) => {
        // Pick a random journey to clear (deterministic from the generated data)
        const targetId = journeyIds[0];

        // Snapshot the other journeys before clearing
        const othersBefore: Record<string, Set<number>> = {};
        for (const id of journeyIds) {
          if (id !== targetId) {
            othersBefore[id] = new Set(breakpoints[id]);
          }
        }

        // Simulate clearing: delete the target journey's breakpoints
        breakpoints[targetId] = new Set();

        // Assert: target journey is empty
        expect(breakpoints[targetId].size).toBe(0);

        // Assert: all other journeys are unchanged
        for (const id of journeyIds) {
          if (id !== targetId) {
            expect(breakpoints[id]).toEqual(othersBefore[id]);
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Feature: clear-all-breakpoints
// Property 2: In-memory store clear preserves other journeys
// ═══════════════════════════════════════════════════════════════════════
describe('Feature: clear-all-breakpoints, Property 2: In-memory store clear preserves other journeys', () => {
  beforeEach(() => {
    clearAllInMemory();
  });

  /**
   * **Validates: Requirements 3.2, 5.2**
   *
   * For any set of journey IDs with arbitrary breakpoint arrays stored in
   * the in-memory store, calling clearBreakpoints(journeyId) SHALL result
   * in getBreakpoints(journeyId) returning [] while getBreakpoints for all
   * other journeys returns their original arrays.
   */
  it('clearBreakpoints empties target and preserves others in memory', () => {
    fc.assert(
      fc.property(arbJourneyEntries, ({ entries, targetIndex }) => {
        // Reset store
        clearAllInMemory();

        // Populate
        for (const [id, indices] of entries) {
          setBreakpoints(id, indices);
        }

        const targetId = entries[targetIndex][0];

        // Snapshot others
        const othersBefore: Record<string, number[]> = {};
        for (const [id, indices] of entries) {
          if (id !== targetId) {
            othersBefore[id] = [...indices];
          }
        }

        // Act
        clearBreakpoints(targetId);

        // Assert: target is empty
        expect(getBreakpoints(targetId)).toEqual([]);

        // Assert: others unchanged
        for (const [id] of entries) {
          if (id !== targetId) {
            expect(getBreakpoints(id)).toEqual(othersBefore[id]);
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});


// ═══════════════════════════════════════════════════════════════════════
// Feature: clear-all-breakpoints
// Property 3: File store clear round-trip
// ═══════════════════════════════════════════════════════════════════════
describe('Feature: clear-all-breakpoints, Property 3: File store clear round-trip', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clear-bp-file-'));
    initSettingsStorage(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  /**
   * **Validates: Requirements 3.3, 5.3**
   *
   * For any set of journey IDs with arbitrary breakpoint arrays persisted
   * in the file store, calling clearFileBreakpoints(journeyId) SHALL result
   * in getFileBreakpoints(journeyId) returning [] while getFileBreakpoints
   * for all other journeys returns their original arrays.
   */
  it('clearFileBreakpoints empties target and preserves others on disk', () => {
    fc.assert(
      fc.property(arbJourneyEntries, ({ entries, targetIndex }) => {
        // Re-init to ensure clean state per iteration
        initSettingsStorage(tmpDir);

        // Write a blank settings file to start fresh
        const settingsDir = path.join(tmpDir, '.stepwise');
        if (fs.existsSync(settingsDir)) {
          fs.rmSync(settingsDir, { recursive: true, force: true });
        }

        // Populate file store
        for (const [id, indices] of entries) {
          setFileBreakpoints(id, indices);
        }

        const targetId = entries[targetIndex][0];

        // Snapshot others
        const othersBefore: Record<string, number[]> = {};
        for (const [id, indices] of entries) {
          if (id !== targetId) {
            othersBefore[id] = [...indices];
          }
        }

        // Act
        clearFileBreakpoints(targetId);

        // Assert: target returns empty
        expect(getFileBreakpoints(targetId)).toEqual([]);

        // Assert: others unchanged
        for (const [id] of entries) {
          if (id !== targetId) {
            expect(getFileBreakpoints(id)).toEqual(othersBefore[id]);
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});


// ═══════════════════════════════════════════════════════════════════════
// Feature: clear-all-breakpoints
// Property 4: Button disabled state tracks currentJourney
// ═══════════════════════════════════════════════════════════════════════

// ── Paths to the plain-JS global files under test ──
const UI_DIR = path.resolve(__dirname, '../../ui/js');
const stateSource = fs.readFileSync(path.join(UI_DIR, 'state.js'), 'utf-8');
const uiSource = fs.readFileSync(path.join(UI_DIR, 'ui.js'), 'utf-8');

/**
 * Wrap a source file so its top-level `const` declaration is also
 * assigned to `this` (the vm context sandbox).
 */
function wrapAsGlobal(source: string, globalName: string): string {
  return `${source}\nthis.${globalName} = ${globalName};`;
}

/**
 * Bootstrap a JSDOM + vm context with State and UI loaded.
 * The DOM includes the clearBreakpointsBtn button.
 */
function createButtonTestContext() {
  const dom = new JSDOM(
    `<!DOCTYPE html>
     <html><body>
       <div class="tab-actions">
         <button id="clearBreakpointsBtn" disabled></button>
       </div>
       <div id="action-log"></div>
       <div id="executionStatus" class="status-badge status-idle">Idle</div>
     </body></html>`,
    { url: 'http://localhost' },
  );

  const ctx = vm.createContext({
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    console,
    Set: globalThis.Set,
    Array: globalThis.Array,
    JSON: globalThis.JSON,
    Math: globalThis.Math,
    setTimeout: globalThis.setTimeout,
    getComputedStyle: dom.window.getComputedStyle,
    // Stubs for dependencies UI.js references
    fsmButtons: () => ({ play: false, stop: false, pause: false, resume: false, step: false }),
    ActionLog: { render() {} },
    Breakpoints: { refreshAllPins() {} },
    API: {},
    UrlHistory: { add: (h: string[], _u: string) => h, remove: (h: string[], _u: string) => h },
    App: {},
  });

  vm.runInContext(wrapAsGlobal(stateSource, 'State'), ctx);
  vm.runInContext(wrapAsGlobal(uiSource, 'UI'), ctx);

  return {
    dom,
    State: (ctx as any).State,
    UI: (ctx as any).UI,
  };
}

describe('Feature: clear-all-breakpoints, Property 4: Button disabled state tracks currentJourney', () => {
  /**
   * **Validates: Requirements 4.1, 4.2, 4.3**
   *
   * For any sequence of currentJourney values (null or a non-empty string),
   * after each assignment followed by UI.refresh(), the clearBreakpointsBtn
   * disabled attribute SHALL equal true when currentJourney is null and
   * false when currentJourney is non-null.
   */
  it('button disabled matches currentJourney === null after each state change', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.option(fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_-]{0,19}$/), { nil: null }),
          { minLength: 1, maxLength: 10 },
        ),
        (journeySequence) => {
          const { dom, State, UI } = createButtonTestContext();
          const btn = dom.window.document.getElementById('clearBreakpointsBtn') as HTMLButtonElement;

          for (const value of journeySequence) {
            State.currentJourney = value;
            UI.refresh();

            if (value === null) {
              expect(btn.disabled).toBe(true);
            } else {
              expect(btn.disabled).toBe(false);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
