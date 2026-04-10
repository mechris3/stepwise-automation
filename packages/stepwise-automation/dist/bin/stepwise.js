#!/usr/bin/env node
"use strict";
/**
 * CLI entry point for @mechris3/stepwise-automation.
 *
 * Usage:
 *   npx @mechris3/stepwise-automation              → starts UI server (default)
 *   npx @mechris3/stepwise-automation serve         → starts UI server
 *   npx @mechris3/stepwise-automation run           → runs all journeys headless
 *   npx @mechris3/stepwise-automation run login     → runs specific journey(s)
 *   npx @mechris3/stepwise-automation --config path → custom config path
 *   npx @mechris3/stepwise-automation --version     → print version
 */
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
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const path = __importStar(require("path"));
const config_1 = require("../src/config");
const index_1 = require("../src/server/index");
const child_process_1 = require("child_process");
// Read version from package.json
// When compiled, this file lives at dist/bin/stepwise.js so we need ../../package.json.
// When run from source, it lives at bin/stepwise.ts so ../package.json works.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = (() => {
    try {
        return require('../../package.json');
    }
    catch {
        return require('../package.json');
    }
})();
const program = new commander_1.Command();
program
    .name('stepwise-automation')
    .description('Debugger-style browser automation test runner')
    .version(pkg.version);
// Global options available to all commands
program
    .option('--config <path>', 'path to config file', undefined)
    .option('--tool <engine>', 'browser engine: puppeteer or playwright', undefined)
    .option('--port <number>', 'UI server port', undefined)
    .option('--headed', 'run in headed mode (for run command)', false);
// ── "serve" command (default when no command given) ─────────────────────
program
    .command('serve', { isDefault: true })
    .description('Start the visual dashboard UI server')
    .action(async () => {
    const opts = program.opts();
    try {
        const config = await (0, config_1.loadConfig)(opts.config);
        const port = opts.port ? parseInt(opts.port, 10) : (config.server?.port ?? 3001);
        const server = (0, index_1.createServer)(config);
        await server.start(port);
    }
    catch (error) {
        handleFatalError(error);
    }
});
// ── "run" command ───────────────────────────────────────────────────────
program
    .command('run [journeys...]')
    .description('Run journeys headless (all or specific ones)')
    .action(async (journeys) => {
    const opts = program.opts();
    try {
        const config = await (0, config_1.loadConfig)(opts.config);
        // Determine which tool to use
        const tool = resolveEngine(opts.tool, config.adapters);
        // Set headed mode in environment if requested
        if (opts.headed) {
            process.env.HEADLESS = 'false';
        }
        else {
            process.env.HEADLESS = 'true';
        }
        if (tool === 'puppeteer') {
            await runPuppeteer(journeys, opts.config);
        }
        else {
            await runPlaywright(journeys, config);
        }
    }
    catch (error) {
        handleFatalError(error);
    }
});
/**
 * Resolve which browser engine to use.
 * Priority: `--tool` flag → first configured adapter → first detected engine.
 *
 * @param toolFlag - Value of the `--tool` CLI flag, if provided
 * @param configuredAdapters - Adapters listed in the config file
 * @returns The resolved engine name
 */
function resolveEngine(toolFlag, configuredAdapters) {
    if (toolFlag) {
        if (toolFlag !== 'puppeteer' && toolFlag !== 'playwright') {
            console.error(`Error: Invalid tool "${toolFlag}". Must be "puppeteer" or "playwright".`);
            process.exit(1);
        }
        // Verify the requested tool is actually installed
        const installed = (0, config_1.detectEngines)();
        if (!installed.includes(toolFlag)) {
            console.error(`Error: "${toolFlag}" is not installed. Install it with: npm install ${toolFlag}`);
            process.exit(1);
        }
        return toolFlag;
    }
    if (configuredAdapters && configuredAdapters.length > 0) {
        return configuredAdapters[0];
    }
    const installed = (0, config_1.detectEngines)();
    if (installed.length === 0) {
        console.error('No browser engine found. Install puppeteer or playwright.');
        process.exit(1);
    }
    return installed[0];
}
/**
 * Run journeys using Puppeteer by spawning `run-all-journeys.ts` with tsx loaders.
 *
 * @param journeys - Journey IDs to run (empty array = all)
 * @param configPath - Optional explicit config file path
 * @returns Resolves when the child process exits (calls `process.exit`)
 */
function runPuppeteer(journeys, configPath) {
    return new Promise((resolve, reject) => {
        const runnerPath = path.resolve(__dirname, '../src/runners/puppeteer/run-all-journeys.ts');
        const tsxEsmPath = 'file://' + require.resolve('tsx/esm');
        const args = ['--require', require.resolve('tsx/cjs'), '--import', tsxEsmPath, runnerPath, ...journeys];
        const child = (0, child_process_1.spawn)(process.execPath, args, {
            stdio: 'inherit',
            env: {
                ...process.env,
                ...(configPath ? { STEPWISE_CONFIG: path.resolve(configPath) } : {}),
            },
        });
        child.on('close', (code) => {
            process.exit(code ?? 1);
        });
        child.on('error', (err) => {
            console.error('Failed to start Puppeteer runner:', err.message);
            process.exit(1);
        });
    });
}
/**
 * Run journeys using Playwright by spawning `npx playwright test`.
 *
 * @param journeys - Journey IDs to filter via `--grep` (empty array = all)
 * @param config - Resolved config (used for future extension)
 * @returns Resolves when the child process exits (calls `process.exit`)
 */
function runPlaywright(journeys, config) {
    return new Promise((resolve, reject) => {
        const playwrightConfigPath = path.resolve(__dirname, '../src/runners/playwright/playwright.config.ts');
        const args = ['playwright', 'test', '--config', playwrightConfigPath];
        // If specific journeys requested, add grep filter
        if (journeys.length > 0) {
            args.push('--grep', journeys.join('|'));
        }
        const child = (0, child_process_1.spawn)('npx', args, {
            stdio: 'inherit',
            env: {
                ...process.env,
            },
        });
        child.on('close', (code) => {
            process.exit(code ?? 1);
        });
        child.on('error', (err) => {
            console.error('Failed to start Playwright runner:', err.message);
            process.exit(1);
        });
    });
}
/**
 * Handle fatal errors: print a clear message and exit with code 1.
 *
 * @param error - The caught error (may be an Error instance or any value)
 */
function handleFatalError(error) {
    if (error instanceof Error) {
        console.error(`Error: ${error.message}`);
    }
    else {
        console.error('Error:', error);
    }
    process.exit(1);
}
// ── "init" command ──────────────────────────────────────────────────────
program
    .command('init')
    .description('Scaffold a stepwise.config.ts file in the current directory')
    .action(async () => {
    const fs = require('fs');
    const configPath = path.resolve(process.cwd(), 'stepwise.config.ts');
    if (fs.existsSync(configPath)) {
        console.log('stepwise.config.ts already exists — skipping.');
        return;
    }
    const template = `import { defineConfig } from '@mechris3/stepwise-automation';

export default defineConfig({});
`;
    fs.writeFileSync(configPath, template, 'utf-8');
    console.log('Created stepwise.config.ts');
});
// ── Parse and execute ───────────────────────────────────────────────────
program.parse(process.argv);
//# sourceMappingURL=stepwise.js.map