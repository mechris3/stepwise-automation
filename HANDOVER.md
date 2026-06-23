# Glassbox — Project Handover Document

## 1. What This Project Is

Glassbox is a **debugger-style browser automation test runner** that provides live execution control (breakpoints, pause/resume/step-through) and a visual web dashboard. It is a ground-up rewrite of `@mechris3/stepwise-automation` with one fundamental architectural change: **it uses Chrome DevTools Protocol (CDP) directly instead of adapter abstractions over Puppeteer/Playwright**.

The previous version abstracted browser interaction behind a `BrowserAdapter` interface with two implementations (PuppeteerAdapter, PlaywrightAdapter). Glassbox eliminates this indirection — CDP is the sole browser communication layer. This simplifies the codebase, removes optional peer dependencies, and enables direct access to low-level browser data (DOM state, console errors, network activity) that can be exposed to AI consumers.

---

## 2. Core Concepts (Inherited from Stepwise)

### 2.1 Consumer vs. Package Boundary

**Critical distinction:** Journeys and page objects are **consumer code** — they live in the user's project, not in this package. Glassbox provides:
- The `BasePage` class that consumers extend
- The `BrowserAdapter` interface/implementation that powers `BasePage`
- The runner that discovers, loads, and executes consumer journey files
- The dashboard UI that visualizes execution

Consumers install Glassbox as a dependency and write their own journeys and page objects that import from it. The package never ships journey files or page object files — it ships the infrastructure that runs them.

### 2.2 Journeys (Consumer Code)

A **journey** is an end-to-end user flow written by the consumer (e.g. "sign up and add todos"). Each journey is a single file in the consumer's project matching a glob pattern (default: `./journeys/**/*.journey.ts`).

Journey files export a class with `constructor(adapter)` and `async execute()`:

```typescript
// This lives in the CONSUMER's project, not in Glassbox
import type { BrowserAdapter } from 'glassbox';
import { LoginPage } from '../page-objects/login.page';

export class LoginJourney {
  constructor(private adapter: BrowserAdapter) {}

  async execute(): Promise<void> {
    const loginPage = new LoginPage(this.adapter);
    await loginPage.navigateToApp();
    await loginPage.login('user', 'pass123');
    await loginPage.waitForDashboard();
  }
}
```

**Why this matters for Glassbox:** The runner must dynamically import arbitrary consumer modules, detect their export shape (class with execute vs. plain function), instantiate them with the adapter, and execute them. It must handle TypeScript via tsx/jiti loaders since consumer files are `.ts`.

### 2.3 Page Objects (Consumer Code)

Page objects are also consumer code. They encapsulate selectors and interactions for a page/component by extending `BasePage` (which Glassbox provides):

```typescript
// This lives in the CONSUMER's project, not in Glassbox
import { BasePage } from 'glassbox';

export class TodoPage extends BasePage {
  private selectors = {
    todoInput: '[data-testid="todo-input"]',
    addTodo: '[data-testid="add-todo"]',
    todoCount: '[data-testid="todo-count"]',
  };

  async addTodo(text: string): Promise<void> {
    await this.fill(this.selectors.todoInput, text);
    await this.click(this.selectors.addTodo);
  }

  async getTodoCount(): Promise<string> {
    return this.getText(this.selectors.todoCount);
  }
}
```

**Why this matters for Glassbox:** We must export `BasePage`, `BrowserContextPage`, the `BrowserAdapter` type, and utilities like `waitForCondition` and `@withErrorContext` as the public API surface that consumers import from.

### 2.4 The BrowserAdapter Interface

This is the contract that page objects consume. In stepwise it was an abstraction over Puppeteer/Playwright. In Glassbox it will be a single CDP-backed implementation.

**Note:** The interface below is carried forward from stepwise as a reference. Method names, signatures, and groupings may be revised in Glassbox to more closely align with CDP domain naming (e.g. `Runtime.evaluate`, `Page.navigate`, `Input.dispatchMouseEvent`). The exact API shape is a design decision for the new project — treat this as a starting point, not a locked contract.

The stepwise interface had **24 methods**:

```typescript
interface BrowserAdapter {
  // Element interaction
  click(selector: string): Promise<void>;
  fill(selector: string, value: string): Promise<void>;
  type(selector: string, value: string, options?: { delay?: number }): Promise<void>;

  // Element queries
  getText(selector: string): Promise<string>;
  getInputValue(selector: string): Promise<string>;
  getAttribute(selector: string, attribute: string): Promise<string | null>;
  countElements(selector: string): Promise<number>;
  isVisible(selector: string): Promise<boolean>;
  isDisabled(selector: string): Promise<boolean>;

  // Waiting
  waitForSelector(selector: string): Promise<void>;
  waitForHidden(selector: string): Promise<void>;
  waitForTimeout(ms: number): Promise<void>;

  // Navigation
  goto(url: string): Promise<void>;
  clickAndWaitForNavigation(selector: string): Promise<void>;
  getCurrentUrl(): Promise<string>;

  // Evaluate
  evaluate(script: string): Promise<any>;
  evaluate<T>(script: () => T): Promise<T>;

  // Session & context
  clearSession(origin?: string): Promise<void>;
  readClipboard(): Promise<string>;
  uploadFile(selector: string, filePath: string): Promise<void>;

  // Dropdowns
  selectByIndex(selector: string, index: number): Promise<void>;
  selectByValue(selector: string, value: string): Promise<void>;
  selectByText(selector: string, text: string, exact?: boolean): Promise<void>;

  // Downloads
  clickAndDownload(selector: string): Promise<DownloadResult>;
  clearDownloads(): Promise<void>;
}
```

### 2.5 Execution Control (The "Debugger" Part)

Every adapter action is wrapped with lifecycle hooks:
1. **Before action**: `logAndCheckAction(description)` — increments action index, emits JSON start event, checks breakpoints, checks pause state
2. **After action**: `logActionComplete()` + `addSlowModeDelay()` — emits JSON complete event, applies slow-mode delay with IPC polling

This enables:
- **Breakpoints** — pause at specific action indices
- **Pause/Resume** — manual pause via UI button
- **Step mode** — execute N actions then re-pause
- **Slow mode** — configurable delay between actions (0–5000ms, quadratic slider scale)

### 2.6 IPC (Inter-Process Communication)

The server (parent) communicates with the runner (child process) via:
- **Signals**: SIGUSR1=pause, SIGUSR2=resume (instant, no polling)
- **stdin JSON**: step/config commands (parsed line-by-line)

Commands: `pause`, `resume`, `step` (with stepsRemaining), `config` (actionDelay, breakpoints)

**Removed from stepwise:** File-based IPC (writing to a temp file, polled every 100ms) was a Playwright workaround. Not needed in Glassbox since the CDP runner is always a standard child process with signal/stdin access.

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLI (bin/glassbox.ts)                     │
│  Commands: serve (default), run [journeys...], init              │
└───────────────────────────────┬──────────────────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │   Express Server       │
                    │   (src/server/)        │
                    │                        │
                    │  REST API + WebSocket  │
                    │  Static UI assets      │
                    └───────────┬───────────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                  │
     ┌────────▼──────┐  ┌──────▼──────┐  ┌───────▼───────┐
     │ TestExecutor   │  │ Journey     │  │ Settings      │
     │ (orchestrator) │  │ Discovery   │  │ Storage       │
     │                │  │ (glob scan) │  │ (.glassbox/)  │
     └────────┬───────┘  └─────────────┘  └───────────────┘
              │
              │  spawns child process per journey
              │
     ┌────────▼──────────────────────────────────────┐
     │            Journey Runner Process              │
     │                                                │
     │  ┌──────────────────────────────────────────┐ │
     │  │  CDP Adapter (BaseAdapter subclass)       │ │
     │  │  - Connects via CDP WebSocket             │ │
     │  │  - Action logging + breakpoint hooks      │ │
     │  │  - Slow mode delay + IPC polling          │ │
     │  └──────────────────────────────────────────┘ │
     │                                                │
     │  ┌──────────────────────────────────────────┐ │
     │  │  Journey Module (user code)              │ │
     │  │  - Page Objects → BasePage → Adapter     │ │
     │  └──────────────────────────────────────────┘ │
     └────────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────────────────────────┐
