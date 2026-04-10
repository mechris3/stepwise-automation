# @mechris3/stepwise-automation

Debugger-style browser automation test runner with live execution control, breakpoints, and a visual dashboard.

## Features

- **Breakpoints** — set breakpoints on any action and pause execution right before it runs
- **Pause / Resume / Step** — full debugger-style control over test execution
- **Dual engine support** — write tests once, run with Puppeteer or Playwright via an adapter pattern
- **Visual dashboard** — web-based UI for selecting journeys, watching actions live, and toggling breakpoints
- **Page Object Model** — extend `BasePage` to encapsulate selectors and interactions per page
- **Journey-first testing** — organize tests as end-to-end user journeys
- **Browser auto-discovery** — automatically detects Chrome, Brave, Edge, and Chromium on macOS, Windows, and Linux
- **Zero config** — works out of the box with sensible defaults; config file is optional
- **Headless CI mode** — run all journeys headless with exit codes for CI pipelines
- **Test data lifecycle hooks** — configurable hooks for setup/teardown at global and per-journey levels

## Installation

Add the package and at least one browser engine to your `package.json` dependencies:

```json
{
  "dependencies": {
    "@mechris3/stepwise-automation": "^0.1.0",
    "puppeteer": "^22.0.0"
  }
}
```

Or use Playwright instead (or both):

```json
{
  "dependencies": {
    "@mechris3/stepwise-automation": "^0.1.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.40.0"
  }
}
```

> **Important:** When using the Playwright engine, `@playwright/test` must be installed in your consuming project as a dev dependency. The stepwise package resolves Playwright from your project's `node_modules` at runtime.

Then install:

```bash
npm install
```

## Quick Start

1. Install the package and a browser engine (see above).

2. Understand `BasePage` — the base class all page objects extend. It takes a `BrowserAdapter` in its constructor and exposes convenience methods like `click`, `fill`, `goto`, `waitForSelector`, etc. You never call the adapter directly; `BasePage` delegates for you:

```typescript
// This is what BasePage looks like (provided by the package — you don't write this)
import { BrowserAdapter } from './adapters/browser-adapter.interface';

export class BasePage {
  constructor(protected adapter: BrowserAdapter) {}

  async click(selector: string): Promise<void>                    { await this.adapter.click(selector); }
  async fill(selector: string, value: string): Promise<void>      { await this.adapter.fill(selector, value); }
  async getText(selector: string): Promise<string>                 { return this.adapter.getText(selector); }
  async waitForSelector(selector: string): Promise<void>           { await this.adapter.waitForSelector(selector); }
  async isVisible(selector: string): Promise<boolean>              { return this.adapter.isVisible(selector); }
  async waitForHidden(selector: string): Promise<void>             { await this.adapter.waitForHidden(selector); }
  async waitForTimeout(ms: number): Promise<void>                  { await this.adapter.waitForTimeout(ms); }
  async clickAndWaitForNavigation(selector: string): Promise<void> { await this.adapter.clickAndWaitForNavigation(selector); }
  async isDisabled(selector: string): Promise<boolean>             { return this.adapter.isDisabled(selector); }
  async getInputValue(selector: string): Promise<string>           { return this.adapter.getInputValue(selector); }
  async countElements(selector: string): Promise<number>           { return this.adapter.countElements(selector); }
  async getAttribute(selector: string, attr: string): Promise<string | null> { return this.adapter.getAttribute(selector, attr); }
  async getCurrentUrl(): Promise<string>                           { return this.adapter.getCurrentUrl(); }
  async goto(url: string): Promise<void>                           { await this.adapter.goto(url); }
  async evaluate<T>(script: () => T): Promise<T>                   { return this.adapter.evaluate(script); }
  async clickAndDownload(selector: string): Promise<DownloadResult> { return this.adapter.clickAndDownload(selector); }
  async clearDownloads(): Promise<void>                              { await this.adapter.clearDownloads(); }
}
```

3. Create a page object at `page-objects/login.page.ts`. Extend `BasePage` and use `this.<method>` to interact with the page:

