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
export declare function writeCommand(command: IpcCommand): void;
/**
 * Read and consume the command from the IPC file (called by adapter).
 * Returns `null` if no command is pending or the file is inaccessible.
 * The file is cleared atomically after reading to prevent duplicate consumption.
 *
 * @returns The pending command, or `null` if none
 */
export declare function readCommand(): IpcCommand | null;
/**
 * Clear any pending commands (called at test start).
 */
export declare function clearCommands(): void;
//# sourceMappingURL=ipc.d.ts.map