│                    Dashboard UI (browser)                      │
│                                                                │
│  ┌─────────┐  ┌──────────────────────────────────────────┐   │
│  │ Sidebar  │  │ Main Content                             │   │
│  │          │  │                                          │   │
│  │ Journey  │  │ Toolbar: Play|Pause|Resume|Step|Stop     │   │
│  │ List     │  │ + action delay slider                    │   │
│  │ (select) │  │                                          │   │
│  │          │  │ Tabs: Actions | Console                  │   │
│  │          │  │                                          │   │
│  │          │  │ Actions: live action log with            │   │
│  │          │  │   breakpoint pins (click to toggle)      │   │
│  │          │  │   spinner/check/pause icons              │   │
│  │          │  │                                          │   │
│  │          │  │ Console: stdout/stderr with syntax       │   │
│  │          │  │   highlighting (paths, errors, success)  │   │
│  └─────────┘  └──────────────────────────────────────────┘   │
│                                                                │
│  Header: logo | engine selector | settings gear               │
│  Footer: connection status | test results summary             │
│                                                                │
│  Settings Panel (collapsible):                                │
│    - Target URL (with MRU history combobox)                   │
│    - Browser path (auto-detected)                             │
│    - User data directory                                      │
│    - Viewport presets + custom W×H                            │
│    - DevTools on launch toggle                                │
│    - Keep browser open toggle                                 │
│  ──────────────────────────────────────────────────────────   │
│  Communication: WebSocket (real-time) + REST API (commands)   │
└──────────────────────────────────────────────────────────────┘
```

---

## 4. Server Architecture (src/server/)

### 4.1 Express Server (`src/server/index.ts`)

Creates an Express app with:
- CORS enabled
- JSON body parsing
- Static file serving for the dashboard UI from a `ui/` directory
- HTTP server with WebSocket upgrade

### 4.2 REST API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/journeys` | Discover and return journey list |
| POST | `/api/tests/run` | Start test execution (body: `{journeys, tool, config}`) |
| POST | `/api/tests/stop` | Stop current execution |
| POST | `/api/tests/pause` | Pause execution |
| POST | `/api/tests/resume` | Resume execution |
| POST | `/api/tests/step` | Step forward N actions (body: `{count}`) |
| POST | `/api/breakpoints` | Set breakpoints (body: `{journey, breakpoints}`) |
| GET | `/api/breakpoints/:journey` | Get breakpoints for a journey |
| DELETE | `/api/breakpoints/:journey` | Clear breakpoints for a journey |
| PATCH | `/api/config` | Push live config update to running child process |
| GET | `/api/config/browsers` | Return all discovered browsers |
| GET | `/api/config/browser-path` | Auto-discover primary browser path |
| GET | `/api/settings` | Read UI settings from `.glassbox/settings.json` |
| PUT | `/api/settings` | Write UI settings |

### 4.3 WebSocket Messages

The server broadcasts typed messages to all connected dashboard clients:

```typescript
type WSMessage =
  | { type: 'run-start'; journeys: string[] }
  | { type: 'run-end'; results: Array<{ journey: string; status: 'passed' | 'failed' | 'skipped' }> }
  | { type: 'test-start'; journey: string }
  | { type: 'test-end'; journey: string; status: 'passed' | 'failed'; duration: string }
  | { type: 'log'; message: string; journey?: string }
  | { type: 'error'; message: string; journey?: string }
  | { type: 'journeys'; journeys: Array<{ id: string; name: string }> };
```

Additionally, the child process emits **structured JSON on stderr** prefixed with `[JSON]`:

```typescript
// Action lifecycle
{ type: 'action', index: number, status: 'start' | 'complete' | 'breakpoint', description?: string }

// UI control (pause/resume state changes)
{ type: 'ui-control', action: 'pause' | 'resume' }
```

The server parses these `[JSON]` lines from stderr and broadcasts them as `error` messages. The UI extracts the JSON payloads to drive the action log and FSM state.

### 4.4 TestExecutor (`src/server/test-executor.ts`)

Orchestrates journey execution:
1. Kills existing browser instances (derives process name from configured browser path)
2. Runs lifecycle hooks (`globalSetup` → for each journey: `beforeEach` → journey → `afterEach` → `globalTeardown`)
3. Spawns one child process per journey with environment variables for config
4. Streams stdout/stderr through WebSocket
5. Manages pause/resume/step via IPC (writes commands to the child process)

Environment variables passed to child process:
- `TEST_DOMAIN` — base URL of the app under test
- `VIEWPORT_WIDTH`, `VIEWPORT_HEIGHT` — browser content area dimensions
- `ACTION_DELAY` — slow mode delay in ms
- `DEVTOOLS` — "true"/"false" for DevTools on launch
- `KEEP_BROWSER_OPEN` — "true"/"false"
- `BROWSER_PATH` — absolute path to browser executable
- `USER_DATA_DIR` — browser profile directory
- `TEST_BREAKPOINTS` — JSON array of action indices
- `STEPWISE_JOURNEY_PATH` — pre-resolved absolute path to journey file
- `STEPWISE_JOURNEYS_GLOB` — glob pattern for discovery

### 4.5 Journey Discovery (`src/server/journey-discovery.ts`)

- Scans for `.ts` files matching the configured glob
- Converts kebab-case filename to Title Case display name
- Returns sorted array of `{ id, name, path }`

### 4.6 Settings Storage (`src/server/settings-storage.ts`)

Persists all mutable UI state to `.glassbox/settings.json` in the project root:

```typescript
interface PersistedSettings {
  targetUrl?: string;
  browserPath?: string;
  userDataDir?: string;
  actionDelay?: number;
  viewportWidth?: number;
  viewportHeight?: number;
  devtools?: boolean;
  keepBrowserOpen?: boolean;
  settingsPanelOpen?: boolean;
  selectedTool?: string;
  activeTab?: string;
  selectedJourneyIds?: string[];
  breakpoints?: Record<string, number[]>;
  sidebarWidth?: number;
  targetUrlHistory?: string[];
}
```

---

## 5. Configuration System

### 5.1 Config File (`glassbox.config.ts`)

Optional — sensible defaults applied when absent. Loaded via dynamic import with `jiti` for TypeScript support.

```typescript
import { defineConfig } from 'glassbox';

export default defineConfig({
  journeys: './journeys/**/*.journey.ts',  // default
  browser: {
    executablePath: '/path/to/chrome',
    userDataDir: '/path/to/profile',
    profileDir: 'Default',
    defaultViewport: { width: 1280, height: 720 },
    headless: false,
  },
  server: { port: 3001 },
  testData: {
    globalSetup: './helpers/global-setup.ts',
    beforeEach: './helpers/before-each.ts',
    afterEach: './helpers/after-each.ts',
    globalTeardown: './helpers/global-teardown.ts',
  },
});
```

### 5.2 Config Resolution Logic

1. If explicit `--config path` provided, load that file (must exist)
2. Otherwise auto-discover `glassbox.config.ts` in CWD
3. If no config found, use all defaults (no error)
4. Validate: journeys must be non-empty string if provided
5. Resolve relative paths against config file directory
6. Validate testData hook files exist
7. Merge defaults for optional fields

### 5.3 Browser Auto-Discovery (`src/utils/browser-discovery.ts`)

Cross-platform detection of Chromium-based browsers:
- **macOS**: Chrome, Brave, Edge, Chromium in `/Applications/`
- **Windows**: Program Files paths + LocalAppData
- **Linux**: `/usr/bin/` paths

Returns `{ name, executablePath, userDataDir }` for each found browser.

---

## 6. The CDP Adapter (New for Glassbox)

### 6.1 What Changes from Stepwise

In stepwise, there were two adapter implementations (PuppeteerAdapter, PlaywrightAdapter) that wrapped their respective library APIs. In Glassbox, there is **one adapter** that speaks CDP directly.

The adapter must:
1. Launch Chrome with specific args (see section 6.2)
2. Connect to the CDP WebSocket endpoint
3. Implement all 24 `BrowserAdapter` methods using CDP domains
4. Wrap every action with `logAndCheckAction()` / `logActionComplete()` / `addSlowModeDelay()` from BaseAdapter

