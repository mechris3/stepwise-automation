import { BasePage } from '@mechris3/stepwise-automation';

export class LoginPage extends BasePage {
  private selectors = {
    authSection: '[data-testid="auth-section"]',
    loginTab: '[data-testid="login-tab"]',
    signupTab: '[data-testid="signup-tab"]',
    loginUsername: '[data-testid="login-username"]',
    loginPassword: '[data-testid="login-password"]',
    loginSubmit: '[data-testid="login-submit"]',
    loginError: '[data-testid="login-error"]',
    signupUsername: '[data-testid="signup-username"]',
    signupPassword: '[data-testid="signup-password"]',
    signupDisplayName: '[data-testid="signup-display-name"]',
    signupSubmit: '[data-testid="signup-submit"]',
    signupError: '[data-testid="signup-error"]',
    appSection: '[data-testid="app-section"]',
  };

  async login(username: string, password: string): Promise<void> {
    await this.click(this.selectors.loginTab);
    await this.fill(this.selectors.loginUsername, username);
    await this.fill(this.selectors.loginPassword, password);
    await this.click(this.selectors.loginSubmit);
  }

  async signup(username: string, password: string, displayName: string): Promise<void> {
    await this.click(this.selectors.signupTab);
    await this.fill(this.selectors.signupUsername, username);
    await this.fill(this.selectors.signupPassword, password);
    await this.fill(this.selectors.signupDisplayName, displayName);
    await this.click(this.selectors.signupSubmit);
  }

  async waitForApp(): Promise<void> {
    await this.waitForSelector(this.selectors.appSection);
  }

  async getLoginError(): Promise<string> {
    return this.getText(this.selectors.loginError);
  }
}
