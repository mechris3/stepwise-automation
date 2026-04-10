import { describe, it, expect } from 'vitest';
import { withErrorContext } from './page-object-error';

describe('withErrorContext (legacy decorator)', () => {
  it('wraps errors with class and method context', async () => {
    class TestPage {
      async doSomething(): Promise<void> {
        throw new Error('Element not found');
      }
    }

    const instance = new TestPage();
    const descriptor: PropertyDescriptor = {
      value: instance.doSomething,
    };

    const result = withErrorContext(TestPage.prototype, 'doSomething', descriptor);
    const wrappedFn = result.value.bind(instance);

    await expect(wrappedFn()).rejects.toThrow('[TestPage.doSomething]\nElement not found');
  });

  it('preserves return value on success', async () => {
    class TestPage {
      async getValue(): Promise<string> {
        return 'hello';
      }
    }

    const instance = new TestPage();
    const descriptor: PropertyDescriptor = {
      value: instance.getValue,
    };

    const result = withErrorContext(TestPage.prototype, 'getValue', descriptor);
    const wrappedFn = result.value.bind(instance);

    expect(await wrappedFn()).toBe('hello');
  });
});

describe('withErrorContext (TC39 stage 3 decorator)', () => {
  it('wraps errors with class and method context', async () => {
    class TestPage {
      async doSomething(): Promise<void> {
        throw new Error('Timeout');
      }
    }

    const instance = new TestPage();
    const context = { name: 'doSomething', kind: 'method' };
    const wrapped = withErrorContext(instance.doSomething, context);
    const boundFn = wrapped.bind(instance);

    await expect(boundFn()).rejects.toThrow('[TestPage.doSomething]\nTimeout');
  });
});