```typescript
// page-objects/login.page.ts
import { BasePage } from '@mechris3/stepwise-automation';

export class LoginPage extends BasePage {
  private selectors = {
    username: '[data-testid="username"]',
    password: '[data-testid="password"]',
    submit: '[data-testid="submit"]',
    dashboard: '[data-testid="dashboard"]',
  };

  async login(username: string, password: string): Promise<void> {
    await this.fill(this.selectors.username, username);
    await this.fill(this.selectors.password, password);
    await this.click(this.selectors.submit);
  }

  async waitForDashboard(): Promise<void> {
    await this.waitForSelector(this.selectors.dashboard);
  }
}
```

No need to write a constructor — `BasePage`'s constructor handles the adapter. Just extend and go.

4. Create a journey file at `journeys/login.journey.ts`:

```typescript
// journeys/login.journey.ts
import type { BrowserAdapter } from '@mechris3/stepwise-automation';
import { LoginPage } from '../page-objects/login.page';

export class LoginJourney {
  constructor(private adapter: BrowserAdapter) {}

  async execute(): Promise<void> {
    const loginPage = new LoginPage(this.adapter);

    await loginPage.goto('/login');
    await loginPage.login('testuser', 'password123');
    await loginPage.waitForDashboard();
  }
}
```

The runner auto-detects class-based journeys (any exported class with a `constructor(adapter)` and `async execute()` method).

5. Add scripts to your `package.json`:

```json
{
  "scripts": {
    "test:ui": "stepwise-automation serve",
    "test:run": "stepwise-automation run"
  }
}
```

6. Start the dashboard:

```bash
npm run test:ui
```

Open `http://localhost:3001` to see the dashboard. Set the Target URL in the settings panel to point at your running application.

That's it — no config file needed. The runner discovers journeys matching `./journeys/**/*.journey.ts` by default.

## Configuration (Optional)

Create a `stepwise.config.ts` in your project root to customize behavior:

```typescript
import { defineConfig } from '@mechris3/stepwise-automation';

export default defineConfig({
  // Glob pattern for journey files (default: './journeys/**/*.journey.ts')
  journeys: './journeys/**/*.journey.ts',

  // Browser engine priority (default: all installed engines)
  adapters: ['puppeteer', 'playwright'],

  // Browser launch configuration
  browser: {
    executablePath: '/path/to/chrome',
    userDataDir: '/path/to/profile',
    profileDir: 'Default',
    defaultViewport: { width: 1280, height: 720 },
    headless: false,
  },

  // Dashboard server port (default: 3001)
  server: { port: 3001 },

  // Test data lifecycle hooks (all optional, paths relative to this config file)
  testData: {
    globalSetup: './helpers/global-setup.ts',
    beforeEach: './helpers/before-each.ts',
    afterEach: './helpers/after-each.ts',
    globalTeardown: './helpers/global-teardown.ts',
  },

  // Redux DevTools — auto-detected from userDataDir if not set
  devtools: { redux: true, reduxPath: '/path/to/redux-devtools' },
});
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `journeys` | `string` | `'./journeys/**/*.journey.ts'` | Glob pattern for journey files |
| `adapters` | `string[]` | All installed | Browser engines to enable: `'puppeteer'` and/or `'playwright'` |
| `browser.executablePath` | `string` | Auto-detected | Absolute path to the browser executable |
| `browser.userDataDir` | `string` | Auto-detected | Path to the browser's user data directory (persistent profile) |
| `browser.profileDir` | `string` | `'Default'` | Profile subdirectory within `userDataDir` |
| `browser.defaultViewport` | `{ width, height }` | `{ 1280, 720 }` | Browser viewport dimensions |
| `browser.headless` | `boolean` | `false` | Run browsers without a visible window |
| `server.port` | `number` | `3001` | Dashboard server port |
| `testData.globalSetup` | `string` | — | Module called once before all journeys start |
| `testData.beforeEach` | `string` | — | Module called before each individual journey |
| `testData.afterEach` | `string` | — | Module called after each individual journey |
| `testData.globalTeardown` | `string` | — | Module called once after all journeys complete |
| `devtools.redux` | `boolean` | `false` | Enable Redux DevTools extension on launch |
| `devtools.reduxPath` | `string` | Auto-detected | Path to Redux DevTools browser extension directory |

## Writing Page Objects

Page objects encapsulate selectors and interactions for a specific page or component. Extend `BasePage` to get access to the `BrowserAdapter` via `this.adapter`:

```typescript
// page-objects/profile.page.ts
import { BasePage } from '@mechris3/stepwise-automation';
import type { BrowserAdapter } from '@mechris3/stepwise-automation';

