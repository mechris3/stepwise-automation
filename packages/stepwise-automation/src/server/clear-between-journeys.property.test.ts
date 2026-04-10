import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';
import { JSDOM } from 'jsdom';

// ── Paths to the plain-JS global files under test ──
const UI_DIR = path.resolve(__dirname, '../../ui/js');
const stateSource = fs.readFileSync(path.join(UI_DIR, 'state.js'), 'utf-8');
const actionLogSource = fs.readFileSync(path.join(UI_DIR, 'action-log.js'), 'utf-8');
const websocketSource = fs.readFileSync(path.join(UI_DIR, 'websocket.js'), 'utf-8');

/**
 * The source files use `const` declarations which don't leak onto the
 * vm context object. We wrap each file so the global name is also
 * assigned as a property of `this` (the context sandbox).
 */
function wrapAsGlobal(source: string, globalName: string): string {
  return `${source}\nthis.${globalName} = ${globalName};`;
}

/**
 * Bootstrap a fresh JSDOM + vm context with the global JS files loaded.
 * Returns references to the State, ActionLog, and WebSocketClient globals
 * living inside the sandboxed context.
 */
function createTestContext() {
  const dom = new JSDOM(
    `<!DOCTYPE html>
     <html><body>
       <div id="action-log"></div>
       <div id="console-output"></div>
     </body></html>`,
    { url: 'http://localhost' },
  );

  const ctx = vm.createContext({
    // DOM globals
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    WebSocket: class FakeWebSocket {
      readyState = 0;
      addEventListener() {}
      close() {}
    },
    requestAnimationFrame: (cb: () => void) => cb(),
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    console,
    Set: globalThis.Set,
    Array: globalThis.Array,
    JSON: globalThis.JSON,
    Math: globalThis.Math,

    // Stubs for dependencies the files reference but we don't need
    fsmTransition: (current: string, _event: string) => current,
    UI: { refresh() {} },
    Breakpoints: { load() {}, has() { return false; }, toggle() {} },
  });

  // Load files in dependency order: State → ActionLog → WebSocketClient
  vm.runInContext(wrapAsGlobal(stateSource, 'State'), ctx);
  vm.runInContext(wrapAsGlobal(actionLogSource, 'ActionLog'), ctx);
  vm.runInContext(wrapAsGlobal(websocketSource, 'WebSocketClient'), ctx);

  return {
    dom,
    State: (ctx as any).State,
    ActionLog: (ctx as any).ActionLog,
    WebSocketClient: (ctx as any).WebSocketClient,
  };
}


// ── Arbitrary generators ──

/** Generate an action object matching the shape used by State.actions */
const arbAction = fc.record({
  index: fc.nat({ max: 999 }),
  description: fc.string({ minLength: 0, maxLength: 50 }),
  status: fc.constantFrom('running', 'complete', 'breakpoint', 'failed'),
});

