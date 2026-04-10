import { describe, it, expect } from 'vitest';
import { findReduxDevToolsExtension } from './redux-devtools';

describe('findReduxDevToolsExtension', () => {
  it('returns string or undefined without throwing', () => {
    const result = findReduxDevToolsExtension();
    expect(result === undefined || typeof result === 'string').toBe(true);
  });
});