export class ProfilePage extends BasePage {
  private selectors = {
    displayName: '[data-testid="display-name"]',
    email: '[data-testid="email"]',
    saveButton: '[data-testid="save-profile"]',
  };

  constructor(adapter: BrowserAdapter) {
    super(adapter);
  }

  async updateDisplayName(name: string): Promise<void> {
    await this.adapter.waitForSelector(this.selectors.displayName);
    await this.adapter.fill(this.selectors.displayName, name);
  }

  async save(): Promise<void> {
    await this.adapter.click(this.selectors.saveButton);
  }

  async getEmail(): Promise<string> {
    return this.adapter.getText(this.selectors.email);
  }
}
```

`BasePage` provides the adapter as `this.adapter` (protected). It also exposes shorthand methods that delegate to the adapter, so `this.click(sel)` and `this.adapter.click(sel)` are equivalent — use whichever you prefer.

`BasePage` shorthand methods (all delegate to `this.adapter`):

- `click(selector)` — click an element
- `fill(selector, value)` — type into an input
- `getText(selector)` — get element text content
- `waitForSelector(selector)` — wait for element to appear
- `isVisible(selector)` — check element visibility
- `waitForHidden(selector)` — wait for element to disappear
- `waitForTimeout(ms)` — wait a fixed duration
- `clickAndWaitForNavigation(selector)` — click and wait for page load
- `isDisabled(selector)` — check if element is disabled
- `getInputValue(selector)` — get current input value
- `countElements(selector)` — count matching elements
- `getAttribute(selector, attribute)` — get an attribute value
- `getCurrentUrl()` — get the current page URL
- `goto(url)` — navigate to a URL (resolved against Target URL from settings)
- `evaluate(script)` — execute JavaScript in the page context
- `clickAndDownload(selector)` — click a download trigger and get the file path and suggested filename
- `clearDownloads()` — remove all downloaded files from the download directory

For browser-level operations (session management, clipboard, file uploads), use `BrowserContextPage`:

- `clearSession()` — clear all cookies, localStorage, and sessionStorage
- `readClipboard()` — read text from the system clipboard
- `uploadFile(selector, filePath)` — upload a file to a file input element
- `selectByIndex(selector, index)` — select a dropdown option by index
- `selectByValue(selector, value)` — select a dropdown option by its `value` attribute
- `selectByText(selector, text, exact?)` — select a dropdown option by visible text (contains match by default, exact match with `exact: true`)
- `clickAndDownload(selector)` — click a download trigger and get the file path and suggested filename
- `clearDownloads()` — remove all downloaded files from the download directory

const context = new BrowserContextPage(adapter);
await context.clearSession();
await context.uploadFile('#file-input', '/path/to/file.png');
await context.selectByIndex('#dropdown', 2);
const clipboard = await context.readClipboard();
```

All 23 methods above make up the complete `BrowserAdapter` interface. Every method is available on both Puppeteer and Playwright adapters.

### File Downloads

`BasePage` provides `clickAndDownload` and `clearDownloads` as inherited convenience methods. Your page objects use them without referencing the adapter directly:

