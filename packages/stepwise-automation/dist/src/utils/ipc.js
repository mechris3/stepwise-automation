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
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeCommand = writeCommand;
exports.readCommand = readCommand;
exports.clearCommands = clearCommands;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
/**
 * File-based IPC for test runner ↔ adapter communication.
 *
 * Works across all process architectures (Puppeteer single-process,
 * Playwright worker processes) because it uses the filesystem instead
 * of signals or stdin pipes.
 *
 * The test executor writes commands to a temp file, and the BaseAdapter
 * polls it between actions.
 */
const IPC_FILE = path.join(os.tmpdir(), 'stepwise-ipc.json');
/**
 * Write a command to the IPC file (called by test executor).
 * No-op if the file cannot be written (locked, permissions, etc.).
 *
 * @param command - The IPC command to write
 */
function writeCommand(command) {
    try {
        fs.writeFileSync(IPC_FILE, JSON.stringify(command), 'utf-8');
    }
    catch {
        // Graceful degradation — IPC unavailable
    }
}
/**
 * Read and consume the command from the IPC file (called by adapter).
 * Returns `null` if no command is pending or the file is inaccessible.
 * The file is cleared atomically after reading to prevent duplicate consumption.
 *
 * @returns The pending command, or `null` if none
 */
function readCommand() {
    try {
        if (!fs.existsSync(IPC_FILE))
            return null;
        const content = fs.readFileSync(IPC_FILE, 'utf-8').trim();
        if (!content)
            return null;
        // Clear the file after reading (atomic read-and-clear)
        fs.writeFileSync(IPC_FILE, '', 'utf-8');
        return JSON.parse(content);
    }
    catch {
        return null;
    }
}
/**
 * Clear any pending commands (called at test start).
 */
function clearCommands() {
    try {
        if (fs.existsSync(IPC_FILE)) {
            fs.writeFileSync(IPC_FILE, '', 'utf-8');
        }
    }
    catch {
        // Graceful degradation
    }
}
//# sourceMappingURL=ipc.js.map