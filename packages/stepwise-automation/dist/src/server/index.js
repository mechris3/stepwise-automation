"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createServer = createServer;
const express_1 = __importDefault(require("express"));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cors = require('cors');
const http = __importStar(require("http"));
const path = __importStar(require("path"));
const websocket_1 = require("./websocket");
const test_executor_1 = require("./test-executor");
const journey_discovery_1 = require("./journey-discovery");
const breakpoint_storage_1 = require("./breakpoint-storage");
const settings_storage_1 = require("./settings-storage");
const ipc_1 = require("../utils/ipc");
const browser_discovery_1 = require("../utils/browser-discovery");
const redux_devtools_1 = require("../utils/redux-devtools");
/**
 * Creates an Express server with REST API endpoints, WebSocket support,
 * and static file serving for the dashboard UI.
 *
 * @param config - Resolved stepwise config
 * @returns Object with `app`, `server`, and `start(port)` method
 */
function createServer(config) {
    const app = (0, express_1.default)();
    app.use(cors());
    app.use(express_1.default.json());
    // Initialize file-based settings storage
    (0, settings_storage_1.initSettingsStorage)(process.cwd());
    // Serve pre-built dashboard UI static assets.
    // __dirname at runtime is dist/src/server/, so we go up 3 levels to package root.
    const uiPath = path.resolve(__dirname, '../../../ui');
    app.use(express_1.default.static(uiPath));
    // Create HTTP server from express app
    const server = http.createServer(app);
    // Attach WebSocket manager to HTTP server
    const wsManager = new websocket_1.WebSocketManager(server);
    // Create TestExecutor — default tool to first configured adapter
    const defaultTool = (config.adapters && config.adapters.length > 0 ? config.adapters[0] : 'puppeteer');
    let executor = new test_executor_1.TestExecutor(config, wsManager, defaultTool);
    // --- REST API Endpoints ---
    // GET /api/journeys — discover and return journey list
    app.get('/api/journeys', async (_req, res) => {
        try {
            const journeys = await (0, journey_discovery_1.discoverJourneys)(config);
            res.json({ journeys });
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to discover journeys' });
        }
    });
    // POST /api/tests/run — start test execution
    app.post('/api/tests/run', (req, res) => {
        const { journeys, tool, config: runConfig } = req.body;
        const selectedTool = tool || defaultTool;
        executor = new test_executor_1.TestExecutor(config, wsManager, selectedTool);
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
        const { count } = req.body;
        executor.step(count);
        res.json({ status: 'stepped' });
    });
    // POST /api/breakpoints — set breakpoints for a journey
    app.post('/api/breakpoints', (req, res) => {
        const { journey, breakpoints } = req.body;
        (0, breakpoint_storage_1.setBreakpoints)(journey, breakpoints);
        (0, settings_storage_1.setFileBreakpoints)(journey, breakpoints);
        res.json({ status: 'saved' });
    });
    // GET /api/breakpoints/:journey — get breakpoints for a journey
    app.get('/api/breakpoints/:journey', (req, res) => {
        const journey = req.params.journey;
        // Prefer in-memory (set during this session), fall back to file
        let bp = (0, breakpoint_storage_1.getBreakpoints)(journey);
        if (bp.length === 0) {
            bp = (0, settings_storage_1.getFileBreakpoints)(journey);
            // Hydrate in-memory from file
            if (bp.length > 0)
                (0, breakpoint_storage_1.setBreakpoints)(journey, bp);
        }
        res.json({ journey, breakpoints: bp });
    });
    // DELETE /api/breakpoints/:journey — clear all breakpoints for a journey
    app.delete('/api/breakpoints/:journey', (req, res) => {
        const journey = req.params.journey;
        (0, breakpoint_storage_1.clearBreakpoints)(journey);
        (0, settings_storage_1.clearFileBreakpoints)(journey);
        // Notify running child process so breakpoints take effect mid-run
        (0, ipc_1.writeCommand)({ type: 'config', breakpoints: [] });
        res.json({ status: 'cleared' });
    });
    // PATCH /api/config — forward live config update to running child process
    app.patch('/api/config', (req, res) => {
        const partialConfig = req.body;
        executor.sendConfig(partialConfig);
        res.json({ status: 'updated' });
    });
    // GET /api/config/browser-path — auto-discover browser executable path
    app.get('/api/config/browser-path', (_req, res) => {
        const browsers = (0, browser_discovery_1.discoverBrowsers)();
        const browserPath = browsers.length > 0 ? browsers[0].executablePath : null;
        res.json({ path: browserPath });
    });
    // GET /api/config/browsers — return all discovered browsers
    app.get('/api/config/browsers', (_req, res) => {
        const browsers = (0, browser_discovery_1.discoverBrowsers)();
        res.json({ browsers });
    });
    // GET /api/config/redux-devtools-path — auto-discover Redux DevTools extension path
    app.get('/api/config/redux-devtools-path', (_req, res) => {
        const extensionPath = (0, redux_devtools_1.findReduxDevToolsExtension)() || null;
        res.json({ path: extensionPath });
    });
    // GET /api/settings — read UI settings from .stepwise/settings.json
    app.get('/api/settings', (_req, res) => {
        try {
            const settings = (0, settings_storage_1.readSettings)();
            res.json(settings);
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to read settings' });
        }
    });
    // PUT /api/settings — write UI settings to .stepwise/settings.json
    app.put('/api/settings', (req, res) => {
        try {
            (0, settings_storage_1.writeSettings)(req.body);
            res.json({ status: 'saved' });
        }
        catch (error) {
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
    function start(port) {
        return new Promise((resolve) => {
            server.listen(port, () => {
                console.log(`Stepwise Automation dashboard running at http://localhost:${port}`);
                resolve();
            });
        });
    }
    return { app, server, start };
}
//# sourceMappingURL=index.js.map