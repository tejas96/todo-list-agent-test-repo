// QA tests for TD-2, written to match "Test plan v2" case by case.
// Each test name starts with its plan case id. Data is made up.
// Tests that call addTodo read ids from its result, because nextId is
// shared across the module.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addTodo, deleteTodo, deserialize, serialize, sortByDueDate, toggleTodo } from '../src/todos.js';

const DUE_MSG = 'Due date must be a valid YYYY-MM-DD date';
const dueError = (err) => err instanceof Error && err.message === DUE_MSG;
const textError = (err) => err instanceof Error && err.message === 'Todo text is required';

const fiveTodos = () => [
  { id: 1, text: 'C', done: false, dueDate: '2026-12-10' },
  { id: 2, text: 'N1', done: false, dueDate: null },
  { id: 3, text: 'A', done: false, dueDate: '2026-12-01' },
  { id: 4, text: 'B', done: false, dueDate: '2026-12-01' },
  { id: 5, text: 'N2', done: false, dueDate: null },
];

// --- deleteTodo (AC2) ---

test('TC-AC2a-U1 test_deleteTodo_removes_matching_todo_without_mutating_input', () => {
  const list = [
    { id: 1, text: 'A', done: false, dueDate: null },
    { id: 2, text: 'B', done: false, dueDate: null },
  ];
  const result = deleteTodo(list, 1);
  assert.deepEqual(result, [{ id: 2, text: 'B', done: false, dueDate: null }]);
  assert.equal(list.length, 2);
  assert.equal(list[0].id, 1);
  assert.notEqual(result, list);
});

test('TC-AC2b-U1 test_deleteTodo_unknown_id_returns_same_items', () => {
  const list = [
    { id: 1, text: 'A', done: false, dueDate: null },
    { id: 2, text: 'B', done: false, dueDate: null },
  ];
  const before = structuredClone(list);
  const result = deleteTodo(list, 99);
  assert.deepEqual(result, list);
  assert.deepEqual(list, before);
});

test('TC-AC2-U1 test_deleteTodo_edge_cases_empty_and_last_item', () => {
  assert.deepEqual(deleteTodo([], 1), []);
  const list = [{ id: 5, text: 'Only', done: false, dueDate: null }];
  assert.deepEqual(deleteTodo(list, 5), []);
});

test('TC-AC2-U2 test_deleteTodo_keeps_other_todos_fields_and_order', () => {
  const list = [
    { id: 1, text: 'A', done: true, dueDate: '2026-12-01' },
    { id: 2, text: 'B', done: false, dueDate: null },
    { id: 3, text: 'C', done: false, dueDate: '2026-11-05' },
  ];
  const result = deleteTodo(list, 2);
  assert.deepEqual(result, [list[0], list[2]]);
  assert.deepEqual(result.map((t) => t.id), [1, 3]);
  assert.equal(result[0].done, true);
  assert.equal(result[0].dueDate, '2026-12-01');
  assert.equal(result[1].dueDate, '2026-11-05');
});

test('TC-AC2-I1 test_deleted_todo_absent_after_serialize_deserialize', () => {
  const todos = addTodo(addTodo([], 'A'), 'B');
  const idA = todos[0].id;
  const loaded = deserialize(serialize(deleteTodo(todos, idA)));
  assert.deepEqual(loaded.map((t) => t.text), ['B']);
});

// --- addTodo without a due date (AC4) ---

test('TC-AC4a-U1 test_addTodo_without_due_date_sets_dueDate_null', () => {
  const todos = addTodo([], 'Buy milk');
  assert.equal(todos.length, 1);
  assert.equal(todos[0].text, 'Buy milk');
  assert.equal(todos[0].done, false);
  assert.strictEqual(todos[0].dueDate, null);
});

test('TC-AC4-U1 test_addTodo_empty_null_undefined_due_date_stored_as_null', () => {
  for (const value of ['', null, undefined]) {
    let result;
    assert.doesNotThrow(() => {
      result = addTodo([], 'X', value);
    });
    assert.strictEqual(result[0].dueDate, null, `dueDate for ${String(value)}`);
  }
});

test('TC-AC4-U2 test_addTodo_still_rejects_empty_text_even_with_valid_date', () => {
  assert.throws(() => addTodo([], '   ', '2026-12-01'), textError);
  assert.throws(() => addTodo([], '', null), textError);
});

// --- addTodo with a due date (AC5) ---

test('TC-AC5a-U1 test_addTodo_stores_valid_due_date_string_unchanged', () => {
  const a = addTodo([], 'Pay rent', '2026-12-01')[0].dueDate;
  const b = addTodo([], 'New year', '2027-01-01')[0].dueDate;
  assert.strictEqual(a, '2026-12-01');
  assert.strictEqual(b, '2027-01-01');
  assert.equal(typeof a, 'string');
  assert.equal(typeof b, 'string');
});

test('TC-AC5b-U1 test_addTodo_rejects_invalid_due_date', () => {
  const list = [];
  for (const bad of ['2026-02-30', 'tomorrow', '2026-13-01', '2026-00-10', '2026-1-5', '2026-12-01T10:00']) {
    assert.throws(() => addTodo(list, 'X', bad), dueError, `expected rejection of ${bad}`);
  }
  assert.equal(list.length, 0);
});

test('TC-AC5b-U2 test_addTodo_due_date_calendar_boundaries', () => {
  assert.strictEqual(addTodo([], 'X', '2028-02-29')[0].dueDate, '2028-02-29');
  assert.throws(() => addTodo([], 'X', '2026-02-29'), Error);
  assert.strictEqual(addTodo([], 'X', '2026-12-31')[0].dueDate, '2026-12-31');
  assert.throws(() => addTodo([], 'X', '2026-04-31'), Error);
});

