import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { JSDOM } from 'jsdom';

/**
 * Minimal DOM + State + event-listener setup that mirrors the vanilla JS
 * globals from ui/js/state.js, ui/js/ui.js, and ui/js/app.js.
 *
 * We replicate only the subset of logic exercised by the action-delay
 * slider: the `input` handler that updates the output label, and the
 * `change` handler (via saveSettings) that persists to State.settings.
 */

// Lightweight State replica (only the slice we need)
let State: { settings: { actionDelay: number } };
let dom: JSDOM;

// Feature: action-delay-relocation, Property 1: Slider adjustment updates label and state
describe('Property 1: Slider adjustment updates label and state', () => {
  /**
   * **Validates: Requirements 4.1, 4.2**
   *
   * For any integer value v in [0, 5000] that is a multiple of 50,
   * setting #actionDelay.value = v and dispatching an `input` event
   * should cause #actionDelayValue.textContent to equal v + "ms",
   * and dispatching a `change` event should cause
   * State.settings.actionDelay to equal v.
   */

  beforeEach(() => {
    // Reset State
    State = { settings: { actionDelay: 0 } };

    // Build minimal DOM via JSDOM
    dom = new JSDOM(
      `<!DOCTYPE html><html><body>
        <div class="toolbar-delay">
          <input type="range" id="actionDelay"
                 min="0" max="5000" step="50" value="0">
          <output for="actionDelay" id="actionDelayValue">0ms</output>
        </div>
      </body></html>`,
      { url: 'http://localhost' },
    );

    const doc = dom.window.document;
    const actionDelay = doc.getElementById('actionDelay') as HTMLInputElement;
    const actionDelayValue = doc.getElementById('actionDelayValue') as HTMLElement;

    // Mirror App.bindEvents() — input handler updates label
    actionDelay.addEventListener('input', () => {
      actionDelayValue.textContent = actionDelay.value + 'ms';
    });

    // Mirror App.bindEvents() — change handler triggers saveSettings logic
    // (saveSettings reads parseInt(actionDelay.value) || 0 into State)
    actionDelay.addEventListener('change', () => {
      State.settings.actionDelay = parseInt(actionDelay.value, 10) || 0;
    });
  });

  it('setting slider value and dispatching input/change updates label text and State', () => {
    fc.assert(
      fc.property(
        // Generate multiples of 50 in [0, 5000]
        fc.integer({ min: 0, max: 100 }).map((n) => n * 50),
        (v) => {
          const doc = dom.window.document;
          const slider = doc.getElementById('actionDelay') as HTMLInputElement;
          const output = doc.getElementById('actionDelayValue') as HTMLElement;

          // Set the slider value
          slider.value = String(v);

          // Dispatch input event — should update label
          slider.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
          expect(output.textContent).toBe(v + 'ms');

          // Dispatch change event — should persist to State
          slider.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
          expect(State.settings.actionDelay).toBe(v);
        },
      ),
      { numRuns: 100 },
    );
  });
});
