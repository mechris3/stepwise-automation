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
export declare function withErrorContext(...args: any[]): any;
//# sourceMappingURL=page-object-error.d.ts.map