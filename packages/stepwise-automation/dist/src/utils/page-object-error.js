"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withErrorContext = withErrorContext;
/**
 * Decorator that wraps a page object method to add context to errors.
 *
 * Supports both legacy (experimentalDecorators) and TC39 stage 3 decorator
 * signatures, so it works under both Puppeteer's tsx and Playwright's bundler.
 *
 * @example
 * class LoginPage extends BasePage {
 *   @withErrorContext
 *   async fillUsername(username: string): Promise<void> {
 *     await this.adapter.fill(this.selectors.usernameInput, username);
 *   }
 * }
 */
function withErrorContext(...args) {
    // TC39 stage 3 decorator: (value: Function, context: { name, kind, ... })
    if (typeof args[0] === 'function' &&
        args[1] &&
        typeof args[1] === 'object' &&
        'kind' in args[1]) {
        const originalMethod = args[0];
        const context = args[1];
        const methodName = String(context.name);
        return async function (...methodArgs) {
            try {
                return await originalMethod.apply(this, methodArgs);
            }
            catch (error) {
                const className = this.constructor.name;
                const originalMessage = error instanceof Error ? error.message : String(error);
                const enhancedError = new Error(`\n[${className}.${methodName}]\n${originalMessage}`);
                if (error instanceof Error && error.stack) {
                    const originalStack = error.stack.split('\n').slice(1).join('\n');
                    enhancedError.stack = `Error: \n[${className}.${methodName}]\n${originalMessage}\n${originalStack}`;
                }
                throw enhancedError;
            }
        };
    }
    // Legacy decorator: (target, propertyKey, descriptor)
    const [, propertyKey, descriptor] = args;
    const originalMethod = descriptor.value;
    descriptor.value = async function (...methodArgs) {
        try {
            return await originalMethod.apply(this, methodArgs);
        }
        catch (error) {
            const className = this.constructor.name;
            const originalMessage = error instanceof Error ? error.message : String(error);
            const enhancedError = new Error(`\n[${className}.${propertyKey}]\n${originalMessage}`);
            if (error instanceof Error && error.stack) {
                const originalStack = error.stack.split('\n').slice(1).join('\n');
                enhancedError.stack = `Error: \n[${className}.${propertyKey}]\n${originalMessage}\n${originalStack}`;
            }
            throw enhancedError;
        }
    };
    return descriptor;
}
//# sourceMappingURL=page-object-error.js.map