### 6.2 Chrome Launch Configuration

Chrome args used in stepwise (carry forward):
```
--no-sandbox
--disable-setuid-sandbox
--disable-session-crashed-bubble
--disable-infobars
--no-first-run
--no-default-browser-check
--hide-crash-restore-bubble
--disable-popup-blocking
--disable-prompt-on-repost
--noerrdialogs
--no-restore-state
--profile-directory=<profileDir>
--window-size=<width>,<height>
--remote-debugging-port=0  (NEW: for CDP connection)
```

### 6.3 CDP Domains to Use

The table below maps the stepwise BrowserAdapter methods to their CDP equivalents. Since Glassbox talks CDP directly, you may want to rename adapter methods to reflect CDP naming more naturally (e.g. `navigate` instead of `goto`, `evaluateExpression` instead of `evaluate`, `dispatchClick` instead of `click`). The naming is yours to decide — the important thing is the underlying CDP mechanics:

| Stepwise Method | CDP Domain/Method | Possible Glassbox Rename |
|---|---|---|
| `click(selector)` | `Runtime.evaluate` (querySelector + click) or `DOM.querySelector` + `Input.dispatchMouseEvent` | `dispatchClick`? |
| `fill(selector, value)` | `Runtime.evaluate` (set value + dispatch input/change events) | `setInputValue`? |
| `type(selector, value)` | `Input.dispatchKeyEvent` per character | `dispatchKeyInput`? |
| `getText(selector)` | `Runtime.evaluate` (querySelector.textContent) | — |
| `getInputValue(selector)` | `Runtime.evaluate` (querySelector.value) | — |
| `getAttribute(selector, attr)` | `Runtime.evaluate` | — |
| `countElements(selector)` | `Runtime.evaluate` (querySelectorAll.length) | — |
| `isVisible(selector)` | `Runtime.evaluate` (check element exists) | — |
| `isDisabled(selector)` | `Runtime.evaluate` (element.disabled) | — |
| `waitForSelector(selector)` | Poll with `Runtime.evaluate` or use `DOM.setChildNodes` observation | — |
| `waitForHidden(selector)` | Poll with `Runtime.evaluate` | — |
| `waitForTimeout(ms)` | `setTimeout` (local) | — |
| `goto(url)` | `Page.navigate` + `Page.loadEventFired` or `Page.lifecycleEvent` | `navigate`? |
| `clickAndWaitForNavigation` | Click + `Page.loadEventFired` | `clickAndNavigate`? |
| `getCurrentUrl()` | `Runtime.evaluate` (window.location.href) or track from `Page.frameNavigated` | `getUrl`? |
| `evaluate(script)` | `Runtime.evaluate` with `expression` or `Runtime.callFunctionOn` | — |
| `clearSession(origin?)` | `Network.clearBrowserCookies` + `Storage.clearDataForOrigin` | `clearStorageData`? |
| `readClipboard()` | `Browser.grantPermissions` + `Runtime.evaluate` (navigator.clipboard.readText) | — |
| `uploadFile(selector, path)` | `DOM.querySelector` + `DOM.setFileInputFiles` | `setFileInputFiles`? |
| `selectByIndex/Value/Text` | `Runtime.evaluate` (set selectedIndex/value + dispatch change) | — |
| `clickAndDownload(selector)` | `Page.setDownloadBehavior` + click + poll filesystem | — |
| `clearDownloads()` | Local fs operation | — |

The "Possible Glassbox Rename" column is just a suggestion — the interface should feel natural for someone working at the CDP level while remaining ergonomic for consumers who extend `BasePage`. Since `BasePage` wraps these methods, you can always have consumer-friendly names on `BasePage` (like `click`) that delegate to differently-named adapter methods internally.

### 6.4 Convenience Methods & Logical Groupings

Many user-facing operations require orchestrating multiple CDP commands. The adapter should expose **convenience methods** that group low-level CDP calls into logically coherent operations. These sit above the raw CDP layer but below `BasePage`.

Design principle: group methods by **what the user is trying to accomplish**, not by which CDP domain they touch.

#### Text Input (multiple strategies for different scenarios)

| Method | Strategy | When to Use |
|--------|----------|-------------|
| `fill(selector, value)` | Focus → set `.value` → dispatch `input`/`change`/`blur` events | Standard inputs (React, Vue, Angular). Fast, no per-key events. |
| `type(selector, value, {delay?})` | Focus → `Input.dispatchKeyEvent` (keyDown/char/keyUp) per character | Third-party inputs that rely on keyboard events (Stripe, OTP fields, autocomplete). |
| `clearAndFill(selector, value)` | Select all (Ctrl+A) → delete → `fill()` | Overwriting existing input content cleanly. |
| `insertText(selector, value)` | Focus → `Input.insertText` | Paste-like insertion without key events. Works for contenteditable. |

Each of these is one "logical action" from the user's perspective but requires 3–10 CDP commands internally (resolve node, focus, dispatch events, etc.).

#### Click & Interaction (multiple strategies)

| Method | Strategy | When to Use |
|--------|----------|-------------|
| `click(selector)` | Resolve node → get box model → `Input.dispatchMouseEvent` (mouseDown + mouseUp + click) | Standard clickable elements. Simulates real user click at element center. |
| `jsClick(selector)` | `Runtime.evaluate` → `element.click()` | Elements obscured by overlays, or when precise coordinates don't matter. |
| `clickAtPoint(x, y)` | `Input.dispatchMouseEvent` at absolute coordinates | Canvas, map interactions, or pixel-precise clicking. |
| `doubleClick(selector)` | Two click sequences + dblclick event | Text selection, double-click interactions. |
| `rightClick(selector)` | `Input.dispatchMouseEvent` with button=2 | Context menu triggers. |

#### Navigation (multiple wait strategies)

| Method | Strategy | When to Use |
|--------|----------|-------------|
| `navigate(url)` | `Page.navigate` + wait for `Page.loadEventFired` | Full page navigation, wait for load. |
| `navigateAndWaitForNetwork(url)` | `Page.navigate` + wait for network idle (no requests for N ms) | SPAs that load data after DOMContentLoaded. |
| `clickAndNavigate(selector)` | Click + wait for `Page.frameNavigated` + load | Link clicks that trigger navigation. |
| `waitForNavigation()` | Wait for next `Page.frameNavigated` event | When something else triggers navigation (form submit, JS redirect). |

#### Waiting (multiple conditions)

| Method | Strategy | When to Use |
|--------|----------|-------------|
| `waitForSelector(selector)` | Poll `Runtime.evaluate` (querySelector !== null) | Wait for element to appear in DOM. |
| `waitForVisible(selector)` | Poll element existence + `offsetParent !== null` / computed visibility | Wait for element to be rendered and visible. |
| `waitForHidden(selector)` | Poll until element removed or hidden | Wait for loading spinners, modals to close. |
| `waitForNetwork()` | Track `Network.requestWillBeSent`/`Network.loadingFinished`, wait for silence | Wait for all XHR/fetch to complete. |
| `waitForFunction(fn)` | Poll `Runtime.evaluate` with user-provided expression | Custom conditions (state changes, counters, etc.). |

#### Session & Storage

| Method | Strategy | When to Use |
|--------|----------|-------------|
| `clearSession(origin?)` | `Network.clearBrowserCookies` + `Storage.clearDataForOrigin` | Full reset between journeys. |
| `clearCookies()` | `Network.clearBrowserCookies` | Just cookies. |
| `clearStorage(origin)` | `Storage.clearDataForOrigin` (localStorage, sessionStorage, indexedDB) | Just storage, keep cookies. |
| `setCookie(cookie)` | `Network.setCookie` | Inject auth tokens, test state. |
| `getCookies()` | `Network.getCookies` | Inspect current cookies. |

#### Select / Dropdown

| Method | Strategy | When to Use |
|--------|----------|-------------|
| `selectByIndex(selector, index)` | `Runtime.evaluate` (set selectedIndex + dispatch change) | Native `<select>` by position. |
| `selectByValue(selector, value)` | `Runtime.evaluate` (find option by value attr) | Native `<select>` by value attribute. |
| `selectByText(selector, text, exact?)` | `Runtime.evaluate` (find option by textContent) | Native `<select>` by visible text. |