test('TC-AC5b-U3 test_addTodo_rejects_due_date_with_leading_or_trailing_spaces', () => {
  const list = [];
  assert.throws(() => addTodo(list, 'X', ' 2026-12-01'), dueError);
  assert.throws(() => addTodo(list, 'X', '2026-12-01 '), dueError);
  assert.equal(list.length, 0);
});

test('TC-AC5-U1 test_addTodo_accepts_past_due_date', () => {
  let todos;
  assert.doesNotThrow(() => {
    todos = addTodo([], 'Old task', '2000-01-01');
  });
  assert.strictEqual(todos[0].dueDate, '2000-01-01');
});

// --- serialize / deserialize (AC5, AC5c) ---

test('TC-AC5-I1 test_dueDate_survives_serialize_deserialize', () => {
  const todos = addTodo(addTodo([], 'Pay rent', '2026-12-01'), 'Buy milk');
  const loaded = deserialize(serialize(todos));
  assert.deepEqual(loaded.map((t) => [t.text, t.dueDate]), [
    ['Pay rent', '2026-12-01'],
    ['Buy milk', null],
  ]);
});

test('TC-AC5c-I1 test_deserialize_legacy_records_without_dueDate', () => {
  let loaded;
  assert.doesNotThrow(() => {
    loaded = deserialize('[{"id":1,"text":"Old","done":false}]');
  });
  assert.strictEqual(loaded[0].dueDate, null);
  const sorted = sortByDueDate([...loaded, { id: 2, text: 'Dated', done: false, dueDate: '2026-12-01' }]);
  assert.deepEqual(sorted.map((t) => t.text), ['Dated', 'Old']);
});

test('TC-AC5c-U2 test_deserialize_sets_malformed_stored_dueDate_to_null', () => {
  let loaded;
  assert.doesNotThrow(() => {
    loaded = deserialize(
      '[{"id":1,"text":"A","done":false,"dueDate":"12/01/2026"},{"id":2,"text":"B","done":false,"dueDate":"2026-12-01"}]'
    );
  });
  assert.strictEqual(loaded[0].dueDate, null);
  assert.strictEqual(loaded[1].dueDate, '2026-12-01');
});

// --- sortByDueDate (AC6) ---

test('TC-AC6-U1 test_sortByDueDate_orders_by_date_then_id_undated_last', () => {
  assert.deepEqual(sortByDueDate(fiveTodos()).map((t) => t.text), ['A', 'B', 'C', 'N1', 'N2']);
});

test('TC-AC6-U2 test_sortByDueDate_does_not_mutate_input', () => {
  const todos = fiveTodos();
  const result = sortByDueDate(todos);
  assert.deepEqual(todos.map((t) => t.id), [1, 2, 3, 4, 5]);
  assert.notEqual(result, todos);
});

test('TC-AC6-U3 test_sortByDueDate_tie_break_by_ascending_id_regardless_of_input_order', () => {
  const todos = [
    { id: 7, text: 'Z', done: false, dueDate: null },
    { id: 3, text: 'Y', done: false, dueDate: '2026-12-01' },
    { id: 1, text: 'X', done: false, dueDate: '2026-12-01' },
    { id: 2, text: 'W', done: false, dueDate: null },
  ];
  assert.deepEqual(sortByDueDate(todos).map((t) => t.id), [1, 3, 2, 7]);
});

test('TC-AC6-U4 test_sortByDueDate_across_month_and_year_boundaries', () => {
  const todos = [
    { id: 1, text: 'P', done: false, dueDate: '2027-01-01' },
    { id: 2, text: 'Q', done: false, dueDate: '2026-12-31' },
    { id: 3, text: 'R', done: false, dueDate: '2026-02-01' },
  ];
  assert.deepEqual(sortByDueDate(todos).map((t) => t.dueDate), ['2026-02-01', '2026-12-31', '2027-01-01']);
});

test('TC-AC6-U5 test_sortByDueDate_empty_all_undated_missing_and_done_todos', () => {
  assert.deepEqual(sortByDueDate([]), []);

  const undated = [
    { id: 3, text: 'U3', done: false, dueDate: null },
    { id: 1, text: 'U1', done: false, dueDate: null },
    { id: 2, text: 'U2', done: false, dueDate: null },
  ];
  assert.deepEqual(sortByDueDate(undated).map((t) => t.id), [1, 2, 3]);

  const withDone = [
    { id: 1, done: true, dueDate: '2026-12-05' },
    { id: 2, done: false, dueDate: '2026-12-01' },
  ];
  assert.deepEqual(sortByDueDate(withDone).map((t) => t.id), [2, 1]);

  const missingProp = [
    { id: 1, text: 'NoProp', done: false },
    { id: 2, text: 'D', done: false, dueDate: '2026-12-01' },
  ];
  assert.deepEqual(sortByDueDate(missingProp).map((t) => t.id), [2, 1]);
});

// --- regression ---

test('TC-REG-U1 test_toggleTodo_keeps_dueDate', () => {
  const todos = addTodo([], 'Pay rent', '2026-12-01');
  const toggled = toggleTodo(todos, todos[0].id);
  assert.equal(toggled[0].done, true);
  assert.strictEqual(toggled[0].dueDate, '2026-12-01');
});

test('TC-REG-U2 test_rejected_addTodo_does_not_consume_an_id', () => {
  const a = addTodo([], 'P');
  assert.throws(() => addTodo(a, 'X', '2026-02-30'), dueError);
  const b = addTodo(a, 'Q');
  assert.equal(b[1].id, a[0].id + 1);
});
