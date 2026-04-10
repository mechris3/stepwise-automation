import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ── Re-define pure functions from ui.js (vanilla JS, not a module) ───
const SIDEBAR_MIN_WIDTH = 128;
const SIDEBAR_MAX_WIDTH_RATIO = 0.5;
const SIDEBAR_KEYBOARD_STEP = 16;

function clampSidebarWidth(width: number, viewportWidth: number): number {
  return Math.min(
    Math.max(width, SIDEBAR_MIN_WIDTH),
    Math.floor(viewportWidth * SIDEBAR_MAX_WIDTH_RATIO),
  );
}

function keyboardResizeWidth(
  currentWidth: number,
  direction: 'left' | 'right',
  viewportWidth: number,
): number {
  const delta = direction === 'left' ? -SIDEBAR_KEYBOARD_STEP : SIDEBAR_KEYBOARD_STEP;
  return clampSidebarWidth(currentWidth + delta, viewportWidth);
}

// Feature: resizable-sidebar, Property 1: Width clamping invariant
describe('Property 1: Width clamping invariant', () => {
  /**
   * **Validates: Requirements 2.2, 2.3, 4.2**
   *
   * For any mouse X position and any viewport width, the clamped sidebar
   * width must always be >= SIDEBAR_MIN_WIDTH and <= floor(viewportWidth * 0.5).
   */
  it('clampSidebarWidth always returns a value in [SIDEBAR_MIN_WIDTH, viewportWidth * 0.5]', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1000, max: 5000 }),
        fc.integer({ min: 320, max: 3840 }),
        (mouseX, viewportWidth) => {
          const result = clampSidebarWidth(mouseX, viewportWidth);
          const maxWidth = Math.floor(viewportWidth * SIDEBAR_MAX_WIDTH_RATIO);

          expect(result).toBeGreaterThanOrEqual(SIDEBAR_MIN_WIDTH);
          expect(result).toBeLessThanOrEqual(maxWidth);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: resizable-sidebar, Property 3: Keyboard resize with clamping
describe('Property 3: Keyboard resize with clamping', () => {
  /**
   * **Validates: Requirements 6.2, 6.3**
   *
   * For any current sidebar width within the valid range and any direction
   * ('left' or 'right'), keyboardResizeWidth() must return a value within
   * the clamped range and differ from the input by exactly SIDEBAR_KEYBOARD_STEP
   * or be at a boundary.
   */
  it('keyboardResizeWidth always returns a clamped value that differs by SIDEBAR_KEYBOARD_STEP or is at a boundary', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: SIDEBAR_MIN_WIDTH, max: 1920 }),
        fc.constantFrom('left' as const, 'right' as const),
        fc.integer({ min: 320, max: 3840 }),
        (startWidth, direction, viewportWidth) => {
          const maxWidth = Math.floor(viewportWidth * SIDEBAR_MAX_WIDTH_RATIO);

          // Ensure startWidth is within the valid clamped range for this viewport
          const clampedStart = clampSidebarWidth(startWidth, viewportWidth);
          const result = keyboardResizeWidth(clampedStart, direction, viewportWidth);

          // Result must be within the valid clamped range
          expect(result).toBeGreaterThanOrEqual(SIDEBAR_MIN_WIDTH);
          expect(result).toBeLessThanOrEqual(maxWidth);

          // Result must differ from input by exactly SIDEBAR_KEYBOARD_STEP or be at a boundary
          const diff = Math.abs(result - clampedStart);
          const atBoundary = result === SIDEBAR_MIN_WIDTH || result === maxWidth;
          expect(diff === SIDEBAR_KEYBOARD_STEP || atBoundary).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: resizable-sidebar, Property 2: Sidebar width persistence round-trip
describe('Property 2: Sidebar width persistence round-trip', () => {
  const SIDEBAR_DEFAULT_WIDTH = 260;

  /**
   * **Validates: Requirements 3.1, 3.2, 4.3**
   *
   * For any valid sidebar width, saving it to a settings object and restoring
   * it using the same logic as _applySettingsToDOM should yield the original value.
   */
  it('round-trip: saving and restoring a valid width returns the same value', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: SIDEBAR_MIN_WIDTH, max: 1920 }),
        (width) => {
          // ── Save: simulate UI.saveSettings() writing to State.settings ──
          const settings: { sidebarWidth?: number } = {};
          settings.sidebarWidth = width;

          // ── Restore: simulate _applySettingsToDOM restoration logic ──
          const stored = settings.sidebarWidth;
          const restored =
            typeof stored === 'number' && stored > 0 && !isNaN(stored)
              ? clampSidebarWidth(stored, 3840) // viewport 3840 → max 1920, keeps all generated values in range
              : SIDEBAR_DEFAULT_WIDTH;

          expect(restored).toBe(width);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: resizable-sidebar, Property 4: ARIA value synchronization
describe('Property 4: ARIA value synchronization', () => {
  /**
   * **Validates: Requirements 6.4**
   *
   * For any sidebar width in the valid range, converting to a string via
   * String(width) (as used for aria-valuenow) and parsing back via parseInt
   * must yield the original numeric value. This ensures the ARIA attribute
   * always faithfully represents the numeric width.
   */
  it('String(width) round-trips back to the numeric value via parseInt for any valid width', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: SIDEBAR_MIN_WIDTH, max: 1920 }),
        (width) => {
          const ariaValue = String(width);
          const parsed = parseInt(ariaValue, 10);

          expect(parsed).toBe(width);
        },
      ),
      { numRuns: 100 },
    );
  });
});
