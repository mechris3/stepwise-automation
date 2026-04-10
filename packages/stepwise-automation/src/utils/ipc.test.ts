import { describe, it, expect, beforeEach } from 'vitest';
import { writeCommand, readCommand, clearCommands, IpcCommand } from './ipc';

describe('IPC Module', () => {
  beforeEach(() => {
    clearCommands();
  });

  it('writeCommand then readCommand returns the command', () => {
    const cmd: IpcCommand = { type: 'pause' };
    writeCommand(cmd);
    const result = readCommand();
    expect(result).toEqual(cmd);
  });

  it('readCommand returns null when no command is pending', () => {
    expect(readCommand()).toBeNull();
  });

  it('readCommand clears the command after reading', () => {
    writeCommand({ type: 'resume' });
    readCommand();
    expect(readCommand()).toBeNull();
  });

  it('handles step command with stepsRemaining', () => {
    const cmd: IpcCommand = { type: 'step', stepsRemaining: 3 };
    writeCommand(cmd);
    const result = readCommand();
    expect(result).toEqual(cmd);
    expect(result?.stepsRemaining).toBe(3);
  });

  it('handles config command with actionDelay', () => {
    const cmd: IpcCommand = { type: 'config', actionDelay: 500 };
    writeCommand(cmd);
    const result = readCommand();
    expect(result).toEqual(cmd);
    expect(result?.actionDelay).toBe(500);
  });

  it('clearCommands removes pending commands', () => {
    writeCommand({ type: 'pause' });
    clearCommands();
    expect(readCommand()).toBeNull();
  });

  it('last write wins when multiple commands are written', () => {
    writeCommand({ type: 'pause' });
    writeCommand({ type: 'resume' });
    const result = readCommand();
    expect(result?.type).toBe('resume');
  });
});
