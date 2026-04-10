import { BasePage } from '@mechris3/stepwise-automation';

export class TodoPage extends BasePage {
  private selectors = {
    todosTab: '[data-testid="todos-tab"]',
    todoInput: '[data-testid="todo-input"]',
    addTodo: '[data-testid="add-todo"]',
    todoList: '[data-testid="todo-list"]',
    todoCount: '[data-testid="todo-count"]',
    displayName: '[data-testid="display-name"]',
    logoutBtn: '[data-testid="logout-btn"]',
  };

  async navigateToTodos(): Promise<void> {
    await this.click(this.selectors.todosTab);
  }

  async addTodo(text: string): Promise<void> {
    await this.fill(this.selectors.todoInput, text);
    await this.click(this.selectors.addTodo);
  }

  async getTodoCount(): Promise<string> {
    return this.getText(this.selectors.todoCount);
  }

  async getDisplayName(): Promise<string> {
    return this.getText(this.selectors.displayName);
  }

  async toggleTodo(id: number): Promise<void> {
    await this.click(`[data-testid="todo-checkbox-${id}"]`);
  }

  async deleteTodo(id: number): Promise<void> {
    await this.click(`[data-testid="todo-delete-${id}"]`);
  }

  async logout(): Promise<void> {
    await this.click(this.selectors.logoutBtn);
  }
}
