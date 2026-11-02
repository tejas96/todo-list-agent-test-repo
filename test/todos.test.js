import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addTodo, deleteTodo, deserialize, serialize, sortByDueDate, toggleTodo } from '../src/todos.js';

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

// Helper: build a todo with an explicit id, so tests do not depend on the
// shared nextId counter in src/todos.js.
const todo = (id, text, dueDate = null, done = false) => ({ id, text, done, dueDate });

// --- deleteTodo ---

test('deletes a todo by id (TC-AC2a-U1)', () => {
  const list = [todo(1, 'A'), todo(2, 'B')];
  const result = deleteTodo(list, 1);
  assert.deepEqual(result.map((t) => t.id), [2]);
  assert.equal(list.length, 2);
});

test('delete with an unknown id keeps the same items (TC-AC2b-U1)', () => {
  const list = [todo(1, 'A'), todo(2, 'B')];
  const result = deleteTodo(list, 99);
  assert.deepEqual(result, list);
});

test('delete returns a new array and leaves the input unchanged (TC-AC2-U1)', () => {
  const list = [todo(1, 'A'), todo(2, 'B')];
  const copy = structuredClone(list);
  const result = deleteTodo(list, 2);
  assert.notEqual(result, list);
  assert.deepEqual(list, copy);
});

test('deleting the only todo gives an empty list (TC-AC2-U2)', () => {
  assert.deepEqual(deleteTodo([todo(1, 'A')], 1), []);
});

test('a deleted todo is gone after save and load (TC-AC2-I1)', () => {
  const list = [todo(1, 'A'), todo(2, 'B')];
  const loaded = deserialize(serialize(deleteTodo(list, 1)));
  assert.deepEqual(loaded.map((t) => t.text), ['B']);
});

// --- addTodo with an optional due date ---

test('adds a todo without a due date (TC-AC4a-U1)', () => {
  const [t] = addTodo([], 'Buy milk');
  assert.equal(t.text, 'Buy milk');
  assert.equal(t.done, false);
  assert.equal(t.dueDate, null);
});

test('null or empty due date is stored as null (TC-AC4-U1)', () => {
  assert.equal(addTodo([], 'Buy milk', null)[0].dueDate, null);
  assert.equal(addTodo([], 'Buy milk', '')[0].dueDate, null);
  assert.equal(addTodo([], 'Buy milk', undefined)[0].dueDate, null);
});

test('every new todo has a dueDate property (TC-AC4-U2)', () => {
  const [t] = addTodo([], 'Buy milk');
  assert.ok(Object.hasOwn(t, 'dueDate'));
});

test('adds a todo with a due date stored unchanged (TC-AC5a-U1)', () => {
  const [t] = addTodo([], 'Pay rent', '2026-12-01');
  assert.equal(t.dueDate, '2026-12-01');
});

test('rejects an impossible calendar date (TC-AC5b-U1)', () => {
  assert.throws(() => addTodo([], 'X', '2026-02-30'), /Due date/);
  assert.throws(() => addTodo([], 'X', '2026-13-01'), /Due date/);
});

test('rejects a due date that is not YYYY-MM-DD (TC-AC5b-U2)', () => {
  assert.throws(() => addTodo([], 'X', 'tomorrow'), /Due date/);
  assert.throws(() => addTodo([], 'X', '12/01/2026'), /Due date/);
});

test('rejects a due date with surrounding spaces (TC-AC5b-U3)', () => {
  assert.throws(() => addTodo([], 'X', ' 2026-12-01'), /Due date/);
  assert.throws(() => addTodo([], 'X', '2026-12-01 '), /Due date/);
});

test('a rejected due date adds nothing and keeps the text rule (TC-AC5b-U1)', () => {
  const list = [todo(1, 'A')];
  assert.throws(() => addTodo(list, 'X', '2026-02-30'));
  assert.equal(list.length, 1);
  assert.throws(() => addTodo([], '   ', '2026-12-01'), /text is required/);
});

test('accepts a leap day only in a leap year (TC-AC5-U1)', () => {
  assert.equal(addTodo([], 'X', '2028-02-29')[0].dueDate, '2028-02-29');
  assert.throws(() => addTodo([], 'X', '2026-02-29'));
});

test('toggle keeps the due date (TC-AC5-U1)', () => {
  const [t] = addTodo([], 'Pay rent', '2026-12-01');
  assert.equal(toggleTodo([t], t.id)[0].dueDate, '2026-12-01');
});

// --- serialize / deserialize ---

test('due date survives save and load (TC-AC5-I1)', () => {
  const todos = addTodo(addTodo([], 'Pay rent', '2026-12-01'), 'Buy milk');
  const loaded = deserialize(serialize(todos));
  assert.deepEqual(loaded.map((t) => t.dueDate), ['2026-12-01', null]);
});

test('records saved before due dates load with dueDate null (TC-AC5c-I1)', () => {
  const loaded = deserialize('[{"id":1,"text":"Old","done":false}]');
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].text, 'Old');
  assert.equal(loaded[0].dueDate, null);
});

test('malformed stored due dates load as null (TC-AC5c-U2)', () => {
  const loaded = deserialize(
    '[{"id":1,"text":"A","done":false,"dueDate":"12/01/2026"},{"id":2,"text":"B","done":false,"dueDate":"2026-12-01"}]'
  );
  assert.equal(loaded[0].dueDate, null);
  assert.equal(loaded[1].dueDate, '2026-12-01');
});

// --- sortByDueDate ---

test('sorts by due date, ties by id, undated last (TC-AC6-U1)', () => {
  const list = [
    todo(1, 'C', '2026-12-10'),
    todo(2, 'N1'),
    todo(3, 'A', '2026-12-01'),
    todo(4, 'B', '2026-12-01'),
    todo(5, 'N2'),
  ];
  assert.deepEqual(sortByDueDate(list).map((t) => t.text), ['A', 'B', 'C', 'N1', 'N2']);
});

test('sort does not change the input array (TC-AC6-U2)', () => {
  const list = [todo(1, 'C', '2026-12-10'), todo(2, 'A', '2026-12-01')];
  const copy = structuredClone(list);
  const sorted = sortByDueDate(list);
  assert.notEqual(sorted, list);
  assert.deepEqual(list, copy);
});

test('a missing dueDate sorts as undated (TC-AC6-U3)', () => {
  const list = [{ id: 1, text: 'Old', done: false }, todo(2, 'A', '2026-12-01')];
  assert.deepEqual(sortByDueDate(list).map((t) => t.text), ['A', 'Old']);
});

test('completed todos follow the same rule (TC-AC6-U4)', () => {
  const list = [todo(1, 'Late', '2026-12-10'), todo(2, 'Early done', '2026-12-01', true), todo(3, 'None', null, true)];
  assert.deepEqual(sortByDueDate(list).map((t) => t.text), ['Early done', 'Late', 'None']);
});

test('sorting an empty list gives an empty list (TC-AC6-U5)', () => {
  assert.deepEqual(sortByDueDate([]), []);
});