#### File & Download

| Method | Strategy | When to Use |
|--------|----------|-------------|
| `uploadFile(selector, paths)` | `DOM.querySelector` → `DOM.setFileInputFiles` | File input elements. |
| `clickAndDownload(selector)` | `Browser.setDownloadBehavior` + click + poll filesystem | Download triggers. |
| `clearDownloads()` | Local fs cleanup | Between tests. |

The key insight: **`BasePage` can expose the simple/common method** (e.g. `this.fill()`) while the adapter provides the full family of related methods for cases where the consumer needs more control. A page object author who needs character-by-character typing can access `this.adapter.type()` directly, while the common case stays ergonomic.

### 6.5 Viewport Sizing via CDP

The stepwise approach (carry forward):
1. Launch with `--window-size=W,H` using a cached chrome offset
2. After launch, create a CDP session on the first page
3. `Emulation.clearDeviceMetricsOverride` — ensure no emulation
4. `Browser.getWindowForTarget` → get `windowId`
5. Set window to reference size, measure `innerWidth`/`innerHeight` via evaluate
6. Calculate chrome offset = bounds - inner dimensions
7. `Browser.setWindowBounds` with exact size (viewport + chrome offset)
8. Cache the offset for next launch

---

## 7. NEW: AI Data Exposure Layer

This is new functionality not present in stepwise. Glassbox should expose browser state data that AI agents can query.

### 7.1 Suggested Data Endpoints / Methods

| Data Type | CDP Source | Description |
|-----------|-----------|-------------|
| DOM State | `DOM.getDocument` + `DOM.describeNode` | Full or partial DOM tree snapshot |
| Computed Styles | `CSS.getComputedStyleForNode` | Styles for a given element |
| Console Errors | `Runtime.consoleAPICalled` + `Runtime.exceptionThrown` | Collect console.error/warn/log messages |
| Network Activity | `Network.requestWillBeSent` + `Network.responseReceived` | Request/response log |
| Performance Metrics | `Performance.getMetrics` | FP, FCP, LCP, memory, etc. |
| Accessibility Tree | `Accessibility.getFullAXTree` | ARIA tree for the page |
| Page Screenshots | `Page.captureScreenshot` | Visual snapshot (base64 PNG) |
| Element Screenshot | `DOM.getBoxModel` + clip to `Page.captureScreenshot` | Screenshot of specific element |
| JavaScript Errors | `Runtime.exceptionThrown` event | Unhandled exceptions |
| Storage State | `DOMStorage.getDOMStorageItems` | localStorage/sessionStorage contents |
| Cookie State | `Network.getAllCookies` | All cookies for the page |

### 7.2 Suggested API Shape

```typescript
// Could be exposed as REST endpoints or as methods on the adapter
interface GlassboxAIContext {
  // Snapshot the current DOM as simplified HTML or structured tree
  getDOMSnapshot(options?: { depth?: number; selector?: string }): Promise<DOMSnapshot>;

  // Get all console messages since last clear
  getConsoleMessages(options?: { level?: 'error' | 'warn' | 'log' | 'all' }): Promise<ConsoleMessage[]>;

  // Get network requests since last navigation
  getNetworkLog(options?: { filterUrl?: string }): Promise<NetworkEntry[]>;

  // Get current page accessibility tree
  getAccessibilityTree(): Promise<AXNode[]>;

  // Take a screenshot
  screenshot(options?: { selector?: string; fullPage?: boolean }): Promise<string>; // base64

  // Get JavaScript errors
  getErrors(): Promise<JSError[]>;

  // Get storage state
  getStorageState(origin?: string): Promise<{ localStorage: Record<string, string>; cookies: Cookie[] }>;

  // Get performance metrics
  getPerformanceMetrics(): Promise<Record<string, number>>;
}
```

### 7.3 Implementation Approach

These should be implemented as **passive collectors** that listen to CDP events during test execution and accumulate data, plus **on-demand queries** that fetch current state when requested.

Passive (subscribe at connection time):
- `Runtime.consoleAPICalled` → accumulate console messages
- `Runtime.exceptionThrown` → accumulate JS errors
- `Network.requestWillBeSent` / `Network.responseReceived` → accumulate network log

On-demand (query when AI asks):
- DOM snapshot, accessibility tree, screenshots, storage state, performance metrics

---

## 8. Dashboard UI

### 8.1 Technology

**Stepwise used:** Vanilla HTML/CSS/JS with no framework. All JS files were globals loaded via `<script>` tags in order. This avoided framework complexity but sacrificed type safety, component encapsulation, and scalability.

**Glassbox will use Angular 21 (latest stable, released November 2025).** Since the project already requires a build step (TypeScript compilation for the backend), there's no benefit to avoiding a framework for the frontend. Angular provides:
- Strong typing throughout (consistent with the TypeScript backend)
- Component-based architecture suited to the growing UI (action log, console, AI panels, settings)
- Familiar tooling for the maintainer
- Built-in RxJS for WebSocket stream handling (natural fit for real-time dashboard updates)
- Signals for reactive state management (mature since Angular 17+)
- esbuild-based builder (`@angular-devkit/build-angular:application`) — sub-2s production builds on M3 Max

The Angular app will be built to static files and placed in the `ui/dist/` directory, served by Express at runtime.

**Dev workflow:**
- **UI development**: `ng serve` with proxy config pointing API/WS to `localhost:3001` — instant HMR
- **Backend development**: `tsx watch bin/glassbox.ts serve` — instant restart on file changes
- **Integration build**: `ng build && tsc` — under 3 seconds total on target hardware (M3 Max, 128GB RAM)
- **Full dev mode**: run both `ng serve` (port 4200) and Express (port 3001) simultaneously; Angular proxies `/api/*` and `/ws` to Express

**Preserve regardless:**
- **Dark theme as default** — GitHub Dark inspired with warm amber/gold accent (`#e5a00d`)
- **Theming support** — use a `data-theme` attribute on `<html>` to swap themes. CSS custom properties define all colors; theme switching just redefines the variables under `[data-theme="light"]`, `[data-theme="dark"]`, etc. Respect `prefers-color-scheme` as the default when the user hasn't made an explicit choice. Persist the user's theme preference in settings.
- **CSS custom properties** for all design tokens (see section 8.5)
- **XSS-safe rendering** — Angular's default template binding auto-escapes; never use `[innerHTML]` with untrusted content
- **Static serving** — the built Angular output ships in `ui/dist/` and is served by Express in production

**Theming architecture:**
```css
/* Dark (default) */
:root, :root[data-theme="dark"] {
  --bg-deep: #0d1117;
  --bg-panel: #161b22;
  --accent-primary: #e5a00d;
  --text-primary: #e6edf3;
  /* ... all tokens ... */
}

/* Light */
:root[data-theme="light"] {
  --bg-deep: #ffffff;
  --bg-panel: #f6f8fa;
  --accent-primary: #9a7b0a;
  --text-primary: #1f2328;
  /* ... all tokens ... */
}

/* System preference fallback (no explicit choice saved) */
@media (prefers-color-scheme: light) {
  :root:not([data-theme]) {
    --bg-deep: #ffffff;
    --bg-panel: #f6f8fa;
    /* ... */
  }
}
```

Theme switching in Angular: a `ThemeService` that reads/writes `data-theme` on `document.documentElement` and persists the choice to settings. Components never reference colors directly — always via `var(--token-name)`.

### 8.2 UI Architecture (Angular Components)

The vanilla JS globals from stepwise map to Angular components/services:

