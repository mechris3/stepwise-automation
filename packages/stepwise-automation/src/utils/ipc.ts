import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

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

/** Command payload exchanged between the test executor and the adapter via IPC. */
export interface IpcCommand {
  /** The command type: pause/resume execution, step forward, or update config. */
  type: 'pause' | 'resume' | 'step' | 'config';
  /** Number of actions to execute before re-pausing (step mode). */
  stepsRemaining?: number;
  /** Delay in milliseconds between actions (slow mode). */
  actionDelay?: number;
  /** Additional arbitrary fields for config updates. */
  [key: string]: any;
}

/**
 * Write a command to the IPC file (called by test executor).
 * No-op if the file cannot be written (locked, permissions, etc.).
 *
 * @param command - The IPC command to write
 */
export function writeCommand(command: IpcCommand): void {
  try {
    fs.writeFileSync(IPC_FILE, JSON.stringify(command), 'utf-8');
  } catch {
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
export function readCommand(): IpcCommand | null {
  try {
    if (!fs.existsSync(IPC_FILE)) return null;
    const content = fs.readFileSync(IPC_FILE, 'utf-8').trim();
    if (!content) return null;
    // Clear the file after reading (atomic read-and-clear)
    fs.writeFileSync(IPC_FILE, '', 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Clear any pending commands (called at test start).
 */
export function clearCommands(): void {
  try {
    if (fs.existsSync(IPC_FILE)) {
      fs.writeFileSync(IPC_FILE, '', 'utf-8');
    }
  } catch {
    // Graceful degradation
  }
}
