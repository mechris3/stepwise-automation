const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Simple in-memory store
const users = {};
let todos = [];
let nextTodoId = 1;

// Auth endpoints
app.post('/api/signup', (req, res) => {
  const { username, password, displayName } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  if (users[username]) return res.status(409).json({ error: 'User already exists' });
  users[username] = { username, password, displayName: displayName || username };
  res.json({ success: true, user: { username, displayName: users[username].displayName } });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = users[username];
  if (!user || user.password !== password) return res.status(401).json({ error: 'Invalid credentials' });
  res.json({ success: true, user: { username, displayName: user.displayName } });
});

// Profile endpoint
app.patch('/api/profile', (req, res) => {
  const { username, displayName } = req.body;
  if (!users[username]) return res.status(404).json({ error: 'User not found' });
  users[username].displayName = displayName;
  res.json({ success: true, user: users[username] });
});

// Todo endpoints
app.get('/api/todos', (req, res) => {
  res.json(todos);
});

app.post('/api/todos', (req, res) => {
  const { text, username } = req.body;
  if (!text) return res.status(400).json({ error: 'Text required' });
  const todo = { id: nextTodoId++, text, completed: false, username: username || 'anonymous' };
  todos.push(todo);
  res.json(todo);
});

app.patch('/api/todos/:id', (req, res) => {
  const todo = todos.find(t => t.id === parseInt(req.params.id));
  if (!todo) return res.status(404).json({ error: 'Not found' });
  if (req.body.completed !== undefined) todo.completed = req.body.completed;
  if (req.body.text !== undefined) todo.text = req.body.text;
  res.json(todo);
});

app.delete('/api/todos/:id', (req, res) => {
  todos = todos.filter(t => t.id !== parseInt(req.params.id));
  res.json({ success: true });
});

// Test data cleanup
app.post('/api/test-data/reset', (req, res) => {
  Object.keys(users).forEach(k => delete users[k]);
  todos = [];
  nextTodoId = 1;
  res.json({ success: true });
});

const PORT = process.env.PORT || 4200;
app.listen(PORT, () => console.log(`Sample app running on http://localhost:${PORT}`));