// Feature: clear-between-journeys, Property 1: test-start clears actions state
describe('Feature: clear-between-journeys, Property 1: test-start clears actions state', () => {
  let State: any;
  let WebSocketClient: any;

  beforeEach(() => {
    const ctx = createTestContext();
    State = ctx.State;
    WebSocketClient = ctx.WebSocketClient;
  });

  /**
   * **Validates: Requirements 1.1, 1.3, 1.4**
   *
   * For any State.actions array of arbitrary length and content, and for any
   * State.currentActionIndex value, when a test-start message is processed
   * by WebSocketClient.onMessage, State.actions SHALL be an empty array and
   * State.currentActionIndex SHALL be 0.
   */
  it('clears State.actions to [] and resets State.currentActionIndex to 0 for any prior state', () => {
    fc.assert(
      fc.property(
        fc.array(arbAction, { minLength: 0, maxLength: 30 }),
        fc.nat({ max: 999 }),
        fc.string({ minLength: 1, maxLength: 60 }),
        (actions, currentIndex, journeyName) => {
          // Arrange: seed arbitrary prior state
          State.actions = actions;
          State.currentActionIndex = currentIndex;

          // Act
          WebSocketClient.onMessage({ type: 'test-start', journey: journeyName });

          // Assert
          expect(State.actions).toEqual([]);
          expect(State.currentActionIndex).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: clear-between-journeys, Property 2: test-start resets console tracking state
describe('Feature: clear-between-journeys, Property 2: test-start resets console tracking state', () => {
  let dom: JSDOM;
  let WebSocketClient: any;

  beforeEach(() => {
    const ctx = createTestContext();
    dom = ctx.dom;
    WebSocketClient = ctx.WebSocketClient;
  });

  /**
   * **Validates: Requirements 2.1, 2.2**
   *
   * For any #console-output HTML content and any _lastConsoleJourney value,
   * when a test-start message is processed, the #console-output element's
   * text content (excluding the journey separator element) SHALL be empty,
   * and WebSocketClient._lastConsoleJourney SHALL be null.
   */
  it('clears #console-output content and resets _lastConsoleJourney to null', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 200 }),
        fc.option(fc.string({ minLength: 1, maxLength: 60 }), { nil: null }),
        fc.string({ minLength: 1, maxLength: 60 }),
        (priorHtml, priorLastJourney, journeyName) => {
          // Arrange: seed arbitrary prior console state
          const consoleEl = dom.window.document.getElementById('console-output')!;
          consoleEl.innerHTML = priorHtml;
          WebSocketClient._lastConsoleJourney = priorLastJourney;

          // Act
          WebSocketClient.onMessage({ type: 'test-start', journey: journeyName });

          // Assert: _lastConsoleJourney is reset to null
          expect(WebSocketClient._lastConsoleJourney).toBeNull();

          // Assert: console text content excluding the journey separator is empty.
          // The handler clears innerHTML then inserts a .console-journey-name separator.
          // All non-separator text content should be empty.
          const children = Array.from(consoleEl.childNodes) as Node[];
          const nonSeparatorText = children
            .filter(
              (node) =>
                !(node instanceof dom.window.HTMLElement &&
                  (node as HTMLElement).classList.contains('console-journey-name')),
            )
            .map((node) => node.textContent || '')
            .join('');
          expect(nonSeparatorText).toBe('');
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: clear-between-journeys, Property 3: journey name is displayed on transition
describe('Feature: clear-between-journeys, Property 3: journey name is displayed on transition', () => {
  let dom: JSDOM;
  let WebSocketClient: any;

  beforeEach(() => {
    const ctx = createTestContext();
    dom = ctx.dom;
    WebSocketClient = ctx.WebSocketClient;
  });

  /**
   * **Validates: Requirements 3.1, 3.2**
   *
   * For any journey name string, when a test-start message is processed,
   * the #action-log container SHALL contain a .journey-header element whose
   * text content equals the journey name, AND the #console-output container
   * SHALL contain a .console-journey-name element whose text content equals
   * the journey name.
   */
  it('inserts journey name into both #action-log and #console-output', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        (journeyName) => {
          // Reset DOM between iterations
          const actionLog = dom.window.document.getElementById('action-log')!;
          const consoleEl = dom.window.document.getElementById('console-output')!;
          actionLog.innerHTML = '';
          consoleEl.innerHTML = '';

          // Act
          WebSocketClient.onMessage({ type: 'test-start', journey: journeyName });

          // Assert: #action-log contains a .journey-header with the journey name
          const header = actionLog.querySelector('.journey-header');
          expect(header).not.toBeNull();
          expect(header!.textContent).toBe(journeyName);

          // Assert: #console-output contains a .console-journey-name with the journey name
          const separator = consoleEl.querySelector('.console-journey-name');
          expect(separator).not.toBeNull();
          expect(separator!.textContent).toBe(journeyName);
        },
      ),
      { numRuns: 100 },
    );
  });
});