```typescript
// page-objects/reports.page.ts
import { BasePage } from '@mechris3/stepwise-automation';
import type { DownloadResult } from '@mechris3/stepwise-automation';
import * as fs from 'fs';

export class ReportsPage extends BasePage {
  private selectors = {
    exportCsvButton: '[data-testid="export-csv"]',
  };

  /** Simple download — returns metadata for the caller to inspect */
  async downloadCsvReport(): Promise<DownloadResult> {
    return this.clickAndDownload(this.selectors.exportCsvButton);
  }

  /** Download + verify filename + return contents for assertions */
  async downloadAndVerifyCsvReport(expectedFilename: string): Promise<string> {
    const result = await this.clickAndDownload(this.selectors.exportCsvButton);

    if (result.suggestedFilename !== expectedFilename) {
      throw new Error(`Expected "${expectedFilename}", got "${result.suggestedFilename}"`);
    }

    return fs.readFileSync(result.filePath, 'utf-8');
  }
}
```

Use it in a journey:

```typescript
// journeys/export-report.journey.ts
import type { BrowserAdapter } from '@mechris3/stepwise-automation';
import { ReportsPage } from '../page-objects/reports.page';

export class ExportReportJourney {
  constructor(private adapter: BrowserAdapter) {}

  async execute(): Promise<void> {
    const reportsPage = new ReportsPage(this.adapter);
    await reportsPage.goto('/reports');

    // Simple download — just verify it happened
    const result = await reportsPage.downloadCsvReport();
    console.log(`Downloaded: ${result.suggestedFilename}`);

    // Download + content verification
    const csv = await reportsPage.downloadAndVerifyCsvReport('monthly-report.csv');
    if (!csv.includes('Total Revenue')) {
      throw new Error('CSV missing expected column');
    }

    // Clean up between tests
    await reportsPage.clearDownloads();
  }
}
```

Downloaded files are stored in a temporary directory and cleaned up by `clearDownloads()`. The adapter handles browser-specific download mechanics (CDP for Puppeteer, download events for Playwright) — your page objects just call the inherited `BasePage` methods.

## Writing Journeys

Journeys are test files that represent end-to-end user flows. They use page objects to interact with the application.

### Naming Convention

Journey files must match the glob pattern (default: `./journeys/**/*.journey.ts`). The filename (without `.journey.ts`) becomes the journey ID. Kebab-case filenames are converted to Title Case for display in the dashboard (e.g. `create-profile` → "Create Profile").

### Class-Based Journeys (Preferred)

```typescript
// journeys/create-profile.journey.ts
import type { BrowserAdapter } from '@mechris3/stepwise-automation';
import { LoginPage } from '../page-objects/login.page';
import { ProfilePage } from '../page-objects/profile.page';

export class CreateProfileJourney {
  constructor(private adapter: BrowserAdapter) {}

  async execute(): Promise<void> {
    const loginPage = new LoginPage(this.adapter);
    const profilePage = new ProfilePage(this.adapter);

    await loginPage.goto('/login');
    await loginPage.login('testuser', 'password123');

    await profilePage.goto('/profile');
    await profilePage.updateDisplayName('New Name');
    await profilePage.save();
  }
}
```

### Function-Based Journeys

```typescript
// journeys/login.journey.ts
import type { BrowserAdapter } from '@mechris3/stepwise-automation';
import { LoginPage } from '../page-objects/login.page';

export default async function loginJourney(adapter: BrowserAdapter): Promise<void> {
  const loginPage = new LoginPage(adapter);
  await loginPage.goto('/login');
  await loginPage.login('testuser', 'password123');
}
```

Both styles are auto-detected. Class-based journeys must have a `constructor(adapter)` and an `async execute()` method.

## Dashboard UI

### Starting the Dashboard

```bash
npx stepwise-automation serve
```

This starts the Express server and opens the visual dashboard at `http://localhost:3001` (or your configured port).

### Layout

The dashboard has a three-column layout:

- **Journey list** — all discovered journeys with checkboxes and status indicators
- **Action log** — live stream of actions as they execute, with breakpoint pin icons
- **Console** — stdout/stderr output from the test process

### Settings Panel