| Stepwise (vanilla) | Angular Equivalent |
|---|---|
| `state.js` (global State object) | NgRx store — single source of truth with actions/reducers/selectors |
| `fsm.js` (toolbar state machine) | NgRx feature state with reducer handling FSM transitions (or a dedicated `ExecutionFsmService` if preferred) |
| `api.js` (fetch wrappers) | An `ApiService` — HttpClient wrappers for all REST endpoints |
| `websocket.js` (WS client) | A `WebSocketService` — RxJS Subject/Observable streams per message type |
| `action-log.js` (action renderer) | An `ActionLogComponent` — renders action items with breakpoint pins |
| `breakpoints.js` (toggle/sync) | NgRx feature state + effects for server sync |
| `url-history.js` (MRU helper) | A utility function or small service |
| `ui.js` (DOM updates, settings) | Split across components + NgRx settings feature state with effects for server persistence |
| `test-runner.js` (FSM→API) | NgRx effects — dispatch actions, trigger API calls, handle responses |
| `app.js` (bootstrap) | `AppComponent` + Angular lifecycle (`ngOnInit`) |
| *(new)* | A `ThemeService` — reads/writes `data-theme` on `<html>`, persists preference, respects system default |

Suggested component tree:
```
AppComponent
├── HeaderComponent (logo, settings gear)
├── SettingsPanelComponent (collapsible, all config inputs)
├── MainLayoutComponent
│   ├── SidebarComponent (journey list with checkboxes)
│   ├── ResizeHandleDirective
│   └── ContentComponent
│       ├── ToolbarComponent (play/pause/resume/step/stop + delay slider)
│       ├── TabBarComponent (Actions / Console tabs)
│       ├── ActionLogComponent (action items + breakpoint pins)
│       └── ConsoleOutputComponent (syntax-highlighted log)
└── FooterComponent (connection status, results summary)
```

### 8.3 FSM States and Transitions

```
idle      → play         → running
running   → pause        → paused
running   → breakpoint_hit → paused
running   → finished     → completed
running   → failure      → errored
running   → stop         → idle
paused    → resume       → running
paused    → step         → stepping
paused    → stop         → idle
stepping  → step_complete_at_breakpoint    → paused
stepping  → step_complete_no_breakpoint    → running
stepping  → breakpoint_hit                 → paused
completed → play_again   → idle
errored   → play_again   → idle
```

Button enabled states per FSM state:
```
idle:      play=true   stop=false  pause=false  resume=false  step=false
running:   play=false  stop=true   pause=true   resume=false  step=false
paused:    play=false  stop=true   pause=false  resume=true   step=true
stepping:  play=false  stop=true   pause=false  resume=false  step=false
completed: play=true   stop=false  pause=false  resume=false  step=false
errored:   play=true   stop=false  pause=false  resume=false  step=false
```

### 8.4 UI Layout Structure

```html
<div id="app">
  <header>  Logo | Engine Selector | Settings Gear  </header>
  <aside>   Settings Panel (collapsible)            </aside>
  <div class="main-layout">
    <nav>     Sidebar — Journey List with checkboxes  </nav>
    <div>     Resize Handle (draggable separator)     </div>
    <main>
      <div>   Toolbar — execution controls + delay slider  </div>
      <div>   Tab Bar — Actions | Console + clear/copy buttons  </div>
      <div>   Tab Panels — action log / console output  </div>
    </main>
  </div>
  <footer>  Connection status | Results summary  </footer>
</div>
```

### 8.5 Design Tokens (CSS Variables)

Key tokens to replicate:
```css
--bg-deep: #0d1117;          /* body background */
--bg-panel: #161b22;         /* panel backgrounds */
--bg-surface: #1c2128;       /* elevated surfaces */
--accent-primary: #e5a00d;   /* warm amber/gold */
--accent-hover: #f0b429;
--text-primary: #e6edf3;
--text-secondary: #b1bac4;
--color-success: #2ea043;
--color-danger: #da3633;
--color-breakpoint: #f85149;
--border-color: #30363d;
--font-mono: 'SF Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace;
```

### 8.6 Action Log Rendering

Each action item in the log shows:
1. **Breakpoint pin** (red dot button, click to toggle)
2. **Action index** (1-based number)
3. **Description** (e.g. "Click: [data-testid='submit']")
4. **Status icon** (spinner=running, ✓=complete, ⏸=breakpoint, ✗=failed)

Items get entrance animations (`.action-item-enter`) and status classes (`current`, `completed`, `failed`).

### 8.7 Console Output

- Syntax highlighting via regex rules:
  - File paths → `console-filepath` class
  - Error keywords → `console-error` class
  - Warning keywords → `console-warning` class
  - Success markers → `console-success` class
- Journey separators between different journeys
- Auto-scroll to bottom (unless user has scrolled up)
- All text set via textContent (XSS-safe)

---

## 9. CLI Interface

### 9.1 Commands

```bash
glassbox                    # starts UI server (default = serve)
glassbox serve              # starts UI server
glassbox run                # runs all journeys headless
glassbox run login signup   # runs specific journey(s)
glassbox init               # scaffolds glassbox.config.ts
glassbox --config path      # custom config path
glassbox --port 3002        # custom server port
glassbox --headed           # run in headed mode (for run command)
glassbox --version          # print version
```

### 9.2 CLI Implementation

Uses `commander` for arg parsing. The `serve` command loads config, creates the Express server, and starts listening. The `run` command loads config, discovers journeys, runs them sequentially (spawns child process per journey), and exits with code 0 (all pass) or 1 (any fail).

### 9.3 Run Output Format

```
🚀 Running 3 journey(s)

▶️  [1/3] Login And Edit Profile
✅ Journey "Login And Edit Profile" completed successfully

▶️  [2/3] Signup And Add Todos
❌ Journey "Signup And Add Todos" failed — stopping run.

============================================================
📊 Results Summary
============================================================
  ✅ login-and-edit-profile (4.23s)
  ❌ signup-and-add-todos (2.11s)
  ⏭️  1 journey(s) skipped
────────────────────────────────────────────────────────────
  Passed: 1  Failed: 1  Skipped: 1
============================================================
```

---

## 10. BaseAdapter Implementation Details

The `BaseAdapter` is the abstract class that both the old adapters and the new CDP adapter extend. It provides all the debugger infrastructure:

### 10.1 Static Shared State

```typescript
abstract class BaseAdapter implements BrowserAdapter {
  protected static downloadDir: string;  // /tmp/glassbox-downloads
  private static isPaused: boolean;
  private static stepMode: boolean;
  private static stepsRemaining: number;
  private static actionIndex: number;
  private static breakpoints: Set<number>;
  private static signalsInitialized: boolean;
  private static actionDelay: number;
  private static baseUrl: string;  // from TEST_DOMAIN env var
}
```

### 10.2 Key Methods

```typescript
// Called BEFORE each adapter action
protected async logAndCheckAction(description: string): Promise<void> {
  // 1. Increment actionIndex
  // 2. Write [JSON]{"type":"action","index":N,"status":"start","description":"..."} to stderr
  // 3. If breakpoint matches, write breakpoint JSON, set isPaused=true
  // 4. Call checkPauseState() — blocks while paused
  // 5. Decrement step counter; re-pause when it hits zero
}

// Called AFTER each adapter action
protected logActionComplete(): void {
  // Write [JSON]{"type":"action","index":N,"status":"complete"} to stderr
}

// Called AFTER logActionComplete
protected async addSlowModeDelay(): Promise<void> {
  // If actionDelay > 0, wait in 50ms intervals, polling IPC between intervals
}

// Blocks execution while paused, polling for resume/step/config commands
protected async checkPauseState(): Promise<void> {
  // Poll file-based IPC (readCommand from temp file)
  // Handle: pause, resume, step, config commands
  // Loop with 100ms sleep while isPaused
}

// Resolve relative URLs against baseUrl
protected resolveUrl(url: string): string {
  // Absolute URLs pass through; relative paths get baseUrl prepended
}
```

### 10.3 IPC Signal Handlers (initialized once)

- **stdin listener**: parses JSON lines for `step`, `resume`, `config` commands
- **SIGUSR1**: sets isPaused=true
- **SIGUSR2**: sets isPaused=false

**Note:** Stepwise also had file-based IPC (writing commands to a temp file, polled by the adapter) as a fallback for Playwright worker processes which couldn't receive signals or stdin. Since Glassbox uses a single CDP-based runner in a standard child process, signals and stdin are always available. The file-based IPC fallback is not needed and should be removed.

### 10.4 URL Resolution

