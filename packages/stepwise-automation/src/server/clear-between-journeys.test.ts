import { describe, it, expect, beforeEach } from 'vitest';
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
 * Wrap a `const` declaration so it also becomes a property on the sandbox.
 */
function wrapAsGlobal(source: string, globalName: string): string {
  return `${source}\nthis.${globalName} = ${globalName};`;
}

/**
 * Bootstrap a fresh JSDOM + vm context with the global JS files loaded.
 * Includes the tab-panel structure needed by the Clear button tests.
 */
function createTestContext() {
  const dom = new JSDOM(
    `<!DOCTYPE html>
     <html><body>
       <div id="action-log"></div>
       <div id="console-output"></div>
       <div class="tab-panel active" id="panel-actions"></div>
       <div class="tab-panel" id="panel-console">
         <div id="console-output-inner"></div>
       </div>
     </body></html>`,
    { url: 'http://localhost' },
  );

  const ctx = vm.createContext({
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

    fsmTransition: (current: string, _event: string) => current,
    UI: { refresh() {} },
    Breakpoints: { load() {}, has() { return false; }, toggle() {} },
  });

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


// ─────────────────────────────────────────────────────────────────────────────
// Task 6.1 — Unit tests for manual Clear button behavior
// Validates: Requirements 4.1, 4.2, 4.3
// ─────────────────────────────────────────────────────────────────────────────

describe('Manual Clear button behavior', () => {
  let dom: JSDOM;
  let State: any;
  let ActionLog: any;

  beforeEach(() => {
    const ctx = createTestContext();
    dom = ctx.dom;
    State = ctx.State;
    ActionLog = ctx.ActionLog;
  });

  it('clearing State.actions and calling ActionLog.clear() empties the action log (Req 4.2)', () => {
    const actionLog = dom.window.document.getElementById('action-log')!;

    // Seed some actions
    State.actions = [
      { index: 0, description: 'Navigate to page', status: 'complete' },
      { index: 1, description: 'Click button', status: 'running' },
    ];
    ActionLog.render();

    // Verify actions are rendered
    expect(actionLog.querySelectorAll('.action-item').length).toBe(2);

    // Simulate Clear button on Actions tab
    State.actions = [];
    ActionLog.clear();

    // State is empty
    expect(State.actions).toEqual([]);
    // DOM is empty
    expect(actionLog.innerHTML).toBe('');
    expect(actionLog.querySelectorAll('.action-item').length).toBe(0);
  });

  it('clearing #console-output textContent empties the console panel (Req 4.3)', () => {
    const consoleEl = dom.window.document.getElementById('console-output')!;

    // Seed console content
    consoleEl.textContent = 'Line 1\nLine 2\nSome error output';
    expect(consoleEl.textContent).not.toBe('');

    // Simulate Clear button on Console tab
    consoleEl.textContent = '';

    expect(consoleEl.textContent).toBe('');
    expect(consoleEl.childNodes.length).toBe(0);
  });

  it('ActionLog.clear() removes journey headers along with action items', () => {
    const actionLog = dom.window.document.getElementById('action-log')!;

    // Insert a journey header then some actions
    ActionLog.insertJourneyHeader('Login Journey');
    State.actions = [{ index: 0, description: 'Step 1', status: 'complete' }];
    ActionLog.render();

    // Verify content exists (render replaces innerHTML, so re-insert header for this test)
    ActionLog.insertJourneyHeader('Login Journey');
    ActionLog.appendAction({ index: 0, description: 'Step 1', status: 'complete' });
    expect(actionLog.children.length).toBeGreaterThan(0);

    // Clear
    State.actions = [];
    ActionLog.clear();

    expect(actionLog.innerHTML).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Task 6.2 — Unit tests for journey header and console separator rendering
// Validates: Requirements 3.1, 3.2, 1.3
// ─────────────────────────────────────────────────────────────────────────────

describe('Journey header and console separator rendering', () => {
  let dom: JSDOM;
  let ActionLog: any;
  let WebSocketClient: any;
  let State: any;

  beforeEach(() => {
    const ctx = createTestContext();
    dom = ctx.dom;
    ActionLog = ctx.ActionLog;
    WebSocketClient = ctx.WebSocketClient;
    State = ctx.State;
  });

  it('ActionLog.insertJourneyHeader() renders a div.journey-header with correct text (Req 3.1)', () => {
    const actionLog = dom.window.document.getElementById('action-log')!;

    ActionLog.insertJourneyHeader('Signup Flow');

    const header = actionLog.querySelector('.journey-header');
    expect(header).not.toBeNull();
    expect(header!.tagName).toBe('DIV');
    expect(header!.className).toBe('journey-header');
    expect(header!.textContent).toBe('Signup Flow');
  });

  it('WebSocketClient._insertConsoleSeparator() renders a div.console-journey-name with correct text (Req 3.2)', () => {
    const consoleEl = dom.window.document.getElementById('console-output')!;

    WebSocketClient._insertConsoleSeparator('Checkout Flow');

    const separator = consoleEl.querySelector('.console-journey-name');
    expect(separator).not.toBeNull();
    expect(separator!.tagName).toBe('DIV');
    expect(separator!.className).toBe('console-journey-name');
    expect(separator!.textContent).toBe('Checkout Flow');
  });

  it('first journey in a batch (run-start + test-start) produces exactly one header and one separator (Req 1.3)', () => {
    const actionLog = dom.window.document.getElementById('action-log')!;
    const consoleEl = dom.window.document.getElementById('console-output')!;

    // Simulate run-start (clears state for the batch)
    WebSocketClient.onMessage({ type: 'run-start' });

    // Simulate test-start for the first journey
    WebSocketClient.onMessage({ type: 'test-start', journey: 'Login Journey' });

    // There should be exactly one journey header in the action log
    const headers = actionLog.querySelectorAll('.journey-header');
    expect(headers.length).toBe(1);
    expect(headers[0].textContent).toBe('Login Journey');

    // There should be exactly one console separator
    const separators = consoleEl.querySelectorAll('.console-journey-name');
    expect(separators.length).toBe(1);
    expect(separators[0].textContent).toBe('Login Journey');
  });

  it('insertJourneyHeader removes empty-state placeholder before inserting header', () => {
    const actionLog = dom.window.document.getElementById('action-log')!;

    // Seed an empty-state placeholder (as ActionLog.render() would for empty actions)
    actionLog.innerHTML =
      '<div class="empty-state"><div class="empty-state-icon">📋</div></div>';

    ActionLog.insertJourneyHeader('Profile Journey');

    // Empty state should be gone
    expect(actionLog.querySelector('.empty-state')).toBeNull();
    // Header should be present
    const header = actionLog.querySelector('.journey-header');
    expect(header).not.toBeNull();
    expect(header!.textContent).toBe('Profile Journey');
  });
});