Click the gear icon to open the settings panel. All settings persist to `.stepwise/settings.json` via the server. Settings are project-scoped and survive browser or domain changes:

- **Target URL** — base URL of the application under test
- **Browser Path** — path to the browser executable (auto-detected)
- **User Data Dir** — path to the browser profile directory (auto-detected)
- **Viewport** — content area dimensions with preset dropdown
- **Action Delay** — milliseconds between each action (slow mode)
- **DevTools** — open Chrome DevTools on launch
- **Keep Browser Open** — keep the browser open after a journey completes

### Breakpoints

Click the pin icon next to any action in the action log to toggle a breakpoint. Breakpoints are persisted to `.stepwise/settings.json` via the server API, scoped per journey. They persist across browser sessions.

When a breakpoint is hit during execution, the test pauses before that action runs. The dashboard highlights the paused action and enables the Resume and Step buttons.

### Execution Controls

- **Run** — start executing selected journeys
- **Stop** — terminate the current test run
- **Resume** — continue execution from the current position
- **Step** — execute exactly one action, then pause again

Button states are managed by a finite state machine with six states: idle, running, paused, stepping, completed, and errored.

## Headless CI Execution

Run all journeys headless from the command line:

```bash
npx stepwise-automation run
```

Use the `--tool` flag to specify the browser engine:

```bash
npx stepwise-automation run --tool puppeteer
npx stepwise-automation run --tool playwright
```

### Exit Codes

- `0` — all journeys passed
- `1` — one or more journeys failed, or a configuration error occurred

Journeys execute sequentially. Execution stops on the first failure.

## CLI Reference

```
stepwise-automation <command> [options]

Commands:
  serve                Start the visual dashboard UI server (default)
  run [journeys...]    Run journeys headless (all or specific ones)

Options:
  --config <path>      Path to config file (default: auto-discover stepwise.config.ts)
  --tool <engine>      Browser engine: puppeteer or playwright
  --port <number>      Override the dashboard server port
  --headed             Run with a visible browser window in run mode
  --version            Print version number
  --help               Show help
```

### Examples

```bash
# Start the dashboard
npx stepwise-automation serve

# Start on a custom port
npx stepwise-automation serve --port 4000

# Run all journeys headless with Puppeteer
npx stepwise-automation run --tool puppeteer

# Run a specific journey
npx stepwise-automation run login

# Run with a custom config file
npx stepwise-automation run --config ./tests/stepwise.config.ts

# Run headless but show the browser window
npx stepwise-automation run --headed
```

## Browser Auto-Discovery

The runner automatically detects installed Chromium-based browsers by probing common installation paths on each platform. It also resolves the default user data directory for each browser, so the test runner can launch with your existing profile (bookmarks, extensions, etc.).

### Supported Browsers

| Browser | macOS | Windows | Linux |
|---------|-------|---------|-------|
| Google Chrome | ✓ | ✓ | ✓ |
| Brave Browser | ✓ | ✓ | ✓ |
| Microsoft Edge | ✓ | ✓ | ✓ |
| Chromium | ✓ | — | ✓ |

### User Data Directories

Setting `userDataDir` launches the browser with your existing profile, including all installed extensions (e.g. Redux DevTools), saved logins, and bookmarks. This is the recommended approach for local development.

The dashboard auto-detects both the browser executable path and user data directory on startup. You can also set them manually in the settings panel or in your config file.

Common user data directory locations:

| Browser | macOS | Windows | Linux |
|---------|-------|---------|-------|
| Google Chrome | `~/Library/Application Support/Google/Chrome` | `%LOCALAPPDATA%\Google\Chrome\User Data` | `~/.config/google-chrome` |
| Brave Browser | `~/Library/Application Support/BraveSoftware/Brave-Browser` | `%LOCALAPPDATA%\BraveSoftware\Brave-Browser\User Data` | `~/.config/BraveSoftware/Brave-Browser` |
| Microsoft Edge | `~/Library/Application Support/Microsoft Edge` | `%LOCALAPPDATA%\Microsoft\Edge\User Data` | `~/.config/microsoft-edge` |
| Chromium | `~/Library/Application Support/Chromium` | — | `~/.config/chromium` |

