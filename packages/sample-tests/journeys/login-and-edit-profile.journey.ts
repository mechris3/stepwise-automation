import type { BrowserAdapter } from '@mechris3/stepwise-automation';
import { LoginPage } from '../page-objects/login.page';
import { ProfilePage } from '../page-objects/profile.page';

/**
 * Journey: Sign up, log in, and edit the user profile display name.
 */
export class LoginAndEditProfileJourney {
  constructor(private adapter: BrowserAdapter) {}

  async execute(): Promise<void> {
    const loginPage = new LoginPage(this.adapter);
    const profilePage = new ProfilePage(this.adapter);

    // Sign up first (fresh state after cleanup)
    await loginPage.navigateToApp();
    await loginPage.signup('profileuser', 'pass456', 'Original Name');
    await loginPage.waitForApp();

    // Navigate to profile tab
    await profilePage.navigateToProfile();

    // Update display name
    await profilePage.updateDisplayName('Updated Name');
    await profilePage.waitForSuccess();

    // Verify the header updated
    const headerName = await profilePage.getHeaderDisplayName();
    if (headerName !== 'Updated Name') {
      throw new Error(`Expected "Updated Name", got "${headerName}"`);
    }
  }
}
