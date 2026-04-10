import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as http from 'http';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import express from 'express';
import { setBreakpoints, getBreakpoints, clearBreakpoints, clearAll as clearAllInMemory } from './breakpoint-storage';
import {
  initSettingsStorage,
  setFileBreakpoints,
  getFileBreakpoints,
  clearFileBreakpoints,
} from './settings-storage';

// ─────────────────────────────────────────────────────────────────────────────
// Helper: create a minimal Express app with just the DELETE endpoint
// ─────────────────────────────────────────────────────────────────────────────

function createTestApp() {
  const app = express();
  app.use(express.json());

  app.delete('/api/breakpoints/:journey', (req, res) => {
    const journey = req.params.journey;
    clearBreakpoints(journey);
    clearFileBreakpoints(journey);
    res.json({ status: 'cleared' });
  });

  return app;
}

/**
 * Make an HTTP request to the test server and return { status, body }.
 */
function request(
  server: http.Server,
  method: string,
  urlPath: string,
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const port = (server.address() as any).port;
    const req = http.request(
      { hostname: '127.0.0.1', port, path: urlPath, method },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          resolve({ status: res.statusCode!, body: JSON.parse(data) });
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

// ═══════════════════════════════════════════════════════════════════════
// 8.1 — DELETE /api/breakpoints/:journey clears in-memory and file
//        breakpoints and returns 200
// Validates: Requirements 3.2, 3.3, 5.1, 5.2, 5.3
// ═══════════════════════════════════════════════════════════════════════

describe('DELETE /api/breakpoints/:journey', () => {
  let server: http.Server;
  let tmpDir: string;

  beforeEach(async () => {
    clearAllInMemory();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clear-bp-endpoint-'));
    initSettingsStorage(tmpDir);

    const app = createTestApp();
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('clears in-memory and file breakpoints and returns 200 (Req 5.1, 5.2, 5.3)', async () => {
    // Populate both stores
    setBreakpoints('login-journey', [1, 3, 5]);
    setFileBreakpoints('login-journey', [1, 3, 5]);
    setBreakpoints('other-journey', [2, 4]);
    setFileBreakpoints('other-journey', [2, 4]);

    const { status, body } = await request(server, 'DELETE', '/api/breakpoints/login-journey');

    expect(status).toBe(200);
    expect(body).toEqual({ status: 'cleared' });

    // In-memory breakpoints for target journey are cleared
    expect(getBreakpoints('login-journey')).toEqual([]);

    // File breakpoints for target journey are cleared
    expect(getFileBreakpoints('login-journey')).toEqual([]);

    // Other journey is untouched in both stores
    expect(getBreakpoints('other-journey')).toEqual([2, 4]);
    expect(getFileBreakpoints('other-journey')).toEqual([2, 4]);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 8.2 — DELETE endpoint returns 200 for a journey with no existing
  //        breakpoints (idempotent)
  // Validates: Requirement 5.4
  // ═══════════════════════════════════════════════════════════════════════

  it('returns 200 for a journey with no existing breakpoints (Req 5.4)', async () => {
    const { status, body } = await request(server, 'DELETE', '/api/breakpoints/nonexistent-journey');

    expect(status).toBe(200);
    expect(body).toEqual({ status: 'cleared' });

    // Stores remain empty / unaffected
    expect(getBreakpoints('nonexistent-journey')).toEqual([]);
    expect(getFileBreakpoints('nonexistent-journey')).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 8.3 — clearFileBreakpoints removes only the target journey from
//        persisted settings
// Validates: Requirements 3.3, 5.3
// ═══════════════════════════════════════════════════════════════════════

describe('clearFileBreakpoints isolation', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clear-bp-file-unit-'));
    initSettingsStorage(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('removes only the target journey and preserves others (Req 3.3, 5.3)', () => {
    setFileBreakpoints('journey-a', [1, 2, 3]);
    setFileBreakpoints('journey-b', [10, 20]);
    setFileBreakpoints('journey-c', [7]);

    clearFileBreakpoints('journey-b');

    expect(getFileBreakpoints('journey-a')).toEqual([1, 2, 3]);
    expect(getFileBreakpoints('journey-b')).toEqual([]);
    expect(getFileBreakpoints('journey-c')).toEqual([7]);
  });

  it('is safe to call on a journey that was never persisted', () => {
    setFileBreakpoints('journey-a', [1, 2]);

    // Should not throw
    clearFileBreakpoints('never-existed');

    // Existing journey is untouched
    expect(getFileBreakpoints('journey-a')).toEqual([1, 2]);
  });

  it('clears the journey completely from the settings file', () => {
    setFileBreakpoints('journey-x', [5, 10, 15]);

    clearFileBreakpoints('journey-x');

    // Reading back returns empty
    expect(getFileBreakpoints('journey-x')).toEqual([]);

    // Verify the key is actually removed from the JSON (not just set to [])
    const settingsPath = path.join(tmpDir, '.stepwise', 'settings.json');
    const raw = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    expect(raw.breakpoints).toBeDefined();
    expect('journey-x' in raw.breakpoints).toBe(false);
  });
});