> **Note:** Without a `userDataDir`, Puppeteer launches a clean browser instance with no extensions. If you need Redux DevTools in that scenario, set `devtools.reduxPath` in your config to the extension's path.

If no system browsers are found, the package falls back to Puppeteer's bundled Chromium (if Puppeteer is installed).

## Test Data Lifecycle Hooks

When running multiple journeys, you often need to prepare and reset test data at various points. The runner supports four lifecycle hooks via the `testData` config:

| Hook | When it runs | Runs N times for N journeys |
|------|-------------|----------------------------|
| `globalSetup` | Once before all journeys start | 1 |
| `beforeEach` | Before each individual journey | N |
| `afterEach` | After each individual journey | N |
| `globalTeardown` | Once after all journeys complete | 1 |

### Step 1: Create the Hook Modules

Create a `helpers/` directory (or any name you like) in your test project and add your hook files. Each file must export a default async function, or a named export matching the hook name.

```
my-app-tests/
  helpers/
    global-setup.ts     ← runs once before all journeys
    before-each.ts      ← runs before each journey
    after-each.ts       ← runs after each journey
    global-teardown.ts  ← runs once after all journeys
  journeys/
    login.journey.ts
    checkout.journey.ts
  package.json
```

### Step 2: Write the Hook Modules

**globalSetup** — runs once before any journey starts. Use it for one-time setup like starting services or seeding a shared database.

```typescript
// helpers/global-setup.ts
export default async function globalSetup(): Promise<void> {
  const response = await fetch('http://localhost:3000/api/test-data/seed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      users: [
        { username: 'testuser', password: 'password123', email: 'test@example.com' },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Global setup failed: ${response.status} ${response.statusText}`);
  }

  console.log('Test data seeded successfully');
}
```

**beforeEach** — runs before every journey. Use it to ensure each journey starts from a known state.

```typescript
// helpers/before-each.ts
export default async function beforeEach(): Promise<void> {
  await fetch('http://localhost:3000/api/test-data/reset', { method: 'POST' });
  console.log('Test data reset for next journey');
}
```

**afterEach** — runs after every journey (even on failure). Use it to clean up data created by the journey that just ran.

```typescript
// helpers/after-each.ts
export default async function afterEach(): Promise<void> {
  await fetch('http://localhost:3000/api/sessions/clear', { method: 'POST' });
  console.log('Sessions cleared');
}
```

**globalTeardown** — runs once after all journeys complete. Use it for final cleanup like stopping services or removing test databases.

```typescript
// helpers/global-teardown.ts
export default async function globalTeardown(): Promise<void> {
  await fetch('http://localhost:3000/api/test-data/destroy', { method: 'POST' });
  console.log('Test environment torn down');
}
```

You can also use a named export instead of default:

```typescript
export async function beforeEach(): Promise<void> {
  await fetch('http://localhost:3000/api/test-data/reset', { method: 'POST' });
}
```

The runner tries `module.default`, then `module.<hookName>` (matching the hook name), then falls back to the module itself if it's a function.

### Step 3: Wire It Up in Config

Point to your hook files in `stepwise.config.ts`. Paths are resolved relative to the config file's directory.

```typescript
// stepwise.config.ts
import { defineConfig } from '@mechris3/stepwise-automation';

export default defineConfig({
  testData: {
    globalSetup: './helpers/global-setup.ts',
    beforeEach: './helpers/before-each.ts',
    afterEach: './helpers/after-each.ts',
    globalTeardown: './helpers/global-teardown.ts',
  },
});
```

Use only the hooks you need — all are optional:

```typescript
export default defineConfig({
  testData: {
    beforeEach: './helpers/reset-data.ts',
  },
});
```

### Execution Order

For a run with 3 journeys (A, B, C):

```
globalSetup() → beforeEach() → A → afterEach() → beforeEach() → B → afterEach() → beforeEach() → C → afterEach() → globalTeardown()
```

### Error Handling

If a hook throws an error:
- The error is logged to the console
- Execution continues to the next journey (hooks never stop the run)
- The journey itself is not marked as failed due to a hook error

### Common Patterns

**Direct database reset (beforeEach):**

```typescript
// helpers/before-each.ts
import { Pool } from 'pg';

