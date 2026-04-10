import express from 'express';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cors = require('cors');
import * as http from 'http';
import * as path from 'path';
import { WebSocketManager } from './websocket';
import { TestExecutor, RunConfig } from './test-executor';
import { discoverJourneys } from './journey-discovery';
import { setBreakpoints, getBreakpoints, clearBreakpoints } from './breakpoint-storage';
import { initSettingsStorage, readSettings, writeSettings, setFileBreakpoints, getFileBreakpoints, clearFileBreakpoints } from './settings-storage';
import { writeCommand } from '../utils/ipc';
import { discoverBrowsers } from '../utils/browser-discovery';
import { findReduxDevToolsExtension } from '../utils/redux-devtools';
import { ResolvedConfig } from '../config';

/**
 * Creates an Express server with REST API endpoints, WebSocket support,
 * and static file serving for the dashboard UI.
 *
 * @param config - Resolved stepwise config
 * @returns Object with `app`, `server`, and `start(port)` method
 */
export function createServer(config: ResolvedConfig) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Initialize file-based settings storage
  initSettingsStorage(process.cwd());

  // Serve pre-built dashboard UI static assets.
  // __dirname at runtime is dist/src/server/, so we go up 3 levels to package root.
  const uiPath = path.resolve(__dirname, '../../../ui');
  app.use(express.static(uiPath));

  // Create HTTP server from express app
  const server = http.createServer(app);

  // Attach WebSocket manager to HTTP server
  const wsManager = new WebSocketManager(server);

  // Create TestExecutor — default tool to first configured adapter
  const defaultTool: 'puppeteer' | 'playwright' =
    (config.adapters && config.adapters.length > 0 ? config.adapters[0] : 'puppeteer') as 'puppeteer' | 'playwright';
  let executor = new TestExecutor(config, wsManager, defaultTool);

  // --- REST API Endpoints ---

  // GET /api/journeys — discover and return journey list
  app.get('/api/journeys', async (_req, res) => {
    try {
      const journeys = await discoverJourneys(config);
      res.json({ journeys });
    } catch (error) {
      res.status(500).json({ error: 'Failed to discover journeys' });
    }
  });

  // POST /api/tests/run — start test execution
  app.post('/api/tests/run', (req, res) => {
    const { journeys, tool, config: runConfig } = req.body as {
      journeys: string[];
      tool?: 'puppeteer' | 'playwright';
      config?: RunConfig;
    };

    const selectedTool = tool || defaultTool;
    executor = new TestExecutor(config, wsManager, selectedTool);
    executor.run(journeys, runConfig);

    res.json({ status: 'started' });
  });

  // POST /api/tests/stop — stop current execution
  app.post('/api/tests/stop', (_req, res) => {
    executor.stop();
    res.json({ status: 'stopped' });
  });

  // POST /api/tests/pause — pause execution
  app.post('/api/tests/pause', (_req, res) => {
    executor.pause();
    res.json({ status: 'paused' });
  });

  // POST /api/tests/resume — resume execution
  app.post('/api/tests/resume', (_req, res) => {
    executor.resume();
    res.json({ status: 'resumed' });
  });

  // POST /api/tests/step — step forward N actions
  app.post('/api/tests/step', (req, res) => {
    const { count } = req.body as { count?: number };
    executor.step(count);
    res.json({ status: 'stepped' });
  });

  // POST /api/breakpoints — set breakpoints for a journey
  app.post('/api/breakpoints', (req, res) => {
    const { journey, breakpoints } = req.body as { journey: string; breakpoints: number[] };
    setBreakpoints(journey, breakpoints);
    setFileBreakpoints(journey, breakpoints);
    res.json({ status: 'saved' });
  });

  // GET /api/breakpoints/:journey — get breakpoints for a journey
  app.get('/api/breakpoints/:journey', (req, res) => {
    const journey = req.params.journey;
    // Prefer in-memory (set during this session), fall back to file
    let bp = getBreakpoints(journey);
    if (bp.length === 0) {
      bp = getFileBreakpoints(journey);
      // Hydrate in-memory from file
      if (bp.length > 0) setBreakpoints(journey, bp);
    }
    res.json({ journey, breakpoints: bp });
  });

  // DELETE /api/breakpoints/:journey — clear all breakpoints for a journey
  app.delete('/api/breakpoints/:journey', (req, res) => {
    const journey = req.params.journey;
    clearBreakpoints(journey);
    clearFileBreakpoints(journey);
    // Notify running child process so breakpoints take effect mid-run
    writeCommand({ type: 'config', breakpoints: [] });
    res.json({ status: 'cleared' });
  });

  // PATCH /api/config — forward live config update to running child process
  app.patch('/api/config', (req, res) => {
    const partialConfig = req.body as Partial<RunConfig>;
    executor.sendConfig(partialConfig);
    res.json({ status: 'updated' });
  });

  // GET /api/config/browser-path — auto-discover browser executable path
  app.get('/api/config/browser-path', (_req, res) => {
    const browsers = discoverBrowsers();
    const browserPath = browsers.length > 0 ? browsers[0].executablePath : null;
    res.json({ path: browserPath });
  });

  // GET /api/config/browsers — return all discovered browsers
  app.get('/api/config/browsers', (_req, res) => {
    const browsers = discoverBrowsers();
    res.json({ browsers });
  });

  // GET /api/config/redux-devtools-path — auto-discover Redux DevTools extension path
  app.get('/api/config/redux-devtools-path', (_req, res) => {
    const extensionPath = findReduxDevToolsExtension() || null;
    res.json({ path: extensionPath });
  });

  // GET /api/settings — read UI settings from .stepwise/settings.json
  app.get('/api/settings', (_req, res) => {
    try {
      const settings = readSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: 'Failed to read settings' });
    }
  });

  // PUT /api/settings — write UI settings to .stepwise/settings.json
  app.put('/api/settings', (req, res) => {
    try {
      writeSettings(req.body);
      res.json({ status: 'saved' });
    } catch (error) {
      console.error('[Server] Failed to write settings:', error);
      res.status(500).json({ error: 'Failed to write settings' });
    }
  });

  // --- start function ---

  /**
   * Starts the HTTP server on the given port.
   *
   * @param port - TCP port to listen on
   * @returns Resolves when the server is listening
   */
  function start(port: number): Promise<void> {
    return new Promise((resolve) => {
      server.listen(port, () => {
        console.log(`Stepwise Automation dashboard running at http://localhost:${port}`);
        resolve();
      });
    });
  }

  return { app, server, start };
}
