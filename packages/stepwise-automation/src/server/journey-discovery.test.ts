import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { discoverJourneys, getJourneyById, toTitleCase, Journey } from './journey-discovery';
import { ResolvedConfig } from '../config';

function makeConfig(journeys: string): ResolvedConfig {
  return {
    journeys,
  };
}

describe('toTitleCase', () => {
  it('converts kebab-case to Title Case', () => {
    expect(toTitleCase('user-login')).toBe('User Login');
  });

  it('handles single word', () => {
    expect(toTitleCase('login')).toBe('Login');
  });

  it('handles multiple segments', () => {
    expect(toTitleCase('add-new-question')).toBe('Add New Question');
  });
});

describe('discoverJourneys', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'journey-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('discovers .journey.ts files and returns sorted Journey array', async () => {
    fs.writeFileSync(path.join(tmpDir, 'user-login.journey.ts'), '');
    fs.writeFileSync(path.join(tmpDir, 'add-question.journey.ts'), '');

    const config = makeConfig(path.join(tmpDir, '*.journey.ts'));
    const journeys = await discoverJourneys(config);

    expect(journeys).toHaveLength(2);
    expect(journeys[0].id).toBe('add-question');
    expect(journeys[0].name).toBe('Add Question');
    expect(path.isAbsolute(journeys[0].path)).toBe(true);
    expect(journeys[1].id).toBe('user-login');
    expect(journeys[1].name).toBe('User Login');
  });

  it('returns empty array when no files match', async () => {
    const config = makeConfig(path.join(tmpDir, '*.journey.ts'));
    const journeys = await discoverJourneys(config);
    expect(journeys).toEqual([]);
  });

  it('only includes .ts files', async () => {
    fs.writeFileSync(path.join(tmpDir, 'login.journey.ts'), '');
    fs.writeFileSync(path.join(tmpDir, 'login.journey.js'), '');
    fs.writeFileSync(path.join(tmpDir, 'notes.txt'), '');

    const config = makeConfig(path.join(tmpDir, '*'));
    const journeys = await discoverJourneys(config);

    expect(journeys).toHaveLength(1);
    expect(journeys[0].id).toBe('login');
  });

  it('returns absolute paths', async () => {
    fs.writeFileSync(path.join(tmpDir, 'checkout.journey.ts'), '');

    const config = makeConfig(path.join(tmpDir, '*.journey.ts'));
    const journeys = await discoverJourneys(config);

    expect(path.isAbsolute(journeys[0].path)).toBe(true);
    expect(journeys[0].path).toBe(path.join(tmpDir, 'checkout.journey.ts'));
  });

  it('sorts results alphabetically by id', async () => {
    fs.writeFileSync(path.join(tmpDir, 'zebra.journey.ts'), '');
    fs.writeFileSync(path.join(tmpDir, 'alpha.journey.ts'), '');
    fs.writeFileSync(path.join(tmpDir, 'middle.journey.ts'), '');

    const config = makeConfig(path.join(tmpDir, '*.journey.ts'));
    const journeys = await discoverJourneys(config);

    expect(journeys.map(j => j.id)).toEqual(['alpha', 'middle', 'zebra']);
  });
});

describe('getJourneyById', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'journey-test-'));
    fs.writeFileSync(path.join(tmpDir, 'user-login.journey.ts'), '');
    fs.writeFileSync(path.join(tmpDir, 'checkout.journey.ts'), '');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns the matching journey', async () => {
    const config = makeConfig(path.join(tmpDir, '*.journey.ts'));
    const journey = await getJourneyById('user-login', config);

    expect(journey).not.toBeNull();
    expect(journey!.id).toBe('user-login');
    expect(journey!.name).toBe('User Login');
  });

  it('returns null for non-existent id', async () => {
    const config = makeConfig(path.join(tmpDir, '*.journey.ts'));
    const journey = await getJourneyById('nonexistent', config);
    expect(journey).toBeNull();
  });
});