The adapter resolves URLs against a base URL from `TEST_DOMAIN`:
- `goto('/login')` → `http://localhost:3000/login`
- `goto('http://example.com')` → `http://example.com` (absolute, pass-through)

---

## 11. Utilities

### 11.1 Error Context Decorator (`@withErrorContext`)

A TypeScript decorator that wraps page object methods to enhance errors with the class name and method name:

```
Error: 
[LoginPage.login]
Element not found: [data-testid="submit"]
```

Supports both legacy decorators and TC39 stage 3 decorators.

### 11.2 Error Formatter

Formats test errors with structured sections for diagnosis:
- Header with journey name, timestamp, duration
- Separated application stack trace (filters out node_modules)
- Identifies page object and journey step from stack
- One-line summary helper for compact output

### 11.3 Wait Utility

```typescript
async function waitForCondition<T>(
  getValue: () => Promise<T>,
  condition: (value: T) => boolean,
  options?: { timeout?: number; interval?: number; errorMessage?: string }
): Promise<T>;
```

Polls a condition until met or timeout (default 5000ms, 250ms interval).

---

## 12. Sample App & Sample Tests (Reference Only — Not Part of Glassbox)

The stepwise repo included a sample app and sample tests as a **separate package** to demonstrate usage. These are consumer-side code and should NOT be part of the Glassbox package itself. They are documented here only to show how consumers use the framework.

### Sample App

A minimal Express app that serves as a test target:

- **Frontend**: Single-page HTML app with login/signup, todo list, profile editing
- **Backend**: Express with in-memory storage, REST endpoints
- **Features**: Auth (signup/login), CRUD todos (add/toggle/delete), profile editing
- **Test data reset**: `POST /api/test-data/reset` clears all state
- **Uses `data-testid` attributes** throughout for reliable selector targeting

### Sample Page Objects (consumer code)

Consumers extend `BasePage` and define selectors + methods:
```
LoginPage — login(), signup(), waitForApp(), getLoginError()
TodoPage — addTodo(), getTodoCount(), toggleTodo(), deleteTodo(), logout()
ProfilePage — navigateToProfile(), updateDisplayName(), waitForSuccess()
```

### Sample Journeys (consumer code)

```
signup-and-add-todos.journey.ts — signs up, adds todos, toggles, deletes
login-and-edit-profile.journey.ts — signs up, logs in, edits profile name
```

### Consumer package.json pattern

```json
{
  "dependencies": {
    "glassbox": "^1.0.0"
  },
  "scripts": {
    "test:ui": "glassbox serve",
    "test:run": "glassbox run"
  }
}
```

Key selectors used in the sample app (for reference):
```
[data-testid="login-tab"], [data-testid="signup-tab"]
[data-testid="login-username"], [data-testid="login-password"], [data-testid="login-submit"]
[data-testid="app-section"], [data-testid="todo-input"], [data-testid="add-todo"]
[data-testid="todo-count"], [data-testid="display-name"], [data-testid="profile-tab"]
```

---

## 13. Key Design Decisions to Preserve

1. **Convention over configuration** — works with zero config. Journeys glob defaults to `./journeys/**/*.journey.ts`.

2. **Page Object Model** — Glassbox provides `BasePage` as an exported class. Consumers extend it in their own projects. The package never contains page object implementations for specific apps.

3. **Class-based journeys** — constructor receives adapter, `execute()` runs the flow. Also supports function-based journeys as fallback. Journeys are consumer code discovered at runtime via glob.

4. **Public API surface** — Glassbox exports: `BasePage`, `BrowserContextPage`, `BrowserAdapter` type, `defineConfig`, `loadConfig`, `waitForCondition`, `withErrorContext`, `formatTestError`, `getErrorSummary`. This is what consumers `import from 'glassbox'`.

4. **Breakpoints are per-journey, per-action-index** — stored server-side in `.glassbox/settings.json`, synced via REST API.

5. **Child process isolation** — each journey runs in its own Node.js process. Config passed via env vars. Communication via stderr JSON + file-based IPC.

6. **TypeScript for core, vanilla JS for UI** — the dashboard has zero build step. Just static HTML/CSS/JS served by Express.

7. **File-based settings** — project-scoped (`.glassbox/` directory), survives browser/domain changes unlike localStorage.

8. **Lifecycle hooks** — globalSetup runs once (abort all on failure), beforeEach/afterEach per journey, globalTeardown once at end.

9. **Crash state cleanup** — clean Chrome's Preferences file and Sessions directory before launch to prevent "didn't shut down correctly" dialogs.

10. **Graceful degradation** — IPC failures are silent, signal setup wrapped in try/catch, all DOM updates handle null elements.

---

## 14. What Changes in Glassbox vs Stepwise

| Aspect | Stepwise (old) | Glassbox (new) |
|--------|---------------|----------------|
| Browser interaction | PuppeteerAdapter + PlaywrightAdapter | Single CDPAdapter (direct CDP) |
| Peer dependencies | puppeteer OR playwright (optional) | None — uses raw CDP WebSocket |
| Engine selector in UI | Puppeteer / Playwright toggle | Remove — single engine |
| Browser launch | Via puppeteer.launch() or playwright.chromium.launch() | Direct child_process.spawn of Chrome + CDP connect |
| CDP access | Indirect (page.createCDPSession()) | Direct (WebSocket to devtools endpoint) |
| AI data access | Not available | First-class: DOM state, console, network, accessibility |
| Package name | @mechris3/stepwise-automation | glassbox |
| Config file | stepwise.config.ts | glassbox.config.ts |
| Settings directory | .stepwise/ | .glassbox/ |
| Config adapters field | `adapters: ['puppeteer', 'playwright']` | Remove — no adapter choice |
| Runner scripts | Separate Puppeteer/Playwright runners | Single CDP runner |

### 14.1 Things to Remove

