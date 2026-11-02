import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addTodo, deserialize, serialize, toggleTodo } from '../src/todos.js';

test('adds a todo', () => {
  const todos = addTodo([], 'Buy milk');
  assert.equal(todos.length, 1);
  assert.equal(todos[0].text, 'Buy milk');
  assert.equal(todos[0].done, false);
});

test('rejects an empty todo', () => {
  assert.throws(() => addTodo([], '   '));
});

test('toggles a todo', () => {
  const [t] = addTodo([], 'Walk');
  assert.equal(toggleTodo([t], t.id)[0].done, true);
});

test('saves and loads the list', () => {
  const todos = addTodo(addTodo([], 'A'), 'B');
  const loaded = deserialize(serialize(todos));
  assert.deepEqual(loaded.map((t) => t.text), ['A', 'B']);
});
