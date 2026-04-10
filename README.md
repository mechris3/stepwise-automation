# stepwise-automation

Debugger-style browser automation with live step-through execution, breakpoints, and a visual dashboard. Dual Puppeteer/Playwright support. Write journeys once, run them with either engine.

---

# Using @mechris3/stepwise-automation

This section is for developers who want to use the package in their own projects. For full API documentation, see the [package README](packages/stepwise-automation/README.md).

## 1. Set up your test project

Create a directory for your tests with subdirectories for journeys and page objects:

```bash
mkdir my-app-tests && cd my-app-tests
npm init -y
mkdir journeys page-objects
```

Add the package and a browser engine to your `package.json`:

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

Then install:

```bash
npm install
```

## 2. Create a page object

Page objects encapsulate selectors and interactions for a page. They extend `BasePage`, which provides `click`, `fill`, `goto`, `waitForSelector`, and other convenience methods — all delegated to the underlying `BrowserAdapter`.

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

## 3. Create a journey

Journeys are end-to-end user flows. The runner passes a `BrowserAdapter` to your constructor — you use it to create page objects.

```typescript
// journeys/login.journey.ts
import type { BrowserAdapter } from '@mechris3/stepwise-automation';
import { LoginPage } from '../page-objects/login.page';

export class LoginJourney {
  constructor(private adapter: BrowserAdapter) {}

  async execute(): Promise<void> {
    const loginPage = new LoginPage(this.adapter);

    await loginPage.navigateToApp();
    await loginPage.login('testuser', 'password123');
    await loginPage.waitForDashboard();
  }
}
```

## Available adapter methods

`BasePage` shorthand methods (all delegate to `this.adapter`):

- `navigateToApp()` — navigate to the app's target URL (reads from dashboard settings)
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

All 23 methods above make up the complete `BrowserAdapter` interface. Every method works with both Puppeteer and Playwright.```

Journey files must match `./journeys/**/*.journey.ts` (the default glob). The filename becomes the journey ID.

## 4. Start your application

Make sure the app you're testing is running:

```bash
# In another terminal
cd my-app
npm start
# App running on http://localhost:3000
```

## 5. Run the dashboard

```bash
cd my-app-tests
npm run test:ui
```

Open http://localhost:3001. Set the Target URL in the settings panel to your app's URL (e.g. `http://localhost:3000`). All settings persist to `.stepwise/settings.json` in your project directory. Select a journey and hit Run.

## 6. Run headless (CI)

```bash
npm run test:run
```

Exit code 0 = all passed, 1 = failure.

## Configuration (optional)

No config file is needed — the runner uses sensible defaults and all UI settings (target URL, viewport, browser path, etc.) persist automatically to `.stepwise/settings.json`. If you want to customize project-level defaults, create `stepwise.config.ts` via `npx stepwise-automation init`:

```typescript
import { defineConfig } from '@mechris3/stepwise-automation';

export default defineConfig({
  browser: {
    defaultViewport: { width: 1280, height: 720 },
  },
  testData: {
    beforeEach: './helpers/reset-data.ts',
  },
});
```

Hook files should export a default async function:

```typescript
// helpers/reset-data.ts
export default async function () {
  // Reset database, clear test data, etc.
}
```

Available hooks: `globalSetup` (once before all journeys), `beforeEach` (before each journey), `afterEach` (after each journey), `globalTeardown` (once after all journeys).

See the [package README](packages/stepwise-automation/README.md) for the full configuration reference, lifecycle hooks, CLI options, and API docs.

---

# Developing the Package

Everything below is for contributors working on `@mechris3/stepwise-automation` itself.

## Repo Structure

```
packages/
  stepwise-automation/   # The npm package (@mechris3/stepwise-automation)
  sample-app/            # Simple todo app to automate against
  sample-tests/          # Example consuming project with journeys + page objects
reference-test-runner/   # Original implementation (kept for reference during development)
docs/                    # Architecture docs
```

## Development Setup

### 1. Install dependencies

```bash
# Package
cd packages/stepwise-automation
npm install

# Sample app
cd ../sample-app
npm install

# Sample tests — link the package first, then install remaining deps
cd ../sample-tests
npm link @mechris3/stepwise-automation
npm install puppeteer
```

### 2. Run the tests

```bash
cd packages/stepwise-automation
npm test
```

### 3. Build the package

```bash
cd packages/stepwise-automation
npm run build
```

### 4. Dev mode (auto-restart on changes)

```bash
cd packages/stepwise-automation
npm run dev
```

This runs the dashboard server directly from TypeScript source via `tsx watch`. Save a `.ts` file and the server restarts automatically. UI files (HTML/CSS/JS) just need a browser refresh.

## Trying It End-to-End

### Terminal 1: Start the sample app

```bash
cd packages/sample-app
npm start
```

This runs a simple todo app on http://localhost:4200 with login, signup, todos, and profile editing.

### Terminal 2: Link the package and start the dashboard

```bash
# Build and link
cd packages/stepwise-automation
npm run build
npm link

# Wire up the consuming project
cd ../sample-tests
npm link @mechris3/stepwise-automation
npm install puppeteer

# Start the dashboard
npm run test:ui
```

Open http://localhost:3001 to see the dashboard. Select a journey and hit Run.

### Headless mode

```bash
cd packages/sample-tests
npm run test:run
```

## After Making Changes to the Package

For TypeScript source changes:
```bash
cd packages/stepwise-automation
npm run build
```

Then restart whatever is consuming it. Or use `npm run dev` for auto-restart during development.

UI files (`ui/` folder) are served statically — changes show up on browser refresh with no rebuild needed.

## npm Scripts Reference

| Package | Script | Description |
|---------|--------|-------------|
| `stepwise-automation` | `npm test` | Run all unit tests |
| `stepwise-automation` | `npm run build` | Compile TypeScript to `dist/` |
| `stepwise-automation` | `npm run dev` | Dashboard server with auto-restart |
| `stepwise-automation` | `npm run dev:run` | Headless run from source |
| `sample-app` | `npm start` | Start the todo app on port 4200 |
| `sample-tests` | `npm run test:ui` | Start the stepwise dashboard |
| `sample-tests` | `npm run test:run` | Run journeys headless |