- `src/adapters/puppeteer-adapter.ts`
- `src/adapters/playwright-adapter.ts`
- `src/adapters/browser-adapter.interface.ts` (keep the interface shape, but as the CDP adapter's contract)
- `src/runners/playwright/` directory
- `src/runners/puppeteer/` directory (rewrite as single `src/runner/`)
- `src/utils/puppeteer-utils.ts`
- `src/utils/playwright-utils.ts`
- Engine selector in UI
- All references to "tool" / "engine" selection
- `peerDependencies` on puppeteer/playwright
- `detectEngines()` function
- Redux DevTools extension auto-discovery (unless you want to keep it)

### 14.2 Things to Add

- `src/adapters/cdp-adapter.ts` — the CDP implementation
- `src/cdp/connection.ts` — CDP WebSocket connection management
- `src/cdp/launcher.ts` — Chrome process spawning + discovery of devtools endpoint
- `src/ai/` directory — AI data exposure layer (DOM, console, network, accessibility)
- AI-related REST endpoints (`/api/ai/dom`, `/api/ai/console`, `/api/ai/network`, etc.)
- Passive CDP event collectors (console messages, network log, JS errors)

### 14.3 Things to Keep As-Is

- `src/adapters/base-adapter.ts` — the debugger infrastructure (breakpoints, pause, step, slow mode, IPC)
- `src/server/` — Express server, WebSocket manager, TestExecutor, journey discovery, settings storage, breakpoint storage
- `src/config.ts` — with adapters field removed and renamed config file
- `src/page-objects/base.page.ts` — page object base class
- `src/page-objects/browser-context.page.ts` — browser context page object
- `src/utils/ipc.ts` — remove (file-based IPC not needed; signals + stdin are sufficient)
- `src/utils/browser-discovery.ts` — cross-platform browser detection
- `src/utils/error-formatter.ts` — error formatting
- `src/utils/page-object-error.ts` — @withErrorContext decorator
- `src/utils/wait-utils.ts` — waitForCondition helper
- `bin/glassbox.ts` — CLI (simplify: remove --tool flag, remove engine resolution)
- `ui/` — rewrite as Angular app (same layout, UX, design tokens, and dark theme — just proper components)

---

## 15. Project Structure & Development Setup

### 15.1 Single Repository (Not a Monorepo)

Glassbox is a single npm package — no Nx, no Lerna, no workspaces. The repo contains the package source plus sibling directories for the sample app and sample tests (which are consumers, not part of the package).

```
glassbox/
├── package.json                 # The Glassbox package
├── tsconfig.json
├── bin/
│   └── glassbox.ts              # CLI entry point
├── src/
│   ├── index.ts                 # Public API exports
│   ├── config.ts                # defineConfig, loadConfig
│   ├── cdp/
│   │   ├── connection.ts        # CDP WebSocket connection
│   │   ├── launcher.ts          # Chrome spawn + endpoint discovery
│   │   └── domains.ts           # Typed CDP domain helpers (optional)
│   ├── adapters/
│   │   ├── browser-adapter.interface.ts  # BrowserAdapter interface
│   │   ├── base-adapter.ts      # Debugger infrastructure (breakpoints, IPC, etc.)
│   │   └── cdp-adapter.ts       # CDP implementation of BrowserAdapter
│   ├── ai/
│   │   ├── collectors.ts        # Passive CDP event collectors
│   │   ├── queries.ts           # On-demand state queries
│   │   └── types.ts             # AI data types (DOMSnapshot, ConsoleMessage, etc.)
│   ├── page-objects/
│   │   ├── base.page.ts         # BasePage class
│   │   └── browser-context.page.ts  # BrowserContextPage
│   ├── runner/
│   │   ├── run-journey.ts       # Single journey runner (child process)
│   │   └── run-all-journeys.ts  # Batch runner for CLI
│   ├── server/
│   │   ├── index.ts             # Express server + REST API
│   │   ├── websocket.ts         # WebSocket manager
│   │   ├── test-executor.ts     # Journey orchestrator
│   │   ├── journey-discovery.ts # Glob-based journey finder
│   │   ├── settings-storage.ts  # .glassbox/settings.json
│   │   └── breakpoint-storage.ts # In-memory breakpoint state
│   └── utils/
│       ├── browser-discovery.ts # Chrome/Brave/Edge auto-detection
│       ├── error-formatter.ts   # Structured error formatting
│       ├── page-object-error.ts # @withErrorContext decorator
│       └── wait-utils.ts        # waitForCondition
├── ui/                          # Angular app
│   ├── angular.json
│   ├── src/
│   │   ├── app/
│   │   │   ├── app.component.ts
│   │   │   ├── components/
│   │   │   │   ├── header/
│   │   │   │   ├── settings-panel/
│   │   │   │   ├── sidebar/
│   │   │   │   ├── toolbar/
│   │   │   │   ├── action-log/
│   │   │   │   ├── console-output/
│   │   │   │   └── footer/
│   │   │   └── services/
│   │   │       ├── api.service.ts
│   │   │       ├── websocket.service.ts
│   │   │       └── theme.service.ts
│   │   ├── store/
│   │   │   ├── execution/
│   │   │   │   ├── execution.actions.ts
│   │   │   │   ├── execution.reducer.ts
│   │   │   │   ├── execution.selectors.ts
│   │   │   │   └── execution.effects.ts
│   │   │   ├── journeys/
│   │   │   ├── breakpoints/
│   │   │   ├── settings/
│   │   │   └── app.state.ts
│   │   ├── styles.css
│   │   └── index.html
│   └── dist/                    # Angular build output (served by Express)
├── dist/                        # Backend build output (tsc)
├── sample-app/                  # Consumer: test target (NOT part of package)
│   ├── package.json
│   └── server.js
└── sample-tests/                # Consumer: journeys + page objects (NOT part of package)
    ├── package.json
    ├── glassbox.config.ts
    ├── journeys/
    └── page-objects/
```

### 15.2 Symlink Strategy for Local Development

The sample-tests project depends on `glassbox` as if it were installed from npm. During development, a symlink avoids the build-publish-install cycle:

```bash
# In the glassbox root:
npm link

# In sample-tests/:
npm link glassbox
```

This creates a symlink: `sample-tests/node_modules/glassbox` → the glassbox package root.

**Resolution chain:**
```
sample-tests/journeys/login.journey.ts
  → import { BasePage } from 'glassbox'
  → resolves via symlink to glassbox/package.json
  → "main": "dist/src/index.js"
  → reads compiled output from dist/
```

**Development workflow with watch:**
```bash
# Terminal 1: Backend TypeScript watch (rebuilds dist/ on change)
tsc --watch

# Terminal 2: Angular UI watch (rebuilds ui/dist/ on change)
cd ui && ng build --watch

# Terminal 3: Run the dashboard against sample-app
cd sample-tests && npx glassbox serve

# Terminal 4: Run the sample app
cd sample-app && node server.js
```

Changes to glassbox source → tsc rebuilds `dist/` in <1s → sample-tests immediately picks up the new code via the symlink. No reinstall needed.

### 15.3 package.json Fields

```json
{
  "name": "glassbox",
  "main": "dist/src/index.js",
  "types": "dist/src/index.d.ts",
  "bin": {
    "glassbox": "dist/bin/glassbox.js"
  },
  "files": [
    "dist/",
    "ui/dist/",
    "README.md",
    "LICENSE"
  ]
}
```

Key points:
- `"main"` points to compiled backend output
- `"bin"` points to compiled CLI
- `"files"` includes both `dist/` (backend) and `ui/dist/` (Angular build output) — this is what gets published to npm
- The Express server serves static files from `ui/dist/` (resolved relative to the compiled server code)

### 15.4 Angular Build Output Location

The Angular app's `outputPath` in `angular.json` should write to `ui/dist/`:

```json
{
  "architect": {
    "build": {
      "options": {
        "outputPath": "../ui/dist"
      }
    }
  }
}
```

The Express server resolves this at runtime:
```typescript
// In compiled form, __dirname is dist/src/server/
// Go up to package root, then into ui/dist/
const uiPath = path.resolve(__dirname, '../../../ui/dist');
app.use(express.static(uiPath));
```

---

## 16. Dependencies

### 16.1 Runtime Dependencies (keep)```json
{
  "commander": "^12.1.0",    // CLI arg parsing
  "cors": "^2.8.5",          // Express CORS middleware
  "express": "^4.21.0",      // HTTP server
  "glob": "^11.0.0",         // Journey file discovery
  "jiti": "^2.6.1",          // TypeScript config file loading
  "tsx": "^4.21.0",          // TypeScript execution for journey files
  "ws": "^8.18.0"            // WebSocket server
}
```

### 16.2 Runtime Dependencies (remove)

- `puppeteer` (was optional peer dep)
- `playwright` (was optional peer dep)

### 16.3 Dev Dependencies

```json
{
  "@types/express": "^5.0.0",
  "@types/node": "^22.0.0",
  "@types/ws": "^8.5.0",
  "typescript": "^5.6.0",
  "vitest": "^2.1.0"
}
```

---

## 17. CDP Connection Strategy

### 17.1 Launching Chrome

```typescript
import { spawn } from 'child_process';

function launchChrome(executablePath: string, args: string[]): ChildProcess {
  return spawn(executablePath, [
    '--remote-debugging-port=0',  // random port, read from stderr
    ...args,
  ], { stdio: ['pipe', 'pipe', 'pipe'] });
}
```

Chrome outputs the DevTools WebSocket URL to stderr:
```
DevTools listening on ws://127.0.0.1:PORT/devtools/browser/UUID
```

Parse this line to get the WebSocket endpoint.

### 17.2 Connecting to CDP

```typescript
import WebSocket from 'ws';

async function connectCDP(wsUrl: string): Promise<CDPConnection> {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });
  return new CDPConnection(ws);
}
```

### 17.3 CDP Command/Event Pattern

```typescript
class CDPConnection {
  private ws: WebSocket;
  private id = 0;
  private callbacks = new Map<number, { resolve, reject }>();