const pool = new Pool({ connectionString: 'postgresql://localhost/myapp_test' });

export default async function beforeEach(): Promise<void> {
  await pool.query('TRUNCATE users, orders, sessions CASCADE');
}
```

**File-based fixtures (globalSetup):**

```typescript
// helpers/global-setup.ts
import * as fs from 'fs';
import * as path from 'path';

export default async function globalSetup(): Promise<void> {
  const fixtures = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'fixtures.json'), 'utf-8')
  );
  await fetch('http://localhost:3000/api/test-data/load', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fixtures),
  });
}
```

**Docker compose reset (afterEach):**

```typescript
// helpers/after-each.ts
import { execSync } from 'child_process';

export default async function afterEach(): Promise<void> {
  execSync('docker compose exec -T db psql -U postgres -c "SELECT reset_test_data()"', {
    stdio: 'inherit',
  });
}
```

## Project Structure

### Standalone Testing Project

```
my-app-tests/
  package.json
  stepwise.config.ts          ← optional
  helpers/
    global-setup.ts           ← optional: runs once before all journeys
    before-each.ts            ← optional: runs before each journey
    after-each.ts             ← optional: runs after each journey
    global-teardown.ts        ← optional: runs once after all journeys
  journeys/
    login.journey.ts
    checkout.journey.ts
  page-objects/
    login.page.ts
    checkout.page.ts
```

```json
{
  "dependencies": {
    "@mechris3/stepwise-automation": "^0.1.0",
    "puppeteer": "^22.0.0"
  },
  "scripts": {
    "test:ui": "stepwise-automation serve",
    "test:run": "stepwise-automation run"
  }
}
```

### Subfolder in an Existing Project

```
my-app/
  src/
  e2e/
    stepwise.config.ts        ← optional
    helpers/
      before-each.ts
    journeys/
      login.journey.ts
    page-objects/
      login.page.ts
```

Run from the subfolder:

```bash
cd e2e
npx stepwise-automation serve
```

All relative paths are resolved from the current working directory (or the config file's directory if `--config` is used).

## API Reference

All public exports from `@mechris3/stepwise-automation`:

### Configuration

- `defineConfig(config)` — type-safe config helper (returns config unchanged)
- `loadConfig(path?)` — load and validate a config file, returns `ResolvedConfig`
- `detectEngines()` — detect installed browser engines
- `StepwiseConfig` — config type (all fields optional)
- `ResolvedConfig` — resolved config type (`journeys` always a string)
- `BrowserConfig` — browser options type

### Adapters

- `BrowserAdapter` — unified browser automation interface
- `BaseAdapter` — abstract base class with pause/resume/step/breakpoint logic
- `PuppeteerAdapter` — Puppeteer implementation of `BrowserAdapter`
- `PlaywrightAdapter` — Playwright implementation of `BrowserAdapter`
- `DownloadResult` — return type for `clickAndDownload` containing `filePath` and `suggestedFilename`

### Page Objects

- `BasePage` — base page object class with convenience methods for element interaction
- `BrowserContextPage` — extended page object for session management, clipboard, file uploads

### Utilities

- `waitForCondition(fn, options?)` — poll until a condition is true
- `formatTestError(error)` — format errors for structured output
- `getErrorSummary(error)` — get a one-line error summary
- `withErrorContext(fn, context)` — wrap page object methods with error context

### IPC

- `writeCommand(command)` — write an IPC command to the temp file
- `readCommand()` — read and clear the current IPC command
- `clearCommands()` — clear any pending IPC commands
- `IpcCommand` — IPC command type

### Optional

- `findReduxDevToolsExtension()` — locate Redux DevTools browser extension

## License

MIT
