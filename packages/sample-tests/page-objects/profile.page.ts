import { BasePage } from '@mechris3/stepwise-automation';

export class ProfilePage extends BasePage {
  private selectors = {
    profileTab: '[data-testid="profile-tab"]',
    displayNameInput: '[data-testid="profile-display-name"]',
    saveButton: '[data-testid="save-profile"]',
    successMessage: '[data-testid="profile-success"]',
    headerDisplayName: '[data-testid="display-name"]',
  };

  async navigateToProfile(): Promise<void> {
    await this.click(this.selectors.profileTab);
  }

  async updateDisplayName(name: string): Promise<void> {
    await this.fill(this.selectors.displayNameInput, name);
    await this.click(this.selectors.saveButton);
  }

  async waitForSuccess(): Promise<void> {
    await this.waitForSelector(this.selectors.successMessage);
  }

  async getHeaderDisplayName(): Promise<string> {
    return this.getText(this.selectors.headerDisplayName);
  }
}