  async send(method: string, params?: object): Promise<any> {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  on(event: string, handler: (params: any) => void): void {
    // Register event listener for CDP events
  }
}
```

### 17.4 Page Target Management

After connecting to the browser-level CDP endpoint:
1. `Target.getTargets()` — find existing page targets
2. `Target.createTarget({url: 'about:blank'})` — create new tab if needed
3. `Target.attachToTarget({targetId, flatten: true})` — attach to page
4. Now you have a session for that page — send Page, DOM, Runtime, Network commands

---

## 18. Testing Strategy

### 18.1 Unit Tests (vitest)

Test the same things stepwise tested:
- Config loading and validation
- IPC read/write/clear
- Browser discovery (mock fs.existsSync)
- Error formatter output
- waitForCondition behavior
- BaseAdapter breakpoint/pause/step logic (mock the abstract methods)
- CLI arg parsing

### 18.2 Integration Tests

- CDP connection lifecycle
- Adapter method implementations against a real Chrome instance
- Server API endpoints (supertest)
- WebSocket message broadcasting

### 18.3 Property-Based Tests

Stepwise used `fast-check` for property tests on:
- `evaluate()` dispatch behavior
- `evaluate()` error propagation
- `evaluate()` logging
- `clearSession()` preservation guarantees

---

## 19. Implementation Priority Order

Suggested order to build Glassbox:

1. **Project scaffold** — package.json, tsconfig, bin, basic directory structure
2. **Config system** — defineConfig, loadConfig (simplified, no adapters field)
3. **CDP launcher** — spawn Chrome, parse WebSocket URL, connect
4. **CDP connection** — command/response handling, event subscriptions
5. **CDPAdapter** — implement all 24 BrowserAdapter methods
6. **BaseAdapter** — port the debugger infrastructure (breakpoints, IPC, logging)
7. **Page objects** — BasePage, BrowserContextPage (unchanged)
8. **Journey runner** — single journey child process script
9. **Server** — Express + WebSocket + TestExecutor + journey discovery
10. **Dashboard UI** — port the vanilla HTML/CSS/JS dashboard
11. **CLI** — commander-based with serve/run/init commands
12. **AI data layer** — passive collectors + query endpoints
13. **Batch runner** — CLI `run` command with sequential execution + summary
14. **Browser discovery** — cross-platform Chrome/Brave/Edge detection
15. **Settings persistence** — .glassbox/settings.json

---

## 20. Behavioral Notes

### 20.1 Error Handling Philosophy

- **Graceful degradation everywhere** — IPC failures, signal setup failures, DOM null elements — all silent
- **Child process errors** → broadcast as WebSocket `error` messages, never crash the server
- **globalSetup failure** → abort entire run, mark all journeys as skipped
- **beforeEach/afterEach/globalTeardown failure** → log but continue
- **Journey failure** → stop the batch run (stop-on-first-failure)

### 20.2 Browser Lifecycle

- Kill existing browser processes before launching (by process name, derived from executable path)
- Clean crash state from Chrome Preferences file
- Remove Session/Tabs files to prevent "Restore pages?" dialog
- Close extra tabs after launch (profile may restore previous tabs)
- Keep-browser-open mode: only for single-journey runs

### 20.3 Action Logging Protocol

Every adapter method must:
1. Call `await this.logAndCheckAction('Description: selector')` — BLOCKS if paused/breakpoint
2. Perform the actual browser operation
3. Call `this.logActionComplete()`
4. Call `await this.addSlowModeDelay()` — BLOCKS during delay, polls IPC

The description format: `"Verb: selector"` e.g. `"Click: [data-testid='submit']"`, `"Fill: #email"`, `"Navigate to: http://localhost:3000"`, `"Evaluate script"`, `"Wait: 500ms"`.

### 20.4 Angular/React/Vue Compatibility

The stepwise adapters used custom utilities (`puppeteer-utils.ts`, `playwright-utils.ts`) that:
- Dispatch proper DOM events after setting input values (input, change, blur for Angular)
- Use `dispatchEvent(new Event('input', {bubbles: true}))` after setting `.value`
- Handle strict mode in Playwright (use `.first()` for multiple matches)

The CDP adapter should replicate this event dispatching in `fill()`:
```javascript
// In Runtime.evaluate for fill():
element.value = value;
element.dispatchEvent(new Event('input', { bubbles: true }));
element.dispatchEvent(new Event('change', { bubbles: true }));
element.dispatchEvent(new Event('blur', { bubbles: true }));
```

---

## 21. Quick Reference: File-by-File Port Guide

| Stepwise File | Glassbox Action |
|---|---|
| `src/index.ts` | Port — update exports (remove adapter exports, add AI exports) |
| `src/config.ts` | Port — remove `adapters` field, rename config file, remove `detectEngines` |
| `src/adapters/base-adapter.ts` | Keep as-is (core debugger infrastructure) |
| `src/adapters/browser-adapter.interface.ts` | Keep interface, remove from exports if desired |
| `src/adapters/puppeteer-adapter.ts` | Replace with `src/adapters/cdp-adapter.ts` |
| `src/adapters/playwright-adapter.ts` | Delete |
| `src/page-objects/base.page.ts` | Keep as-is |
| `src/page-objects/browser-context.page.ts` | Keep as-is |
| `src/runners/puppeteer/run-journey.ts` | Rewrite as `src/runner/run-journey.ts` (use CDP launcher) |
| `src/runners/puppeteer/run-all-journeys.ts` | Rewrite as `src/runner/run-all-journeys.ts` |
| `src/runners/puppeteer/browser.ts` | Replace with `src/cdp/launcher.ts` |
| `src/runners/playwright/*` | Delete |
| `src/server/index.ts` | Port — remove engine-specific routes, add AI endpoints |
| `src/server/websocket.ts` | Keep as-is |
| `src/server/test-executor.ts` | Port — remove tool selection logic |
| `src/server/journey-discovery.ts` | Keep as-is |
| `src/server/settings-storage.ts` | Port — rename directory from .stepwise to .glassbox |
| `src/utils/ipc.ts` | Delete — file-based IPC was a Playwright workaround; use signals + stdin only |
| `src/utils/browser-discovery.ts` | Keep as-is |
| `src/utils/error-formatter.ts` | Keep as-is |
| `src/utils/page-object-error.ts` | Keep as-is |
| `src/utils/wait-utils.ts` | Keep as-is |
| `src/utils/puppeteer-utils.ts` | Delete (logic moves into cdp-adapter) |
| `src/utils/playwright-utils.ts` | Delete |
| `src/utils/redux-devtools.ts` | Optional — keep if you want extension support |
| `bin/stepwise.ts` | Port as `bin/glassbox.ts` — remove --tool flag |
| `ui/*` | Rewrite as Angular app — same layout/UX, remove engine selector |

---

## 22. Summary

Glassbox is a focused rewrite that:
1. **Simplifies** by going CDP-direct (one path instead of two adapter abstractions)
2. **Empowers AI** by exposing rich browser state data (DOM, console, network, accessibility)
3. **Preserves** the debugger UX (breakpoints, pause, step, slow mode, visual dashboard)
4. **Preserves** the developer UX (page objects, journeys, zero-config defaults, lifecycle hooks)
5. **Preserves** the dashboard UI (dark theme, amber accents, FSM-driven toolbar, action log with breakpoint pins)

The core insight: Puppeteer and Playwright are both thin wrappers over CDP anyway. By going direct, Glassbox gets simpler code, fewer dependencies, and unrestricted access to every CDP domain for the AI data layer.

---

## 23. What Glassbox Ships vs. What Consumers Provide

| Glassbox Ships (this package) | Consumers Provide (their projects) |
|---|---|
| `BasePage` class | Page object classes that extend `BasePage` |
| `BrowserContextPage` class | Journey files (`.journey.ts`) |
| `BrowserAdapter` interface + CDP implementation | Selectors and interaction logic |
| Runner (discovers + executes journeys) | `glassbox.config.ts` (optional) |
| Dashboard UI (static HTML/CSS/JS) | Lifecycle hook scripts (setup/teardown) |
| CLI (`glassbox serve`, `glassbox run`) | The application under test |
| Express server + WebSocket | — |
| Debugger infrastructure (breakpoints, IPC) | — |
| AI data exposure layer | — |
| Browser auto-discovery + launcher | — |
| Config system (`defineConfig`, `loadConfig`) | — |
| Utility exports (`waitForCondition`, `@withErrorContext`, error formatters) | — |

The package is a **tool** — it runs, observes, and controls. The consumer provides the **what** — which pages exist, which flows to test, and which app to target.
