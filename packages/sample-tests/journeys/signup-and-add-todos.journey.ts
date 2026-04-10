import type { BrowserAdapter } from '@mechris3/stepwise-automation';
import { LoginPage } from '../page-objects/login.page';
import { TodoPage } from '../page-objects/todo.page';

/**
 * Journey: Sign up a new user, add todos, complete one, delete one.
 */
export class SignupAndAddTodosJourney {
  constructor(private adapter: BrowserAdapter) {}

  async execute(): Promise<void> {
    const loginPage = new LoginPage(this.adapter);
    const todoPage = new TodoPage(this.adapter);

    // Sign up a new user
    await loginPage.navigateToApp();
    await loginPage.signup('testuser', 'password123', 'Test User');
    await loginPage.waitForApp();

    // Verify we're logged in
    const name = await todoPage.getDisplayName();
    if (name !== 'Test User') {
      throw new Error(`Expected display name "Test User", got "${name}"`);
    }

    // Add some todos
    await todoPage.addTodo('Buy groceries');
    await todoPage.addTodo('Walk the dog');
    await todoPage.addTodo('Write some tests');

    // Check count
    const count = await todoPage.getTodoCount();
    if (!count.includes('3')) {
      throw new Error(`Expected 3 items, got: "${count}"`);
    }

    // Complete one todo
    await todoPage.toggleTodo(1);

    // Verify count updated
    const updatedCount = await todoPage.getTodoCount();
    if (!updatedCount.includes('2')) {
      throw new Error(`Expected 2 remaining items, got: "${updatedCount}"`);
    }

    // Delete a todo
    await todoPage.deleteTodo(2);
  }
}
